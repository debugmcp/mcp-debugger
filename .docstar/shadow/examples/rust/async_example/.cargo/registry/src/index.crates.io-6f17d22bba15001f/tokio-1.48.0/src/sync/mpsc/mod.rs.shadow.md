# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/mod.rs
@source-hash: 6ea3d79e35968dd1
@generated: 2026-02-09T18:03:17Z

## Tokio MPSC Channel Module

**Primary Purpose:** Module providing multi-producer, single-consumer (MPSC) channels for async task communication in Tokio. Acts as the main API entry point exposing both bounded and unbounded channel variants.

**Key Exports:**
- **Bounded Channel (L117-120):** `channel()`, `Sender`, `Receiver`, `OwnedPermit`, `Permit`, `PermitIterator`, `WeakSender` from `bounded` submodule
- **Unbounded Channel (L126-129):** `unbounded_channel()`, `UnboundedSender`, `UnboundedReceiver`, `WeakUnboundedSender` from `unbounded` submodule
- **Error Types (L131):** Public error module for channel-related errors

**Architecture:**
- **Block-based Storage (L115, L124):** Uses internal `block` and `list` modules for memory-efficient linked-list storage
- **Shared Channel Implementation (L122):** Common `chan` module provides core channel logic
- **Platform-Optimized Block Size (L133-144):** 
  - 64-bit systems: 32 messages per block (L137-138)
  - 32-bit systems: 16 messages per block (L140-141)
  - Loom testing: 2 messages per block (L143-144)

**Key Behavioral Patterns:**
- **Backpressure:** Bounded channels block senders when at capacity
- **Disconnection Semantics:** Dropping all senders terminates receiver; dropping receiver fails all pending sends
- **Runtime Agnostic:** Works across different Tokio runtime instances and non-Tokio runtimes
- **Cooperative Scheduling:** Participates in Tokio's cooperative scheduling when used within Tokio runtime
- **Memory Management:** Block reuse optimization when empty blocks exist

**Critical Constraints:**
- `BLOCK_CAP` must be power of 2 and smaller than `usize` bit count (L135-136)
- Timeout methods require Tokio timer access (L81-83)
- Single consumer per channel (multiple producers allowed)

**Sync/Async Bridge:**
- Bounded channels: Use `blocking_send`/`blocking_recv` for sync code
- Unbounded channels: Sender choice depends on receiver location (async→sync use std/crossbeam, sync→async use Tokio)

**Feature Gating:** Entire module disabled when "sync" feature not enabled (L1)