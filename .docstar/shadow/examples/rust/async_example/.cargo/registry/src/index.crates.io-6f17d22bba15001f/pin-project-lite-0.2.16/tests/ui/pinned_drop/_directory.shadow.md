# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pinned_drop/
@generated: 2026-02-09T18:16:01Z

## Purpose
This directory contains UI (User Interface) tests for the pin-project-lite crate's PinnedDrop functionality, specifically focused on testing improper usage patterns and error conditions. These are negative test cases designed to verify that the compiler correctly rejects invalid code and produces appropriate error messages.

## Key Components
The directory contains test files that validate different aspects of PinnedDrop error handling:

- **Internal API Misuse Tests**: Tests that attempt to call private/internal functions like `__drop_inner` directly, ensuring these implementation details remain inaccessible to user code
- **Type Constraint Validation Tests**: Tests that verify Drop and PinnedDrop implementations cannot impose additional type parameter constraints beyond those specified in the original struct definition

## Test Architecture
All files follow the UI test pattern where:
- Test cases are designed to fail compilation with specific error codes (E0367, access violations)
- Comments like `//~^ ERROR E0367` indicate expected compilation failures
- Each test focuses on a specific violation of pin-project-lite's safety invariants

## Key Safety Invariants Tested
1. **Encapsulation**: Internal implementation details (like `__drop_inner`) must not be accessible to user code
2. **Type System Soundness**: Drop implementations cannot add constraints not present in the original type definition
3. **Pin Safety**: PinnedDrop implementations must respect the same constraint rules as regular Drop implementations

## Integration with pin-project-lite
These tests validate the error-checking mechanisms built into the pin-project-lite crate, ensuring that:
- The `pin_project!` macro generates properly encapsulated code
- The `PinnedDrop` trait integration maintains type system soundness
- Compiler errors provide clear feedback for common misuse patterns

## Test Framework Context
As UI tests, these files are processed by the Rust compiler during testing to verify that expected compilation errors occur, ensuring the pin-project-lite crate's safety guarantees are properly enforced at compile time.