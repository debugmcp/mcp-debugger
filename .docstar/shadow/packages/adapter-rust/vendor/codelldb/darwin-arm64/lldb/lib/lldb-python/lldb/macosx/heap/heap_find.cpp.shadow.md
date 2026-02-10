# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/macosx/heap/heap_find.cpp
@source-hash: bf10767049fe2489
@generated: 2026-02-09T18:03:42Z

**Purpose**: LLDB plugin for heap memory analysis on Darwin/macOS systems. Compiles into a dylib that provides debugging functions for finding data within active malloc blocks during debugging sessions.

**Core Architecture**:
- Plugin system for LLDB heap inspection with C++ implementation
- Uses Darwin-specific malloc zone enumeration and Mach VM APIs
- Integrates with stack logging for allocation tracking
- Provides ObjC class analysis and heap statistics

**Key Classes & Data Structures**:

**MatchResults (L205-247)**: Container for malloc block search results
- Fixed array of `malloc_match` entries (max 8k entries)
- `push_back()` with optional uniqueness checking
- `data()` returns NULL-terminated result array

**MallocStackLoggingEntries (L249-283)**: Stack trace collection for allocation history
- Fixed array of `malloc_stack_entry` (max 128 entries) 
- `next()` allocates new entry, `data()` returns NULL-terminated array

**ObjCClasses (L301-341)**: Objective-C class registry management
- `Update()` (L305) retrieves and sorts all ObjC classes via `objc_getClassList()`
- `FindClassIndex()` (L321) binary search for class lookup
- Maintains sorted array for efficient class validation

**ObjCClassInfo (L352-448)**: Heap statistics collector for ObjC objects
- Tracks byte/count totals per class via `AddInstance()` (L363)
- Sorting by bytes (L385) or count (L402) with formatted output
- Entry struct (L421-425) holds index, count, bytes per class

**Core Search Functions**:

**find_pointer_in_heap()** (L722-742): Searches all malloc zones for pointer values
- Uses `eDataTypeContainsData` search type
- Optional VM region checking for stack/non-heap memory

**find_cstring_in_heap()** (L833-854): Locates C string data in heap
- Byte-aligned search through all active allocations  
- Returns malloc blocks containing substring matches

**find_objc_objects_in_memory()** (L773-790): ObjC object instance finder
- Validates objects by checking `isa` pointers against known classes
- Supports inheritance hierarchy matching

**find_block_for_address()** (L859-874): Address-to-block mapping
- Uses `eDataTypeAddress` to find containing malloc block
- Returns block info for given address

**Memory Enumeration Engine**:

**foreach_zone_in_this_process()** (L463-513): Zone iteration driver
- Enumerates malloc zones via `malloc_get_all_zones()`
- Optional VM region scanning for non-heap memory (L477-512)
- Uses `mach_vm_region_recurse()` for complete memory coverage

**range_info_callback()** (L543-663): Core search logic dispatcher  
- Handles 4 data types: Address, ContainsData, ObjC, HeapInfo
- Memory comparison with alignment support (L561-589)
- ObjC object validation via class registry (L591-638)

**Stack Tracking Integration**:
- `get_stack_history_for_address()` (L684-716): Retrieves allocation/deallocation stacks
- Uses private `__mach_stack_logging_*` APIs for historical data
- Supports both current allocation and full history modes

**Private API Integration** (L82-125):
- Redefines `mach_stack_logging_record_t` and related types
- External declarations for `__mach_stack_logging_*` functions
- Stack logging type constants for malloc operations

**Global State**:
- `g_matches` (L344): Global result storage
- `g_malloc_stack_history` (L345): Stack trace storage  
- `g_objc_classes` (L346): Class registry cache
- `g_objc_class_snapshot` (L450): Heap statistics collector

**Memory Safety**:
- `safe_malloc()` (L287-298): VM-based allocation to avoid malloc interference
- `task_peek()` (L457-461): Local memory access wrapper for zone enumeration