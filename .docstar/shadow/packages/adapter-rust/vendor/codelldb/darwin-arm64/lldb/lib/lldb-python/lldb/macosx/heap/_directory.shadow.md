# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/macosx/heap/
@generated: 2026-02-09T18:16:11Z

## LLDB macOS Heap Analysis Module

This directory contains a specialized LLDB debugging plugin for heap memory analysis on Darwin/macOS systems. The module compiles into a dynamic library that extends LLDB's debugging capabilities with sophisticated heap inspection and memory forensics tools.

### Overall Purpose & Responsibility

The module provides comprehensive heap memory analysis functionality for debugging sessions on macOS, enabling developers to:
- Search for specific data patterns within active malloc blocks
- Track allocation history and stack traces
- Analyze Objective-C object instances and class distributions
- Map memory addresses to their containing malloc blocks
- Generate heap statistics and memory usage reports

### Core Architecture & Components

The system is built around a multi-layered architecture:

**Memory Enumeration Engine**: The foundation layer that iterates through all malloc zones in the target process using Darwin-specific APIs (`malloc_get_all_zones()`) and Mach VM region scanning for comprehensive memory coverage.

**Search Dispatch System**: The core logic dispatcher (`range_info_callback()`) that handles four distinct data search types:
- Address mapping to find containing blocks
- Data pattern matching with alignment support  
- Objective-C object validation via class registry
- Heap statistics collection

**Specialized Search Functions**: High-level entry points for common debugging scenarios:
- `find_pointer_in_heap()` - Locates pointer values across all allocations
- `find_cstring_in_heap()` - Searches for string data within heap blocks
- `find_objc_objects_in_memory()` - Finds instances of specific ObjC classes
- `find_block_for_address()` - Maps addresses to their malloc blocks

**Objective-C Integration**: Dedicated subsystem for ObjC-specific analysis:
- Class registry management with binary search optimization
- Inheritance hierarchy support for object validation
- Heap statistics aggregation by class type

**Stack Logging Integration**: Allocation history tracking using private Darwin APIs to retrieve stack traces for malloc operations, supporting both current allocation and full deallocation history.

### Data Flow & Organization

1. **Initialization**: ObjC classes are enumerated and cached in sorted arrays for efficient lookup
2. **Zone Enumeration**: All malloc zones are discovered and iterated systematically
3. **Search Execution**: Each memory region is analyzed based on the requested search criteria
4. **Result Aggregation**: Matches are collected in fixed-size arrays with optional deduplication
5. **Stack Resolution**: Allocation history is retrieved for relevant addresses using stack logging APIs

### Key Data Structures

- **MatchResults**: Thread-safe container for search results (max 8k entries)
- **MallocStackLoggingEntries**: Stack trace collection system (max 128 entries)
- **ObjCClasses**: Sorted class registry for efficient validation
- **ObjCClassInfo**: Heap statistics collector with sorting capabilities

### Public API Surface

The module exposes its functionality through well-defined entry points that can be invoked from LLDB debugging sessions:

- **Memory Search APIs**: `find_pointer_in_heap()`, `find_cstring_in_heap()`
- **Object Analysis APIs**: `find_objc_objects_in_memory()`  
- **Address Mapping APIs**: `find_block_for_address()`
- **Stack History APIs**: `get_stack_history_for_address()`

### Memory Safety & Performance

The implementation includes safety mechanisms to avoid interfering with the target process's memory management:
- VM-based allocation (`safe_malloc()`) to prevent malloc recursion
- Local memory access wrappers for zone enumeration
- Fixed-size result containers to prevent unbounded memory growth
- Binary search optimizations for class lookup operations

This module serves as a critical debugging tool for macOS developers, providing deep visibility into heap memory usage patterns and allocation behavior during live debugging sessions.