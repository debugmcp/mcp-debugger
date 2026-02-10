# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/formatters/cpp/
@generated: 2026-02-09T18:16:07Z

## Purpose
This directory provides LLDB debugger formatters for C++ standard library containers, enabling enhanced visualization of STL data structures during debugging sessions. It supports both major C++ standard library implementations: GNU libstdc++ and LLVM libc++.

## Architecture & Organization

**Unified Entry Point (`__init__.py`)**
- Serves as the central orchestrator that automatically loads both formatter submodules
- Provides the standard LLDB integration hook `__lldb_init_module()` that registers all C++ formatters
- Implements a clean modular pattern where each standard library implementation maintains separation

**Dual Implementation Support**
- **`gnu_libstdcpp.py`**: Formatters for GNU libstdc++ containers (Linux/GCC ecosystem)
- **`libcxx.py`**: Formatters for LLVM libc++ containers (macOS/Clang ecosystem, `std::__1` namespace)

## Key Components

### Core STL Container Support
Both implementations provide comprehensive formatters for:
- **String containers**: `std::string` with short string optimization handling
- **Sequence containers**: `std::vector`, `std::list`, `std::forward_list`, `std::deque`
- **Associative containers**: `std::map`, `std::multimap`, `std::set`, `std::multiset`, `std::unordered_map`, etc.
- **Modern C++ types**: `std::optional`, `std::variant`, `std::shared_ptr`, `std::weak_ptr`

### Formatter Categories

**Summary Providers**: Generate compact string representations showing key information (size, state)
**Synthetic Providers**: Create expandable tree views of container contents with proper child navigation

### Advanced Safety Features
- **Loop Detection**: Floyd's cycle detection algorithm prevents infinite loops in corrupted linked structures
- **Size Capping**: Configurable limits prevent performance issues with large containers
- **Error Resilience**: Extensive exception handling ensures formatters don't crash on corrupted data
- **Type Validation**: Defensive programming with type checking and graceful fallbacks

## Public API Surface

### Primary Entry Point
- `__lldb_init_module(debugger, internal_dict)`: Main registration function called by LLDB

### Global Configuration (GNU libstdc++)
- `_list_uses_loop_detector`: Controls cycle detection in list containers
- Size capping variables for performance tuning

### Global Configuration (libc++)
- `_list_capping_size`, `_map_capping_size`: Performance limits
- `_list_uses_loop_detector`: Loop detection toggle

## Internal Organization & Data Flow

1. **Initialization Phase**: LLDB calls `__lldb_init_module()` which cascades to both submodules
2. **Registration Phase**: Each submodule registers type-specific formatters using regex patterns
3. **Runtime Phase**: When debugging, LLDB matches container types and invokes appropriate formatters
4. **Navigation Phase**: Synthetic providers handle lazy evaluation and child element access

## Key Technical Patterns

**Memory Layout Navigation**: Deep understanding of internal STL implementations including:
- Red-black tree structures for ordered containers
- Hash table bucket traversal for unordered containers
- Two-dimensional array indexing for deque
- Compressed pair layouts and anonymous member handling

**Cross-Platform Compatibility**: Handles implementation differences between GNU and LLVM standard libraries while providing consistent debugging experience

**Performance Optimization**: Lazy evaluation, caching mechanisms, and size limits ensure responsive debugging even with large containers