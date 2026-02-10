# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/ast.py
@source-hash: d16626aa5c054bcc
@generated: 2026-02-09T18:09:35Z

## Purpose
Python's `ast` module provides tools for working with Abstract Syntax Trees (ASTs). This file contains the main API for parsing Python source code into ASTs, manipulating AST nodes, and converting ASTs back to source code.

## Core Functions

### Parsing & Evaluation
- `parse()` (L34-53): Converts Python source code into an AST. Accepts source string, filename, mode ('exec', 'eval', 'single'), type comments flag, and feature version.
- `literal_eval()` (L56-112): Safely evaluates string expressions containing only Python literals (strings, numbers, tuples, lists, dicts, sets, booleans, None). Uses recursive `_convert()` helper functions for type-safe evaluation.

### AST Manipulation
- `dump()` (L115-179): Creates formatted string representation of AST nodes for debugging. Has options for field annotation, attribute inclusion, and indentation.
- `copy_location()` (L182-196): Copies source location attributes (lineno, col_offset, end_lineno, end_col_offset) between AST nodes.
- `fix_missing_locations()` (L199-231): Recursively fills missing line/column information in AST nodes using parent node values.
- `increment_lineno()` (L234-254): Adjusts line numbers of all nodes in an AST by a given offset.

### Tree Traversal
- `iter_fields()` (L257-266): Yields (fieldname, value) tuples for node fields.
- `iter_child_nodes()` (L269-280): Yields direct child AST nodes.
- `walk()` (L369-380): Recursively yields all descendant nodes using breadth-first traversal.

### Visitor Pattern Classes
- `NodeVisitor` (L383-438): Base class for AST traversal. Uses dynamic method dispatch (`visit_ClassName`) with fallback to `generic_visit()`. Contains special handling for deprecated `Constant` node types.
- `NodeTransformer` (L441-497): Subclass of `NodeVisitor` that allows AST modification during traversal. Visitor methods can return replacement nodes or None to remove nodes.

### Source Code Generation
- `_Unparser` (L724-1788): Comprehensive AST-to-source converter. Uses visitor pattern with precedence handling for correct parenthesization. Key features:
  - Precedence system via `_Precedence` enum (L689-717)
  - String literal handling with quote selection
  - F-string unparsing with proper escaping
  - Context managers for indentation and delimiters
- `unparse()` (L1789-1791): Public interface to `_Unparser`.

### Utility Functions
- `get_docstring()` (L283-304): Extracts docstrings from function/class/module nodes.
- `get_source_segment()` (L332-366): Extracts original source code segment for an AST node using line/column info.

## Dependencies
- Imports core AST types from `_ast` module (L29)
- Uses `contextlib` for context managers (L30)
- Uses `enum` for precedence definitions (L31)

## Deprecated Elements
Contains extensive backward compatibility code:
- Deprecated AST node classes: `Num`, `Str`, `Bytes`, `NameConstant`, `Ellipsis` (L590-621)
- Deprecated slice classes: `slice`, `Index`, `ExtSlice` (L644-655)  
- Deprecated context classes: `Suite`, `AugLoad`, `AugStore`, `Param` (L671-681)
- Dynamic attribute access for deprecated names via `__getattr__()` (L1799-1807)

## Entry Point
- `main()` (L1810-1835): Command-line interface for parsing and dumping Python files as ASTs.