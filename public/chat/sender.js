/**
 * Message sending and API communication
 */

import { marked } from "https://esm.sh/marked";
import { dom } from "./dom.js";
import { state, saveCurrentChat } from "./state.js";
import { checkAgreement } from "./agreement.js";
import {
  addMessageToChat,
  showTypingIndicator,
  hideTypingIndicator,
  clearErrorBubble,
  createAssistantMessageElement,
  scrollToBottom,
} from "./ui.js";

const DISCORD_BOT_URL = "https://scrum.yun.ng/chat";
const FAKE_STREAM_DELAY_MS = 80;

const PERSONAL_INFO_REGEX = {
  Email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi,
  "Phone Number": /\b(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d\s.-]{7,}\b/g,
  "Credit Card": /\b(?:\d[ -]*?){13,16}\b/g,
  "Social Security Number": /\b\d{3}-\d{2}-\d{4}\b/g,
  "IP Address": /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

export async function sendMessage(isRetry = false, retryQuestion = null) {
  if (!checkAgreement()) return;

  const message = isRetry ? retryQuestion : dom.userInput.value.trim();

  const contains = Object.entries(PERSONAL_INFO_REGEX)
    .filter(([_, regex]) => regex.test(message))
    .map(([key, _]) => key);
  if (contains.length > 0) {
    const infoList = contains.join(", ");
    if (
      confirm(
        `Your message contains the following personal information: ${infoList}. Are you sure you want to send it?`,
      )
    ) {
      // User confirmed, proceed with sending the message
    } else {
      // User canceled, do not send the message
      return;
    }
  }

  const currentRetries = state.retryTracker.get(message) || 0;
  if (currentRetries >= 3) {
    const retryModal = document.getElementById("max-retries-modal");
    retryModal.style.display = "flex";

    document.getElementById("close-retries-btn").onclick = () => {
      retryModal.style.display = "none";
    };
    return;
  }

  if (message === "" || state.isProcessing) return;

  state.isProcessing = true;
  dom.userInput.disabled = true;
  dom.sendButton.disabled = true;
  showTypingIndicator();

  try {
    if (!isRetry) {
      if (state.currentEditingMessageEl) {
        state.currentEditingMessageEl.remove();
        state.currentEditingMessageEl = null;
      }

      addMessageToChat("user", message, false, null, state.chatHistory.length);
      dom.userInput.value = "";
      dom.userInput.style.height = "auto";
      state.chatHistory.push({ role: "user", content: message });
      saveCurrentChat();
    }

    const assistantMessageEl = createAssistantMessageElement();
    const assistantTextEl = assistantMessageEl.querySelector(".content");

    scrollToBottom();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(DISCORD_BOT_URL, {
      method: "POST",
      headers: {
        "Authorization": "MT2mtLuWi3IB0sgVPeQlSGqS2apsj3J6",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: state.chatHistory.slice(0, -1),
        prompt: message,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Failed to get response");
    }
    if (!response.body) {
      throw new Error("Response body is null");
    }

    await processDiscordStreamResponse(
      response,
      assistantMessageEl,
      assistantTextEl,
      message,
    );
  } catch (error) {
    handleSendMessageError(error, message);
  } finally {
    hideTypingIndicator();
    state.isProcessing = false;
    dom.userInput.disabled = false;
    dom.sendButton.disabled = false;
    dom.userInput.focus();
  }
}

async function processDiscordStreamResponse(
  response,
  assistantMessageEl,
  assistantTextEl,
  originalMessage,
) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";

  // Collect full response body
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }

  // Parse newline-delimited JSON and find the "done" event
  let lastMessageContent = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const json = JSON.parse(trimmed);
      if (json.event === "done" && json.data?.response) {
        lastMessageContent = json.data.response;
      }
    } catch (e) {
      // skip non-JSON lines
    }
  }

  if (!lastMessageContent) return;

  // Tokenize into words and newlines, then display word-by-word via marked
  const tokens = [];
  for (const [li, line] of lastMessageContent.split("\n").entries()) {
    if (li > 0) tokens.push("\n");
    for (const word of line.split(" ").filter((w) => w !== "")) {
      tokens.push(word);
    }
  }
  await new Promise((resolve) => {
    const shown = [];
    let i = 0;
    let firstOnLine = true;
    function typeNextToken() {
      if (i >= tokens.length) {
        resolve();
        return;
      }
      const token = tokens[i++];
      if (token === "\n") {
        shown.push("\n");
        firstOnLine = true;
        assistantTextEl.innerHTML = marked.parse(shown.join(""));
        setTimeout(typeNextToken, 0);
      } else {
        if (!firstOnLine) shown.push(" ");
        shown.push(token);
        firstOnLine = false;
        assistantTextEl.innerHTML = marked.parse(shown.join(""));
        scrollToBottom();
        setTimeout(typeNextToken, FAKE_STREAM_DELAY_MS);
      }
    }
    typeNextToken();
  });

  state.chatHistory.push({ role: "assistant", content: lastMessageContent });
  saveCurrentChat();
  state.retryTracker.delete(originalMessage);
}

function handleSendMessageError(error, message) {
  console.error("Error:", error);

  clearErrorBubble();

  let errorMessage = "Sorry, there was an error processing your request.";
  if (error.name === "AbortError") {
    errorMessage = "60 second timeout reached, aborting request.";
  }

  const currentRetries = (state.retryTracker.get(message) || 0) + 1;
  state.retryTracker.set(message, currentRetries);

  addMessageToChat("assistant", errorMessage, true, message);
}

export function setupSendMessageListeners() {
  dom.userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  dom.userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  dom.sendButton.addEventListener("click", sendMessage);

  // Listen for custom retry event from UI
  document.addEventListener("chatRetry", (event) => {
    sendMessage(true, event.detail.message);
  });
}
