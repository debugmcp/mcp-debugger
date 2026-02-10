# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/ast.py
@source-hash: d16626aa5c054bcc
@generated: 2026-02-09T18:07:19Z

## Purpose
Python AST (Abstract Syntax Tree) module providing comprehensive tools for parsing, manipulating, and unparsing Python source code. This is the standard library implementation that enables programmatic code analysis and transformation.

## Core Functions

### Parsing & Evaluation
- `parse(source, filename='<unknown>', mode='exec', *, type_comments=False, feature_version=None)` (L34-53): Main entry point for converting source code to AST nodes. Wraps compile() with PyCF_ONLY_AST flag. Handles feature version validation for Python 3.x compatibility.
- `literal_eval(node_or_string)` (L56-112): Safe evaluation of Python literals only (strings, numbers, tuples, lists, dicts, sets, booleans, None). Includes complex nested literal support with arithmetic operations on numeric literals.

### AST Utilities
- `dump(node, annotate_fields=True, include_attributes=False, *, indent=None)` (L115-179): Pretty-prints AST structure for debugging. Supports both compact and indented output formats.
- `copy_location(new_node, old_node)` (L182-196): Transfers source location attributes (lineno, col_offset, end_lineno, end_col_offset) between nodes.
- `fix_missing_locations(node)` (L199-231): Recursively fills missing location information by inheriting from parent nodes.
- `increment_lineno(node, n=1)` (L234-254): Adjusts line numbers for code relocation. Handles special case for TypeIgnore nodes.

### Tree Traversal
- `iter_fields(node)` (L257-266): Yields (fieldname, value) pairs for all fields present on a node.
- `iter_child_nodes(node)` (L269-280): Yields direct child AST nodes, handling both single nodes and lists.
- `walk(node)` (L369-380): Breadth-first traversal yielding all descendant nodes using deque for efficiency.

### Source Code Analysis
- `get_docstring(node, clean=True)` (L283-304): Extracts docstrings from functions, classes, and modules. Optionally cleans whitespace using inspect.cleandoc.
- `get_source_segment(source, node, *, padded=False)` (L332-366): Retrieves original source code that generated a specific AST node. Handles multi-line statements with optional padding preservation.

## Visitor Pattern Classes

### NodeVisitor (L383-438)
Base class for AST traversal implementing visitor pattern. Uses dynamic method dispatch (`visit_` + node class name). Includes backward compatibility handling for deprecated constant node types via `visit_Constant` with deprecation warnings.

### NodeTransformer (L441-497) 
Extends NodeVisitor for AST modification. Visitor methods can return:
- `None`: removes node
- New node: replaces original
- List of nodes: replaces single node with multiple (for statements)

## Code Generation

### _Unparser (L724-1787)
Comprehensive AST-to-source converter with precedence-aware parenthesis handling:

**Core Infrastructure:**
- Maintains source buffer, precedence tracking, indentation state
- Context managers: `block()` (L785-796), `delimit()` (L799-805), `buffered()` (L775-782)
- Precedence system using `_Precedence` enum (L689-717) for correct parenthesization

**Statement Handlers:**
- Function definitions: `visit_FunctionDef`/`visit_AsyncFunctionDef` (L1074-1078)
- Class definitions: `visit_ClassDef` (L1048-1072) 
- Control flow: `visit_If` (L1140-1156), `visit_For`/`visit_AsyncFor` (L1121-1138)
- Exception handling: `visit_Try`/`visit_TryStar` (L1021-1035)

**Expression Handlers:**
- Binary operations with precedence: `visit_BinOp` (L1489-1504)
- String literals and f-strings: `visit_JoinedStr` (L1224-1269), complex quote selection logic
- Comprehensions: List/Set/Dict/Generator (L1347-1371)

### unparse(ast_obj) (L1789-1791)
Public interface to _Unparser for converting AST back to source code.

## Backward Compatibility

### Deprecated Node Classes (L590-681)
Legacy AST node types maintained for compatibility:
- `Num`, `Str`, `Bytes`, `NameConstant`, `Ellipsis`: All redirect to `Constant` with deprecation warnings
- `Index`, `ExtSlice`, `slice`: Deprecated slice-related classes
- `Suite`, `AugLoad`, `AugStore`, `Param`: Python 2 remnants

### Dynamic Attribute Access (L1799-1807)
`__getattr__` implementation provides deprecated globals with warnings when accessed.

## Internal Utilities
- `_splitlines_no_ff(source, maxlines=None)` (L308-318): Python parser-compatible line splitting
- `_pad_whitespace(source)` (L321-329): Preserves formatting characters for source reconstruction
- Pattern matching visitors (L1701-1787): Full support for Python 3.10+ match statements

## Dependencies
- `_ast`: C extension providing core AST node types
- `contextlib`: Context manager utilities  
- `enum`: For precedence enumeration
- `re`: Regular expressions for line splitting
- `sys`: System information (float limits)

## Architecture Notes
- Extensive use of visitor pattern for extensible AST processing
- Precedence-aware expression handling prevents unnecessary parentheses
- Robust backward compatibility layer for deprecated features
- Command-line interface via `main()` (L1810-1835) for AST inspection