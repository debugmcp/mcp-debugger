# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/local_runtime/mod.rs
@source-hash: c4f796218d90c615
@generated: 2026-02-09T18:03:02Z

**Purpose**: Module aggregator for Tokio's local runtime implementation, providing a single-threaded async runtime without work-stealing.

**Structure**:
- Declares two submodules: `runtime` (L1) and `options` (L3)
- Exports public API components and internal scheduler interface

**Key Exports**:
- `LocalOptions` (L5): Configuration options for local runtime setup
- `LocalRuntime` (L6): Main single-threaded runtime implementation  
- `LocalRuntimeScheduler` (L7): Internal scheduler interface exposed to parent module only

**Architectural Role**: 
This module serves as the entry point for Tokio's local runtime subsystem, which provides a lightweight alternative to the multi-threaded runtime for single-threaded use cases. The local runtime avoids the overhead of work-stealing and cross-thread synchronization.

**Dependencies**: 
- Internal submodules `runtime` and `options` contain the actual implementations
- Part of Tokio's broader runtime module hierarchy

**Usage Pattern**: 
Typical module facade pattern - consolidates related functionality from submodules and provides clean public API surface while selectively exposing internal components to parent modules.