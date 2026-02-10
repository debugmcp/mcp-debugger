# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/error.rs
@source-hash: cbf06fb7b000f2e6
@generated: 2026-02-09T18:12:20Z

## Error Handling Module for Syn Parser

This module provides comprehensive error handling infrastructure for the Syn parsing library, with thread-safe error management and procedural macro integration.

### Core Types

**Result<T> (L15)** - Standard Result type alias using syn::Error as the error type

**Error (L101-103)** - Main error type containing a vector of ErrorMessage structs. Thread-safe and supports combining multiple error messages.

**ErrorMessage (L105-113)** - Internal error representation with ThreadBound span and message string. Spans are thread-local and fallback to call_site when accessed from different threads.

**SpanRange (L118-121)** - Copy-able span range struct (start/end Span) required by ThreadBound to avoid Drop implementations.

### Key Functionality

**Error Construction:**
- `Error::new<T: Display>(span, message)` (L159-173) - Creates single-span error
- `Error::new_spanned<T: ToTokens, U: Display>(tokens, message)` (L190-204) - Creates error spanning entire token stream (printing feature only)

**Error Reporting:**
- `to_compile_error()` (L226-232) - Converts error to compile_error! macro invocation
- `into_compile_error(self)` (L266-268) - Consuming version of to_compile_error
- `combine(&mut self, another)` (L272-274) - Merges multiple errors together

**Span Management:**
- `span()` (L211-217) - Returns joined span or call_site if accessed cross-thread
- Thread-safety handled via ThreadBound wrapper around SpanRange

### Internal Helpers

**ErrorMessage::to_compile_error()** (L278-325) - Generates `::core::compile_error!($message)` token stream with proper span attribution

**new_at()** (L328-335) - Parsing feature helper for cursor-based error creation
**new2()** (L338-349) - Creates error with explicit start/end spans

### Iterator Support

**IntoIter (L423-435)** - Owned iterator yielding individual Error instances
**Iter<'a> (L448-460)** - Borrowed iterator yielding cloned Error instances

### Trait Implementations

- Debug, Display, Clone for Error and related types (L351-402)
- std::error::Error (L404)
- From<LexError> (L406-410) - Conversion from proc_macro2 lex errors
- IntoIterator for both owned and borrowed Error (L412-460)
- Extend<Error> for combining multiple errors (L462-467)

### Dependencies

- `proc_macro2` for token manipulation and spans
- `quote::ToTokens` for printing feature
- `crate::thread::ThreadBound` for thread-safe span storage
- `crate::buffer::Cursor` for parsing operations

### Architecture Notes

The error system prioritizes thread-safety while maintaining span information. Spans are bound to their originating thread and gracefully degrade to call_site when accessed cross-thread. The design supports both single and multi-error scenarios with automatic compile_error! generation for procedural macros.