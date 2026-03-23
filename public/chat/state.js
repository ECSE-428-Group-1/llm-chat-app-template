/**
 * Shared state management for chat app
 */

const STORAGE_KEY = "nasaq_sessions";
const CURRENT_CHAT_KEY = "nasaq_current_chat";

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
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && typeof saved === "object") {
            state.allChats = saved;
        }
    } catch (err) {
        console.debug("Could not parse session storage", err);
        state.allChats = {};
    }

    const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);
    if (savedChatId && state.allChats[savedChatId]) {
        state.currentChatId = savedChatId;
    }
}

export function saveSessionsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.allChats));
    if (state.currentChatId) {
        localStorage.setItem(CURRENT_CHAT_KEY, state.currentChatId);
    }
}

export function initChats() {
    loadSessionsFromStorage();

    if (!state.currentChatId || !state.allChats[state.currentChatId]) {
        const newChat = createChatObject("New Chat");
        state.allChats[newChat.id] = newChat;
        state.currentChatId = newChat.id;
    }

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
    const chat = createChatObject(title);
    state.allChats[chat.id] = chat;
    state.currentChatId = chat.id;
    state.chatHistory = [...chat.messages];
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

export function resetSessionState() {
    const initial = createDefaultAssistantMessage();
    state.chatHistory = [initial];
    state.isProcessing = false;
    state.currentEditingMessageEl = null;
    state.retryTracker.clear();
}

