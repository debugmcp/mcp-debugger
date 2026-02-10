# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/marker.rs
@source-hash: c11c5a1be8bdf18b
@generated: 2026-02-09T18:11:39Z

**Purpose:** Defines a zero-sized marker type to establish consistent auto-trait behavior across all proc-macro2 types.

**Core Components:**
- `ProcMacroAutoTraits` struct (L12): Zero-sized marker containing `PhantomData<Rc<()>>` to control auto-trait inheritance
- `MARKER` constant (L14): Singleton instance for reuse across the crate

**Auto-Trait Strategy:**
The struct uses `PhantomData<Rc<()>>` to inherit specific auto-trait behaviors:
- `Rc<()>` is `Send` but not `Sync`, ensuring proc-macro types follow this pattern
- Explicitly implements `UnwindSafe` and `RefUnwindSafe` (L16-17) for panic safety
- Conditionally derives `PartialEq` and `Eq` (L9-10) based on semver-exempt features

**Architectural Role:**
This marker is embedded in proc-macro2's core types to ensure they all have identical auto-trait implementations, preventing inconsistencies that could break user code. The `PhantomData` approach allows controlling trait bounds without adding runtime overhead.

**Dependencies:**
- `alloc::rc::Rc` for the phantom type parameter
- `core::marker::PhantomData` for zero-cost type-level constraints
- `core::panic` traits for unwind safety guarantees