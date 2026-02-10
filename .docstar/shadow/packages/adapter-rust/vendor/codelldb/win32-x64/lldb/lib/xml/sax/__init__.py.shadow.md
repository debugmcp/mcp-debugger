# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/__init__.py
@source-hash: 2f949d27b9eda628
@generated: 2026-02-09T18:06:15Z

## SAX Package Entry Point

This is the main entry point for Python's Simple API for XML (SAX) implementation, providing a high-level interface for XML parsing using the SAX 2 specification.

### Primary Responsibility
- Exposes the primary SAX API for XML parsing operations
- Manages parser creation and selection through a fallback mechanism
- Provides convenient wrapper functions for common XML parsing tasks

### Key Functions

**parse(source, handler, errorHandler=ErrorHandler()) (L29-33)**
- High-level function to parse XML from various sources (files, URLs, streams)
- Creates parser instance, sets handlers, and initiates parsing
- Uses default ErrorHandler if none provided

**parseString(string, handler, errorHandler=ErrorHandler()) (L35-48)**
- Parses XML from string data (both str and bytes supported)
- Creates appropriate InputSource wrapper (StringIO for strings, BytesIO for bytes)
- Handles character encoding transparently

**make_parser(parser_list=()) (L66-88)**
- Core parser factory function with fallback mechanism
- Attempts to create parsers from custom list first, then default_parser_list
- Returns first successfully instantiated parser
- Raises SAXReaderNotAvailable if no parsers can be created

**_create_parser(parser_name) (L92-94)**
- Internal utility to dynamically import and instantiate parser modules
- Uses __import__ to load parser module and calls its create_parser() function

### Key Imports and Dependencies
- **Lines 22-26**: Core SAX components (InputSource, handlers, exceptions)
- **Lines 36, 44-47**: io module for stream handling in parseString()
- **Lines 60-63**: Environment variable support for parser selection

### Configuration and Defaults

**default_parser_list (L53)**
- Default parser preference: ["xml.sax.expatreader"]
- Can be overridden via PY_SAX_PARSER environment variable (L61-62)

**Module Finder Hint (L56-58)**
- Uses _false flag pattern to inform modulefinder about potential expatreader import
- Ensures proper dependency tracking for packaging tools

### Error Handling Patterns
- ImportError handling distinguishes between missing modules and broken imports (L77-82)
- SAXReaderNotAvailable allows parsers to signal incompatibility (L83-86)
- Graceful fallback through parser list until successful instantiation

### Architectural Notes
- Follows factory pattern for parser creation with configurable fallback chain
- Environment-driven configuration allows runtime parser selection
- Clean separation between high-level convenience functions and internal implementation