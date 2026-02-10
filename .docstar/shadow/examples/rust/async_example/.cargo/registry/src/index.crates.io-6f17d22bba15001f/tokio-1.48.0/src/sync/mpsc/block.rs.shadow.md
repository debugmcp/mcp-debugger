# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/block.rs
@source-hash: 6c3017989952d68e
@generated: 2026-02-09T18:03:24Z

## Purpose
Lock-free block storage for Tokio's MPSC channel implementation. Manages fixed-size blocks in a linked list where each block contains `BLOCK_CAP` slots for storing channel messages with atomic coordination between senders and receivers.

## Core Structures

**Block<T> (L13-21)**: Main block structure containing a header and values array. Each block represents a contiguous segment of channel slots with atomic coordination mechanisms.

**BlockHeader<T> (L24-39)**: Metadata for block coordination including:
- `start_index` (L28): Absolute index of first slot in this block
- `next` (L31): Atomic pointer to next block in linked list
- `ready_slots` (L34): Bitfield tracking which slots contain ready values
- `observed_tail_position` (L38): Unsafe cell for tail position tracking

**Values<T> (L47)**: Transparent wrapper around array of `UnsafeCell<MaybeUninit<T>>` for storing actual channel values.

**Read<T> (L41-44)**: Enum representing read results - either a value or channel closed signal.

## Key Constants & Masks
- `BLOCK_CAP` (L49): Block capacity imported from parent module
- `BLOCK_MASK/SLOT_MASK` (L52-55): Bit masks for extracting block ID and slot offset from indices
- `RELEASED` (L60): Flag indicating block released by sender
- `TX_CLOSED` (L65): Flag indicating all senders dropped
- `READY_MASK` (L68): Mask for slot readiness bits

## Critical Methods

**Block::new() (L95-126)**: Heap-allocates and initializes new block with proper memory layout and atomic field setup.

**Block::read() (L152-169)**: Unsafe atomic read from slot, checking readiness bits and handling channel closure. Returns `Option<Read<T>>`.

**Block::write() (L195-207)**: Unsafe write to slot followed by atomic readiness signaling via `set_ready()`.

**Block::grow() (L347-406)**: Lock-free linked list extension using compare-and-swap operations. Handles contention by walking the list to find insertion point.

**Block::try_push() (L313-331)**: Atomic compare-and-swap to append block to linked list with proper ordering guarantees.

**Block::tx_release() (L244-255)**: Sender-side block release protocol, setting observed tail position and release flag for receiver coordination.

## Utility Functions
- `start_index()/offset()` (L72-80): Index manipulation helpers
- `is_ready()/is_tx_closed()` (L410-418): Bitfield query functions

## Memory Ordering & Safety
Extensive use of `Acquire`/`Release`/`AcqRel` ordering for proper synchronization. Multiple unsafe methods require caller-enforced invariants around slot emptiness and concurrent access prevention.

## Architecture Notes
- Lock-free design using atomic operations and bitfields
- Cache-friendly value storage in contiguous arrays
- Block recycling via `reclaim()` method (L228-232)
- Handles memory allocation failures gracefully
- Supports both normal operation and testing/fuzzing via loom integration