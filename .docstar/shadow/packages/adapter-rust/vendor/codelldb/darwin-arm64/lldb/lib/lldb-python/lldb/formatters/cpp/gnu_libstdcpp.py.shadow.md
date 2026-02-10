# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/formatters/cpp/gnu_libstdcpp.py
@source-hash: a78f3fc1aada2965
@generated: 2026-02-09T18:03:40Z

LLDB C++ STL formatters for GNU libstdc++ implementations. This module provides custom data formatters that help LLDB display complex STL containers in a readable format during debugging sessions.

## Key Functions

**ForwardListSummaryProvider** (L9-15): Summary formatter for std::forward_list showing size information with capping support based on LLDB's maximum children display setting.

**StdOptionalSummaryProvider** (L18-21): Summary formatter for std::optional showing whether the optional contains a value, with consistent spacing format matching libcxx formatter.

**VariantSummaryProvider** (L885-914): Summary formatter for std::variant displaying the active type or special states (No Value, Invalid).

## Core Synthetic Providers

**StdOptionalSynthProvider** (L24-51): Synthetic children provider for std::optional that exposes the contained value when present. Handles libstdc++ internal structure with `_M_payload` and `_M_engaged` members, with fallback for versions with additional `_M_value` child.

**StdUnorderedMapSynthProvider** (L60-132): Synthetic provider for unordered map-like containers (unordered_map, unordered_multimap, unordered_set, unordered_multiset). Uses hash table traversal via `_M_h._M_before_begin._M_nxt` linked list structure.

**AbstractListSynthProvider** (L134-314): Base class for list-like containers implementing common functionality:
- Floyd's cycle detection algorithm (L173-189) to prevent infinite loops
- Template type extraction from allocator type
- Child count optimization using `_M_data` field when available (L195-197)

**StdForwardListSynthProvider** (L316-330): Extends AbstractListSynthProvider for std::forward_list (single-linked list) with `has_prev=False`.

**StdListSynthProvider** (L332-353): Extends AbstractListSynthProvider for std::list (double-linked list) with `has_prev=True`.

**StdVectorSynthProvider** (L355-517): Composite provider supporting both regular vectors and specialized vector<bool>:
- **StdVectorImplementation** (L356-441): Regular vector using `_M_start`, `_M_finish`, `_M_end_of_storage` pointers
- **StdVBoolImplementation** (L442-488): Specialized for vector<bool> with bit-level access using `_M_p` and `_M_offset` fields

**StdMapLikeSynthProvider** (L525-718): Provider for ordered map-like containers (map, multimap, set, multiset). Implements red-black tree traversal using `_M_t._M_impl._M_header` structure with sophisticated node increment algorithm (L687-715) including garbage detection for corrupted trees.

**StdDequeSynthProvider** (L724-882): Provider for std::deque implementing complex two-dimensional array access. Calculates block size based on libstdc++ formula (L747-750) and handles first/last node size calculations for proper element indexing.

**VariantSynthProvider** (L917-974): Synthetic provider for std::variant that navigates the internal union structure using `_M_index` and `_M_u` fields, with special handling for `__gnu_cxx::__aligned_membuf` wrapper types.

## Global Configuration

**_list_uses_loop_detector** (L721): Global flag controlling whether list formatters use Floyd's cycle detection algorithm.

## Key Patterns

- All providers implement lazy evaluation with `self.count = None` pattern for expensive operations
- Extensive error handling with try/catch blocks returning safe defaults
- Logger integration throughout for debugging formatter issues
- Template argument type extraction for generic container support
- Byte-level memory calculations for proper offset computation
- Support for different libstdc++ versions through conditional member access