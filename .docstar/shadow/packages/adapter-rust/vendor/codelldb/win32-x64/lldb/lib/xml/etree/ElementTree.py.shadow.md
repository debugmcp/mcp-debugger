# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/etree/ElementTree.py
@source-hash: 897618a09d05dadf
@generated: 2026-02-09T18:06:23Z

## Primary Purpose
Lightweight XML processing library providing hierarchical XML parsing, element manipulation, and serialization capabilities. Core implementation of Python's XML ElementTree API with support for multiple output formats (XML, HTML, text, C14N).

## Key Classes & Functions

### Core Element Classes
- **Element (L126-413)**: Primary XML element container with dict-like attributes and list-like children
  - Key properties: `tag`, `attrib`, `text`, `tail` (L147-168)
  - Container operations: `__getitem__`, `__setitem__`, `append`, `extend`, `remove` (L211-270)
  - XPath support: `find`, `findall`, `findtext`, `iterfind` (L272-317)
  - Tree traversal: `iter`, `itertext` (L373-412)

- **ElementTree (L514-735)**: Document-level container wrapping root element
  - Parsing: `parse` method with XMLParser integration (L545-577)
  - Serialization: `write` method supporting multiple formats (L679-731)
  - XPath delegation to root element (L591-677)

- **QName (L466-510)**: Qualified name wrapper for proper namespace handling
  - Supports both `{uri}local` and separate URI/tag construction (L480-483)
  - Full comparison operators for sorting/equality (L490-509)

### Parsing Infrastructure  
- **XMLParser (L1503-1736)**: Expat-based XML parser with configurable target
  - Event-driven parsing with TreeBuilder target (L1513-1557)
  - Namespace and error handling (L1628-1709)
  - Feed/close pattern for incremental parsing (L1703-1725)

- **XMLPullParser (L1264-1320)**: Event-streaming parser for large documents
  - Event queue management with `read_events` iterator (L1302-1314)
  - Supports "start", "end", "start-ns", "end-ns" events (L1266-1276)

- **TreeBuilder (L1381-1500)**: SAX-like builder creating Element trees
  - Factory pattern for elements, comments, PIs (L1401-1419)
  - Stack-based element construction (L1443-1472)

### Factory Functions
- **SubElement (L415-431)**: Creates and appends child element to parent
- **Comment (L433-444)**: Creates comment element with special tag
- **ProcessingInstruction/PI (L447-463)**: Creates PI element

### Serialization & Utilities
- **Serialization functions**: `tostring`, `tostringlist`, `dump` (L1067-1137)
- **indent (L1140-1188)**: Pretty-prints XML with configurable whitespace
- **Parsing functions**: `parse`, `iterparse`, `XML`, `XMLID`, `fromstring` (L1194-1376)

### C14N Canonicalization
- **canonicalize (L1740-1767)**: Converts XML to canonical form
- **C14NWriterTarget (L1773-2029)**: Streaming canonicalization target
  - Namespace prefix rewriting and QName-aware processing (L1844-1879)
  - Configurable comment/whitespace handling (L1795-1814)

## Key Dependencies
- **ElementPath module (L104)**: XPath expression evaluation
- **xml.parsers.expat**: Low-level XML parsing (L1515-1522) 
- **Standard libraries**: `sys`, `re`, `warnings`, `io`, `collections`, `contextlib`, `weakref`

## Architectural Patterns
- **Dual Implementation**: Python fallback with optional C acceleration (L2073-2085)
- **Factory Pattern**: Configurable element/comment/PI creation
- **Builder Pattern**: TreeBuilder constructs trees from SAX events
- **Streaming**: Support for both DOM-style and event-driven parsing
- **Namespace Handling**: Global registry with prefix management (L969-1001)

## Critical Constraints
- Elements must be Element instances for tree operations (L251-255)
- Mutable default argument in SubElement/Element constructors (L170, L415)
- Parser/target circular references require explicit cleanup (L1722-1725)
- Version compatibility warnings for boolean element evaluation (L202-209)