const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const feedbackModal = document.getElementById('feedbackModal');
const starContainer = document.getElementById('starContainer');
const closeFeedback = document.getElementById('closeFeedback');

// Generate a random session ID for this page load
const sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
let currentRating = 0;

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

    // Parse Markdown bold (**text**) to HTML <strong>text</strong>
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

    div.innerHTML = formattedText;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    userInput.value = '';

    // Show typing indicator (optional simplified version)
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'bot-message');
    typingDiv.style.opacity = '0.5';
    typingDiv.innerText = 'Razzy is typing...';
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId })
        });
        const data = await response.json();

        // Remove typing indicator
        typingDiv.remove();

        appendMessage(data.response, 'bot');

        if (data.askFeedback) {
            setTimeout(() => {
                feedbackModal.style.display = 'flex';
            }, 2000);
        }

    } catch (error) {
        typingDiv.remove();
        appendMessage("Sorry, I'm having trouble connecting to the server.", 'bot');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Feedback Logic
starContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('star')) {
        currentRating = e.target.getAttribute('data-value');
        updateStars(currentRating);
    }
});

function updateStars(rating) {
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        if (star.getAttribute('data-value') <= rating) {
            star.classList.add('active');
            star.style.color = '#fbbf24';
        } else {
            star.classList.remove('active');
            star.style.color = '#475569';
        }
    });
}

closeFeedback.addEventListener('click', async () => {
    if (currentRating > 0) {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: currentRating, sessionId })
        });
        alert('Thank you for your feedback!');
    }
    feedbackModal.style.display = 'none';
});
