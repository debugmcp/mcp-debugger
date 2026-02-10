# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/open_options/mock_open_options.rs
@source-hash: 0a5f0ffdb5a67bec
@generated: 2026-02-09T18:02:40Z

## Purpose
Mock implementation of `std::fs::OpenOptions` for testing tokio filesystem operations. Uses the `mockall` crate to generate test doubles that can be configured with expected behaviors and return values.

## Key Components

### MockOpenOptions Struct (L12-39)
Generated mock struct that mirrors the API of `std::fs::OpenOptions`:
- **Core file operations**: `append()`, `create()`, `create_new()`, `read()`, `write()`, `truncate()` (L15-21)
- **File opening**: `open()` method returns `MockFile` instead of `std::fs::File` (L18)
- **Clone support**: Implements `Clone` trait for test flexibility (L23-25)

### Platform-Specific Extensions
- **Unix support** (L26-30): Implements `OpenOptionsExt` with `custom_flags()` and `mode()` methods for Unix file permissions and flags
- **Windows support** (L31-38): Implements `OpenOptionsExt` with Windows-specific methods (`access_mode()`, `share_mode()`, `custom_flags()`, `attributes()`, `security_qos_flags()`)

## Dependencies
- **mockall** (L3): Provides the `mock!` macro for generating mock implementations
- **MockFile** (L5): Related mock file type from `crate::fs::mocks`
- **Platform traits** (L6-9): Conditional imports for Unix/Windows-specific `OpenOptionsExt` traits

## Architecture Notes
- Uses conditional compilation (`#[cfg(unix)]`, `#[cfg(windows)]`) to provide platform-appropriate mock implementations
- All methods follow builder pattern, returning `&mut Self` for method chaining
- The `open()` method is the key integration point, returning `MockFile` for controlled testing scenarios
- Allows `unreachable_pub` warning since this is test infrastructure code (L1)