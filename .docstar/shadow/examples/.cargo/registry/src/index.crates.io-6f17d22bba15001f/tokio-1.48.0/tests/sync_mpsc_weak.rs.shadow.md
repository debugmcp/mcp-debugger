# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_mpsc_weak.rs
@source-hash: 71adc1975b4952c4
@generated: 2026-02-09T18:12:38Z

**Purpose**: Comprehensive test suite for Tokio's MPSC (Multi-Producer Single Consumer) weak sender functionality, validating weak reference patterns for both bounded and unbounded channels.

## Core Test Categories

### Basic Weak Sender Operations
- `weak_sender()` (L14-56): Tests downgrade/upgrade cycle for bounded channels, verifying weak senders can be upgraded when strong senders exist and fail when they don't
- `weak_unbounded_sender()` (L275-317): Mirror test for unbounded channels

### Actor Pattern Implementation
- `actor_weak_sender()` (L59-166): Complex actor pattern test using bounded channels with:
  - `MyActor` struct (L60-128): Actor with weak sender for self-messaging capability
  - `MyActorHandle` struct (L131-153): External handle for actor communication
  - Tests actor self-messaging via weak sender upgrade/downgrade cycle
- `actor_weak_unbounded_sender()` (L320-427): Identical actor pattern for unbounded channels

### Message Drop Semantics
- `test_msgs_dropped_on_rx_drop()` (L188-210): Validates that pending messages are properly dropped when receiver is closed, using `Msg` struct (L170-177) with custom Drop implementation tracked by `NUM_DROPPED` (L168)
- `test_msgs_dropped_on_unbounded_rx_drop()` (L449-471): Unbounded channel equivalent using `MsgUnbounded` (L431-438) and `NUM_DROPPED_UNBOUNDED` (L429)

### Upgrade/Downgrade Edge Cases
- Basic success/failure scenarios (L213-227, L475-490)
- Permit-based edge cases (L243-261): Tests interaction with channel permits
- Reference counting validation (L264-272, L505-513)
- Channel closure behavior (L516-531)

### Reference Count Testing
- Strong/weak count tracking for both channel types (L534-687)
- Validates count accuracy during clone, drop, and downgrade operations

## Key Dependencies
- `tokio::sync::mpsc`: Core MPSC channel functionality
- `tokio::sync::oneshot`: Request-response pattern in actor tests
- `std::sync::atomic`: Drop counting mechanism for message lifecycle tests

## Architecture Notes
- Weak senders allow holding channel references without preventing channel closure
- Actor pattern demonstrates practical weak sender usage for self-messaging
- Tests validate that weak senders don't affect channel lifetime management
- Message drop tests ensure proper cleanup semantics when receivers are closed

## Critical Invariants
- Weak senders can only be upgraded when strong senders exist
- Channel closes when all strong senders are dropped (regardless of weak sender count)
- Messages sent after receiver drop are properly discarded
- Reference counts accurately track strong/weak sender relationships