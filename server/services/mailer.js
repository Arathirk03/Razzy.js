const nodemailer = require('nodemailer');

// Mock Transport if no credentials
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'ethereal.user@ethereal.email', // Generated ethereal user
        pass: 'verysecret' // Generated ethereal password
    }
});

async function sendEmail(to, subject, text) {
    try {
        // In a real app, use environment variables for real SMTP
        // For now, we will log the email attempt
        console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`);

        // If credentials exist, send real email (commented out for local safety unless env provided)
        /*
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
             // Use real transporter
        }
        */
        return true;
    } catch (error) {
        console.error("Email error:", error);
        return false;
    }
}

module.exports = { sendEmail };
