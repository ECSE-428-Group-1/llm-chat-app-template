/**
 * Shared state management for chat app
 */

const STORAGE_KEY = "nasaq_sessions";
const CURRENT_CHAT_KEY = "nasaq_current_chat";

// Use sessionStorage so chat history is cleared when the tab/browser is closed.
// This prevents persistence across builds and new deployments.
const storage = window.sessionStorage;

function createDefaultAssistantMessage() {
    return {
        role: "assistant",
        content: "Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
    };
}

function createChatObject(title = "New Chat") {
    const now = new Date().toISOString();
    return {
        id: `chat_${Date.now()}`,
        title,
        createdAt: now,
        updatedAt: now,
        messages: [createDefaultAssistantMessage()],
    };
}

export const state = {
    allChats: {},
    currentChatId: null,
    chatHistory: [],
    isProcessing: false,
    currentEditingMessageEl: null,
    retryTracker: new Map(),
};

export function loadSessionsFromStorage() {
    try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
        if (saved && typeof saved === "object") {
            state.allChats = saved;
        }
    } catch (err) {
        console.debug("Could not parse session storage", err);
        state.allChats = {};
    }

    const savedChatId = storage.getItem(CURRENT_CHAT_KEY);
    if (savedChatId && state.allChats[savedChatId]) {
        state.currentChatId = savedChatId;
    }
}

export function saveSessionsToStorage() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state.allChats));
    if (state.currentChatId) {
        storage.setItem(CURRENT_CHAT_KEY, state.currentChatId);
    }
}

export function initChats() {
    // Clear prior session cache on load to avoid carrying old data across browser restarts.
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(CURRENT_CHAT_KEY);

    state.allChats = {};
    state.currentChatId = null;

    const newChat = createChatObject("New Chat");
    state.allChats[newChat.id] = newChat;
    state.currentChatId = newChat.id;

    selectChat(state.currentChatId);
    saveSessionsToStorage();
}

export function selectChat(chatId) {
    if (!chatId || !state.allChats[chatId]) return false;

    state.currentChatId = chatId;
    state.chatHistory = [...state.allChats[chatId].messages];
    localStorage.setItem(CURRENT_CHAT_KEY, chatId);
    return true;
}

export function createNewChat(title = "New Chat") {
    // Ensure current unsaved conversation is not kept as an active open chat.
    // Start fresh state for the new session.
    const chat = createChatObject(title);
    state.allChats[chat.id] = chat;
    state.currentChatId = chat.id;
    state.chatHistory = [...chat.messages];
    state.currentEditingMessageEl = null;
    state.isProcessing = false;
    state.retryTracker.clear();

    saveSessionsToStorage();
    return chat.id;
}

export function saveCurrentChat() {
    if (!state.currentChatId || !state.allChats[state.currentChatId]) return;

    const now = new Date().toISOString();
    state.allChats[state.currentChatId].messages = [...state.chatHistory];
    state.allChats[state.currentChatId].updatedAt = now;
    saveSessionsToStorage();
}

export function currentChatHasUserMessage() {
    return state.chatHistory.some((msg) => msg.role === "user");
}

export function isCurrentChatEmpty() {
    return !currentChatHasUserMessage();
}

export function resetSessionState() {
    const initial = createDefaultAssistantMessage();
    state.chatHistory = [initial];
    state.isProcessing = false;
    state.currentEditingMessageEl = null;
    state.retryTracker.clear();
}

