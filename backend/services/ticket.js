// Removed circular dependency import

// actually server.js is in root, so path is ../../server
// But requiring server.js might re-run the server code. Ideally DB should be in backend/db/index.js.
// For now, I'll use a safer approach: I'll accept 'db' as dependency or move DB connection to its own file.
// Let's quickly refactor DB connection to backend/db/index.js to avoid issues.

const { sendEmail } = require('./email');

const isValidTransactionId = (id) => /^pay_[a-zA-Z0-9]+$/.test(id);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createTicket = (db, email, transactionId, issueDescription, callback) => {
    if (!isValidEmail(email)) {
        return callback(new Error("Invalid Email Format"));
    }
    if (transactionId && !isValidTransactionId(transactionId)) {
        return callback(new Error("Invalid Transaction ID Format (must start with pay_...)"));
    }

    const sql = `INSERT INTO tickets (email, transaction_id, issue_description) VALUES (?, ?, ?)`;
    db.run(sql, [email, transactionId, issueDescription], function (err) {
        if (err) {
            return callback(err);
        }
        const ticketId = this.lastID;

        // Send Emails
        const userSubject = `Ticket Created: #${ticketId}`;
        const userBody = `Hi,\n\nYour ticket has been raised successfully with ID: ${ticketId}.\nWe will get back to you shortly.\n\nIssue: ${issueDescription}`;
        sendEmail(email, userSubject, userBody);

        const adminSubject = `New Ticket #${ticketId} from ${email}`;
        const adminBody = `A new ticket has been raised.\n\nUser: ${email}\nTransaction ID: ${transactionId || 'N/A'}\nIssue: ${issueDescription}`;
        sendEmail('emailarathirk@gmail.com', adminSubject, adminBody);

        callback(null, ticketId);
    });
};

module.exports = { createTicket, isValidTransactionId, isValidEmail };
