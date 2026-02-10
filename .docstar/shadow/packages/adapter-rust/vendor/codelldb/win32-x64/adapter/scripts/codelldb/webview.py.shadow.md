# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/webview.py
@source-hash: e8268baef2202249
@generated: 2026-02-09T18:10:12Z

**Primary Purpose:**
Python wrapper for VS Code webview panels in the CodeLLDB debugger extension. Provides a simplified interface for creating and managing webview panels that can display HTML content and exchange messages with the debugger.

**Key Components:**

- **Global view_id counter (L6):** Incremental ID generator for webview instances
- **Webview class (L9-57):** Main wrapper class for webview panel functionality
  - `__init__(debugger_id) (L12-19)`: Creates webview instance with unique ID, sets up event handlers
  - `_message_handler(message) (L21-27)`: Filters and dispatches incoming messages by webview ID
  - `dispose() (L32-34)`: Sends disposal message to VS Code interface
  - `set_html(html) (L36-38)`: Updates webview HTML content
  - `reveal(view_column, preserve_focus) (L40-43)`: Shows webview in specified column
  - `post_message(message) (L45-47)`: Sends message to webview content
  - Event properties for message reception (L49-52) and disposal (L54-57)

**Dependencies:**
- Local `interface` module for VS Code communication
- Local `Event` class for event handling
- `lldb` module (imported but unused)

**Architectural Patterns:**
- Event-driven architecture with observer pattern via Event objects
- Message-based communication using structured dictionaries
- Resource cleanup through `__del__` method (L29-30) removing message handler
- Unique ID-based message routing system

**Key Relationships:**
- Communicates with VS Code via `interface.send_message()` and `interface.on_did_receive_message`
- Each webview instance filters messages by its unique ID
- Supports bidirectional messaging between Python debugger and webview content

**Critical Invariants:**
- Each webview must have unique ID for proper message routing
- Message handler must be removed on destruction to prevent memory leaks
- All VS Code communication uses predefined message format with 'message' and 'id' fields