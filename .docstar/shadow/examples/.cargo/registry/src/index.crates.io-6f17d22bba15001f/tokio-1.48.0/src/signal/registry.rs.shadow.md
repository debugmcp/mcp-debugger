# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/signal/registry.rs
@source-hash: c64d2620dfc0435c
@generated: 2026-02-09T18:06:45Z

## Purpose
Signal registry system that manages event notification distribution using a publisher-subscriber pattern. Core component of Tokio's signal handling that decouples event recording from listener notification through atomic coordination.

## Key Components

### EventInfo (L13-26)
Thread-safe event state holder with atomic pending flag and watch channel sender. Combines event buffering (`pending: AtomicBool`) with broadcast capability (`tx: watch::Sender<()>`). Default implementation creates watch channel and initializes pending to false.

### Storage Trait (L30-38) 
Generic interface for event lookup and iteration. Provides `event_info()` for ID-based retrieval and `for_each()` for bulk operations. Implemented by `Vec<EventInfo>` (L40-51) using direct indexing.

### Registry<S> (L64-111)
Core orchestrator generic over storage type S. Key methods:
- `register_listener()` (L76-82): Creates new watch receiver, panics on invalid event_id
- `record_event()` (L86-90): Atomically marks event as pending without notification
- `broadcast()` (L95-110): Processes all pending events, resets flags, notifies listeners via watch channels

Critical pattern: Two-phase operation separating event recording from broadcasting enables batching and prevents race conditions.

### Globals (L113-149)
Singleton wrapper combining `OsExtraData` and `Registry<OsStorage>`. Implements `Deref` to OsExtraData (L118-124) and delegates registry operations. Provides platform-specific storage access on Unix (L146-148).

### Global Access (L162-170)
Thread-safe singleton initialization using `OnceLock<Globals>`. Requires Init trait bounds on OsExtraData and OsStorage for lazy initialization.

## Dependencies
- `watch` channels for multi-consumer notification
- `AtomicBool` with SeqCst ordering for thread-safe pending flags  
- `OsStorage`/`OsExtraData` from signal::os module for platform abstraction

## Architectural Patterns
- Generic storage abstraction enables platform-specific optimizations
- Atomic record-then-broadcast pattern prevents lost signals
- Watch channels provide efficient 1-to-N notification with receiver dropping support
- Init trait enables deferred initialization for global state

## Critical Invariants
- EventIds must be valid indices in storage or `register_listener` panics
- Pending flags use SeqCst ordering for cross-thread visibility
- Broadcast returns true only if at least one listener received notification