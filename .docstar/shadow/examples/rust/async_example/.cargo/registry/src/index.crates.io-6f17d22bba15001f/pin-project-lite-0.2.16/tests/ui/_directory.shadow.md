# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/
@generated: 2026-02-09T18:16:38Z

## Overall Purpose and Responsibility

This directory contains comprehensive UI (User Interface) tests for the `pin-project-lite` crate that validate compile-time error detection and safety enforcement. These are negative test cases designed to ensure the crate's macros (`pin_project!`, `PinnedDrop`) correctly reject invalid usage patterns and generate meaningful diagnostic messages. The tests serve as a safety net, verifying that the macro system maintains memory safety guarantees and prevents unsound pin projections.

## Key Components and Organization

### Test Categories by Subdirectory

**`not_unpin/`** - Unpin Trait Handling Tests
- Validates `#[project(!Unpin)]` annotation behavior
- Tests conflict detection between macro-generated and manual `Unpin` implementations
- Ensures legitimate manual implementations are allowed while rejecting dangerous conflicts

**`pin_project/`** - Core Macro Validation Tests
- Trait implementation conflict detection (`Drop`, `Unpin`)
- Syntax and bounds validation for generic parameters
- Safety constraints (packed structs, lifetime collisions)
- Unsupported construct rejection (unit structs, enums, unions)

**`pinned_drop/`** - PinnedDrop Functionality Tests
- Internal API encapsulation validation
- Type constraint soundness checking
- Pin safety invariant enforcement

### Common Testing Patterns

All test files follow the **compile-fail UI test architecture**:
1. Import relevant macros from `pin-project-lite`
2. Define deliberately invalid code patterns
3. Use `//~ ERROR` annotations to specify expected compiler errors
4. Validate that safety violations are caught at compile time

## Public API Surface

The tests validate error handling for:
- `pin_project_lite::pin_project` macro usage patterns
- `PinnedDrop` trait implementations
- Generic type parameter and lifetime constraints
- Struct attribute and syntax validation

## Internal Organization and Data Flow

### Error Detection Pipeline
1. **Syntax Validation**: Basic macro usage and parameter parsing
2. **Trait Conflict Detection**: Preventing implementation collisions
3. **Safety Constraint Enforcement**: Memory layout and alignment checks
4. **Namespace Protection**: Hiding internal implementation details

### Safety Invariants Tested
- **Memory Safety**: No packed structs or misaligned references in pin projections
- **Type System Soundness**: No additional constraints in Drop/PinnedDrop implementations
- **API Encapsulation**: Internal types (`__Origin`) and lifetimes (`'__pin`) remain inaccessible
- **Pin Projection Safety**: Proper `Unpin` trait handling to prevent use-after-move bugs

## Important Patterns and Conventions

### Test Structure
Each test file focuses on a specific error category and includes:
- Minimal reproduction cases for each error condition
- Clear error annotations mapping to expected compiler diagnostics
- Empty `main()` functions to provide compilation context

### Error Message Validation
Tests ensure that:
- Compiler errors are generated for safety violations
- Error messages provide actionable feedback for developers
- Internal implementation details remain hidden from user diagnostics

## Role in Larger System

This test suite is critical for maintaining the safety guarantees of the `pin-project-lite` crate, which is fundamental to safe async Rust programming. By validating that all potentially unsafe usage patterns are rejected at compile time, these tests ensure that:
- Pin projections cannot violate memory safety
- The macro system maintains encapsulation boundaries
- Developers receive clear feedback when using the API incorrectly
- The crate's zero-cost abstraction guarantees hold under all usage scenarios

The comprehensive error testing enables confident adoption of `pin-project-lite` in production async Rust code by proving that the macro system cannot be misused in ways that would compromise memory safety.