# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/handler.py
@source-hash: 64c7aae49f1dd382
@generated: 2026-02-09T18:06:16Z

## Purpose
Core SAX 2.0 handler interface definitions for Python XML parsing. Provides base classes and abstract interfaces that SAX parsers use to report parsing events to applications. These are primarily empty template classes meant for subclassing.

## Key Classes

### ErrorHandler (L22-43)
Basic error reporting interface with three severity levels:
- `error()` (L32-34): Handle recoverable errors, raises exception by default
- `fatalError()` (L36-38): Handle non-recoverable errors, raises exception by default  
- `warning()` (L40-42): Handle warnings, prints to stdout by default

### ContentHandler (L47-204)
Main SAX callback interface for document content events. Defines document parsing lifecycle:
- `setDocumentLocator()` (L57-78): Receives locator for position tracking
- `startDocument()`/`endDocument()` (L80-94): Document boundary events
- `startPrefixMapping()`/`endPrefixMapping()` (L96-124): Namespace prefix scope events
- `startElement()`/`endElement()` (L126-138): Non-namespace element events
- `startElementNS()`/`endElementNS()` (L140-156): Namespace-aware element events
- `characters()` (L158-166): Character data notification
- `ignorableWhitespace()` (L168-180): Whitespace in element content
- `processingInstruction()` (L182-191): PI handling
- `skippedEntity()` (L193-203): Entity skip notification

### DTDHandler (L208-218)
Interface for DTD-related events:
- `notationDecl()` (L214-215): Notation declarations
- `unparsedEntityDecl()` (L217-218): Unparsed entity declarations

### EntityResolver (L223-234)
Interface for resolving external entities:
- `resolveEntity()` (L230-234): Returns system identifier or InputSource

### LexicalHandler (L345-387)
Optional handler for lexical events (comments, CDATA, DTD boundaries):
- `comment()` (L358-362): Comment reporting
- `startDTD()`/`endDTD()` (L364-378): DTD declaration boundaries
- `startCDATA()`/`endCDATA()` (L380-387): CDATA section boundaries

## Feature Constants (L243-285)
Standard SAX feature URIs controlling parser behavior:
- `feature_namespaces`: Namespace processing control
- `feature_namespace_prefixes`: Prefix reporting control  
- `feature_string_interning`: String interning behavior
- `feature_validation`: Validation control
- `feature_external_ges`/`feature_external_pes`: External entity inclusion

## Property Constants (L294-342)
Standard SAX property URIs for parser configuration:
- `property_lexical_handler`: Lexical event handler assignment
- `property_declaration_handler`: DTD declaration handler
- `property_encoding`: Input encoding specification
- `property_interning_dict`: String interning dictionary

## Architecture Notes
- All handler methods are no-op by default (template pattern)
- Handlers follow callback/observer pattern - parsers call these methods during parsing
- ContentHandler is the primary interface most applications will implement
- Version marked as "2.0beta" (L12)
- Part of xml.sax package ecosystem for SAX parsing in Python