const db = require('../db/database');
const { sendEmail } = require('./mailer');
const crypto = require('crypto');

// Razorpay ID format regex
const RAZORPAY_ID_REGEX = /^pay_[a-zA-Z0-9]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateTransactionId(id) {
    return RAZORPAY_ID_REGEX.test(id);
}

function validateEmail(email) {
    return EMAIL_REGEX.test(email);
}

function createTicket(email, issueDetails, callback) {
    const ticketId = 'tic_' + crypto.randomBytes(4).toString('hex');

    const stmt = db.prepare("INSERT INTO tickets (id, user_email, issue_details) VALUES (?, ?, ?)");
    stmt.run(ticketId, email, issueDetails, function (err) {
        if (err) {
            console.error("DB Error:", err);
            callback(err, null);
            return;
        }

        // Send Emails
        // 1. To User
        sendEmail(email, `Ticket Raised: ${ticketId}`, `Hello,\n\nYour ticket for the issue: "${issueDetails}" has been raised. Ticket ID: ${ticketId}.\n\nRazzy Support.`);

        // 2. To Admin (Razorpay Org)
        sendEmail('emailarathirk@gmail.com', `New Ticket: ${ticketId}`, `User: ${email}\nIssue: ${issueDetails}\nTicket ID: ${ticketId}`);

        callback(null, ticketId);
    });
    stmt.finalize();
}

function checkTransactionStatus(txnId, callback) {
    db.get("SELECT * FROM transactions WHERE id = ?", [txnId], (err, row) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, row);
        }
    });
}

/**
 * Heuristic to check if an issue is "critical" enough for a ticket.
 * Simple keyword check for now, can be LLM powered too.
 */
function isCriticalIssue(text) {
    const criticalKeywords = ['failed', 'deducted', 'debited', 'missing', 'fraud', 'stuck', 'pending', 'refund', 'urgent'];
    return criticalKeywords.some(w => text.toLowerCase().includes(w));
}

module.exports = {
    validateTransactionId,
    validateEmail,
    createTicket,
    checkTransactionStatus,
    isCriticalIssue
};
