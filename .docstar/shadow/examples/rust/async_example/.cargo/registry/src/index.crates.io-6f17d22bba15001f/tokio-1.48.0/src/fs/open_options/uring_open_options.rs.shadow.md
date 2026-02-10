# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/open_options/uring_open_options.rs
@source-hash: babad962d169e443
@generated: 2026-02-09T18:02:42Z

**Purpose**: Internal Tokio io_uring filesystem module providing a builder pattern wrapper for file open options that can convert to standard library OpenOptions.

## Core Structure
- **UringOpenOptions struct (L9-18)**: Encapsulates file opening parameters with Unix-specific libc types
  - Fields mirror std::fs::OpenOptions capabilities: read, write, append, truncate, create flags
  - Unix-specific fields: `mode` (libc::mode_t), `custom_flags` (libc::c_int)
  - All fields are `pub(crate)` for internal Tokio access

## Key Methods
- **new() (L21-32)**: Constructor with safe defaults (mode 0o666, all flags false)
- **Fluent setters (L34-72)**: Builder pattern methods for read, write, append, truncate, create, create_new, mode, custom_flags
- **access_mode() (L75-84)**: Converts read/write/append combinations to libc O_* flags, validates invalid combinations
- **creation_mode() (L87-109)**: Converts create/truncate/create_new combinations to libc flags with validation

## Dependencies
- **libc**: For Unix file system constants and types
- **std::fs::OpenOptions**: Standard library type for conversion target
- **Test mock**: Uses MockOpenOptions in test builds (L3-6)

## Key Patterns
- **Builder pattern**: All setters return `&mut Self` for method chaining
- **Unix semantics**: Direct mapping to libc constants for io_uring compatibility
- **Error handling**: Returns io::Error with appropriate errno codes for invalid flag combinations
- **Type conversion**: Implements From trait for seamless conversion to std::fs::OpenOptions

## Critical Constraints
- Invalid flag combinations return EINVAL errors (no read/write/append, truncate with append without create_new)
- Mode values cast from u32 to libc::mode_t
- References rust stdlib implementation for flag logic compatibility