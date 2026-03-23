# Chat Module Structure

The `chat.js` file has been refactored into a modular architecture for better maintainability. Each file handles a specific concern.

## Module Breakdown

- **`index.js`** - Main entry point that orchestrates all modules on DOMContentLoaded
- **`state.js`** - Shared state management (allChats, currentChatId, chatHistory, isProcessing, currentEditingMessageEl, retryTracker, createdAt/updatedAt timestamps)
- **`dom.js`** - DOM element references and helper functions for accessing UI elements
- **`agreement.js`** - Disclaimer modal and cookie-based agreement logic
- **`session.js`** - Session token generation and retrieval from localStorage
- **`sender.js`** - Core message sending logic, API communication, and error handling
- **`ui.js`** - Message rendering, copy buttons, edit buttons, and UI manipulation
- **`sse.js`** - Server-Sent Events parsing utilities

## Usage

The module is initialized through `index.js` which is imported in `public/index.html` as an ES module:

```html
<script type="module" src="chat/index.js"></script>
```

## Benefits

- **Single Responsibility**: Each module has a clear, focused purpose
- **Maintainability**: Easier to locate and modify specific features
- **Testability**: Individual modules can be tested independently
- **Scalability**: New features can be added without bloating existing files

## Module Dependencies

```
index.js (orchestrator)
├── dom.js (element references)
├── agreement.js → dom.js
├── sender.js → dom.js, state.js, agreement.js, session.js, ui.js, sse.js
├── ui.js → dom.js, state.js
└── state.js (allChats, currentChatId, chatHistory, saveCurrentChat, createNewChat, selectChat)
└── session.js (token management)
└── sse.js (utilities)
```

## History Ordering

- `state.js` tracks `createdAt` and `updatedAt` per chat session
- `ui.js` sorts sidebar `state.allChats` by `updatedAt` (newest first)
- Sidebar now shows only existing saved chats, with `No chats available yet.` if none
