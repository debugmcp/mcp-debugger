# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/
@generated: 2026-02-09T18:16:17Z

## SAX XML Processing Package

This directory implements Python's Simple API for XML (SAX) 2.0 specification, providing a complete event-driven XML parsing framework. SAX is a streaming XML API that processes documents sequentially through callback events, making it memory-efficient for large XML files.

## Overall Architecture

The package follows a layered architecture with clear separation of concerns:

- **Parser Interface Layer**: Abstract base classes defining standard SAX contracts
- **Parser Implementation**: Concrete expat-based XML parser with namespace support
- **Handler Framework**: Event callback interfaces for application integration
- **Utilities**: Helper functions for XML generation, filtering, and input handling
- **Exception Hierarchy**: Specialized error types for XML processing scenarios

## Key Components and Relationships

### Core Entry Points (__init__.py)
Primary public API providing high-level parsing functions:
- `parse(source, handler)`: Parse XML from files/URLs/streams
- `parseString(string, handler)`: Parse XML from string data
- `make_parser()`: Factory function with fallback parser selection

### Parser Engine (expatreader.py)
Complete SAX parser implementation wrapping pyexpat:
- **ExpatParser**: Main parser class supporting both namespace-aware and legacy modes
- **ExpatLocator**: Position tracking during parsing
- Incremental parsing support via `feed()`/`flush()`/`close()` methods
- External entity resolution with stack management

### Handler Interfaces (handler.py)
Event callback definitions following observer pattern:
- **ContentHandler**: Document structure events (elements, text, namespaces)
- **ErrorHandler**: Error reporting with three severity levels
- **DTDHandler**: DTD-related declarations
- **EntityResolver**: External entity resolution
- **LexicalHandler**: Optional lexical events (comments, CDATA)

### Abstract Framework (xmlreader.py)
Base classes and interfaces:
- **XMLReader**: Abstract parser interface with handler management
- **IncrementalParser**: Streaming parser base with chunked reading
- **AttributesImpl/AttributesNSImpl**: Attribute containers for namespace-aware/unaware processing
- **InputSource**: Input abstraction supporting files, streams, URIs

### Utilities (saxutils.py)
Helper functionality for XML processing:
- **XMLGenerator**: ContentHandler implementation for XML output generation
- **XMLFilterBase**: Transparent event filter for parser chaining
- String escaping/unescaping with proper entity handling
- Input source preparation and stream adaptation

### Exception Hierarchy (_exceptions.py)
Specialized error types:
- **SAXException**: Base exception with nested exception support
- **SAXParseException**: Location-aware parsing errors
- **SAXNotRecognizedException/SAXNotSupportedException**: Feature/property errors
- **SAXReaderNotAvailable**: Parser availability issues

## Public API Surface

### Primary Entry Points
```python
# High-level parsing
sax.parse(source, handler)
sax.parseString(xml_string, handler)

# Parser creation
parser = sax.make_parser()
parser.setContentHandler(handler)
parser.parse(source)
```

### Handler Implementation
```python
class MyHandler(sax.ContentHandler):
    def startElement(self, name, attrs): pass
    def endElement(self, name): pass
    def characters(self, content): pass
```

### XML Generation
```python
generator = sax.saxutils.XMLGenerator(output_stream)
# Use as ContentHandler to generate XML
```

## Internal Data Flow

1. **Parser Creation**: `make_parser()` attempts parser instantiation with fallback
2. **Input Preparation**: `prepare_input_source()` normalizes input sources
3. **Event Generation**: Parser reads XML and generates SAX events
4. **Handler Dispatch**: Events dispatched to registered handlers
5. **Error Handling**: Exceptions propagated through handler chain with location info

## Key Patterns and Conventions

- **Observer Pattern**: Handlers receive events via callback methods
- **Factory Pattern**: Parser creation with configurable fallback chain
- **Chain of Responsibility**: XMLFilterBase enables parser/handler chaining  
- **Template Method**: Handler base classes provide overrideable behavior
- **Adapter Pattern**: Stream adaptation in saxutils for diverse output types

## Configuration and Features

- **Namespace Processing**: Configurable via `feature_namespaces`
- **String Interning**: Optional performance optimization
- **External Entity Handling**: Configurable security policy
- **Encoding Detection**: Automatic character encoding handling
- **Incremental Parsing**: Support for streaming large documents

## Integration Notes

This SAX implementation is part of LLDB's debugging environment, providing XML processing capabilities for configuration files, debugging metadata, and structured data interchange. The parser handles both legacy non-namespace XML and modern namespace-aware documents, making it suitable for diverse XML processing needs within the debugging toolkit.