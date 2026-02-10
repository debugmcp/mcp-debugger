# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/
@generated: 2026-02-09T18:16:02Z

## Purpose

This directory contains UI (user interface) tests for the `pin-project-lite` crate, specifically focused on compile-time error validation and behavior verification. These tests ensure that the crate's macros and traits produce expected compiler errors and warnings when used incorrectly.

## Key Components

The directory is organized into three main test suites:

- **not_unpin**: Tests related to types that should not implement the `Unpin` trait when using pin-project-lite macros
- **pin_project**: Core functionality tests for the main `#[pin_project]` attribute macro
- **pinned_drop**: Tests for the pinned drop functionality and associated macro behavior

## Organization and Testing Pattern

This follows the standard Rust UI testing pattern where:
- Test files contain code that should produce specific compiler errors
- Expected error outputs are captured and compared against actual compiler diagnostics
- Tests verify both positive cases (code that should compile) and negative cases (code that should fail with specific errors)

## Role in the Larger System

These UI tests serve as a critical validation layer for pin-project-lite's compile-time guarantees:
- Ensures macro expansions produce correct code transformations
- Validates that unsafe Pin usage is properly constrained
- Confirms that the library's safety invariants are enforced at compile time
- Provides regression testing for complex macro interactions

The tests complement unit tests by focusing specifically on the developer experience and error messages that users encounter when misusing the library's APIs.