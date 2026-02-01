const assert = require('assert');

const API_URL = 'http://localhost:3000/api/chat';

async function verifyFlag() {
    console.log("--- Verifying Feedback Flag ---");
    const sessionId = `test_flag_${Date.now()}`;

    // Step 1: Start Solvable Flow
    // "Check status" -> "pay_..." (ending in 1 -> Solvable)

    // 1. Check Status
    await send(sessionId, "Check status");

    // 2. Provide Solvable ID
    // Ending in 1 => Pending/Solvable => "Does this answer your query?"
    const res2 = await send(sessionId, "pay_111111111");

    // 3. Say Yes (Satisfied)
    // Should transition to AWAITING_ANYTHING_ELSE (No feedbackRequest yet)
    const res3 = await send(sessionId, "Yes");
    console.log("Response 3 (Should be 'Anything else?'):", res3.response);

    if (res3.feedbackRequest) {
        console.error("FAILURE: feedbackRequest shouldn't be here yet.");
        process.exit(1);
    }

    // 4. Say No (Nothing else)
    // Should transition to AWAITING_FEEDBACK and send feedbackRequest: true
    const res4 = await send(sessionId, "No");

    console.log("Response 4:", JSON.stringify(res4));

    if (res4.feedbackRequest === true) {
        console.log("SUCCESS: feedbackRequest flag received correctly at the end.");
    } else {
        console.error("FAILURE: feedbackRequest flag MISSING.");
        process.exit(1);
    }
}

async function send(sessionId, message) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message })
    });
    return await res.json();
}

verifyFlag();
