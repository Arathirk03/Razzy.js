const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./backend/db');
const guardrails = require('./backend/middleware/guardrails');
const { findRelevantContext } = require('./backend/services/rag');
const { createTicket, isValidEmail, isValidTransactionId } = require('./backend/services/ticket');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory session store
const sessions = {};

const STATES = {
    IDLE: 'IDLE',
    AWAITING_DETAILS: 'AWAITING_DETAILS',
    AWAITING_TX_FOR_DIAGNOSIS: 'AWAITING_TX_FOR_DIAGNOSIS',
    OFFER_TICKET: 'OFFER_TICKET',
    OFFER_AGENT: 'OFFER_AGENT',
    CHECK_SATISFACTION_POST_TICKET: 'CHECK_SATISFACTION_POST_TICKET',
    AWAITING_ANYTHING_ELSE: 'AWAITING_ANYTHING_ELSE',
    AWAITING_FEEDBACK: 'AWAITING_FEEDBACK'
};

// Helper: safe markdown bold
const bold = (text) => `<b>${text}</b>`;

// Helper: Simulate Status Check
const getSimulatedStatus = (txId) => {
    // Heuristic: If ID ends with '1' or '3' or '5' -> Pending/Solvable
    const lastChar = txId.slice(-1);
    if (['1', '3', '5', '7', '9'].includes(lastChar)) {
        return {
            solvable: true,
            status: "Pending",
            tat: "24-48 hours",
            message: `Current status is ${bold("Pending")}. This is usually processed within 24-48 hours. Please check back after that time.`
        };
    } else {
        return {
            solvable: false,
            status: "Failed",
            tat: null,
            message: `Current status is ${bold("Failed")} or ${bold("Stuck")}. This requires manual intervention.`
        };
    }
};

