# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/blocking.rs
@source-hash: 8e62b2cdc512fedb
@generated: 2026-02-09T18:12:09Z

## Purpose
Feature flag-based conditional compilation module that provides blocking task spawning APIs for Tokio. Uses compile-time configuration to either expose real runtime functionality or panic-based stubs.

## Key Components

### Runtime Feature Enabled (`cfg_rt!`, L1-10)
- **`spawn_blocking`** (L2): Re-exports `crate::runtime::spawn_blocking` for spawning blocking tasks on thread pool
- **`spawn_mandatory_blocking`** (L6): Re-exports filesystem-specific blocking spawner (requires both `rt` and `fs` features)
- **`JoinHandle`** (L9): Re-exports `crate::task::JoinHandle` for task result handling

### No Runtime Feature (`cfg_not_rt!`, L12-63)
Provides stub implementations that panic when runtime feature is disabled:

- **`spawn_blocking<F, R>`** (L18-25): Stub function that panics with feature flag message
  - Generic over closure `F: FnOnce() -> R + Send + 'static` and return type `R: Send + 'static`
  - Includes Send/Sync assertion via `assert_send_sync` (L23)

- **`spawn_mandatory_blocking<F, R>`** (L28-34): Filesystem-specific stub that also panics
  - Returns `Option<JoinHandle<R>>` instead of direct `JoinHandle<R>`

- **`JoinHandle<R>`** (L37-59): Mock implementation with phantom data
  - Contains only `PhantomData<R>` field (L38)
  - Implements `Send + Sync` for `T: Send` (L41-42)
  - Implements `Future` with `unreachable!()` poll method (L44-50)
  - Provides basic `Debug` formatting (L52-59)

- **`assert_send_sync<T: Send + Sync>`** (L61-62): Compile-time trait bound verification helper

## Architecture Pattern
Uses Tokio's conditional compilation system (`cfg_rt!`, `cfg_not_rt!`, `cfg_fs!`) to provide different implementations based on enabled feature flags. When runtime features are disabled, all functions panic with descriptive messages rather than causing compilation errors.

## Dependencies
- `std::fmt`, `std::future::Future`, `std::pin::Pin`, `std::task::{Context, Poll}` for no-runtime implementations
- `crate::runtime` and `crate::task` modules when runtime is enabled