# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/tests/issue_392.rs
@source-hash: 163a423eeea14025
@generated: 2026-02-09T18:11:32Z

**Purpose**: Test case for parking_lot issue #392, verifying that multiple consecutive calls to `with_upgraded()` on an upgradable read lock work correctly without deadlock or panic.

**Structure**:
- `Lock` struct (L3): Simple wrapper around `RwLock<i32>` for test isolation
- `issue_392()` test function (L6-15): Regression test demonstrating the fix for issue #392

**Key Operations**:
1. Creates RwLock with initial value 0 (L7)
2. Acquires upgradable read lock (L8) 
3. Calls `with_upgraded()` twice consecutively (L9-11, L12-14) - this pattern was problematic in issue #392

**Dependencies**: 
- `parking_lot::RwLock` - high-performance reader-writer lock implementation

**Test Pattern**: Each `with_upgraded()` call temporarily upgrades the read lock to write lock, executes the closure, then downgrades back to read lock. The test verifies this upgrade/downgrade cycle can be repeated without issues.

**Critical Behavior**: The ability to call `with_upgraded()` multiple times on the same upgradable read lock guard without deadlock or panic - this was the specific issue being addressed in #392.