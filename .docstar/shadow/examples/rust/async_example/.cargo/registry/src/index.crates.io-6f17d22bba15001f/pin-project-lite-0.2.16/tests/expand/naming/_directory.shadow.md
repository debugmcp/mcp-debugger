# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/
@generated: 2026-02-09T18:16:11Z

This directory contains test files demonstrating `pin-project-lite`'s custom projection naming capabilities and their macro expansion outputs. It serves as part of the crate's test suite to validate that the `pin_project!` macro correctly generates projection types with user-specified names rather than defaults.

## Purpose and Scope

The directory tests the **naming configuration system** of pin-project-lite, which allows users to customize the names of generated projection types through attributes:
- `#[project = CustomName]` - Names the mutable projection type
- `#[project_ref = CustomRefName]` - Names the immutable reference projection type  
- `#[project_replace = CustomReplaceName]` - Names the replacement projection type

## Test Architecture

The directory follows a systematic testing pattern with **paired files**:
- **`.rs` files**: Source test cases with specific naming configurations
- **`.expanded.rs` files**: Expected macro expansion outputs for validation

### Test Matrix

**Enum Tests** (`enum-*.rs`):
- `enum-all.*` - Tests all three projection names specified (EnumProj, EnumProjRef, EnumProjReplace)
- `enum-mut.*` - Tests only mutable projection naming (EnumProj)
- `enum-ref.*` - Tests only reference projection naming (EnumProjRef)
- `enum-none.*` - Tests default naming (no custom names)

**Struct Tests** (`struct-*.rs`):
- `struct-all.*` - Tests all three projection names specified (StructProj, StructProjRef, StructProjReplace)
- `struct-mut.*` - Tests only mutable projection naming (StructProj)
- `struct-ref.*` - Tests only reference projection naming (StructProjRef)
- `struct-none.*` - Tests default naming (no custom names)

## Key Components

### Test Data Types
Each test case defines either:
- **Generic enum** `Enum<T, U>` with `Struct { pinned: T, unpinned: U }` and `Unit` variants
- **Generic struct** `Struct<T, U>` with `pinned: T` and `unpinned: U` fields

### Generated Projection Types
The expanded files demonstrate the complete macro-generated infrastructure:
- **Projection structs/enums**: Mirror original types with appropriate `Pin<&mut T>`/`Pin<&T>` wrappers for pinned fields
- **Core methods**: `project()`, `project_ref()`, `project_replace()` for safe field access
- **Safety infrastructure**: `__Origin` phantom types, conditional `Unpin` implementations, `MustNotImplDrop` trait enforcement

### Safety Mechanisms
All expanded files include comprehensive pin safety guarantees:
- **Drop prevention**: `MustNotImplDrop` trait prevents manual `Drop` implementations
- **Unpin analysis**: Conditional `Unpin` implementations based on pinned field constraints
- **Memory layout validation**: `__assert_not_repr_packed()` functions prevent unsafe representations
- **Lifetime tracking**: `'__pin` lifetimes ensure projection safety

## Integration with Pin Ecosystem

The tests validate that custom-named projections maintain full compatibility with Rust's pin projection ecosystem:
- Safe field access through generated projection methods
- Proper `Pin<&mut T>` wrapping for pinned fields
- Zero-cost abstractions through inline unsafe implementations
- Compile-time safety through phantom types and trait bounds

## Testing Strategy

This directory enables **expansion testing** - comparing actual macro output against expected results to ensure:
- Custom naming attributes are properly parsed and applied
- Generated code maintains identical safety properties regardless of naming
- All projection variants (mutable, reference, replace) work with custom names
- Both enum and struct types support the full naming feature set

The systematic coverage across enum/struct types and naming combinations provides confidence that the naming system works correctly across all supported pin-project-lite use cases.