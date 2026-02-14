/**
 * LLM Chat App Frontend
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const historyList = document.querySelector(".history-list");
const newChatBtn = document.querySelector(".new-chat-btn");

// State
let sessions = JSON.parse(localStorage.getItem("chat_sessions")) || [];
let currentSessionId = null; 
let chatHistory = []; 
let isProcessing = false; // Added missing declaration

// UI Listeners
userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener("click", sendMessage);
newChatBtn.addEventListener("click", startNewChat);

async function sendMessage() {
    const message = userInput.value.trim();
    if (message === "" || isProcessing) return;

    isProcessing = true;
    userInput.disabled = true;
    sendButton.disabled = true;

    // 1. Add User Message
    addMessageToChat("user", message);
    chatHistory.push({ role: "user", content: message });

    userInput.value = "";
    userInput.style.height = "auto";
    typingIndicator.classList.add("visible");

    try {
        const assistantMessageEl = document.createElement("div");
        assistantMessageEl.className = "message assistant-message";
        assistantMessageEl.innerHTML = "<p></p>";
        chatMessages.appendChild(assistantMessageEl);
        const assistantTextEl = assistantMessageEl.querySelector("p");

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory }),
        });

        if (!response.ok) throw new Error("Failed to get response");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";
        let buffer = "";

        const flushAssistantText = () => {
            assistantTextEl.textContent = responseText;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        // 2. Process the Stream
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parsed = consumeSseEvents(buffer);
            buffer = parsed.buffer;

            for (const data of parsed.events) {
                if (data === "[DONE]") break;
                try {
                    const jsonData = JSON.parse(data);
                    let content = jsonData.response || jsonData.choices?.[0]?.delta?.content || "";
                    if (content) {
                        responseText += content;
                        flushAssistantText();
                    }
                } catch (e) { console.error("JSON Parse Error", e); }
            }
        }

        // 3. FINALIZE: Save the full conversation
        if (responseText.length > 0) {
            chatHistory.push({ role: "assistant", content: responseText });
            
            if (currentSessionId !== null) {
                sessions[currentSessionId] = [...chatHistory];
            } else {
                sessions.unshift([...chatHistory]);
                currentSessionId = 0;
            }
            saveAndRefresh();
        }

    } catch (error) {
        console.error("Error:", error);
        addMessageToChat("assistant", "Sorry, there was an error.");
    } finally {
        typingIndicator.classList.remove("visible");
        isProcessing = false;
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
}

// --- HELPER FUNCTIONS ---

function addMessageToChat(role, content) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}-message`;
    messageEl.innerHTML = `<p>${content}</p>`;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
    let normalized = buffer.replace(/\r/g, "");
    const events = [];
    let eventEndIndex;
    while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
        const rawEvent = normalized.slice(0, eventEndIndex);
        normalized = normalized.slice(eventEndIndex + 2);
        const lines = rawEvent.split("\n");
        for (const line of lines) {
            if (line.startsWith("data:")) {
                events.push(line.slice(5).trimStart());
            }
        }
    }
    return { events, buffer: normalized };
}

function saveAndRefresh() {
    localStorage.setItem("chat_sessions", JSON.stringify(sessions));
    renderSidebar();
}

function renderSidebar() {
    historyList.innerHTML = "";
    sessions.forEach((session, index) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        // Use the first user message (index 1 usually) for the title
        const userMsg = session.find(m => m.role === 'user');
        const title = userMsg ? userMsg.content.substring(0, 20) : "New Chat";
        a.textContent = title + "...";
        a.onclick = (e) => { e.preventDefault(); loadSession(index); };
        li.appendChild(a);
        historyList.appendChild(li);
    });
}

function loadSession(index) {
    currentSessionId = index;
    chatHistory = [...sessions[index]];
    chatMessages.innerHTML = ""; // Clear current view
    chatHistory.forEach(msg => addMessageToChat(msg.role, msg.content));
}

function startNewChat() {
    currentSessionId = null;
    chatHistory = [
        { role: "assistant", content: "Hello! I'm your NASAQ assistant. How can I help?" }
    ];
    chatMessages.innerHTML = "";
    addMessageToChat(chatHistory[0].role, chatHistory[0].content);
}

// Initial Run
renderSidebar();
startNewChat();