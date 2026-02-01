require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

const db = require('./db/database');
const { checkGuardrail } = require('./services/guardrail');
const { getRAGResponse } = require('./services/rag');
const { validateTransactionId, validateEmail, createTicket, checkTransactionStatus, isCriticalIssue } = require('./services/ticket');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI if API Key is present
let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Store conversation state in memory for simple session management
// In production, use Redis or Database with Session IDs
const sessions = {};

/**
 * POST /api/chat
 * Body: { message: string, sessionId: string }
 */
app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            state: 'IDLE', // IDLE, WAITING_FOR_EMAIL, WAITING_FOR_TXN, WAITING_FOR_DETAILS
            history: [],
            tempData: {}
        };
    }
    const session = sessions[sessionId];
    session.history.push({ role: 'user', content: message });

    // 1. Check for specific commands based on state
    if (session.state === 'WAITING_FOR_EMAIL') {
        if (validateEmail(message)) {
            session.tempData.email = message;
            session.state = 'WAITING_FOR_TXN';
            const botMsg = "Thanks. Now, please provide the Transaction ID (starting with 'pay_').";
            session.history.push({ role: 'assistant', content: botMsg });
            return res.json({ response: botMsg });
        } else {
            const botMsg = "That doesn't look like a valid email. Please try again.";
            return res.json({ response: botMsg });
        }
    }

    if (session.state === 'WAITING_FOR_TXN') {
        if (validateTransactionId(message)) {
            session.tempData.txnId = message;
            // logic to create ticket now if we have details, or ask for details
            session.state = 'WAITING_FOR_DETAILS';
            const botMsg = "Got it. **Please briefly describe the issue** so I can raise a ticket.";
            session.history.push({ role: 'assistant', content: botMsg });
            return res.json({ response: botMsg });
        } else {
            const botMsg = "Invalid Transaction ID format. It should start with 'pay_' followed by alphanumeric characters.";
            return res.json({ response: botMsg });
        }
    }

    if (session.state === 'WAITING_FOR_DETAILS') {
        const email = session.tempData.email;
        const txnId = session.tempData.txnId; // currently unused in createTicket params but useful for context
        const details = message + ` (Txn ID: ${txnId})`;

        createTicket(email, details, (err, ticketId) => {
            if (err) {
                const botMsg = "Something went wrong while creating the ticket. Please try again later.";
                session.state = 'IDLE';
                return res.json({ response: botMsg });
            }
            session.state = 'IDLE';
            // Save conversation to DB
            const log = JSON.stringify(session.history);
            db.run("INSERT INTO conversations (id, full_log) VALUES (?, ?)", [ticketId, log]); // Using ticketId as convo ID for simplicity here, or random

            const botMsg = `Done. Ticket raised successfully! Your Ticket ID is **${ticketId}**. You will receive an email confirmation shortly. How would you rate this interaction?`;
            session.history.push({ role: 'assistant', content: botMsg });
            return res.json({ response: botMsg, askFeedback: true });
        });
        return;
    }

    // 2. Normal Flow: Guardrail Check
    const guard = await checkGuardrail(message, openai);

    if (!guard.isSafe) {
        const botMsg = "I can only help with Razorpay related queries. Please ask me about payments, refunds, or technical issues.";
        session.history.push({ role: 'assistant', content: botMsg });
        return res.json({ response: botMsg });
    }

    if (guard.type === 'greeting') {
        // Simple greeting response
        const greetings_responses = ["Hi there! I'm Razzy. How can I help you with Razorpay today?", "Hello! Need help with payments?"];
        const botMsg = greetings_responses[Math.floor(Math.random() * greetings_responses.length)];
        session.history.push({ role: 'assistant', content: botMsg });
        return res.json({ response: botMsg });
    }

    // 3. Check for specific intent: Transaction Status
    if (message.toLowerCase().includes('status') && message.includes('pay_')) {
        // Extract pay_ ID
        const match = message.match(/pay_[a-zA-Z0-9]+/);
        if (match) {
            checkTransactionStatus(match[0], (err, row) => {
                if (row) {
                    const botMsg = `Transaction ${match[0]} is currently **${row.status.toUpperCase()}**. Amount: ₹${row.amount}.`;
                    session.history.push({ role: 'assistant', content: botMsg });
                    res.json({ response: botMsg });
                } else {
                    const botMsg = `I couldn't find any transaction with ID ${match[0]}.`;
                    session.history.push({ role: 'assistant', content: botMsg });
                    res.json({ response: botMsg });
                }
            });
            return;
        }
    }

    // 4. Critical Issue Diagnosis -> Start Ticket Flow
    if (isCriticalIssue(message)) {
        session.state = 'WAITING_FOR_EMAIL';
        const botMsg = "I understand this is an important issue. I can help you raise a support ticket. **Please provide your registered Email ID** to proceed.";
        session.history.push({ role: 'assistant', content: botMsg });
        return res.json({ response: botMsg });
    }

    // 5. General Inquiry -> RAG
    const answer = await getRAGResponse(message, openai);
    session.history.push({ role: 'assistant', content: answer });
    res.json({ response: answer });
});

/**
 * POST /api/feedback
 */
app.post('/api/feedback', (req, res) => {
    const { rating, sessionId } = req.body;
    db.run("INSERT INTO feedback (conversation_id, rating) VALUES (?, ?)", [sessionId, rating], (err) => {
        if (err) console.error(err);
        res.json({ status: 'success' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
