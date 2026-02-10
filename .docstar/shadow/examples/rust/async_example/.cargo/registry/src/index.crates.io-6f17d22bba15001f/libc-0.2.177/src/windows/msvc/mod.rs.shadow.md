# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/windows/msvc/mod.rs
@source-hash: 7bc0f1e7e7381529
@generated: 2026-02-09T18:02:23Z

**Primary Purpose:** MSVC-specific bindings module for the libc crate on Windows, providing MSVC toolchain-specific constants and function bindings.

**Key Constants:**
- `L_tmpnam` (L3): Maximum length for temporary filename buffer (260 characters)
- `TMP_MAX` (L4): Maximum number of unique temporary filenames (`0x7fff_ffff`)
- `EOTHER` (L8): MSVC-specific POSIX error code (131) - only available in MSVC toolchain

**External Function Bindings (L10-17):**
All functions use explicit `link_name` attributes to map to MSVC runtime functions:
- `stricmp` (L11-12): Case-insensitive string comparison, maps to `_stricmp`
- `strnicmp` (L13-14): Case-insensitive string comparison with length limit, maps to `_strnicmp` 
- `memccpy` (L15-16): Memory copy until character found, maps to `_memccpy`

**Dependencies:**
- Uses `crate::prelude::*` (L1) for common libc types (`c_uint`, `c_int`, `c_char`, `c_void`, `size_t`)

**Architectural Notes:**
- Platform-specific module targeting Windows MSVC toolchain only
- Uses explicit link names to interface with MSVC C runtime library
- Part of libc's platform abstraction layer
- Functions follow C calling convention with raw pointer parameters