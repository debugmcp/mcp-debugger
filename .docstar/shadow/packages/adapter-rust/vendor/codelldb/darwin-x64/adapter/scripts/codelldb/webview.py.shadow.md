# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/webview.py
@source-hash: e8268baef2202249
@generated: 2026-02-09T18:07:28Z

## Purpose
Bridge module providing a Python wrapper for VS Code webview panels within the CodeLLDB debugger extension. Enables creation and management of HTML-based UI components that can communicate bidirectionally with the debugger.

## Key Components

### Global State
- `view_id` (L6): Global counter for generating unique webview identifiers

### Webview Class (L9-57)
Primary webview panel abstraction that wraps VS Code webview API functionality.

**Constructor** (L12-19):
- Assigns unique ID using global counter
- Associates with specific debugger instance via `debugger_id`
- Initializes event handlers for message reception and disposal
- Registers message handler with global interface

**Core Methods**:
- `dispose()` (L32-34): Destroys webview panel via interface message
- `set_html()` (L36-38): Updates webview HTML content
- `reveal()` (L40-43): Shows webview in specified column with focus options
- `post_message()` (L45-47): Sends messages to webview content

**Event Properties**:
- `on_did_receive_message` (L49-52): Event fired when webview posts messages
- `on_did_dispose` (L54-57): Event fired when webview is destroyed

**Internal Methods**:
- `_message_handler()` (L21-27): Routes incoming messages by ID and type
- `__del__()` (L29-30): Cleanup that removes message handler registration

## Dependencies
- `interface` module: Provides core message passing infrastructure
- `event.Event`: Event system for handling callbacks
- `lldb`: LLDB debugger integration (imported but not directly used)

## Architecture Patterns
- **Event-driven messaging**: Uses Event objects for loose coupling between webview and consumers
- **ID-based routing**: Messages filtered by unique webview ID to enable multiple concurrent webviews
- **Resource management**: Automatic cleanup via `__del__` and explicit cleanup via `dispose()`

## Critical Constraints
- Global `view_id` counter creates potential race conditions in multi-threaded scenarios
- Message handler registration/deregistration must be properly balanced to prevent memory leaks
- Each webview instance is bound to a specific debugger ID for message routing