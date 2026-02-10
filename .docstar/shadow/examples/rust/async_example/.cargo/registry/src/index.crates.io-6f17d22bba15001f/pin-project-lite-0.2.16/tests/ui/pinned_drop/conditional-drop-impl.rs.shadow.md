# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pinned_drop/conditional-drop-impl.rs
@source-hash: df03f38b2a331f33
@generated: 2026-02-09T18:02:39Z

## Test File: Conditional Drop Implementation Error Cases

**Purpose**: UI test file demonstrating compilation errors when Drop/PinnedDrop implementations have mismatched type constraints compared to their struct definitions.

**Key Components**:

- `DropImpl<T>` struct (L7-9): Generic struct with unconstrained type parameter `T` containing field `f: T`
- `Drop for DropImpl<T: Unpin>` impl (L11-14): Drop implementation that incorrectly adds `Unpin` constraint not present in struct definition, triggering compiler error E0367
- `PinnedDropImpl<T>` struct (L18-21): Pin-projected generic struct with unconstrained `T` and pinned field `f`  
- `PinnedDrop for PinnedDropImpl<T: Unpin>` impl (L23-25): PinnedDrop implementation that incorrectly adds `Unpin` constraint, also triggering E0367

**Dependencies**:
- `pin_project_lite` crate for `pin_project` macro and `PinnedDrop` trait

**Test Pattern**: 
This is a negative test case designed to verify that the Rust compiler correctly enforces the rule that Drop implementations must have identical type parameter constraints as their corresponding type definitions. The `//~^ ERROR E0367` comments (L12, L17) indicate expected compilation failures.

**Critical Invariant**: 
Drop trait implementations cannot impose additional constraints on type parameters beyond what the original struct definition specifies - this ensures soundness of the type system around cleanup code.