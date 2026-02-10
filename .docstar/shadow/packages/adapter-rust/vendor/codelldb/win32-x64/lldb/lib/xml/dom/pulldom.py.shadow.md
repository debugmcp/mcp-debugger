# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/dom/pulldom.py
@source-hash: 614b88673d496a36
@generated: 2026-02-09T18:06:20Z

## Purpose
Pull-based XML DOM parsing implementation that provides streaming XML processing with SAX2 backend. Enables incremental DOM construction through event iteration rather than full document parsing.

## Key Classes

### PullDOM (L13-195)
Core SAX ContentHandler that generates DOM events as a stream. Implements namespace-aware XML parsing with deferred DOM construction.

**Key attributes:**
- `elementStack` (L22): Stack tracking nested elements during parsing
- `document` (L15): Current DOM document being built
- `firstEvent/lastEvent` (L20-21): Linked list of pending DOM events
- `_ns_contexts` (L29): Namespace context stack for prefix resolution

**Key methods:**
- `startElementNS()` (L51-106): Creates namespace-aware elements with proper attribute handling
- `endElementNS()` (L108-110): Closes elements and generates END_ELEMENT events
- `buildDocument()` (L164-186): Lazy document creation when first element encountered
- `comment()/processingInstruction()` (L131-147): Handle non-element content

### DOMEventStream (L204-281)
Iterator interface for pull-based XML parsing. Wraps parser and provides event-by-event access.

**Key methods:**
- `getEvent()` (L243-256): Core pull mechanism - reads buffer chunks and yields next DOM event
- `expandNode()` (L228-241): Fully materializes a DOM subtree from current position
- `_slurp()/_emit()` (L258-274): Fallback for non-incremental parsers

### SAX2DOM (L283-314)
Subclass that immediately builds complete DOM tree instead of generating events. Appends nodes to parents as they're created.

### ErrorHandler (L196-202)
Simple SAX error handler - prints warnings, raises errors/fatal errors.

## Key Functions

- `parse()` (L318-327): Main entry point for file/stream parsing
- `parseString()` (L329-336): Entry point for string parsing

## Event Constants (L4-11)
Standard XML event types: START_ELEMENT, END_ELEMENT, COMMENT, etc.

## Dependencies
- `xml.sax`: SAX2 parser backend
- `xml.dom.minidom`: Default DOM implementation factory
- `io.StringIO`: String stream handling

## Architecture Notes
- Uses linked list structure for event queue (firstEvent/lastEvent pointers)
- Implements lazy document creation - waits for first element before creating Document
- Namespace handling tracks URI->prefix mappings in context stack
- Supports both incremental (feed-based) and batch (parse-based) SAX parsers
- Default buffer size optimized at 16364 bytes (2^14 - 20)

## Critical Patterns
- Event queue implemented as singly-linked list with [event_data, next_node] structure
- Element stack maintained for proper nesting and parent-child relationships
- Pending events stored until document creation for pre-root content
- Fallback mechanism when incremental parsing unavailable