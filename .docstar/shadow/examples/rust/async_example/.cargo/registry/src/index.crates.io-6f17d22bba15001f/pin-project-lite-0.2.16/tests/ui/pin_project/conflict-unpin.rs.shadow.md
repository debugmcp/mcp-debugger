# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/conflict-unpin.rs
@source-hash: 37e7b2f9ab1be70d
@generated: 2026-02-09T18:02:39Z

## Primary Purpose
Test file for pin-project-lite that verifies compile-time error detection when user-provided `Unpin` implementations conflict with auto-generated ones from the `pin_project!` macro.

## Key Test Cases

### Foo Struct (L7-16)
- **Struct Definition (L7-13)**: Generic struct with pinned `future` field and regular `field`
- **Conflicting Implementation (L16)**: Conditional `Unpin` impl `where T: Unpin` conflicts with macro-generated impl
- **Expected Error**: E0119 (conflicting implementations)

### Bar Struct (L20-29)  
- **Struct Definition (L20-26)**: Similar structure to Foo
- **Conflicting Implementation (L29)**: Blanket `Unpin` impl without conditions conflicts with macro
- **Expected Error**: E0119

### Baz Struct (L31-40)
- **Struct Definition (L31-37)**: Same pattern as previous structs
- **Conflicting Implementation (L40)**: Conditional `Unpin` impl `where T: Unpin, U: Unpin` creates conflict
- **Expected Error**: E0119

### Qux Struct (L42-52)
- **Struct Definition (L42-49)**: Uses `#[project(!Unpin)]` attribute to disable auto-Unpin
- **Conflicting Implementation (L52)**: Blanket `Unpin` impl still conflicts despite `!Unpin` directive
- **Expected Error**: E0119

### Fred Struct (L54-64)
- **Struct Definition (L54-61)**: Also uses `#[project(!Unpin)]` attribute
- **Conflicting Implementation (L64)**: Conditional `Unpin` impl creates conflict
- **Expected Error**: E0119

## Dependencies
- `pin_project_lite::pin_project` (L3) - Core macro being tested

## Architecture Pattern
This is a negative test file using the Rust compiler's error checking. Each test case follows the pattern:
1. Define struct with `pin_project!` macro
2. Provide manual `Unpin` implementation
3. Expect E0119 compilation error due to conflicting trait implementations

## Critical Invariants
- The `pin_project!` macro automatically generates `Unpin` implementations
- Manual `Unpin` implementations will always conflict with auto-generated ones
- The `#[project(!Unpin)]` attribute doesn't prevent conflicts with manual implementations