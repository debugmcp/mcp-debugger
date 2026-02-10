# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_broadcast_weak.rs
@source-hash: 9efbe3872eecc2de
@generated: 2026-02-09T18:12:32Z

This file contains comprehensive tests for Tokio's broadcast channel weak sender functionality, verifying the behavior of `WeakSender` reference counting and upgrade/downgrade operations.

## Purpose
Tests the weak reference semantics of Tokio broadcast channels, ensuring proper reference counting, upgrade/downgrade behavior, and channel closure semantics when only weak senders remain.

## Key Test Functions

### Core Weak Sender Tests
- **`weak_sender` (L10-53)**: Complex async test demonstrating weak sender lifecycle - creates sender, downgrades to weak, upgrades back to strong, sends messages, and verifies proper cleanup when all strong references are dropped
- **`downgrade_upgrade_sender_failure` (L56-62)**: Verifies that upgrading a weak sender fails when no strong senders exist
- **`downgrade_drop_upgrade` (L66-74)**: Tests that weak senders cannot upgrade after the original strong sender is dropped

### Reference Counting Tests
- **`test_tx_count_weak_sender` (L77-91)**: Validates that `downgrade()` doesn't affect strong count but increases weak count; verifies counts remain accurate after strong sender drop
- **`test_rx_is_closed_when_dropping_all_senders_except_weak_senders` (L93-103)**: Confirms receiver closure when only weak senders remain
- **`sender_strong_count_when_cloned` (L105-114)**: Tests strong count tracking with cloned senders
- **`sender_weak_count_when_downgraded` (L116-124)**: Verifies weak count increments on downgrade
- **`sender_strong_count_when_dropped` (L126-136)**: Tests strong count decrements on drop
- **`sender_weak_count_when_dropped` (L138-148)**: Tests weak count decrements on weak sender drop
- **`sender_strong_and_weak_conut` (L150-181)**: Comprehensive test of mixed strong/weak reference counting with multiple senders

## Dependencies
- `tokio::sync::broadcast` for channel operations
- Standard test framework with async support
- WASM compatibility layer (L5-6)

## Key Patterns
- Reference counting validation using `strong_count()` and `weak_count()` methods
- Upgrade/downgrade cycle testing with `WeakSender::upgrade()` and `Sender::downgrade()`
- Channel closure detection via `Receiver::is_closed()`
- Async spawn patterns for concurrent sender operations

## Critical Invariants
- Weak senders don't prevent channel closure when no strong senders exist
- Upgrade operations fail when strong count reaches zero
- Reference counts accurately reflect actual sender instances
- Channel remains functional through upgrade/downgrade cycles