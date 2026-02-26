/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */
/**
 * NASAQ Chat App - Cleaned Frontend
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Helper: Check for agreement cookie
function hasAgreed() {
	return document.cookie.split(';').some((item) => item.trim().startsWith('nasaq_agreed='));
}

document.addEventListener('DOMContentLoaded', () => {
	const modal = document.getElementById('disclaimer-modal');
	const modalContent = document.querySelector('.modal-content');
	const agreeBtn = document.getElementById('agree-btn');
	const declineBtn = document.getElementById('decline-btn');
	const readBtn = document.getElementById('read-policy-btn');
	const pdfContainer = document.getElementById('pdf-viewer-container');
	const errorMsg = document.getElementById('error-message');
	const mainContent = document.querySelector('.main-wrapper');
	const inputArea = document.querySelector('.message-input');

	if (!modal || !agreeBtn) return;
	/* commenting the cookies part to pass tests.*/
		if (hasAgreed()) {
			modal.style.display = 'none';
			mainContent?.classList.remove('locked');
			inputArea?.classList.remove('locked');
			userInput.disabled = false;
			sendButton.disabled = false;
		} else {/**/
	modal.style.display = 'flex';
	mainContent?.classList.add('locked');
	inputArea?.classList.add('locked');
	userInput.disabled = true;
	sendButton.disabled = true;
	userInput.placeholder = "Please accept the agreement to chat...";
	}//cookies

	agreeBtn.addEventListener('click', () => {
		/* commenting the cookies part to pass tests.*/
		const d = new Date();
		d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
		document.cookie = "nasaq_agreed=true; expires=" + d.toUTCString() + "; path=/";
		/**/
		modal.style.display = 'none';
		mainContent?.classList.remove('locked');
		inputArea?.classList.remove('locked');
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.placeholder = "Please Enter Your Prompt Here";
	});

	declineBtn.addEventListener('click', () => {
		if (errorMsg) errorMsg.style.display = 'block';
	});

	readBtn.addEventListener('click', () => {
		const isOpeningPDF = pdfContainer.style.display === 'none';
		if (isOpeningPDF) {
			pdfContainer.style.display = 'block';
			modalContent.classList.add('expanded');
			readBtn.innerText = 'Back to Message';
		} else {
			pdfContainer.style.display = 'none';
			modalContent.classList.remove('expanded');
			readBtn.innerText = 'Read Policy';
		}
	});

	attachCopyButtonsToExistingMessages();
});

async function sendMessage() {
	/* commenting the cookies part to pass tests.*/
	if (!hasAgreed()) {
		alert("You must accept the agreement to use NASAQ ChatBot.");
		location.reload();
		return;
	}
/**/
	const message = userInput.value.trim();

	if (!localStorage.getItem("sessionToken")) {
		try {
			await updateAndSetToken();
		} catch (error) {
			addMessageToChat("assistant", "Error initializing session.");
			return;
		}
	}

	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;
	addMessageToChat("user", message);
	userInput.value = "";
	typingIndicator.classList.add("visible");
	chatHistory.push({ role: "user", content: message });

	try {
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);
		const assistantTextEl = assistantMessageEl.querySelector("p");
		chatMessages.scrollTop = chatMessages.scrollHeight;

		let response = await startResponseStream();

		if (response.status === 401 || response.status === 500) {
			await updateAndSetToken();
			response = await startResponseStream();
		}

		if (!response.ok) throw new Error("Failed to get response");

	} catch (error) {
		console.error("Error:", error);
		addMessageToChat("assistant", "Sorry, there was an error processing your request.");
	} finally {
		typingIndicator.classList.remove("visible");
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
	},
];
let isProcessing = false;

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

// Requests for a new token and updates it in localStorage
async function updateAndSetToken() {
	const response = await fetch("/api/session-token/generate", {
		method: "GET",
		headers: {
			'Session-Token': localStorage.getItem('sessionToken') || '',
		}
	});
	if (!response.ok) {
		throw new Error("Failed to get session token");
	}
	const token = (await response.json())['token'];
	localStorage.setItem("sessionToken", token);
	return token;
}

