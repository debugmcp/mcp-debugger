# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/drop_order.rs
@source-hash: 9b13b6461e44be1c
@generated: 2026-02-09T18:11:44Z

## Primary Purpose
Test suite verifying that pin-project-lite maintains correct drop order semantics for pinned and unpinned fields during normal destruction and `project_replace` operations.

## Key Components

### Drop Order Test Infrastructure
- **`D` struct (L9)**: Drop-tracking wrapper with Cell-based sequencing to verify destruction order
- **`Drop` implementation (L11-18)**: Validates sequential drop order by checking Cell values increment correctly

### Pin-Project Test Structures
- **`StructPinned` (L20-30)**: Structure with two `#[pin]` fields for testing pinned field drop semantics
- **`StructUnpinned` (L32-40)**: Structure with unpinned fields for comparison testing  
- **`Enum` (L42-58)**: Enum variants testing both pinned and unpinned field combinations

### Test Functions
- **`struct_pinned` (L60-72)**: Tests drop order for pinned struct fields in normal and `project_replace` scenarios
- **`struct_unpinned` (L74-86)**: Tests drop order for unpinned struct fields
- **`enum_struct` (L88-111)**: Tests drop order for enum variants with mixed field types
- **`project_replace_panic` (L116-169)**: Complex panic safety test ensuring proper cleanup when drops panic during `project_replace`

## Key Dependencies
- `pin_project_lite::pin_project` macro for generating projection methods
- `std::pin::Pin` for pinned references
- `std::cell::Cell` for interior mutability in drop tracking
- `std::panic` for testing panic scenarios

## Critical Behaviors
- Drop order validation through sequential numbering (D struct expects values 0,1,2,...)
- Panic safety during `project_replace` operations ensuring all allocated resources are properly cleaned up
- Distinction between pinned and unpinned field handling in generated code

## Architecture Notes
- Tests use Cell-based drop counters to verify Rust's guaranteed drop order semantics
- `project_replace` testing ensures the pin-project macro generates memory-safe replacement code
- Panic tests validate that partial failures during replacement don't leak resources