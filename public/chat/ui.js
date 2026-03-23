/**
 * Chat message UI rendering and content manipulation
 */

import { dom, getChatArea } from "./dom.js";
import { state, selectChat } from "./state.js";

export function addMessageToChat(
    role,
    content,
    isError = false,
    originalQuestion = null,
    chatHistoryIndex = null
) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}-message ${isError ? "error-bubble" : ""}`;
    messageEl.innerHTML = `<p>${content}</p>`;

    if (chatHistoryIndex !== null) {
        messageEl.dataset.chatIndex = chatHistoryIndex;
    }

    dom.chatMessages.appendChild(messageEl);
    attachCopyButton(messageEl);

    if (role === "user" && !isError) {
        const allUserMessages = document.querySelectorAll(".user-message:not(.error-bubble)");
        allUserMessages.forEach((msg) => {
            const editBtn = msg.querySelector(".edit-btn");
            if (editBtn) editBtn.remove();
        });
        attachEditButton(messageEl);
    }

    if (isError && originalQuestion) {
        const retryBtn = document.createElement("button");
        retryBtn.className = "retry-btn";
        retryBtn.innerHTML = "<span>↻</span> Retry";
        retryBtn.title = "Try this prompt again";
        retryBtn.onclick = () => {
            // Trigger retry - the sendMessage function from sender.js will handle this
            const event = new CustomEvent("chatRetry", { detail: { message: originalQuestion } });
            document.dispatchEvent(event);
        };
        messageEl.appendChild(retryBtn);
    }

    const chatArea = getChatArea();
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
}

export function attachCopyButton(messageEl) {
    if (!messageEl || messageEl.querySelector(".copy-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.title = "Copy message";
    btn.innerText = "⮺";

    btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const p = messageEl.querySelector("p");
        const text = p ? p.textContent.trim() : "";
        try {
            await navigator.clipboard.writeText(text);
            btn.innerText = "Copied";
            btn.classList.add("copied");
            setTimeout(() => {
                btn.innerText = "⮺";
                btn.classList.remove("copied");
            }, 1500);
        } catch (err) {
            console.error("Copy failed", err);
            btn.innerText = "Failed";
            setTimeout(() => {
                btn.innerText = "⮺";
            }, 1500);
        }
    });

    messageEl.appendChild(btn);
}

export function attachEditButton(messageEl) {
    if (!messageEl || messageEl.querySelector(".edit-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "edit-btn";
    btn.title = "Edit and resend this message";
    btn.innerText = "✎";

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        editLastMessage(messageEl);
    });

    messageEl.appendChild(btn);
}

export function editLastMessage(messageEl) {
    const msgText = messageEl.querySelector("p")?.textContent.trim() || "";

    if (!msgText) return;

    const chatIndexToEdit = parseInt(messageEl.dataset.chatIndex || "-1", 10);

    if (chatIndexToEdit >= 0 && chatIndexToEdit < state.chatHistory.length) {
        state.chatHistory = state.chatHistory.slice(0, chatIndexToEdit + 1);
    }

    const allMessages = Array.from(document.querySelectorAll(".message"));
    const messageIndex = allMessages.indexOf(messageEl);

    if (messageIndex !== -1) {
        const messagesToRemove = allMessages.slice(messageIndex + 1);
        messagesToRemove.forEach((msg) => msg.remove());
    }

    messageEl.classList.add("editing");
    state.currentEditingMessageEl = messageEl;

    dom.userInput.value = msgText;
    dom.userInput.style.height = "auto";
    dom.userInput.style.height = dom.userInput.scrollHeight + "px";

    dom.userInput.focus();
    const inputArea = document.querySelector(".message-input");
    if (inputArea) {
        inputArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

export function attachCopyButtonsToExistingMessages() {
    const messages = document.querySelectorAll(".message");
    messages.forEach(attachCopyButton);
}

export function renderCurrentChat() {
    if (!dom.chatMessages) return;
    dom.chatMessages.innerHTML = "";
    state.chatHistory.forEach((msg, index) => {
        addMessageToChat(msg.role, msg.content, false, null, index);
    });
}

export function renderChatHistorySidebar() {
    const historyList = document.querySelector(".history-list");
    if (!historyList) return;

    historyList.innerHTML = "";

    const chats = Object.values(state.allChats)
        .slice()
        .sort((a, b) => {
            const at = a.updatedAt || a.createdAt || "";
            const bt = b.updatedAt || b.createdAt || "";
            return bt.localeCompare(at);
        });

    if (chats.length === 0) {
        const empty = document.createElement("li");
        empty.className = "history-empty";
        empty.textContent = "No chats available yet.";
        historyList.appendChild(empty);
        return;
    }

    chats.forEach((chat) => {
        const item = document.createElement("li");
        item.className = "history-item";
        item.textContent = chat.title;
        if (chat.id === state.currentChatId) {
            item.classList.add("active-chat");
        }

        item.addEventListener("click", () => {
            if (!selectChat(chat.id)) return;
            renderCurrentChat();
            renderChatHistorySidebar();
        });

        historyList.appendChild(item);
    });
}

export function setupNewChatButton(onCreate) {
    const button = document.querySelector(".new-chat-btn");
    if (!button) return;

    button.addEventListener("click", () => {
        const chatId = onCreate();
        if (chatId) {
            renderChatHistorySidebar();
            renderCurrentChat();
        }
    });
}

export function showTypingIndicator() {
    if (dom.typingIndicator) dom.typingIndicator.classList.add("visible");
}

export function hideTypingIndicator() {
    if (dom.typingIndicator) dom.typingIndicator.classList.remove("visible");
}

export function clearErrorBubble() {
    if (
        dom.chatMessages.lastChild &&
        dom.chatMessages.lastChild.classList.contains("assistant-message")
    ) {
        const p = dom.chatMessages.lastChild.querySelector("p");
        if (!p || !p.textContent.trim()) {
            dom.chatMessages.removeChild(dom.chatMessages.lastChild);
        }
    }
}

export function createAssistantMessageElement() {
    const assistantMessageEl = document.createElement("div");
    assistantMessageEl.className = "message assistant-message";
    assistantMessageEl.innerHTML = "<p></p>";
    assistantMessageEl.dataset.chatIndex = state.chatHistory.length;
    dom.chatMessages.appendChild(assistantMessageEl);
    attachCopyButton(assistantMessageEl);
    return assistantMessageEl;
}

export function scrollToBottom() {
    const chatArea = getChatArea();
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
}
