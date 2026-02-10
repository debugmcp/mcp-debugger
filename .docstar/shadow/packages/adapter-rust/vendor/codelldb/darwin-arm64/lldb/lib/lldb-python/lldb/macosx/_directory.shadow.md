# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/macosx/
@generated: 2026-02-09T18:16:36Z

## LLDB macOS Platform Integration Module

This directory provides macOS-specific debugging extensions and platform integration for LLDB on Darwin systems. It serves as the macOS platform layer within the broader LLDB Python bindings, offering specialized debugging capabilities tailored to Darwin's unique system architecture and APIs.

### Overall Purpose & Responsibility

The module extends LLDB's cross-platform debugging framework with macOS-specific functionality, enabling sophisticated analysis of Darwin processes through:
- Advanced heap memory forensics and allocation tracking
- Darwin-specific memory management integration (malloc zones, VM regions)
- Objective-C runtime introspection and object analysis
- Platform-native stack logging and allocation history
- Memory safety mechanisms designed for live process debugging

### Key Components & Architecture

**Heap Analysis Subsystem** (`heap/`): The primary component providing comprehensive heap memory analysis through a multi-layered architecture:
- **Memory Enumeration Engine**: Interfaces with Darwin's `malloc_get_all_zones()` and Mach VM APIs for complete memory coverage
- **Search Dispatch System**: Core logic dispatcher handling multiple search types (address mapping, pattern matching, ObjC validation, statistics)
- **Objective-C Integration**: Specialized subsystem for ObjC runtime analysis with class registry management and inheritance support
- **Stack Logging Integration**: Allocation history tracking using private Darwin APIs

### Public API Surface & Entry Points

The module exposes its capabilities through well-defined debugging APIs accessible from LLDB sessions:

**Memory Search Operations**:
- `find_pointer_in_heap()` - Locates pointer values across heap allocations
- `find_cstring_in_heap()` - Searches for string patterns in heap memory
- `find_block_for_address()` - Maps memory addresses to containing malloc blocks

**Objective-C Analysis**:
- `find_objc_objects_in_memory()` - Discovers instances of specific ObjC classes
- Class registry management with binary search optimization
- Heap statistics aggregation by class type

**Stack History & Allocation Tracking**:
- `get_stack_history_for_address()` - Retrieves allocation/deallocation stack traces
- Integration with Darwin's private stack logging infrastructure

### Internal Organization & Data Flow

The module follows a systematic approach to memory analysis:

1. **Initialization Phase**: ObjC class enumeration and registry caching for efficient lookups
2. **Discovery Phase**: Systematic enumeration of all malloc zones and VM regions
3. **Analysis Phase**: Dispatch-based search execution with specialized handlers for different data types
4. **Collection Phase**: Thread-safe result aggregation with deduplication and size limits
5. **Resolution Phase**: Stack trace resolution and allocation history retrieval

### Important Patterns & Conventions

**Memory Safety**: The implementation prioritizes safety in live debugging environments:
- VM-based allocation (`safe_malloc()`) to prevent malloc recursion
- Fixed-size result containers (8k entries max) to prevent unbounded growth
- Local memory access wrappers for safe zone enumeration

**Performance Optimization**: Designed for efficient operation during debugging:
- Binary search algorithms for class registry lookups
- Sorted data structures for O(log n) access patterns
- Bounded search results to maintain responsiveness

**Platform Integration**: Deep integration with Darwin-specific APIs and runtime systems:
- Mach VM region scanning for comprehensive memory coverage
- Private malloc stack logging APIs for allocation history
- Objective-C runtime introspection through class enumeration

This module serves as a critical platform-specific extension to LLDB, providing macOS developers with powerful heap analysis and memory forensics capabilities during debugging sessions. It bridges LLDB's cross-platform debugging framework with Darwin's unique memory management and runtime systems.