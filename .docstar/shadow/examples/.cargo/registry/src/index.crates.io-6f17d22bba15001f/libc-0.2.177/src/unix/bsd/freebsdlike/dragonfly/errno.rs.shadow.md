# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/dragonfly/errno.rs
@source-hash: 07b19390b9ae8f54
@generated: 2026-02-09T18:02:11Z

**Primary Purpose**: DragonFly BSD-specific errno handling implementation that provides thread-local error number access through both deprecated and current interfaces.

**Key Components**:
- `__error()` function (L9-11): Deprecated wrapper that returns a mutable pointer to the thread-local errno variable. Marked for deprecation since version 0.2.77 with recommendation to use `__errno_location()` instead.
- `errno` static (L16): Thread-local mutable static integer that stores the current error number for the calling thread.

**Dependencies**:
- `crate::prelude::*` (L1): Imports common types and macros
- `c_int` type: Standard C integer type for errno values

**Architectural Decisions**:
- Uses `f!` macro (L7-12) to define the deprecated function, indicating this is part of libc's function generation system
- Implements DragonFly BSD's `__error` function locally because it's declared as "static inline" in the system headers, requiring implementation within the libc crate rather than external linking
- Thread-local storage ensures each thread has its own errno value, preventing race conditions in multi-threaded applications

**Platform-Specific Context**:
- This is DragonFly BSD specific errno handling, different from other BSD variants
- Part of the broader unix/bsd/freebsdlike/dragonfly module hierarchy, indicating platform-specific adaptations within the libc crate structure

**Critical Constraints**:
- The `__error` function is deprecated and should not be used in new code
- errno is mutable and thread-local, requiring careful handling in unsafe contexts