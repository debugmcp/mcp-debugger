# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/saxutils.py
@source-hash: 3fe2cdb6386e0c4d
@generated: 2026-02-09T18:06:20Z

## Purpose
Core SAX (Simple API for XML) utilities module providing XML escaping, generation, filtering, and input source preparation functionality. Part of the Python standard library's XML processing suite within the LLDB debugging environment.

## Key Functions

**String Escaping/Unescaping (L12-68)**
- `__dict_replace(s, d)` (L12-16): Internal helper for bulk string replacement using dictionary mappings
- `escape(data, entities={})` (L18-32): Escapes XML special characters (&, <, >) with proper ordering (ampersand first)
- `unescape(data, entities={})` (L34-46): Reverses XML entity escaping (ampersand last to avoid double-unescaping)
- `quoteattr(data, entities={})` (L48-68): Escapes and quotes attribute values, handles whitespace entities and quote character conflicts

**Output Stream Management (L71-110)**
- `_gettextwriter(out, encoding)` (L71-110): Smart wrapper that adapts various output stream types (TextIOBase, codecs streams, RawIOBase, generic write objects) into consistent text writers with XML character reference error handling

## Key Classes

**XMLGenerator (L112-225)**
Core XML document generator implementing ContentHandler interface:
- Constructor (L114-124): Configures output stream, encoding (default iso-8859-1), namespace tracking, and short empty element support
- Namespace handling: `_ns_contexts` stack for URI-to-prefix mappings, `_qname()` method (L126-141) builds qualified names
- Element generation: Supports both regular and namespace-aware elements with pending start element optimization
- Content methods: `characters()` (L208-213), `ignorableWhitespace()` (L215-220), `processingInstruction()` (L222-224)
- Special XML namespace handling for 'http://www.w3.org/XML/1998/namespace' (L133-134)

**XMLFilterBase (L227-334)**
Transparent SAX event filter implementing XMLReader interface:
- Pass-through architecture: Delegates all handler calls to upstream parent reader
- Method categories: ErrorHandler (L241-248), ContentHandler (L252-289), DTDHandler (L293-297), EntityResolver (L301-302), XMLReader (L306-326)
- Filter chain support via `getParent()`/`setParent()` (L330-334)

**Utility Functions (L336-369)**

**prepare_input_source(source, base="") (L338-369)**
InputSource factory and resolver:
- Handles multiple input types: PathLike objects, strings (as URIs), file-like objects
- Auto-detection of character vs byte streams via `read(0)` type checking
- Fallback resolution: Local file system first, then URL opening
- Base URI resolution using `urllib.parse.urljoin()`

## Dependencies
- `io`, `codecs`: Stream handling and text encoding
- `os`, `urllib.parse`, `urllib.request`: File system and URL operations  
- `handler`, `xmlreader`: SAX framework components (relative imports)

## Architectural Patterns
- **Chain of Responsibility**: XMLFilterBase enables filter chaining
- **Adapter Pattern**: `_gettextwriter()` adapts diverse output types
- **Template Method**: XMLGenerator provides customizable XML generation framework
- **Factory Pattern**: `prepare_input_source()` creates appropriate InputSource objects

## Critical Invariants
- XML escaping order: ampersand must be escaped first and unescaped last
- Namespace context stack must be properly maintained during document generation
- Pending start element state prevents malformed XML output
- Character encoding consistency between streams and declared encoding