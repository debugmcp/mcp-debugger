# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/tests/const_fn.rs
@source-hash: 8ac3171d7bced357
@generated: 2026-02-09T18:11:28Z

## Purpose
Test file that validates const function capabilities in the libc crate, specifically ensuring that certain libc functions can be used in const contexts.

## Key Elements
- **Const validation test (L1-3)**: Tests that `libc::CMSG_SPACE(1)` can be evaluated at compile time by using it to initialize a const variable `_FOO`
- **Platform-specific test**: Only compiled on Linux targets via `#[cfg(target_os = "linux")]`
- **Compile-time assertion**: If `CMSG_SPACE` is not a const function, compilation will fail

## Dependencies
- `libc` crate - provides system-level constants and functions

## Architecture Notes
- Uses const evaluation as a compile-time test mechanism
- Leverages Rust's const evaluation system to verify libc function constness
- Single-purpose validation file with minimal surface area

## Critical Constraints
- Must only be compiled on Linux due to platform-specific `CMSG_SPACE` function
- Requires `libc::CMSG_SPACE` to be declared as const fn in the libc crate