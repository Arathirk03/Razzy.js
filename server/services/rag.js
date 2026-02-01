const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const dataPath = path.resolve(__dirname, '../data/razorpay_data.json');
const knowledgeBase = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Simple keyword-based search for RAG fallback or Mock mode
function searchKnowledgeBase(query) {
    const queryLower = query.toLowerCase();
    const results = knowledgeBase.filter(item =>
        item.topic.toLowerCase().includes(queryLower) ||
        item.content.toLowerCase().includes(queryLower)
    );

    if (results.length > 0) {
        return results.map(r => `**${r.topic}**: ${r.content}`).join('\n\n');
    }
    return null;
}

async function getRAGResponse(query, openai) {
    if (!openai) {
        // Fallback if no OpenAI Key
        const context = searchKnowledgeBase(query);
        return context ? `Here is what I found regarding your query:\n\n${context}` : "I'm not sure about that. Please ask a specific Razorpay related question.";
    }

    // Real RAG implementation would use Embeddings here. 
    // To keep it simple and robust for this demo without a Vector DB instance:

    const context = searchKnowledgeBase(query) || "No specific documentation found, try to answer generally about Razorpay.";

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are Razzy, a helpful assistant for Razorpay. Answer the user's question based on the context provided below. If the answer is not in the context, use your general knowledge ONLY if it is about Razorpay. Keep it short." },
                { role: "system", content: `Context: ${context}` },
                { role: "user", content: query }
            ]
        });
        return response.choices[0].message.content;
    } catch (e) {
        console.error("OpenAI Error:", e);
        return "I am having trouble connecting to my brain right now. " + (searchKnowledgeBase(query) || "");
    }
}

module.exports = { getRAGResponse };
