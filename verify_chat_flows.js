const assert = require('assert');

const API_URL = 'http://localhost:3000/api/chat';

async function testFlow(name, steps) {
    console.log(`\n--- Testing Flow: ${name} ---`);
    const sessionId = `test_${Date.now()}`;

    for (const step of steps) {
        process.stdout.write(`User: ${step.input} -> `);
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, message: step.input })
            });
            const data = await res.json();
            const botResponse = data.response;
            console.log(`Bot: ${botResponse.slice(0, 50)}...`); // Truncate for readability

            if (step.expectedContains) {
                if (!botResponse.toLowerCase().includes(step.expectedContains.toLowerCase())) {
                    console.error(`FAILED: Expected response to include "${step.expectedContains}", but got:\n${botResponse}`);
                    return false;
                }
            }
        } catch (error) {
            console.error(`FAILED: Error sending request: ${error.message}`);
            return false;
        }
    }
    console.log("PASSED");
    return true;
}

async function runTests() {
    // Scenario 1: Payment Query -> Clarification -> Raise Ticket -> Satisfied
    await testFlow("Payment -> Ticket -> Satisfied", [
        { input: "I have a payment issue", expectedContains: "details" }, // Asks for details
        { input: "I want to raise a ticket", expectedContains: "Email" }, // User explicitly asks for ticket
        { input: "test@example.com", expectedContains: "Transaction ID" },
        { input: "pay_1234567891", expectedContains: "issue" },
        { input: "Money deducted but failed", expectedContains: "Ticket raised" },
        { input: "Yes", expectedContains: "rate" }
    ]);

    // Scenario 2: Diagnosis -> Ticket -> Not Satisfied -> Agent
    await testFlow("Diagnosis -> Ticket -> Not Satisfied -> Agent", [
        { input: "Transaction failed", expectedContains: "Transaction ID" }, // Specific intent
        { input: "pay_1234567892", expectedContains: "Failed" },
        { input: "Yes", expectedContains: "Email" },
        { input: "test2@example.com", expectedContains: "issue" },
        { input: "Still failing", expectedContains: "Ticket raised" },
        { input: "No", expectedContains: "Live Agent" },
        { input: "Yes", expectedContains: "rate" } // Expect agent handoff + rating request
    ]);

    // Scenario 3: Ambiguous Payment Info -> Clarification
    await testFlow("Ambiguous Payment Info -> Clarification", [
        { input: "payment information", expectedContains: "details" }, // Short query -> Clarification
        { input: "Yes", expectedContains: "Great" }
    ]);

    // Scenario 4: Solvable Status -> Satisfied
    await testFlow("Solvable Status -> Satisfied", [
        { input: "Check status", expectedContains: "Transaction ID" },
        { input: "pay_101", expectedContains: "Pending" },
        { input: "Yes", expectedContains: "rate" } // Satisfied -> Rating
    ]);

    // Scenario 5: Info Query -> Answer -> Ticket
    await testFlow("Info Query -> Answer -> Ticket", [
        { input: "When will my money be refunded?", expectedContains: "working days" },
        { input: "No", expectedContains: "raise a ticket" },
        { input: "Yes", expectedContains: "Email" }
    ]);

    // Scenario 6: KB Check - Integration & Webhooks
    await testFlow("KB Check: Integration & Webhooks", [
        { input: "How to integrate with React?", expectedContains: "SDKs" },
        { input: "Yes", expectedContains: "rate" } // Satisfied -> Rating
    ]);

    await testFlow("KB Check: Webhooks", [
        { input: "What is payment.captured?", expectedContains: "Webhooks" },
        { input: "Yes", expectedContains: "rate" } // Satisfied -> Rating
    ]);

    // Scenario 7: KB Check - Pricing
    await testFlow("KB Check: Pricing", [
        { input: "What are the fees?", expectedContains: "2%" },
        { input: "Yes", expectedContains: "rate" } // Satisfied -> Rating
    ]);

    // Scenario 8: Clarification - Ambiguous Payment
    await testFlow("Clarification: Ambiguous Payment", [
        { input: "payment issue", expectedContains: "details" }, // Short query
        { input: "money gone", expectedContains: "details" } // Ambiguous fallback also asks details first
    ]);

    // Scenario 9: Clarification - Short Query
    await testFlow("Clarification: Short Query", [
        { input: "refund", expectedContains: "details" },
        { input: "When will I get my refund?", expectedContains: "working days" }
    ]);

}

runTests();
