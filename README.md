Razzy: Razorpay Assistant Chatbot
About the Project Razzy is a chatbot. Its main job is to help users with payment problems and banking questions. 
I used HTML, CSS, and plain JavaScript to build it.

Main Features

Razorpay Only: The bot is programmed to only talk about things related to Razorpay. If a user asks about something else, the bot will politely stay on topic.
Smart Memory: Once you give the bot your email or a transaction ID, it remembers it. It won't keep asking you for the same information over and over.
Correct Information: I used a system called RAG which connects the bot to real Razorpay documents. This stops the bot from making up fake answers or "hallucinating."
Strict Rules for Input: The bot checks if you are typing things correctly. For example, a Transaction ID must start with pay_ or it won't let you continue. It also checks if your email address looks real.
Ticket System: If the bot cannot fix the problem, it creates a support ticket. It gives the user a Ticket ID and sends an email to both the user and the Razorpay team with a summary of the chat.
Feedback: After every chat, the bot asks the user to give a rating from 1 to 5 so we can see how well it is doing.

How to Use Since this uses plain JavaScript, you can run it in any web browser. It is designed to be simple, fast, and very helpful for payment issues.
