# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/doc/mod.rs
@source-hash: fbb5c84915b85f0d
@generated: 2026-02-09T18:06:27Z

**Purpose**: Documentation-only module for the Tokio crate that defines placeholder types referenced in docs but not implemented in this location. This module is only visible on docs.rs and cannot be used in actual code.

## Key Components

**NotDefinedHere (L21)**: An uninhabitable enum used as a placeholder type for documentation purposes. Serves as an alias target for types defined elsewhere in the codebase.
- Derives Debug trait for consistency
- Zero-sized enum with no variants, making it impossible to instantiate
- Follows the "never type" pattern to prevent accidental usage

**mio::event::Source Implementation (L24-44)**: Conditional trait implementation for the placeholder type when "net" feature is enabled.
- Provides stub implementations of register(), reregister(), and deregister() methods
- All methods return Ok(()) without performing any actual operations
- Required for documentation completeness but never executed due to uninhabitable type

**os Module (L47)**: Conditionally compiled submodule available when either "net" or "fs" features are enabled.

## Dependencies
- `mio` crate for event source trait (feature-gated)
- Standard library for I/O types

## Architecture Notes
- Uses feature gates to conditionally compile platform-specific or functionality-specific code
- Employs the uninhabitable type pattern to create safe documentation placeholders
- Separation of concerns: documentation artifacts isolated from runtime code

## Documentation Strategy
The module enables cross-referencing types in documentation without circular dependencies or exposing internal implementation details. Type aliases can reference `NotDefinedHere` to redirect readers to actual implementations while maintaining clean API documentation structure.