# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/dom/expatbuilder.py
@source-hash: 80598dbc5970feaa
@generated: 2026-02-09T18:06:20Z

## High-Performance XML DOM Builder using Expat Parser

This module provides optimized XML parsing and DOM construction using the Expat parser to build minidom document instances. It bypasses SAX/pulldom overhead for performance gains.

### Core Architecture
- **ExpatBuilder (L133-447)**: Main DOM builder class that uses Expat callbacks to construct minidom documents
- **FragmentBuilder (L591-706)**: Specialized builder for parsing XML fragments within a given context
- **Namespace Support**: Namespaces mixin class (L708-845) adds namespace handling to builders
- **Filter System**: FilterVisibilityController (L453-508) wraps DOMBuilderFilter for selective node processing

### Key Classes and Functions

**ElementInfo (L60-110)**: Metadata container for XML element type information
- Stores attribute info, content model, and provides type checking methods
- Methods: `getAttributeType()`, `isElementContent()`, `isEmpty()`, `isId()`

**ExpatBuilder (L133-447)**: Core document builder
- `createParser()` (L151): Creates Expat parser instance
- `parseFile()` (L197): Parses from file object with chunked reading
- `parseString()` (L216): Parses from string
- `install()` (L174): Sets up Expat callback handlers
- Handler methods for various XML events (L237-446)

**FragmentBuilder (L591-706)**: Context-aware fragment parsing
- Extends ExpatBuilder for parsing XML fragments
- Uses template document structure with entity references
- `_getNSattrs()` (L682): Collects namespace declarations from context

**Namespaces Mixin (L708-845)**: Adds namespace support
- `_parse_ns_name()` (L114): Parses namespace-qualified names
- Overrides element/attribute handlers for namespace processing
- `start_element_handler()` (L733): Creates namespace-aware elements

**Filter Classes**:
- **FilterVisibilityController (L453-508)**: Applies whatToShow filtering
- **FilterCrutch/Rejecter/Skipper (L511-570)**: Temporary handler replacement for filtering

### Performance Optimizations
- Character data continuation: Appends to existing text nodes rather than creating new ones
- Identity comparisons with None instead of truth tests
- Buffer text setting on parser for reduced callback overhead
- Interning of strings via `_intern()` (L111) and `_intern_setdefault`

### Public API Functions
- `parse()` (L896): Parse document from file/filename with optional namespaces
- `parseString()` (L914): Parse document from string
- `parseFragment()` (L925): Parse fragment with context
- `parseFragmentString()` (L945): Parse fragment string with context
- `makeBuilder()` (L957): Factory function for creating builders from options

### Dependencies
- xml.parsers.expat: Core XML parsing
- xml.dom.minidom: DOM node implementation
- xml.dom.xmlbuilder: Builder options and filters
- xml.dom.NodeFilter: Node filtering constants

### Key Constants
- Node type constants (L36-38): TEXT_NODE, CDATA_SECTION_NODE, DOCUMENT_NODE
- Filter constants (L40-43): FILTER_ACCEPT, FILTER_REJECT, FILTER_SKIP, FILTER_INTERRUPT
- Type info mapping (L48-58): Maps Expat attribute types to TypeInfo objects