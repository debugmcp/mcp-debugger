# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/support/panic.rs
@source-hash: 7bcaf8ea2d249b5c
@generated: 2026-02-09T18:06:50Z

**Primary Purpose:** Test utility for detecting and capturing panic information in Tokio tests. Provides thread-safe panic testing with source file location capture.

**Core Functionality:**
- `test_panic<Func>()` (L4-34): Main test harness that executes a function and captures panic details
  - Accepts `FnOnce() + UnwindSafe` closure for safe panic testing
  - Returns `Option<String>` containing the source file path where panic occurred
  - Uses global mutex (L5) to ensure thread-safe panic hook management

**Implementation Strategy:**
- **Thread Safety**: Static `PANIC_MUTEX` (L5) serializes access to global panic hook
- **Hook Management**: Temporarily replaces panic hook (L11, L14-20) to capture file location
- **Panic Capture**: Custom hook extracts `panic_info.location().file()` (L15-19) into shared Arc<Mutex<Option<String>>>
- **Clean Restoration**: Always restores previous panic hook (L26) to maintain test environment integrity

**Key Dependencies:**
- `std::panic`: Core panic handling and unwinding mechanisms
- `std::sync::{Arc, Mutex}`: Thread-safe shared state for panic location storage

**Architectural Decisions:**
- Uses `catch_unwind()` (L23) for controlled panic execution without test termination
- Employs Arc/Mutex pattern for cross-closure data sharing between hook and main function
- Prioritizes hook restoration to prevent test environment pollution

**Critical Constraints:**
- Function must be `UnwindSafe` to ensure safe unwinding behavior
- Global mutex prevents concurrent panic testing, enforcing sequential execution
- Hook replacement is temporary and always restored to maintain test isolation