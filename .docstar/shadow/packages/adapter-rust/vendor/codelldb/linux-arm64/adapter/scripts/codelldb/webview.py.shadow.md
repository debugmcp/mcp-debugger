# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/webview.py
@source-hash: e8268baef2202249
@generated: 2026-02-09T18:09:19Z

**Primary Purpose:** VSCode webview panel wrapper for LLDB debugger extension, providing Python interface to create and manage webview panels within the debugger context.

**Key Components:**

- **Global view_id (L6):** Auto-incrementing counter for unique webview instance identification
- **Webview class (L9-57):** Main interface wrapper with lifecycle management
  - `__init__(debugger_id)` (L12-19): Creates webview instance, sets up event handlers, registers message listener
  - `_message_handler(message)` (L21-27): Routes incoming messages to appropriate event handlers based on message type
  - `__del__()` (L29-30): Cleanup method removing message handler on garbage collection
  - `dispose()` (L32-34): Explicitly destroys webview panel via interface message
  - `set_html(html)` (L36-38): Updates webview HTML content
  - `reveal(view_column, preserve_focus)` (L40-43): Shows webview in specified editor column
  - `post_message(message)` (L45-47): Sends data to webview JavaScript context

**Event Properties:**
- `on_did_receive_message` (L49-52): Event fired when webview posts messages back
- `on_did_dispose` (L54-57): Event fired when webview panel is closed

**Dependencies:**
- `interface` module: Core communication layer with VSCode extension host
- `Event` class: Event emitter pattern implementation  
- `lldb`: LLDB debugger Python bindings (imported but not directly used)

**Architecture:** Event-driven message passing system where webview instances register for global message events and filter by their unique ID. Uses interface module as communication bridge to VSCode extension APIs.

**Key Patterns:**
- Observer pattern via Event properties for webview lifecycle callbacks
- Message filtering by webview ID for multi-instance support
- Resource cleanup in both `__del__` and explicit `dispose()` methods