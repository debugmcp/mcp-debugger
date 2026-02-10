# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/ast.py
@source-hash: d16626aa5c054bcc
@generated: 2026-02-09T18:08:33Z

This is Python's `ast` module providing comprehensive Abstract Syntax Tree manipulation capabilities for Python code analysis and transformation.

## Primary Purpose
Processes trees of Python abstract syntax grammar, enabling programmatic access to Python's AST structure for parsing, analysis, and code generation.

## Core Functions

### Parsing & Evaluation
- **parse() (L34-53)**: Main entry point for parsing Python source into AST nodes. Handles feature versions, type comments via PyCF_ONLY_AST flag
- **literal_eval() (L56-112)**: Safe evaluation of literal expressions (strings, numbers, containers). Uses recursive _convert() helper with malformed node detection
- **compile()**: Referenced throughout for AST compilation to bytecode

### AST Manipulation  
- **dump() (L115-179)**: Debug-friendly AST tree formatter with optional indentation and field annotation via _format() helper
- **copy_location() (L182-196)**: Copies source location attributes (lineno, col_offset, end_lineno, end_col_offset) between nodes
- **fix_missing_locations() (L199-231)**: Recursively fills missing location info from parent nodes via _fix() helper
- **increment_lineno() (L234-254)**: Adjusts line numbers across entire AST subtree, handles TypeIgnore special case

### Tree Traversal
- **iter_fields() (L257-266)**: Yields (fieldname, value) tuples for node fields
- **iter_child_nodes() (L269-280)**: Yields direct AST child nodes, handles both single nodes and lists
- **walk() (L369-380)**: Breadth-first traversal of all descendant nodes using deque
- **get_docstring() (L283-304)**: Extracts docstring from function/class/module nodes with optional cleaning

### Source Code Utilities
- **get_source_segment() (L332-366)**: Extracts original source code segment for a node using line/column info
- **_splitlines_no_ff() (L308-318)**: Splits source respecting Python parser behavior
- **_pad_whitespace() (L321-329)**: Preserves whitespace structure for source reconstruction

## Key Classes

### Visitor Pattern Implementation
- **NodeVisitor (L383-438)**: Base class for AST traversal with dynamic method dispatch (visit_ClassName pattern). Includes generic_visit() fallback and deprecated Constant handling
- **NodeTransformer (L441-497)**: Extends NodeVisitor for AST modification, supports node replacement/removal and list handling in generic_visit()

### Code Generation
- **_Unparser (L724-1787)**: Comprehensive AST-to-source converter with precedence handling, formatting contexts, and Python syntax reconstruction
  - Precedence system via _Precedence enum (L688-717)
  - Context managers for delimiters, blocks, buffering (L774-815)
  - Extensive visit_* methods for all AST node types
  - String literal handling with quote selection (L1180-1222)
  - F-string formatting support (L1224-1307)

### Deprecated Node Classes
- **Backward compatibility classes (L590-682)**: Num, Str, Bytes, NameConstant, Ellipsis with deprecation warnings and metaclass _ABC
- **Legacy slice classes (L644-669)**: Index, ExtSlice with automatic conversion to modern equivalents

## Important Constants & Data
- **_const_types (L622-631)**: Maps deprecated classes to Python types
- **_const_node_type_names (L633-642)**: Type mapping for visitor method dispatch
- **_INFSTR (L686)**: Infinity representation for unparsing
- **Operator mappings**: binop (L1456-1470), unop (L1436-1442), cmpops (L1506-1517), boolops (L1527)

## Dependencies
- **_ast module**: Core AST node classes imported via `from _ast import *`
- **contextlib**: Context managers for code generation
- **enum**: IntEnum for precedence system
- **collections.deque**: Efficient tree traversal
- **re**: Pattern matching for source splitting

## Architectural Patterns
- **Visitor Pattern**: Clean separation of traversal logic from node-specific operations
- **Context Managers**: Elegant handling of nested code structures and buffering
- **Precedence System**: Ensures correct parenthesization in code generation
- **Deprecation Layer**: Smooth migration from old AST node types to Constant

## Critical Constraints
- **Source location consistency**: Location attributes must be properly maintained for compilation
- **Type safety in literal_eval**: Only allows safe literal expressions
- **Precedence correctness**: Unparser must preserve operator precedence and associativity
- **Python version compatibility**: Feature version handling for different Python syntax features