# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/symtable.py
@source-hash: 3858ba5f1bd23175
@generated: 2026-02-09T18:09:14Z

**Primary Purpose**: Python interface to compiler's internal symbol tables, providing high-level access to variable scope information, symbol types, and namespace analysis for Python code.

**Core Components**:

- **symtable() (L12-19)**: Main entry point returning toplevel SymbolTable for source code analysis
- **SymbolTableFactory (L21-39)**: Factory pattern with memoization using WeakValueDictionary to create appropriate symbol table types (Function, Class, or base SymbolTable)
- **SymbolTable (L42-155)**: Base class representing a symbol table scope with methods for:
  - Type identification (module/function/class/annotation/TypeVar/type alias/parameter)
  - Symbol lookup and retrieval
  - Child namespace navigation
  - Metadata access (name, line number, optimization status)

**Specialized Symbol Tables**:

- **Function (L157-209)**: Extends SymbolTable with function-specific symbol categorization:
  - Parameters, locals, globals, nonlocals, and free variables
  - Uses lazy evaluation with private caching (__params, __locals, etc.)
  - Implements bit-mask filtering via __idents_matching()

- **Class (L211-253)**: Extends SymbolTable for class scopes:
  - Method detection with special handling for generators and type parameters
  - Complex logic to distinguish actual methods from generators and generic functions

- **Symbol (L255-354)**: Represents individual symbols with comprehensive classification methods:
  - Scope analysis (global, local, nonlocal, free)
  - Usage patterns (referenced, assigned, imported, annotated)
  - Namespace binding with single/multiple namespace handling

**Key Dependencies**:
- `_symtable`: C extension providing low-level symbol table access
- `weakref`: For memory-efficient factory memoization
- Constants: USE, DEF_*, SCOPE_*, scope types imported from _symtable

**Architectural Patterns**:
- Factory pattern with memoization for symbol table creation
- Lazy evaluation for expensive operations (symbol categorization)
- Bit-mask operations for flag checking throughout Symbol methods
- Inheritance hierarchy: SymbolTable -> Function/Class specializations

**Critical Invariants**:
- Symbol flags use bit operations with SCOPE_OFF/SCOPE_MASK for scope extraction
- Factory memoization prevents duplicate objects for same table/filename pairs
- Module-level scopes have special handling in Symbol.is_global()/is_local()
- Generator detection requires checking for ".0" parameter in varnames