# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mod.rs
@source-hash: 0560ed6df8f7b536
@generated: 2026-02-09T18:06:48Z

## Primary Purpose
This is the main synchronization module for Tokio's async runtime, providing both message-passing channels and state synchronization primitives for coordinating between async tasks. It serves as the public API entry point with extensive documentation and conditional compilation for different feature sets.

## Key Components

### Channel Types (Message Passing)
- **oneshot** (L471): Single-value, single-producer-to-single-consumer channel for one-time communication
- **mpsc** (L463): Multi-producer, single-consumer channel for streaming multiple values
- **broadcast** (L461): Multi-producer, multi-consumer channel where all consumers receive all messages
- **watch** (L497): Multi-producer, multi-consumer channel that only stores the latest value

### State Synchronization Primitives
- **Barrier** (L459): Synchronization point where multiple tasks wait for each other
- **Mutex** (L466): Mutual exclusion lock with various guard types (owned, mapped variants)
- **Notify** (L469): Basic task notification without data transfer
- **RwLock** (L480-486): Reader-writer lock with multiple guard variants
- **Semaphore** (L477): Concurrency limiting with permit-based access control
- **OnceCell** (L492): Thread-safe lazy initialization
- **SetOnce** (L495): Single-assignment cell

### Internal Components
- **batch_semaphore** (L473-474, L502): Internal semaphore implementation with error types
- **AtomicWaker** (L489, L515): Internal task waking mechanism
- **futures** module (L454-456): Exports named future types (Notified, OwnedNotified)

## Architecture & Patterns

### Conditional Compilation Strategy
- **cfg_sync!** (L452-498): Main feature gate that includes full sync API when "sync" feature is enabled
- **cfg_not_sync!** (L500-520): Fallback that provides minimal internal-only sync primitives for other Tokio features
- **Feature-specific gates**: Fine-grained conditional compilation for rt, signal, process, fs features

### Module Organization
- Public API modules are feature-gated and provide comprehensive documentation
- Internal modules marked with `pub(crate)` for cross-crate usage within Tokio
- Guard types and error types co-located with their primary types

## Key Design Decisions

### Runtime Agnostic Design
All primitives work across different async runtimes, not just Tokio, with cooperative scheduling when used within Tokio runtime.

### Comprehensive Guard Types
Each locking primitive provides multiple guard variants (owned, mapped) for different ownership and access patterns.

### Documentation-Heavy Approach
Extensive inline examples and usage patterns for each synchronization primitive, serving as both API documentation and educational material.

## Dependencies & Relationships
- Integrates with `crate::task` for JoinHandle and cooperative scheduling
- Uses internal `crate::sync::*` modules for implementation details
- Feature flags control which synchronization primitives are available
- Error types are shared between related primitives (batch_semaphore errors used by Semaphore)