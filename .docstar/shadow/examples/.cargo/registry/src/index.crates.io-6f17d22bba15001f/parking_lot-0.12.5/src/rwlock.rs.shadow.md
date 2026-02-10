# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/rwlock.rs
@source-hash: 7edd9dd320858a62
@generated: 2026-02-09T18:11:43Z

## parking_lot RwLock Public API

**Primary Purpose**: Provides a high-performance, fair reader-writer lock implementation that wraps the underlying `RawRwLock` with type-safe RAII guards and additional functionality.

**Core Type Definitions**:
- `RwLock<T>` (L88): Type alias for `lock_api::RwLock<RawRwLock, T>` - the main reader-writer lock
- `const_rwlock<T>()` (L93-95): Const constructor function for creating RwLock in const contexts
- `RwLockReadGuard<'a, T>` (L99): RAII guard for shared read access
- `RwLockWriteGuard<'a, T>` (L103): RAII guard for exclusive write access
- `MappedRwLockReadGuard<'a, T>` (L112): Read guard for mapped subfields, no unlock/relock support
- `MappedRwLockWriteGuard<'a, T>` (L121): Write guard for mapped subfields, no unlock/relock support
- `RwLockUpgradableReadGuard<'a, T>` (L125): RAII guard for upgradable read access

**Key Dependencies**:
- `crate::raw_rwlock::RawRwLock` (L8): The underlying raw lock implementation
- `lock_api` crate: Provides the generic lock API that this wraps

**Architectural Patterns**:
- **Type Alias Pattern**: All public types are aliases to `lock_api` generics specialized with `RawRwLock`
- **RAII Guards**: All access is mediated through drop-based guards that automatically release locks
- **Const Constructor**: `const_rwlock()` enables static initialization on stable Rust

**Critical Features & Invariants**:
- **Task-fair locking**: Prevents reader/writer starvation through eventual fairness (every 0.5ms or 1ms+ critical sections)
- **No poisoning**: Lock remains usable after panic, unlike std::sync::RwLock
- **Downgrade support**: Write locks can be atomically downgraded to read locks
- **Upgradable reads**: Special read locks that can be upgraded to write locks
- **Memory efficiency**: Only 1 word of space vs boxed std library implementation
- **Adaptive spinning**: Efficient micro-contention handling

**Fairness Mechanism**:
- Uses "eventual fairness" with periodic fair unlocks every 0.5ms average
- Critical sections >1ms always use fair unlock
- Manual fair unlock available via `unlock_fair()` methods on guards

**Test Coverage** (L127-659):
- Comprehensive test suite covering all locking modes, contention scenarios, panic safety, downgrades, upgrades, and edge cases
- Notable tests: smoke test (L143), concurrent stress test (L155), panic safety tests (L182-231), upgrade/downgrade functionality (L234, L522)