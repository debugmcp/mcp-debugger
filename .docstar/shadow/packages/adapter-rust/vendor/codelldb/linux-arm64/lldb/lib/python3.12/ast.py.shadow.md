# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/ast.py
@source-hash: d16626aa5c054bcc
@generated: 2026-02-09T18:08:39Z

**Python AST Module - Abstract Syntax Tree Processing**

Core module for manipulating Python abstract syntax trees, providing parsing, traversal, modification, and code generation capabilities.

## Primary Functions

**parse()** (L34-53): Main entry point for parsing Python source code into AST nodes. Accepts source string, filename, mode ('exec', 'eval', 'single'), and optional type comments and feature version. Returns AST node tree.

**literal_eval()** (L56-112): Safe evaluation of string expressions containing only Python literals (strings, numbers, tuples, lists, dicts, sets, booleans, None). Uses recursive conversion with malformed node validation.

**dump()** (L115-179): Debug utility for pretty-printing AST trees. Supports field annotation control, attribute inclusion, and indentation formatting.

## AST Manipulation Utilities

**copy_location()** (L182-196): Transfers source location attributes (lineno, col_offset, end_lineno, end_col_offset) between AST nodes.

**fix_missing_locations()** (L199-231): Recursively fills missing location information by inheriting from parent nodes, essential for compilation.

**increment_lineno()** (L234-254): Adjusts line numbers throughout AST tree, useful for code relocation.

**get_source_segment()** (L332-366): Extracts original source code segment for a given AST node using location information.

## Tree Traversal

**iter_fields()** (L257-266): Generator yielding (fieldname, value) tuples for node fields.

**iter_child_nodes()** (L269-280): Generator yielding direct AST child nodes.

**walk()** (L369-380): Depth-first traversal generator yielding all descendant nodes using deque-based iteration.

**get_docstring()** (L283-304): Extracts and optionally cleans docstring from function/class/module nodes.

## Visitor Pattern Classes

**NodeVisitor** (L383-438): Base class for AST traversal with dynamic visitor method dispatch (visit_NodeName pattern). Includes deprecated constant node handling with warnings.

**NodeTransformer** (L441-497): Subclass allowing AST modification during traversal. Visitor methods can return None (remove node), replacement node, or list of nodes for statements.

## Code Generation

**_Unparser** (L724-1787): Comprehensive AST-to-source converter with precedence handling, formatting control, and Python syntax compliance. Key methods:
- visit() (L855-860): Main unparsing entry point
- Precedence management via _Precedence enum (L689-717)
- String literal handling with backslash avoidance
- F-string generation with quote type optimization

**unparse()** (L1789-1791): Public interface to _Unparser for converting AST back to Python source code.

## Deprecated Node Compatibility

Extensive backward compatibility layer (L500-682) for deprecated AST node types:
- Legacy constant nodes (Num, Str, Bytes, NameConstant, Ellipsis) mapped to modern Constant
- Deprecated slice nodes (Index, ExtSlice) with automatic conversion
- Warning system for deprecated usage

## Dependencies & Architecture

- Imports core AST nodes from `_ast` module
- Uses contextlib for unparsing state management
- Employs visitor pattern for extensible tree processing
- Maintains precedence tables for correct parenthesization
- String processing utilities for source code handling

## Critical Constraints

- AST nodes must have proper location information for compilation
- Unparsing maintains semantic equivalence but not formatting
- Deprecated node usage triggers deprecation warnings
- Safe literal evaluation restricted to specific node types only