async function startResponseStream() {
	return await fetch("/api/chat", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Session-Token": localStorage.getItem("sessionToken") || "",
		},
		body: JSON.stringify({
			messages: chatHistory,
		}),
	});
}

/**
 * Sends a message to the chat API and processes the response
 */
const retryTracker = new Map();
async function sendMessage(isRetry = false, retryQuestion = null) {
	if (!hasAgreed()) {
		alert("You must accept the agreement to use NASAQ ChatBot.");
		location.reload(); // Forces the modal to reappear
		return;
	}

	// Determine the message source: either the retry argument or the input field
    const message = isRetry ? retryQuestion : userInput.value.trim();

	// Check Max Retries (Scenario ID012)
    const currentRetries = retryTracker.get(message) || 0;
    if (currentRetries >= 3) {
        const retryModal = document.getElementById('max-retries-modal');
        retryModal.style.display = 'flex';
        
        document.getElementById('close-retries-btn').onclick = () => {
            retryModal.style.display = 'none';
        };
        return;
    }

	if (!localStorage.getItem("sessionToken")) {
		try {
			await updateAndSetToken();
		} catch (error) {
			console.error("Error getting session token:", error);
			addMessageToChat(
				"assistant",
				"Sorry, there was an error initializing the chat session.",
			);
			return;
		}
	}
	// Don't send empty messages
	if (message === "" || isProcessing) return;

	// Disable input while processing
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;
	// Show typing indicator
	typingIndicator.classList.add("visible");

	if (!isRetry) {
        addMessageToChat("user", message);
        userInput.value = "";
        userInput.style.height = "auto";
        chatHistory.push({ role: "user", content: message });
    }
	// Setup 30-second timeout (Scenario ID011)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);


try {
        // Create new assistant response element
        const assistantMessageEl = document.createElement("div");
        assistantMessageEl.className = "message assistant-message";
        assistantMessageEl.innerHTML = "<p></p>";
        chatMessages.appendChild(assistantMessageEl);
        attachCopyButton(assistantMessageEl);
        const assistantTextEl = assistantMessageEl.querySelector("p");

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // --- TIMEOUT SETUP (Scenario ID011) ---
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second limit

        // Send request to API
        // Using fetch directly to attach the abort signal
        let response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Session-Token": localStorage.getItem("sessionToken") || "",
            },
            signal: controller.signal,
            body: JSON.stringify({
                messages: chatHistory,
            }),
        });

        clearTimeout(timeoutId); // Cancel the timeout since the request started responding

        if (response.status === 401 || response.status === 500) {
            // retry logic for unauthorized error -> try refreshing token
            await updateAndSetToken();
            // Re-fetch with a fresh controller for the retry
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
            
            response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Session-Token": localStorage.getItem("sessionToken") || "",
                },
                signal: retryController.signal,
                body: JSON.stringify({ messages: chatHistory }),
            });
            clearTimeout(retryTimeoutId);
        }

        // Handle errors
        if (!response.ok) {
            throw new Error("Failed to get response");
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }

        // Process streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";
        let buffer = "";
        const flushAssistantText = () => {
            assistantTextEl.textContent = responseText;
            const chatArea = document.querySelector('.chat-area');
            if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        };

        let sawDone = false;
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                // Process any remaining complete events in buffer
                const parsed = consumeSseEvents(buffer + "\n\n");
                for (const data of parsed.events) {
                    if (data === "[DONE]") {
                        break;
                    }
                    try {
                        const jsonData = JSON.parse(data);
                        let content = "";
                        if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
                            content = jsonData.response;
                        } else if (jsonData.choices?.[0]?.delta?.content) {
                            content = jsonData.choices[0].delta.content;
                        }
                        if (content) {
                            responseText += content;
                            flushAssistantText();
                        }
                    } catch (e) {
                        console.error("Error parsing SSE data as JSON:", e, data);
                    }
                }
                break;
            }

            // Decode chunk
            buffer += decoder.decode(value, { stream: true });
            const parsed = consumeSseEvents(buffer);
            buffer = parsed.buffer;
            for (const data of parsed.events) {
                if (data === "[DONE]") {
                    sawDone = true;
                    buffer = "";
                    break;
                }
                try {
                    const jsonData = JSON.parse(data);
                    let content = "";
                    if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
                        content = jsonData.response;
                    } else if (jsonData.choices?.[0]?.delta?.content) {
                        content = jsonData.choices[0].delta.content;
                    }
                    if (content) {
                        responseText += content;
                        flushAssistantText();
                    }
                } catch (e) {
                    console.error("Error parsing SSE data as JSON:", e, data);
                }
            }
            if (sawDone) {
                break;
            }
        }

        // Add completed response to chat history
        if (responseText.length > 0) {
            chatHistory.push({ role: "assistant", content: responseText });
            // SUCCESS: Reset the retry count for this specific question
            retryTracker.delete(message);
        }

    } catch (error) {
        console.error("Error:", error);
        
        // CLEANUP: If we have an empty assistant bubble because of a crash, remove it
        if (chatMessages.lastChild && chatMessages.lastChild.classList.contains('assistant-message')) {
            const p = chatMessages.lastChild.querySelector('p');
            if (!p || !p.textContent.trim()) {
                chatMessages.removeChild(chatMessages.lastChild);
            }
        }

        // Determine message (Scenario ID011)
        let errorMessage = "Sorry, there was an error processing your request.";
        if (error.name === 'AbortError') {
            errorMessage = "Sorry for the slow service. Either there is a difficulty connecting to the AI service or the AI is searching a lot more documents to give a better answer.";
        }

        // UPDATE RETRY TRACKER (Scenario ID012)
        const currentRetries = (retryTracker.get(message) || 0) + 1;
        retryTracker.set(message, currentRetries);

        // Add error message with retry capability
        addMessageToChat("assistant", errorMessage, true, message);

    } finally {
        // Hide typing indicator
        typingIndicator.classList.remove("visible");

        // Re-enable input
        isProcessing = false;
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content, isError = false, originalQuestion = null) {
    const messageEl = document.createElement("div");
    // Adds 'error-bubble' class if it's a failure
    messageEl.className = `message ${role}-message ${isError ? 'error-bubble' : ''}`;
    messageEl.innerHTML = `<p>${content}</p>`;
    chatMessages.appendChild(messageEl);
    
    attachCopyButton(messageEl);

    // If it's an error and we haven't hit the 3-retry limit yet
    if (isError && originalQuestion) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'retry-btn';
        retryBtn.innerHTML = '<span>↻</span> Retry';
        retryBtn.title = 'Try this prompt again';
        // This calls the sendMessage function again with the exact same text
        retryBtn.onclick = () => sendMessage(true, originalQuestion);
        messageEl.appendChild(retryBtn);
    }

    const chatArea = document.querySelector('.chat-area');
    chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * Attach a copy button to a message element (if not already present)
 */
function attachCopyButton(messageEl) {
	if (!messageEl || messageEl.querySelector('.copy-btn')) return;
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'copy-btn';
	btn.title = 'Copy message';
	btn.innerText = '⮺';

	btn.addEventListener('click', async (e) => {
		e.stopPropagation();
		const p = messageEl.querySelector('p');
		const text = p ? p.textContent.trim() : '';
		try {
			await navigator.clipboard.writeText(text);
			btn.innerText = 'Copied';
			btn.classList.add('copied');
			setTimeout(() => {
				btn.innerText = '⮺';
				btn.classList.remove('copied');
			}, 1500);
		} catch (err) {
			console.error('Copy failed', err);
			btn.innerText = 'Failed';
			setTimeout(() => { btn.innerText = '⮺'; }, 1500);
		}
	});

	messageEl.appendChild(btn);
}

/** Attach copy buttons to any existing static messages on the page */
function attachCopyButtonsToExistingMessages() {
	const messages = document.querySelectorAll('.message');
	messages.forEach(attachCopyButton);
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice("data:".length).trimStart());
			}
		}
		if (dataLines.length === 0) continue;
		events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}

// Attach copy buttons to any messages already present on load
attachCopyButtonsToExistingMessages();
