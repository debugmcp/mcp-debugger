# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/macros.rs
@source-hash: 954a9c57fcdabc86
@generated: 2026-02-09T18:11:38Z

## Primary Purpose
Provides conditional compilation macros for the mio crate, enabling feature-based code inclusion and optional logging functionality. This utility module simplifies feature gate management across the codebase.

## Key Macros

### Feature Gate Macros (L6-70)
- **`cfg_os_poll` (L7-15)**: Includes items when `os-poll` feature is enabled, with docs.rs documentation attributes
- **`cfg_not_os_poll` (L18-25)**: Includes items when `os-poll` feature is disabled (negation macro)
- **`cfg_os_ext` (L28-36)**: Includes items when `os-ext` feature is enabled
- **`cfg_net` (L39-47)**: Includes items when `net` feature is enabled
- **`cfg_io_source` (L51-59)**: Complex conditional for items requiring IoSource - enabled when `net` feature OR (`unix` target AND `os-ext` feature)
- **`cfg_any_os_ext` (L62-70)**: Includes items when either `os-ext` OR `net` features are enabled

### Logging Macros (L72-98)
- **`trace` (L73-76)**: Wrapper for trace-level logging
- **`warn` (L78-82)**: Wrapper for warn-level logging  
- **`error` (L84-88)**: Wrapper for error-level logging
- **`log` (L90-98)**: Core logging dispatcher that conditionally compiles to `log::$level!` when `log` feature is enabled, or no-op when disabled

## Architecture Patterns
- **Feature-based Conditional Compilation**: All feature gate macros follow identical pattern - accept variadic items and wrap them with appropriate `#[cfg(...)]` attributes
- **Documentation Metadata**: Feature macros include `#[cfg_attr(docsrs, doc(cfg(...)))]` for proper docs.rs feature documentation
- **Logging Abstraction**: Logging macros provide zero-cost abstraction when logging is disabled, using unused variable suppression technique

## Dependencies
- External: `log` crate (conditionally compiled)
- Internal: None - this is a foundational utility module

## Critical Constraints
- `#![allow(unused_macros)]` (L4) suppresses warnings since not all macros are used depending on enabled features
- Logging macros use `if false { let _ = (...) }` pattern (L96) to prevent unused variable warnings when logging is disabled
- Complex feature interdependency in `cfg_io_source` reflects Unix-specific IoSource requirements