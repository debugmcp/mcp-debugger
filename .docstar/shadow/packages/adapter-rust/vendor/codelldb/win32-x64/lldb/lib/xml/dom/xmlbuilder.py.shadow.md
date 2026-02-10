# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/dom/xmlbuilder.py
@source-hash: d4f33a8f01875562
@generated: 2026-02-09T18:06:22Z

## Purpose
DOM Level 3 Load/Save feature implementation providing XML parsing and document building capabilities through DOM builders with configurable features and entity resolution.

## Key Classes

**Options (L12-42)**: Configuration container for DOMBuilder features. Stores parsing options like namespaces (L22), validation (L24), entity handling (L25-27), whitespace processing (L33), comments (L35), and encoding behavior (L36). Used to pass settings from DOMBuilder to ExpatBuilder.

**DOMBuilder (L44-206)**: Main XML document builder implementing DOM Level 3 LS-Load specification. Core methods:
- `setFeature(name, state)` (L75): Configure parsing features using _settings dictionary (L101-160)
- `parseURI(uri)` (L180): Parse XML from URI using entity resolver
- `parse(input)` (L187): Parse from DOMInputSource, delegates to expatbuilder (L202-205)
- `parseWithContext()` (L197): Context-aware parsing (not implemented)

Action constants for context parsing: ACTION_REPLACE, ACTION_APPEND_AS_CHILDREN, ACTION_INSERT_AFTER, ACTION_INSERT_BEFORE (L49-52).

**DOMEntityResolver (L212-254)**: Entity resolution for XML documents. Key methods:
- `resolveEntity(publicId, systemId)` (L215): Creates DOMInputSource with proper encoding detection and base URI calculation
- `_get_opener()` (L237): Lazy-loads urllib opener for HTTP requests
- `_guess_media_encoding()` (L248): Extracts charset from Content-Type headers

**DOMInputSource (L256-302)**: Input source abstraction with slots for byteStream, characterStream, stringData, encoding, publicId, systemId, baseURI (L257-258). Provides getter/setter methods for all properties.

**DOMBuilderFilter (L305-330)**: Element filtering during DOM construction. Filter constants: FILTER_ACCEPT, FILTER_REJECT, FILTER_SKIP, FILTER_INTERRUPT (L315-318). Methods `acceptNode()` and `startContainer()` default to FILTER_ACCEPT.

**DocumentLS (L334-365)**: Mixin for load/save document functionality. Provides `saveXML()` implementation (L359) but load methods are not implemented.

**DOMImplementationLS (L367-387)**: Factory for DOM builders. `createDOMBuilder()` (L371) only supports synchronous mode, raises NotSupportedErr for async or schema validation.

## Dependencies
- xml.dom: DOM exceptions and core functionality
- xml.dom.expatbuilder: Actual XML parsing implementation
- xml.dom.NodeFilter: Node filtering constants
- urllib: HTTP/URL handling for entity resolution

## Architecture Patterns
- Feature-based configuration through Options class and _settings mapping
- Entity resolution with lazy HTTP opener initialization
- Delegation pattern: DOMBuilder delegates actual parsing to expatbuilder
- Mixin pattern: DocumentLS provides load/save capabilities to documents

## Key Functions
**_name_xform(name)** (L208-209): Converts feature names from DOM standard format (kebab-case) to Python attribute format (snake_case).

## Critical Constraints
- Only synchronous parsing supported
- Schema validation not implemented
- Context-aware parsing not implemented
- Asynchronous operations raise NotSupportedErr
- Entity resolver requires systemId (L216 assertion)