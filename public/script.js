document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');

    // Generate or retrieve Session ID
    let sessionId = localStorage.getItem('razzy_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('razzy_session_id', sessionId);
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // --- Rating System Logic ---
    const ratingContainer = document.getElementById('rating-container');
    const stars = document.querySelectorAll('.stars i');

    // Handle Stars Hover
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const value = parseInt(star.getAttribute('data-value'));
            highlightStars(value);
        });

        star.addEventListener('mouseout', () => {
            // Reset to currently selected if any, or clear
            // For now, simpler: clear hover effects, keep selection logic separate if needed.
            // But actually, we only need to highlight up to hover.
            const selected = document.querySelectorAll('.stars i.selected');
            if (selected.length > 0) {
                const maxVal = parseInt(selected[selected.length - 1].getAttribute('data-value'));
                highlightStars(maxVal);
            } else {
                highlightStars(0);
            }
        });

        star.addEventListener('click', () => {
            const value = star.getAttribute('data-value');
            highlightStars(value); // Visual confirm
            submitRating(value);
        });
    });

    function highlightStars(count) {
        stars.forEach(s => {
            const v = parseInt(s.getAttribute('data-value'));
            if (v <= count) {
                s.classList.add('hovered');
            } else {
                s.classList.remove('hovered');
            }
        });
    }

    function submitRating(rating) {
        // Send as a user message, but maybe visually distinct? 
        // For simplicity, just send "5" so the backend state machine picks it up.
        // We can hide it from the chat if desired, but seeing "5" is fine for now.
        // Let's send it.
        const msg = `${rating} stars`;
        addMessage(msg, 'user');

        ratingContainer.classList.add('hidden'); // Hide immediately

        // Use the existing submit flow
        // We need to trigger the fetch manually
        handleChatSubmit(msg);
    }

    // Modify existing event listener to check for feedbackRequest
    async function handleChatSubmit(message) {
        // Show typing indicator
        const typingId = showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId })
            });

            const data = await response.json();
            removeTypingIndicator(typingId);

            if (data.response) {
                addMessage(data.response, 'bot');
            }
            if (data.error) {
                addMessage("Error: " + data.error, 'bot');
            }

            // Check for Feedback Request
            if (data.feedbackRequest) {
                showRatingUI();
            } else {
                hideRatingUI();
            }

        } catch (err) {
            removeTypingIndicator(typingId);
            addMessage("Sorry, I'm having trouble connecting right now.", 'bot');
            console.error(err);
        }
    }

    function showRatingUI() {
        // Small delay to appear after message
        setTimeout(() => {
            ratingContainer.classList.remove('hidden');
        }, 500);
    }

    function hideRatingUI() {
        ratingContainer.classList.add('hidden');
        highlightStars(0); // Reset visual
    }

    // Refactor the submit listener to use handleChatSubmit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        userInput.value = '';

        handleChatSubmit(message);
    });

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        if (sender === 'user') {
            contentDiv.textContent = text;
        } else {
            contentDiv.innerHTML = text; // Allow <b> tags
        }

        const timeDiv = document.createElement('div');
        timeDiv.classList.add('message-time');
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        chatMessages.appendChild(messageDiv);

        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.classList.add('message', 'bot-message');
        div.innerHTML = `<div class="message-content" style="color:#aaa;">...</div>`;
        chatMessages.appendChild(div);
        scrollToBottom();
        return id;
    }

});
