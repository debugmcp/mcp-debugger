# examples\rust\async_example\Cargo.toml
@source-hash: e27749ceff51733c
@generated: 2026-02-24T01:54:01Z

## Cargo.toml - Rust Async Example Project

Cargo manifest file defining a basic Rust project configured for asynchronous programming with the Tokio runtime.

### Package Configuration
- **Project name**: "async_example" (L2)
- **Version**: "0.1.0" (L3) 
- **Rust edition**: 2021 (L4)

### Dependencies
- **tokio**: Version 1.x with "full" feature set (L7)
  - Enables complete Tokio async runtime capabilities
  - Includes all tokio modules: macros, I/O, networking, timers, sync primitives
  - Provides foundation for async/await programming patterns

### Architecture Notes
- Minimal project setup focused on async demonstration
- No additional dependencies beyond core async runtime
- Standard Rust 2021 edition for modern language features
- Full Tokio feature set suggests comprehensive async example coverage