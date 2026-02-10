# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/html/
@generated: 2026-02-09T18:16:10Z

## HTML Processing Library

This directory provides a complete HTML processing toolkit implementing the core functionality for parsing HTML/XHTML documents and handling character entities according to HTML4 and HTML5 standards.

## Overall Purpose

The module serves as the foundational HTML processing infrastructure within the LLDB debugger's documentation system, enabling parsing of HTML content, safe character escaping/unescaping, and comprehensive entity reference handling. It supports both strict XHTML parsing and tolerant HTML parsing for real-world web content.

## Key Components and Integration

**HTMLParser (parser.py)** - Event-driven HTML/XHTML parser that tokenizes markup using regex patterns and dispatches to handler methods. Supports both normal parsing mode and CDATA mode for script/style elements. Provides tolerant parsing for malformed HTML.

**Character Utilities (__init__.py)** - HTML-safe string processing functions implementing HTML5 standard compliance for character reference conversion. Integrates with the entity mappings to provide bidirectional conversion between characters and entity references.

**Entity Reference Mappings (entities.py)** - Comprehensive character entity databases providing bidirectional lookups between HTML entity names and Unicode codepoints. Supports both HTML4 (252 entities) and HTML5 (2,231+ entities) standards.

## Public API Surface

### Main Entry Points

**HTMLParser class**:
- `HTMLParser(convert_charrefs=True)` - Main parser constructor
- `feed(data)` - Process HTML content incrementally  
- `close()` - Finalize parsing
- Handler methods for customization: `handle_starttag()`, `handle_endtag()`, `handle_data()`, etc.

**Character Processing**:
- `escape(s, quote=True)` - Convert special characters to HTML entities
- `unescape(s)` - Convert HTML entities back to Unicode characters

**Entity Mappings**:
- `html5` - Complete HTML5 named character reference dictionary
- `name2codepoint` - HTML4 entity name to Unicode codepoint mapping
- `codepoint2name` - Reverse Unicode codepoint to entity name mapping
- `entitydefs` - Entity name to character string mapping

## Internal Organization and Data Flow

1. **Input Processing**: HTMLParser receives raw HTML text via `feed()` method
2. **Tokenization**: Core parsing loop (`goahead()`) scans for markup using regex patterns
3. **State Management**: Parser switches between normal and CDATA modes based on element types
4. **Entity Resolution**: Character references are converted using entity mappings when `convert_charrefs` is enabled
5. **Event Generation**: Parser dispatches to appropriate handler methods for each markup construct
6. **Character Safety**: Escape/unescape functions ensure safe HTML generation and processing

## Important Patterns and Conventions

- **Event-driven architecture**: Parser generates events rather than building parse trees, enabling streaming processing
- **Tolerant parsing**: Uses lenient regex patterns to handle malformed HTML gracefully
- **Standards compliance**: Entity handling follows HTML5 specifications with fallback to HTML4
- **Performance optimization**: Early return patterns, compiled regex caching, and O(1) entity lookups
- **Safety-first escaping**: Processes ampersands first to prevent double-encoding cascades
- **Template method pattern**: Virtual handler methods allow easy customization without modifying core parsing logic

The module provides a robust foundation for any system requiring HTML content processing, from web scraping to documentation generation to safe content rendering.