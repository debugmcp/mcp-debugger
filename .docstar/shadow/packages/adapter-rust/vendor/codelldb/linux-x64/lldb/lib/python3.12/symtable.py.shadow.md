# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/symtable.py
@source-hash: 3858ba5f1bd23175
@generated: 2026-02-09T18:10:05Z

**Purpose**: Python module providing high-level interface to compiler's internal symbol tables for analyzing variable scopes, bindings, and namespaces in Python source code.

**Key Components**:

- **`symtable()` function (L12-19)**: Entry point that creates top-level SymbolTable from source code using internal `_symtable` module
- **`SymbolTableFactory` class (L21-38)**: Factory with memoization for creating appropriate SymbolTable subclasses based on table type
- **`SymbolTable` class (L42-155)**: Base class representing a symbol table with methods for:
  - Type identification (module/function/class/annotation/type alias/type parameter) (L62-82)
  - Symbol lookup and retrieval (L125-143) 
  - Child table navigation (L145-154)
  - Metadata access (name, line number, optimization status)

**Specialized Symbol Tables**:
- **`Function` class (L157-209)**: Extends SymbolTable for function scopes, providing cached access to parameters, locals, globals, nonlocals, and free variables using bitwise flag operations
- **`Class` class (L211-253)**: Extends SymbolTable for class scopes, identifies methods by analyzing child tables and distinguishing functions from generators

**`Symbol` class (L255-354)**: Represents individual symbols with comprehensive scope analysis methods:
- Binding type checks (parameter, global, local, nonlocal, free, imported, assigned)
- Reference analysis and annotation detection
- Namespace binding management with single/multiple namespace support

**Architecture**: 
- Wraps low-level `_symtable` C module with Pythonic interface
- Uses factory pattern with weak reference memoization to avoid duplicate objects
- Employs bitwise operations on symbol flags for efficient scope determination
- Lazy evaluation pattern for expensive operations (caching in Function/Class methods)

**Key Dependencies**: 
- `_symtable` (internal C module for actual symbol table generation)
- `weakref` (for memoization without preventing garbage collection)

**Usage Pattern**: Call `symtable()` to get root SymbolTable, then navigate through children and lookup symbols to analyze scoping and variable usage in Python code.