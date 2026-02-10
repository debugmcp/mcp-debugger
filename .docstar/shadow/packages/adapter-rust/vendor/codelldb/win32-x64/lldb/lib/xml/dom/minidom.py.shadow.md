# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/dom/minidom.py
@source-hash: af4ee09b06efc54e
@generated: 2026-02-09T18:06:27Z

## Primary Purpose
Python minidom DOM implementation providing Level 1 DOM with basic Level 2/3 namespace features. Part of Python's standard library xml.dom package, used for parsing and manipulating XML documents in memory.

## Core Architecture

**Base Node Class (L34-283):** Foundation class implementing DOM Node interface with tree navigation, child manipulation, and XML serialization. Key methods:
- `toxml()/toprettyxml()` (L46-66): XML serialization with formatting
- `insertBefore()/appendChild()/removeChild()` (L82-177): Tree manipulation with sibling linking
- `normalize()` (L179-204): Text node consolidation
- `cloneNode()` (L206-207): Deep/shallow node copying
- Context manager support (L272-278) for automatic cleanup

**Document Class (L1546-1883):** Root document container extending Node and DocumentLS. Features:
- Element/node factory methods (L1673-1739)
- `getElementById()` (L1741-1797): ID-based element lookup with caching
- `getElementsByTagName[NS]()` (L1799-1804): Tag-based element search
- XML parsing integration via `parse()`/`parseString()` functions (L1986-2004)

**Element Class (L664-937):** Represents XML elements with attribute management:
- Lazy attribute dictionaries (`_attrs`, `_attrsNS`) initialized by `_ensure_attributes()` (L701-704)
- Dual attribute indexing: by name and by (namespace, localName)
- Attribute CRUD operations (L723-839) with namespace support
- XML serialization with `writexml()` (L871-901)

**Attribute Classes:**
- `Attr` (L345-471): Attribute nodes with namespace support and ID detection
- `NamedNodeMap` (L473-638): Live attribute collection providing dict-like interface to element's attributes

**Text/Character Classes:**
- `CharacterData` (L1018-1089): Base for text-containing nodes with data manipulation methods
- `Text` (L1092-1181): Text nodes with `splitText()` and whitespace detection
- `CDATASection` (L1215-1224): CDATA sections extending Text
- `Comment` (L1201-1212): Comment nodes

**Utility Classes:**
- `DocumentFragment` (L327-342): Container for node groups
- `ProcessingInstruction` (L992-1015): PI nodes
- `DocumentType` (L1308-1366): DTD declarations
- `Childless` (L951-990): Mixin preventing child operations

## Key Dependencies
- `xml.dom`: Core DOM constants and exceptions
- `xml.dom.expatbuilder`: Default XML parser backend
- `xml.dom.pulldom`: Alternative streaming parser
- `io`: Text/binary stream handling for serialization

## Critical Implementation Details

**ID Caching:** Document maintains `_id_cache` and `_id_search_stack` for efficient `getElementById()` with cache invalidation via `_clear_id_cache()` (L1538-1544).

**Namespace Handling:** Dual indexing system for attributes supports both qualified names and (URI, localName) tuples. `_nssplit()` helper (L1971-1976) parses qualified names.

**Memory Management:** Circular references between elements/attributes broken by `unlink()` methods. Context manager support ensures cleanup.

**Parser Integration:** Module provides high-level `parse()`/`parseString()` functions (L1986-2004) that delegate to expatbuilder or pulldom based on parameters.

## Usage Patterns
```python
# Parse XML
doc = minidom.parse("file.xml")
doc = minidom.parseString("<root><child/></root>")

# Navigate/modify DOM
root = doc.documentElement
child = root.getElementsByTagName("child")[0]
root.setAttribute("attr", "value")

# Serialize
print(doc.toxml())
```