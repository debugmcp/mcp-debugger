# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/formatters/cpp/libcxx.py
@source-hash: b042368e3bf09728
@generated: 2026-02-09T18:03:37Z

## LLDB libc++ STL Formatters

**Purpose**: LLDB Python script providing debug formatters for libc++ STL containers, specifically for macOS libc++ implementation in the `std::__1` namespace. Enables enhanced debugging visualization of STL containers.

### Core Functions & Utilities

- **`make_string(F, L)`** (L17-25): Converts byte data to quoted string representation for debugger display
- **`is_short_string(value)`** (L31-32): Determines if std::string uses short string optimization 
- **`extract_short_size(value)`** (L35-36): Extracts string length from short string representation

### STL Container Formatters

#### std::string Support
- **`stdstring_SummaryProvider(valobj, dict)`** (L45-74): Main string formatter handling both short string optimization and heap-allocated strings. Navigates complex libc++ internal structure to extract string data and length.

#### std::vector Support  
- **`stdvector_SynthProvider`** (L77-150): Complete synthetic provider for std::vector
  - `num_children()` (L82-108): Calculates vector size with safety checks for uninitialized vectors
  - `get_child_at_index(index)` (L117-130): Creates child elements by pointer arithmetic
  - `update()` (L132-146): Extracts `__begin_`, `__end_` pointers and element type info
- **`stdvector_SummaryProvider(valobj, dict)`** (L156-158): Summary showing vector size

#### std::list Support
- **`stdlist_entry`** (L161-189): Wrapper for list node navigation with properties for next/prev/value
- **`stdlist_iterator`** (L192-229): Iterator implementation for traversing doubly-linked list
- **`stdlist_SynthProvider`** (L231-354): Comprehensive list formatter
  - `has_loop()` (L247-263): Floyd's cycle detection algorithm to prevent infinite loops
  - `num_children_impl()` (L274-299): Counts list elements with loop detection and size capping
  - Uses global `_list_capping_size` (L928) and `_list_uses_loop_detector` (L929) for safety

#### std::map Support
- **`stdmap_iterator_node`** (L368-402): Tree node wrapper for red-black tree navigation
- **`stdmap_iterator`** (L408-482): Binary tree iterator with overflow protection
  - `tree_min()/tree_max()` (L409-428): Tree traversal utilities
  - `increment_node()` (L436-449): In-order tree traversal with step counting
- **`stdmap_SynthProvider`** (L485-633): Complex red-black tree formatter
  - `get_data_type()` (L534-550): Lazy type extraction from tree nodes  
  - `get_child_at_index(index)` (L571-633): Tree traversal with special handling for node 0 vs others
  - Uses global `_map_capping_size` (L927) for performance limits

#### std::deque Support
- **`stddeque_SynthProvider`** (L645-801): Two-dimensional array implementation
  - `find_block_size()` (L661-679): Calculates block size based on element size (4096/element_size or 16)
  - Complex pointer arithmetic for accessing elements across memory blocks

#### std::shared_ptr/std::weak_ptr Support  
- **`stdsharedptr_SynthProvider`** (L804-880): Provides access to pointer, reference count, and weak count

### Initialization
- **`__lldb_init_module(debugger, dict)`** (L889-924): Registers all formatters with LLDB using regex patterns to match libc++ type names in `std::__1` namespace

### Key Dependencies
- `lldb` module for debugger API
- `lldb.formatters.Logger` for debug logging throughout all classes

### Architecture Notes
- Formatters handle libc++ internal layout complexities (compressed pairs, anonymous members)
- Heavy use of exception handling for robustness during debugging
- Performance safeguards via size capping and overflow detection
- Compatible specifically with libc++ implementation, not other C++ standard libraries