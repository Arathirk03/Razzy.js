const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'razzy.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Tickets table
        db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            user_email TEXT,
            issue_details TEXT,
            status TEXT DEFAULT 'OPEN',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Feedback table
        db.run(`CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT,
            rating INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Conversations table
        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            full_log TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Transactions table (Mock Data)
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            amount INTEGER,
            status TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
             // Seed mock transactions
             const stmt = db.prepare("INSERT OR IGNORE INTO transactions (id, amount, status) VALUES (?, ?, ?)");
             stmt.run("pay_12345", 500, "captured");
             stmt.run("pay_67890", 1200, "failed");
             stmt.run("pay_abcde", 150, "refunded");
             stmt.finalize();
        });
    });
}

module.exports = db;
