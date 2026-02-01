const guardrails = (req, res, next) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message field is required' });
    }

    const lowerMsg = message.toLowerCase();

    // Basic heuristic to detect non-Razorpay topics
    // In a real generic app, this would be an LLM classifier.
    const razorpayKeywords = [
        'razorpay', 'payment', 'transaction', 'refund', 'api', 'dashboard',
        'webhook', 'integration', 'checkout', 'settlement', 'invoice', 'link',
        'subscription', 'order', 'support', 'ticket', 'issue', 'failed', 'pending',
        'status', 'id', 'email', 'hello', 'hi', 'help', 'thanks', 'thank', 'bye',
        'ok', 'okay', 'done', 'yes', 'no', 'ho', 'hey', 'one', 'moment', 'wait',
        'pricing', 'fee', 'charges', 'sdk', 'react', 'node', 'python', 'mobile',
        'web', 'code', 'error', 'captured', 'authorized'
    ];

    // Check for common Prompt Injection patterns (basic)
    const injectionPatterns = [
        'ignore previous instructions', 'system prompt', 'you are a', 'act as a',
        'jailbreak', 'reveal your instructions'
    ];

    // Helper for keyword match (relaxed to substring)
    const containsKeyword = (text, keywords) => {
        // Check if any keyword matches as a substring
        return keywords.some(k => text.includes(k));
    };

    const isRelated = containsKeyword(lowerMsg, razorpayKeywords);
    const isInjection = injectionPatterns.some(pattern => lowerMsg.includes(pattern));

    if (isInjection) {
        return res.json({
            response: "I cannot comply with that request. I am Razzy, a Razorpay assistant."
        });
    }

    // Strict keyword check might be too aggressive for "My money is gone", so we add general financial terms.
    // If it's completely unrelated like "What is the capital of France?"
    if (!isRelated && message.split(' ').length > 2) {
        return res.json({
            response: "I can only assist with Razorpay-related inquiries. Please ask about payments, refunds, or integration."
        });
    }

    next();
};

module.exports = guardrails;
