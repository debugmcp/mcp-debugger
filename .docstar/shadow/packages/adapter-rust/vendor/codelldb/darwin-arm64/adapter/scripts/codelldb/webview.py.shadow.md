# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/webview.py
@source-hash: e8268baef2202249
@generated: 2026-02-09T18:06:54Z

## Purpose
Provides a simplified Python interface for VSCode webview panels within the CodeLLDB debugger adapter, enabling creation and management of HTML-based UI components.

## Key Components

### Global State
- `view_id` (L6): Global counter for assigning unique IDs to webview instances

### Webview Class (L9-57)
Primary class for managing webview panel lifecycle and communication.

**Constructor (L12-19):**
- Generates unique view ID using global counter
- Stores debugger_id for message routing
- Initializes event handlers for message reception and disposal
- Registers message handler with interface module

**Message Handling (L21-27):**
- `_message_handler()`: Processes incoming messages filtered by webview ID
- Handles 'webviewDidReceiveMessage' and 'webviewDidDispose' message types
- Emits appropriate events with inner message content

**Lifecycle Management:**
- `__del__()` (L29-30): Cleanup handler that removes message listener
- `dispose()` (L32-34): Explicitly destroys webview panel via interface

**Content Management:**
- `set_html()` (L36-38): Updates webview HTML content
- `reveal()` (L40-43): Shows webview in specified column with focus options
- `post_message()` (L45-47): Sends messages to webview content

**Event Properties:**
- `on_did_receive_message` (L49-52): Event fired when webview posts messages
- `on_did_dispose` (L54-57): Event fired when webview is disposed

## Dependencies
- `interface` module: Core message passing and communication layer
- `Event` class: Observable event system for webview lifecycle
- `lldb`: LLDB debugger integration (imported but not directly used)

## Architecture
Uses observer pattern with Event objects for asynchronous communication. Messages are routed through a centralized interface module using unique webview IDs. The class acts as a bridge between Python debugger scripts and VSCode webview panels.