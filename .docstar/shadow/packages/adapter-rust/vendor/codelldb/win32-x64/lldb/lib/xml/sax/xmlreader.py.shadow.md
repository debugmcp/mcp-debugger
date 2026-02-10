# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/xmlreader.py
@source-hash: 0962c8d64ac8b031
@generated: 2026-02-09T18:06:19Z

## Primary Purpose
SAX 2.0 XML parser interface definitions providing abstract base classes for XML document parsing with callback-based event handling. Core implementation of the Simple API for XML (SAX) specification.

## Key Classes and Components

### XMLReader (L11-89)
Abstract base class defining the standard SAX parser interface. Manages four event handlers:
- `_cont_handler`: ContentHandler for document content events (L25)
- `_dtd_handler`: DTDHandler for DTD-related events (L26)  
- `_ent_handler`: EntityResolver for external entity resolution (L27)
- `_err_handler`: ErrorHandler for error processing (L28)

**Key Methods:**
- `parse(source)` (L30): Abstract method for parsing XML documents - must be implemented by subclasses
- Handler getters/setters (L34-64): Access and configure event handlers
- `setLocale(locale)` (L66): Always raises SAXNotSupportedException
- Feature/property methods (L75-89): Always raise SAXNotRecognizedException - intended for subclass override

### IncrementalParser (L91-159)
Extends XMLReader to support streaming/incremental XML parsing. Provides concrete `parse()` implementation using chunked reading.

**Key Methods:**
- `parse(source)` (L115): Concrete implementation using saxutils, reads in chunks of `_bufsize` (default 64KB)
- `feed(data)` (L127): Abstract method for processing XML data chunks
- `prepareParser(source)` (L136): Abstract setup method called before parsing
- `close()` (L141): Abstract method to finalize parsing
- `reset()` (L154): Abstract method to prepare parser for reuse

**Usage Pattern:** instantiate → feed data → close → reset → repeat

### Locator (L163-183)
Interface for tracking document position during SAX events. Default implementation returns sentinel values (-1 for numbers, None for identifiers). Subclasses should override for actual position tracking.

### InputSource (L187-272)
Encapsulates input data for XML parsing. Supports multiple input methods with precedence: character stream > byte stream > URI.

**Private Attributes:**
- `__system_id`, `__public_id`: Document identifiers (L204-205)
- `__encoding`: Character encoding hint (L206)
- `__bytefile`, `__charfile`: Input streams (L207-208)

### AttributesImpl (L276-334)
Non-namespace-aware XML attribute container. Dictionary-like interface with SAX-specific methods.
- Wraps `_attrs` dictionary providing both SAX interface and Python dict operations
- `getType()` always returns "CDATA" (L287-288)

### AttributesNSImpl (L338-369)
Namespace-aware attribute container extending AttributesImpl.
- Manages `_attrs` {(ns_uri, lname): value} and `_qnames` {(ns_uri, lname): qname} mappings
- Provides bidirectional QName ↔ namespace name resolution

## Dependencies
- `handler` module: Provides default handler implementations
- `_exceptions`: SAX exception classes (SAXNotSupportedException, SAXNotRecognizedException)
- `saxutils`: Used in IncrementalParser.parse() for input source preparation

## Architecture Notes
- Pure interface definitions - all parsing logic must be implemented by subclasses
- Synchronous parsing model enforced by design
- Event-driven architecture with four distinct handler types
- Support for both namespace-aware and non-namespace-aware processing
- Input abstraction supports files, streams, and URIs

## Test Function
`_test()` (L372-375): Basic instantiation test for main classes