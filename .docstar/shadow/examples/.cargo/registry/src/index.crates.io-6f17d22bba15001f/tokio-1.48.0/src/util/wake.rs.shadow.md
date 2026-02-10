# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/wake.rs
@source-hash: c759b23ec7dd5f7a
@generated: 2026-02-09T18:06:52Z

## Purpose
Provides Tokio-specific waking utilities that bridge between Arc-based wake implementations and the standard library's RawWaker/Waker system. This module enables efficient task waking without unnecessary reference counting operations.

## Key Components

### Wake Trait (L7-13)
Core abstraction for Arc-based waking with two methods:
- `wake(Arc<Self>)` - Consumes the Arc for one-time waking
- `wake_by_ref(&Arc<Self>)` - Wakes without consuming the Arc reference

### WakerRef Struct (L21-24) 
Lifetime-bounded waker wrapper available only under `cfg_rt` feature:
- Uses `ManuallyDrop<Waker>` to prevent premature cleanup
- `PhantomData<&'a ()>` ties lifetime to creating reference
- Implements `Deref` to `Waker` for transparent usage (L26-32)

### Core Factory Functions
- `waker<W: Wake>(Arc<W>) -> Waker` (L48-55): Creates owned Waker from Arc, consuming the Arc
- `waker_ref<W: Wake>(&Arc<W>) -> WakerRef<'_>` (L35-44): Creates borrowed Waker without affecting refcount

### RawWaker Implementation (L57-85)
Complete vtable implementation for RawWaker integration:
- `waker_vtable<W>()` (L57-64): Builds vtable with all required operations  
- `clone_arc_raw<T>()` (L66-69): Increments Arc refcount for cloning
- `wake_arc_raw<T>()` (L71-74): Consumes Arc and calls `Wake::wake()`
- `wake_by_ref_arc_raw<T>()` (L77-81): Calls `Wake::wake_by_ref()` without consuming Arc using ManuallyDrop
- `drop_arc_raw<T>()` (L83-85): Properly drops the Arc

## Architecture
Follows standard Rust waker pattern but optimized for Arc-based implementations. The vtable functions handle raw pointer conversions safely while maintaining proper Arc semantics. The `waker_ref` approach avoids unnecessary reference counting when the Arc lifetime is guaranteed.