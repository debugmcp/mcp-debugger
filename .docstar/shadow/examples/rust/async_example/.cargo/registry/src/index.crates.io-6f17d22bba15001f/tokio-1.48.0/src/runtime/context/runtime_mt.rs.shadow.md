# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/context/runtime_mt.rs
@source-hash: 911b95f39dbed005
@generated: 2026-02-09T18:03:02Z

## Purpose
Runtime context management for multi-threaded Tokio runtime, providing entry/exit state tracking and safe cleanup mechanisms.

## Key Components

### Functions
- **current_enter_context()** (L4-6): Returns current runtime enter state by accessing thread-local CONTEXT storage
- **exit_runtime<F,R>()** (L10-36): Temporarily clears runtime "entered" state while executing closure, with automatic restoration via RAII

### Internal Types  
- **Reset** (L12): RAII guard struct that restores previous runtime state on drop
- **Reset::drop()** (L15-24): Validates runtime state and restores previous enter context, with assertion to prevent permanent executor claims

## Dependencies
- `super::{EnterRuntime, CONTEXT}`: Runtime enter state enum and thread-local context storage
- Thread-local storage pattern via `CONTEXT.with()`

## Architecture Patterns
- **RAII Guard Pattern**: Reset struct ensures automatic cleanup even on panic (L33-35)
- **Thread-Local Context**: Uses TLS for per-thread runtime state management
- **Temporary State Modification**: Safe entry/exit state transitions with validation

## Critical Invariants
- Runtime must be entered before calling exit_runtime (assertion L28)
- Closure must not claim permanent executor (assertion L18-20)
- State restoration guaranteed via Drop trait implementation
- Panic-safe design through RAII pattern

## Key Behaviors
- State transitions: Entered → NotEntered → Original State
- Automatic restoration occurs after closure execution
- Validation ensures proper runtime context lifecycle