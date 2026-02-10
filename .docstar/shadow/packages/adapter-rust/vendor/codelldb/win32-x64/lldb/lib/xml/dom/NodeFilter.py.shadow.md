# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/dom/NodeFilter.py
@source-hash: 9bfacbbb64e239a7
@generated: 2026-02-09T18:06:07Z

## Purpose
Python implementation of DOM2 NodeFilter interface for XML DOM traversal operations. Provides constants for filter actions and node type visibility masks used in DOM tree traversal and filtering.

## Key Components

### NodeFilter Class (L4-27)
Main class implementing DOM2 NodeFilter interface specification. Contains only constants and one abstract method.

**Filter Action Constants (L8-10):**
- `FILTER_ACCEPT = 1` - Accept the node during traversal
- `FILTER_REJECT = 2` - Reject node and its descendants  
- `FILTER_SKIP = 3` - Skip node but continue with descendants

**Node Type Visibility Masks (L12-24):**
Bitmask constants for controlling which DOM node types are visible during traversal:
- `SHOW_ALL = 0xFFFFFFFF` - Show all node types
- `SHOW_ELEMENT = 0x00000001` - Element nodes
- `SHOW_ATTRIBUTE = 0x00000002` - Attribute nodes
- `SHOW_TEXT = 0x00000004` - Text nodes
- `SHOW_CDATA_SECTION = 0x00000008` - CDATA section nodes
- `SHOW_ENTITY_REFERENCE = 0x00000010` - Entity reference nodes
- `SHOW_ENTITY = 0x00000020` - Entity nodes
- `SHOW_PROCESSING_INSTRUCTION = 0x00000040` - Processing instruction nodes
- `SHOW_COMMENT = 0x00000080` - Comment nodes
- `SHOW_DOCUMENT = 0x00000100` - Document nodes
- `SHOW_DOCUMENT_TYPE = 0x00000200` - Document type nodes
- `SHOW_DOCUMENT_FRAGMENT = 0x00000400` - Document fragment nodes
- `SHOW_NOTATION = 0x00000800` - Notation nodes

**Abstract Method:**
- `acceptNode(self, node)` (L26-27) - Must be implemented by subclasses to define filtering logic

## Usage Context
Part of LLDB's XML DOM processing capabilities. Designed for implementing custom node filters in DOM tree traversal operations. Follows W3C DOM Level 2 Traversal and Range specification.

## Dependencies
Standard Python - no external dependencies required.

## Architecture Notes
- Pure constant/interface definition class
- Follows DOM2 specification exactly
- Designed for inheritance - subclasses implement `acceptNode()` method
- Bitmask pattern allows combining multiple node types with bitwise OR operations