async function checkGuardrail(query, openai) {
    if (!openai) {
        // Simple keyword guardrail for Mock mode
        const validKeywords = ['razorpay', 'payment', 'refund', 'transaction', 'api', 'dashboard', 'settlement', 'fail', 'credit', 'debit', 'ticket', 'status', 'money', 'bank', 'hi', 'hello', 'hey', 'help', 'bye', 'thank', 'thanks'];
        const queryLower = query.toLowerCase();

        // Allow pure greetings
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening'];
        if (greetings.includes(queryLower)) return { isSafe: true, type: 'greeting' };

        // Check for keywords
        const isSafe = validKeywords.some(keyword => queryLower.includes(keyword));
        return { isSafe, type: isSafe ? 'inquiry' : 'unrelated' };
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a classifier for a Razorpay chatbot. Your job is to determine if the user input is related to Razorpay, payments, banking, or a casual greeting/farewell. Reply with JSON format: { \"isSafe\": boolean, \"type\": \"greeting\" | \"inquiry\" | \"unrelated\" }." },
                { role: "user", content: query }
            ]
        });
        const content = response.choices[0].message.content;
        try {
            return JSON.parse(content);
        } catch (e) {
            return { isSafe: true, type: 'inquiry' }; // Fail open if JSON parse fails
        }
    } catch (e) {
        console.error("Guardrail Error:", e);
        return { isSafe: true, type: 'inquiry' }; // Fail open on API error
    }
}

module.exports = { checkGuardrail };
