# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose
This directory contains UI (user interface) tests for the `pin-project-lite` crate's macro system. These are negative test cases designed to verify that the `pin_project!` macro correctly rejects invalid usage patterns and generates appropriate compile-time errors with meaningful diagnostic messages.

## Key Components & Test Categories

### Trait Implementation Conflicts
- **conflict-drop.rs**: Tests detection of conflicting `Drop` implementations between macro-generated and user-provided code
- **conflict-unpin.rs**: Validates error handling for conflicting `Unpin` implementations across various scenarios
- **overlapping_unpin_struct.rs**: Ensures proper Unpin trait resolution with `PhantomPinned` types
- **unpin_sneaky.rs**: Prevents manual `Unpin` implementation on internal macro-generated types

### Syntax & Bounds Validation
- **invalid-bounds.rs**: Tests rejection of malformed generic type parameter bounds and where clauses
- **invalid.rs**: Validates error handling for basic invalid macro usage patterns (empty parentheses, misplaced attributes, duplicates)
- **unsupported.rs**: Ensures macro properly rejects unsupported struct definitions (unit structs, enums, unions)

### Safety & Memory Layout Constraints
- **packed.rs**: Verifies rejection of packed structs to maintain alignment safety in pin projections
- **overlapping_lifetime_names.rs**: Tests lifetime parameter name collision detection with reserved `'__pin` lifetime
- **negative_impls_stable.rs**: Validates edge cases around negative trait implementations in stable Rust

## Architecture Pattern
All tests follow the **compile-fail UI test pattern**:
1. Import `pin_project_lite::pin_project` macro
2. Define structs or implementations that should be rejected
3. Use `//~ ERROR` comments to specify expected compiler error messages
4. Include empty `main()` function for compilation context

## Public API Surface
The tests validate the public API constraints of:
- `pin_project!` macro from `pin_project_lite` crate
- Proper error reporting for invalid usage patterns
- Safety guarantees around pin projection and memory layout

## Internal Organization & Data Flow
Tests are organized by error category:
- **Trait conflicts**: Ensuring macro-generated implementations don't conflict with user code
- **Syntax validation**: Proper parsing and rejection of invalid macro syntax
- **Safety enforcement**: Memory safety and alignment constraints
- **Namespace protection**: Preventing access to internal macro implementation details

## Critical Invariants
- The `pin_project!` macro must reject any usage that could compromise memory safety
- Error messages should be clear and actionable for developers
- Internal implementation details (like `__Origin` types and `'__pin` lifetimes) must remain inaccessible
- Packed structs and misaligned references are strictly forbidden in pin projections

## Testing Infrastructure
These UI tests integrate with Rust's compiler testing framework, using the `//~` error annotation syntax to validate that specific compiler errors are generated for each invalid usage pattern. This ensures the macro maintains its safety guarantees while providing good developer experience through clear error reporting.