# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/mod.rs
@source-hash: c3982eda654dfb42
@generated: 2026-02-09T18:03:11Z

## Purpose
Core scheduler abstraction module for Tokio runtime, providing unified interface for different scheduler implementations (current_thread and multi_thread) through feature-gated conditional compilation.

## Key Types

**Handle (L29-42)**: Primary scheduler handle enum that wraps either `CurrentThread` or `MultiThread` schedulers based on feature flags. Includes `Disabled` variant for no-runtime builds.

**Context (L44-50)**: Runtime context enum for scheduler-specific execution contexts, mirroring the Handle variants.

## Core Functionality

**Handle Methods**:
- `current()` (L90-95): Gets current runtime handle via context, panics if no runtime
- `spawn()` (L120-131): Spawns Send futures on appropriate scheduler
- `spawn_local()` (L140-150): Unsafe local task spawning (CurrentThread only)
- `driver()` (L54-65): Access to I/O driver handle
- `blocking_spawner()` (L97-99): Access to blocking task spawner
- `shutdown()` (L152-159): Graceful scheduler shutdown (MultiThread only)

**Runtime Detection**:
- `is_local()` (L101-108): Checks if using local runtime
- `can_spawn_local_on_local_runtime()` (L111-118): Validates local spawning safety
- `num_workers()` (L183-189): Returns worker count (1 for CurrentThread)

**Metrics** (L191-233): Various scheduler metrics under `cfg_unstable_metrics`

**Context Methods**:
- `expect_current_thread()` (L238-244): Type-safe CurrentThread context extraction
- `defer()` (L246-248): Waker deferral mechanism

## Architecture Patterns

**Feature-Gated Modules** (L1-25): Conditional compilation using `cfg_rt!` and `cfg_rt_multi_thread!` macros to include scheduler-specific code.

**match_flavor! Macro** (L77-86): Pattern matching helper that reduces boilerplate when dispatching to scheduler-specific implementations.

**Polymorphic Dispatch**: Handle enum provides unified interface while delegating to appropriate scheduler implementation based on runtime type.

## Dependencies
- `crate::runtime::driver`: I/O driver integration
- `current_thread`/`multi_thread`: Scheduler implementations
- `inject`: Task injection queue
- `defer`: Waker deferral system
- `block_in_place`: Blocking operation support (multi-thread only)

## Critical Invariants
- Local spawning only allowed on CurrentThread scheduler with thread ownership verification
- Feature flags must align with scheduler variant access
- Disabled variant only for no-runtime builds (unreachable in normal operation)