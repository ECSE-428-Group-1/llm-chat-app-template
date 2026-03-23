/**
 * DOM element references and helpers
 */

export const dom = {
    chatMessages: null,
    userInput: null,
    sendButton: null,
    typingIndicator: null,
    modal: null,
    modalContent: null,
    agreeBtn: null,
    declineBtn: null,
    readBtn: null,
    pdfContainer: null,
    errorMsg: null,
    mainContent: null,
    inputArea: null,
};

export function initializeDomReferences() {
    dom.chatMessages = document.getElementById("chat-messages");
    dom.userInput = document.getElementById("user-input");
    dom.sendButton = document.getElementById("send-button");
    dom.typingIndicator = document.getElementById("typing-indicator");
    dom.modal = document.getElementById("disclaimer-modal");
    dom.modalContent = document.querySelector(".modal-content");
    dom.agreeBtn = document.getElementById("agree-btn");
    dom.declineBtn = document.getElementById("decline-btn");
    dom.readBtn = document.getElementById("read-policy-btn");
    dom.pdfContainer = document.getElementById("pdf-viewer-container");
    dom.errorMsg = document.getElementById("error-message");
    dom.mainContent = document.querySelector(".main-wrapper");
    dom.inputArea = document.querySelector(".message-input");
}

export function getChatArea() {
    return document.querySelector(".chat-area");
}
