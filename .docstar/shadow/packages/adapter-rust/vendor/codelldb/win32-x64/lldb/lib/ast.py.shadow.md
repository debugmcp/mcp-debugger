# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ast.py
@source-hash: d16626aa5c054bcc
@generated: 2026-02-09T18:13:04Z

## AST Module - Python Abstract Syntax Tree Processing

The `ast` module provides comprehensive functionality for parsing, manipulating, and unparsing Python abstract syntax trees. This is Python's standard library AST implementation bundled with LLDB.

### Core Functions

**`parse(source, filename='<unknown>', mode='exec', *, type_comments=False, feature_version=None)` (L34-53)**
- Primary entry point for parsing Python source code into AST nodes
- Wraps the built-in `compile()` function with `PyCF_ONLY_AST` flag
- Supports type comments and feature version specification
- Validates Python 3.x versions only (raises ValueError for other major versions)

**`literal_eval(node_or_string)` (L56-112)**
- Safely evaluates Python literal expressions (strings, numbers, containers, etc.)
- Recursive evaluation with strict type checking via nested helper functions
- Supports complex number arithmetic with binary operations (Add/Sub)
- Uses `_convert()`, `_convert_num()`, and `_convert_signed_num()` internal helpers

**`dump(node, annotate_fields=True, include_attributes=False, *, indent=None)` (L115-179)**
- Converts AST nodes to formatted string representation for debugging
- Supports pretty-printing with configurable indentation
- Uses recursive `_format()` helper with field annotation control

### AST Manipulation Utilities

**`copy_location(new_node, old_node)` (L182-196)**
- Copies source location attributes between AST nodes
- Handles `lineno`, `col_offset`, `end_lineno`, `end_col_offset`
- Special handling for optional end position attributes

**`fix_missing_locations(node)` (L199-231)**
- Recursively fills missing location attributes in AST trees
- Essential for compiler compatibility when generating AST nodes programmatically
- Propagates parent location information to children via `_fix()` helper

**`increment_lineno(node, n=1)` (L234-254)**
- Adjusts line numbers throughout AST tree (useful for code relocation)
- Special case handling for `TypeIgnore` nodes (line 243-244)

### Traversal and Iteration

**`iter_fields(node)` (L257-266)**
- Generator yielding `(fieldname, value)` tuples for node fields

**`iter_child_nodes(node)` (L269-280)**
- Generator yielding direct child AST nodes (handles both single nodes and lists)

**`walk(node)` (L369-380)**
- Depth-first traversal of entire AST subtree using deque-based iteration
- Yields all descendant nodes in unspecified order

### Visitor Pattern Classes

**`NodeVisitor` (L383-438)**
- Base class for AST traversal with visitor pattern
- Uses dynamic method dispatch: `visit_ClassName` methods
- `generic_visit()` provides default recursive traversal
- `visit_Constant()` includes deprecated node type compatibility (L419-438)

**`NodeTransformer(NodeVisitor)` (L441-497)**
- Subclass enabling AST modification during traversal
- Visitor methods can return replacement nodes, None (removal), or lists
- `generic_visit()` handles in-place list modifications and field updates

### Source Code Analysis

**`get_docstring(node, clean=True)` (L283-304)**
- Extracts docstrings from function, class, and module nodes
- Optional cleaning via `inspect.cleandoc()` for whitespace normalization

**`get_source_segment(source, node, *, padded=False)` (L332-366)**
- Reconstructs original source code from AST node location information
- Uses `_splitlines_no_ff()` (L308-318) and `_pad_whitespace()` (L321-329) helpers
- Handles multi-line statements with optional padding preservation

### Code Generation (_Unparser Class)

**`_Unparser(NodeVisitor)` (L724-1787)**
- Comprehensive AST-to-source-code converter
- Manages operator precedence via `_Precedence` enum (L688-717)
- Context managers for formatting: `block()`, `delimit()`, `buffered()` (L774-811)
- Extensive visit methods for all Python AST node types
- Special handling for f-strings, docstrings, and complex expressions

**`unparse(ast_obj)` (L789-791)**
- Public interface to `_Unparser` functionality

### Backward Compatibility

**Deprecated Node Classes (L590-681)**
- `Num`, `Str`, `Bytes`, `NameConstant`, `Ellipsis` - redirect to `Constant`
- `Index`, `ExtSlice` - deprecated slice representations
- Metaclass `_ABC` provides deprecation warnings and instance checking

**Global Attribute Access (L799-807)**
- `__getattr__()` handles deprecated class access with warnings
- Lazy loading of deprecated globals for compatibility

### Constants and Mappings

- `_const_types` (L622-628): Maps deprecated classes to Python types
- `_const_node_type_names` (L633-642): Type-to-name mapping for visitor compatibility
- `_INFSTR` (L686): Infinity representation for float literals
- Operator dictionaries in `_Unparser` for symbol mapping

### Command Line Interface

**`main()` (L810-835)**
- Argument parsing for `python -m ast` usage
- Supports various parsing modes and output formatting options