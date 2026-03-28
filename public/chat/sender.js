/**
 * Message sending and API communication
 */

import { dom } from "./dom.js";
import { state, saveCurrentChat } from "./state.js";
import { checkAgreement } from "./agreement.js";
import {
  updateAndSetToken,
  getSessionToken,
  hasSessionToken,
} from "./session.js";
import {
  addMessageToChat,
  showTypingIndicator,
  hideTypingIndicator,
  clearErrorBubble,
  createAssistantMessageElement,
  scrollToBottom,
} from "./ui.js";
import { consumeSseEvents, parseStreamContent } from "./sse.js";

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

  if (!hasSessionToken()) {
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
    const assistantTextEl = assistantMessageEl.querySelector("p");

    scrollToBottom();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Session-Token": getSessionToken(),
      },
      signal: controller.signal,
      body: JSON.stringify({ messages: state.chatHistory }),
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 500) {
      await updateAndSetToken();
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);

      response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Session-Token": getSessionToken(),
        },
        signal: retryController.signal,
        body: JSON.stringify({ messages: state.chatHistory }),
      });
      clearTimeout(retryTimeoutId);
    }

    if (!response.ok) {
      throw new Error("Failed to get response");
    }
    if (!response.body) {
      throw new Error("Response body is null");
    }

    await processStreamResponse(
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

async function processStreamResponse(
  response,
  assistantMessageEl,
  assistantTextEl,
  originalMessage,
) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let responseText = "";
  let buffer = "";

  const flushAssistantText = () => {
    assistantTextEl.textContent = responseText;
    scrollToBottom();
  };

  let sawDone = false;
  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      const parsed = consumeSseEvents(buffer + "\n\n");
      for (const data of parsed.events) {
        if (data === "[DONE]") break;
        try {
          const jsonData = JSON.parse(data);
          const content = parseStreamContent(jsonData);
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
        const content = parseStreamContent(jsonData);
        if (content) {
          responseText += content;
          flushAssistantText();
        }
      } catch (e) {
        console.error("Error parsing SSE data as JSON:", e, data);
      }
    }
    if (sawDone) break;
  }

  if (responseText.length > 0) {
    state.chatHistory.push({ role: "assistant", content: responseText });
    saveCurrentChat();
    state.retryTracker.delete(originalMessage);
  }
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
