# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/expatreader.py
@source-hash: 5b6750ae591cffa3
@generated: 2026-02-09T18:06:23Z

## Purpose
SAX (Simple API for XML) driver implementation for the pyexpat C module, providing XML parsing capabilities with both namespace-aware and non-namespace modes. This is a complete XML parser that converts expat callbacks into SAX events.

## Key Classes

### ExpatLocator (L45-76)
- **Purpose**: Provides location information during XML parsing
- **Key Methods**:
  - `getColumnNumber()` (L54): Returns current column position from expat parser
  - `getLineNumber()` (L60): Returns current line number from expat parser
  - `getPublicId()` (L66) / `getSystemId()` (L72): Returns document identifiers
- **Architecture**: Uses weak references to avoid circular dependencies between parser and content handler

### ExpatParser (L81-441)
- **Purpose**: Main SAX parser implementation wrapping pyexpat functionality
- **Inheritance**: Extends `xmlreader.IncrementalParser` and `xmlreader.Locator`
- **Constructor** (L84): Configures namespace handling and buffer size (default 65516 bytes)

#### Core Parsing Methods
- `parse()` (L97): Main entry point for parsing XML documents
- `feed()` (L200): Incremental parsing for data chunks
- `flush()` (L217): Forces processing of buffered data
- `close()` (L242): Finalizes parsing and cleanup
- `reset()` (L284): Reinitializes parser state

#### SAX Feature/Property Management
- `getFeature()` / `setFeature()` (L124-164): Manages SAX parsing features
- `getProperty()` / `setProperty()` (L166-196): Handles SAX properties
- Supported features: namespaces, string interning, external entities
- Unsupported: validation, external parameter entities, namespace prefixes

#### Event Handlers
- `start_element()` / `end_element()` (L340-344): Non-namespace element events
- `start_element_ns()` / `end_element_ns()` (L346-389): Namespace-aware element events
- `start_namespace_decl()` / `end_namespace_decl()` (L399-403): Namespace declarations
- `external_entity_ref()` (L414): External entity resolution with stack management
- `skipped_entity_handler()` (L436): Handles skipped entities per SAX spec

## Dependencies
- **xml.parsers.expat**: Core XML parsing engine (required)
- **xml.sax modules**: SAX framework components (exceptions, handlers, readers)
- **weakref**: For avoiding circular references (optional, falls back to direct references)

## Key State Variables
- `_parser`: Current expat parser instance
- `_namespaces`: Boolean controlling namespace processing mode
- `_parsing`: Parsing state flag
- `_entity_stack`: Stack for nested entity parsing
- `_interning`: String interning dictionary (optional)

## Factory Function
- `create_parser()` (L444): Standard factory function returning ExpatParser instance

## Architecture Notes
- Implements both incremental and full document parsing
- Handles namespace processing with URI/local name splitting
- Manages entity stack for external entity processing
- Uses weak references to prevent memory cycles
- Provides comprehensive error handling with SAXParseException wrapping