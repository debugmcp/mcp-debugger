# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/invalid-bounds.rs
@source-hash: 4068e272a4f5d448
@generated: 2026-02-09T18:02:39Z

**Test File for Invalid Generic Bounds Syntax in pin_project_lite**

This is a negative test file that validates proper error reporting for invalid generic bound syntax in the `pin_project!` macro from the `pin_project_lite` crate.

## Primary Purpose
Tests that the `pin_project!` macro correctly rejects malformed generic type parameter bounds and where clauses, ensuring proper compile-time error messages are generated for syntax violations.

## Test Structure

### Generic Parameter Bound Tests (L5-39)
- **Generics1** (L6): Invalid `T: 'static : Sized` - double colon syntax error
- **Generics2** (L12): Invalid `T: 'static : ?Sized` - double colon with maybe bound
- **Generics3** (L18): Invalid `T: Sized : 'static` - reversed bound order with double colon
- **Generics4** (L24): Invalid `T: ?Sized : 'static` - maybe bound with double colon
- **Generics5** (L30): Invalid `T: Sized : ?Sized` - contradictory bounds with double colon
- **Generics6** (L36): Invalid `T: ?Sized : Sized` - contradictory bounds in reverse order

### Where Clause Tests (L41-93)
- **WhereClause1** (L44): Invalid `T: 'static : Sized` in where clause
- **WhereClause2** (L53): Invalid `T: 'static : ?Sized` in where clause
- **WhereClause3** (L62): Invalid `T: Sized : 'static` in where clause
- **WhereClause4** (L71): Invalid `T: ?Sized : 'static` in where clause
- **WhereClause5** (L80): Invalid `T: Sized : ?Sized` in where clause
- **WhereClause6** (L89): Invalid `T: ?Sized : Sized` in where clause

## Dependencies
- `pin_project_lite::pin_project` macro (L3)

## Expected Behavior
Each test case contains inline error expectations (`//~ ERROR`) specifying the exact compiler error messages that should be generated. The main function (L95) is empty as this is purely a compile-time validation test.

## Pattern
All structs follow the same pattern: single generic type parameter `T` with a `field: T` member, but with intentionally malformed bound syntax to trigger specific parser errors.