app.post('/api/chat', guardrails, (req, res) => {
    const { message, sessionId } = req.body;

    if (!sessionId) return res.status(400).json({ error: "Session ID required" });

    if (!sessions[sessionId]) {
        sessions[sessionId] = { state: STATES.IDLE, data: {}, history: [] };
    }

    const session = sessions[sessionId];
    const msgLower = message.toLowerCase();

    // Save User Message
    db.run(`INSERT INTO conversation_history (session_id, user_message) VALUES (?, ?)`, [sessionId, message]);
    session.history.push({ role: 'user', content: message });

    let botResponse = "";

    // --- State Machine ---

    if (session.state === STATES.AWAITING_FEEDBACK) {
        const rating = parseInt(message.match(/\d+/)?.[0]);
        if (rating >= 1 && rating <= 5) {
            botResponse = "Thank you for your feedback! If you need anything else, I'm here.";
            db.run(`INSERT INTO feedback (rating, comment) VALUES (?, ?)`, [rating, session.data.lastIssue || "General"]);
        } else {
            botResponse = "Thanks! Accessing menu...";
        }
        session.state = STATES.IDLE;
        session.data = {};

    } else if (session.state === STATES.AWAITING_ANYTHING_ELSE) {
        if (['no', 'nah', 'nope', 'good', 'nothing', 'bye'].some(w => msgLower.includes(w))) {
            botResponse = "Okay. Before you go, please rate your experience from 1 to 5.";
            session.state = STATES.AWAITING_FEEDBACK;
        } else if (['yes', 'yeah', 'sure'].includes(msgLower)) {
            botResponse = "Sure, what else can I help you with?";
            session.state = STATES.IDLE;
        } else {
            // Assume they are asking something new
            // Fallback to IDLE logic by re-processing? 
            // For simplicity, treat as IDLE but we need to run the IDLE logic. 
            // We can just reset to IDLE and process, but since we are in `if/else` block, we can't easily jump.
            // Let's just say:
            botResponse = "I am listening. How can I help?";
            session.state = STATES.IDLE;
        }

    } else if (session.state === STATES.AWAITING_TX_FOR_DIAGNOSIS) {
        if (isValidTransactionId(message)) {
            session.data.transactionId = message; // Store it
            const result = getSimulatedStatus(message);
            if (result.solvable) {
                botResponse = `${result.message}\n\nSince this is within the expected timeframe, you don't need to raise a ticket. Does this answer your query? (Reply ${bold("Yes")} or ${bold("No")})`;
                session.state = STATES.OFFER_TICKET; // Re-use this state to check satisfaction
                session.data.waitingForSatisfaction = true;
            } else {
                botResponse = `${result.message}\n\nWe should raise a ticket for this. Would you like to proceed? (Reply ${bold("Yes")} or ${bold("No")})`;
                session.state = STATES.OFFER_TICKET;
                session.data.waitingForSatisfaction = false;
            }
        } else if (['cancel', 'no', 'stop'].includes(msgLower)) {
            botResponse = "Okay. How else can I help you?";
            session.state = STATES.IDLE;
        } else {
            botResponse = `That doesn't look like a valid ID. It should start with ${bold("pay_")}. (Or type 'cancel')`;
        }

    } else if (session.state === STATES.OFFER_TICKET) {
        // User responding to "Do you want to raise a ticket?" OR "Does this answer your query?"

        if (session.data.waitingForSatisfaction) {
            // Case: Solvable Diagnosis. asking if satisfied.
            if (['yes', 'sure', 'yeah'].includes(msgLower)) {
                botResponse = "Great! Is there anything else I can help you with?";
                session.state = STATES.AWAITING_ANYTHING_ELSE;
                session.data = {};
            } else {
                // Not satisfied -> Offer Ticket
                botResponse = `I understand you still have concerns. Would you like to ${bold("raise a ticket")} for this?`;
                session.data.waitingForSatisfaction = false;
            }
        } else {
            // Case: Offering Ticket explicitly
            if (['yes', 'sure', 'ok'].includes(msgLower)) {
                botResponse = `Okay, let's raise a ticket. Please provide your ${bold("Email ID")}.`;
                session.state = STATES.AWAITING_DETAILS;
            } else {
                // User declined Ticket -> Offer Live Agent
                botResponse = `Okay. Would you like to connect to a ${bold("Live Agent")} instead?`;
                session.state = STATES.OFFER_AGENT;
            }
        }

    } else if (session.state === STATES.CHECK_SATISFACTION_POST_TICKET) {
        if (['yes', 'sure', 'yeah'].includes(msgLower)) {
            botResponse = "Great! Is there anything else I can help you with?";
            session.state = STATES.AWAITING_ANYTHING_ELSE;
        } else {
            botResponse = `I'm sorry to hear that. Would you like to connect to a ${bold("Live Agent")} for further assistance?`;
            session.state = STATES.OFFER_AGENT;
        }

    } else if (session.state === STATES.OFFER_AGENT) {
        if (['yes', 'sure', 'please', 'ok'].includes(msgLower)) {
            // Simulate Handoff
            const historyText = session.history.map(m => `${m.role}: ${m.content}`).join("\n");
            console.log(`[AGENT HANDOFF] Sending history for Session ${sessionId}:\n${historyText}`);

            botResponse = `Connecting you to a live agent... ⏳\n\nI have shared your conversation history so they know the context. An agent will be with you shortly.\n\nBefore you go, please rate your experience with me from 1 to 5.`;
            session.state = STATES.AWAITING_FEEDBACK;
            session.data = {};
        } else {
            botResponse = "Okay. Let me know if you need anything else.";
            session.state = STATES.IDLE;
        }

    } else if (session.state === STATES.AWAITING_DETAILS) {
        // Ticket Creation Flow
        if (!session.data.email) {
            if (isValidEmail(message)) {
                session.data.email = message;
                if (session.data.transactionId) {
                    botResponse = `Thanks. Please briefly describe the ${bold("issue")}.`;
                } else {
                    botResponse = `Thanks. Now, please provide the ${bold("Transaction ID")} (starting with ${bold("pay_...")}).`;
                }
            } else {
                botResponse = `That doesn't look like a valid email. Please provide a valid ${bold("email address")}.`;
            }
        } else if (!session.data.transactionId) {
            if (isValidTransactionId(message)) {
                session.data.transactionId = message;
                botResponse = `Got it. Please briefly describe the ${bold("issue")}.`;
            } else if (msgLower.includes('skip') || msgLower.includes('no')) {
                botResponse = `I need a valid ${bold("Transaction ID")} starting with ${bold("pay_")} to proceed.`;
            } else {
                botResponse = `Invalid format. Transaction ID must start with ${bold("pay_")}.`;
            }
        } else if (!session.data.issueDescription) {
            session.data.issueDescription = message;
            createTicket(db, session.data.email, session.data.transactionId, session.data.issueDescription, (err, ticketId) => {
                if (err) {
                    botResponse = "Sorry, something went wrong.";
                    session.state = STATES.IDLE;
                } else {
                    botResponse = `Ticket raised successfully! Ticket ID: ${bold(ticketId)}. Check your email.\n\nAre you satisfied with this resolution? (Reply ${bold("Yes")} or ${bold("No")})`;
                    session.data.lastIssue = session.data.issueDescription;
                    session.state = STATES.CHECK_SATISFACTION_POST_TICKET;
                }
                sendResponse(res, sessionId, botResponse, session);
            });
            return;
        }

    } else {
        // IDLE STATE - IMPLICIT INTENT DETECTION

        // Priority 0: Small Talk & Greetings (Handled first to avoid "Short Query" filtering)
        if (['hi', 'hello', 'hey', 'ho'].includes(msgLower)) {
            botResponse = "Hello! I am Razzy. How can I help you today?";
        } else if (['thanks', 'thank you', 'thx'].includes(msgLower)) {
            botResponse = "You're welcome!";
        } else if (['yes', 'ok', 'done'].includes(msgLower)) {
            botResponse = "Great!";
        } else if (msgLower.includes('agent') || msgLower.includes('human')) {
            botResponse = `Would you like to connect to a ${bold("Live Agent")}?`;
            session.state = STATES.OFFER_AGENT;

        } else if (msgLower.includes('ticket') || msgLower.includes('raise')) {
            session.state = STATES.AWAITING_DETAILS;
            botResponse = `I can help you raise a ticket. First, please provide your ${bold("Email ID")}.`;

        } else {
            // Priority 1: Check for Transaction Status Intent (Specific keywords)
            if (['failed', 'stuck', 'pending', 'deducted', 'missing'].some(w => msgLower.includes(w)) || (msgLower.includes('status') && msgLower.includes('check'))) {
                botResponse = `I can check the status for you. Please provide the ${bold("Transaction ID")} (starting with ${bold("pay_...")}).`;
                session.state = STATES.AWAITING_TX_FOR_DIAGNOSIS;
                session.data.clarificationRequested = false;
            } else {

                // Priority 2: Short Query Clarification (Pre-RAG)
                if (message.split(/\s+/).filter(w => w.length > 0).length < 3) {
                    botResponse = "Could you please provide a few more details so I can assist you better?";
                    // We don't change state, just ask.
                }
                else {
                    // Priority 3: Check Knowledge Base (RAG) for any query
                    const context = findRelevantContext(message);

                    if (context) {
                        botResponse = `${context}\n\nDoes this answer your query? (Reply ${bold("Yes")} or ${bold("No")})`;
                        session.state = STATES.OFFER_TICKET;
                        session.data.waitingForSatisfaction = true;
                        session.data.clarificationRequested = false;
                    }
                    // Priority 4: Ambiguous Payment Query (Fallback)
                    else if (msgLower.includes('payment') || msgLower.includes('transaction') || msgLower.includes('money') || msgLower.includes('refund') || msgLower.includes('status')) {
                        if (session.data.clarificationRequested) {
                            // We already asked, now we offer ticket
                            botResponse = `I see. Would you like to ${bold("raise a ticket")} for this issue?`;
                            session.state = STATES.OFFER_TICKET;
                            session.data.waitingForSatisfaction = false;
                            session.data.clarificationRequested = false;
                        } else {
                            // Ask for details first
                            botResponse = `Could you please provide more details about the issue you are facing with ${bold("Razorpay")}?`;
                            session.data.clarificationRequested = true;
                        }
                    } else {
                        // Fallback
                        botResponse = `I'm not sure. Would you like to check a ${bold("transaction status")} or connect to an ${bold("agent")}?`;
                    }
                }
            }
        }
    }

    sendResponse(res, sessionId, botResponse, session);
});

function sendResponse(res, sessionId, botResponse, session) {
    db.run(`INSERT INTO conversation_history (session_id, bot_response) VALUES (?, ?)`, [sessionId, botResponse]);
    if (session) session.history.push({ role: 'bot', content: botResponse });

    const responsePayload = { response: botResponse };
    if (session && session.state === STATES.AWAITING_FEEDBACK) {
        responsePayload.feedbackRequest = true;
    }

    res.json(responsePayload);
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { app };
