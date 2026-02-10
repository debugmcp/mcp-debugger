# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/trace.rs
@source-hash: cfc48b92d3f9e8e3
@generated: 2026-02-09T18:06:53Z

## Purpose and Responsibility
Provides tracing and observability infrastructure for Tokio's runtime, including task spawn metadata tracking and conditional instrumentation based on feature flags.

## Key Components

### SpawnMeta Struct (L5-18)
Metadata container for task spawning with conditional field compilation:
- `name`: Optional task name (only with `tokio_unstable` + `tracing` features)
- `original_size`: Original future/function size before boxing
- `spawned_at`: Source code location where task was spawned
- `_pd`: PhantomData for lifetime management

### SpawnMeta Constructors
- `new()` (L24-31): Creates named spawn metadata with tracing features enabled
- `new_unnamed()` (L34-47): Creates unnamed spawn metadata, handles feature flag compilation

## Conditional Compilation Blocks

### cfg_trace! Block (L50-165)
Active when tracing is enabled, provides full instrumentation:

#### task() Function (L62-86)
Instruments regular async tasks with tracing spans including:
- Task kind, name, ID, and size information
- Source location details
- Handles size comparison between original and current task size

#### blocking_task() Function (L89-112)
Instruments blocking tasks with specialized spans for blocking operations, includes function type information.

#### async_op() Function (L114-133)
Creates instrumented async operations with hierarchical span structure:
- Resource span context
- Async operation span
- Poll operation span

#### AsyncOpTracingCtx (L136-140)
Container for tracing context with three span levels for async operations.

#### InstrumentedAsyncOp (L143-164)
Pin-projected wrapper that implements Future with nested span entry during polling.

### cfg_not_trace! Block (L167-180)
No-op implementations when tracing is disabled - functions return tasks unchanged.

## Additional Utilities

### caller_location() (L184-190)
Conditionally captures caller location based on feature flags, returns `Option<&'static Location>`.

## Dependencies
- `tracing`: Span creation and instrumentation
- `pin_project_lite`: Pin projection for async wrapper
- `std::marker::PhantomData`: Lifetime management
- Internal Tokio runtime types

## Architectural Patterns
- Conditional compilation for performance when tracing disabled
- Zero-cost abstractions through feature flag elimination
- Hierarchical span structure for async operation tracing
- Pin projection for safe async wrapper implementation