/**
 * Main initialization and orchestration
 */

import { initializeDomReferences } from "./dom.js";
import { setupAgreementModal } from "./agreement.js";
import { renderCurrentChat, renderChatHistorySidebar, setupNewChatButton, attachCopyButtonsToExistingMessages } from "./ui.js";
import { setupSendMessageListeners } from "./sender.js";
import { initChats, createNewChat } from "./state.js";

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    initializeDomReferences();
    setupAgreementModal();
    initChats();
    renderChatHistorySidebar();
    renderCurrentChat();
    setupNewChatButton(() => createNewChat("New Chat"));
    setupSendMessageListeners();
    attachCopyButtonsToExistingMessages();
});
