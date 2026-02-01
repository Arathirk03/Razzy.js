// Simulating a Vector DB or Document Store logic
const knowledgeBase = [
    {
        keywords: ['refund', 'money back', 'return', 'reversed'],
        content: "Refunds usually take 5-7 working days to reflect in the customer's account. You can track refunds from the Razorpay Dashboard > Transactions > Refunds."
    },
    {
        keywords: ['settlement', 'bank', 'account', 'deposit'],
        content: "Settlements are processed according to your cycle (T+2 days by default). Check the 'Settlements' tab in the dashboard. If a settlement is on hold, check your KYC status."
    },
    {
        keywords: ['failed', 'failure', 'declined', 'error'],
        content: "Payment failures can happen due to bank downtime, insufficient funds, or wrong OTP. If money was debited for a failed transaction, it is usually auto-refunded within 5-7 days."
    },
    {
        keywords: ['integration', 'api', 'key', 'sdk', 'webhook', 'react', 'node', 'python'],
        content: "Razorpay offers SDKs for various platforms (React, Node.js, Python, etc.). You can find your API Keys in the Dashboard under Settings > API Keys. For detailed guides, visit docs.razorpay.com."
    },
    {
        keywords: ['webhook', 'event', 'captured', 'failed', 'authorized'],
        content: "Webhooks allow your server to receive real-time updates. Common events: 'payment.captured', 'payment.failed'. Configure them in Dashboard > Settings > Webhooks."
    },
    {
        keywords: ['error', 'code', 'bad_request', 'gateway'],
        content: "Common errors: 'BAD_REQUEST_ERROR' (invalid data), 'GATEWAY_ERROR' (bank issue). Check the 'error.description' field in the response for details."
    },
    {
        keywords: ['pricing', 'fee', 'charges', 'rate', 'cost'],
        content: "Standard pricing is 2% per transaction for Indian Debit/Credit cards and UPI. International payments are charged at 3%."
    },
    {
        keywords: ['order', 'create order', 'order id'],
        content: "It is best practice to create an Order ID on your server using the Orders API before initiating a payment on the client side."
    },
    {
        keywords: ['smart collect', 'virtual account', 'neft', 'imps'],
        content: "Smart Collect allows you to accept payments via NEFT/RTGS/IMPS using Virtual Accounts created for each customer."
    },
    {
        keywords: ['contact', 'support', 'human', 'agent', 'call', 'talk'],
        content: "You can raise a ticket with our support team or request a live agent connection for unresolved issues."
    },
    {
        keywords: ['transaction', 'status', 'check'],
        content: "To check a transaction status, please provide the Transaction ID (starting with pay_...)."
    },
    {
        keywords: ['international', 'global', 'foreign', 'currency'],
        content: "To accept international payments, ensure 'International Payments' is enabled in your Dashboard settings. It may require additional KYC."
    },
    {
        keywords: ['chargeback', 'dispute', 'fraud'],
        content: "A chargeback occurs when a customer disputes a payment. You can contest it via the Dispute Dashboard by providing proof of delivery."
    },
    {
        keywords: ['invoice', 'link', 'payment link'],
        content: "You can send Payment Links via email or SMS from the Dashboard. No coding required."
    },
    {
        keywords: ['subscription', 'recurring', 'auto', 'debit'],
        content: "Razorpay Subscriptions allow you to charge customers automatically. You need to create a Plan first."
    }
];

const findRelevantContext = (query) => {
    const lowerQuery = query.toLowerCase();

    // Improved matching: Check if the query contains any of the keywords as a substring
    // This handles "refunded" (contains "refund") or "payment" (contains "pay") if broadly matched,
    // but better to rely on specific keywords in knowledgeBase.

    const matches = knowledgeBase.filter(doc =>
        doc.keywords.some(keyword => lowerQuery.includes(keyword))
    );

    if (matches.length > 0) {
        return matches.map(m => m.content).join("\n");
    }
    return null;
};

module.exports = { findRelevantContext };
