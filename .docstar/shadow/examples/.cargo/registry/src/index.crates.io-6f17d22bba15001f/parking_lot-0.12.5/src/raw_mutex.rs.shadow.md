# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/raw_mutex.rs
@source-hash: 4a79255673f47e16
@generated: 2026-02-09T18:11:42Z

## RawMutex - Low-Level Parking Lot Mutex Implementation

**Primary Purpose:** Implements a low-level mutex using parking lot primitives with atomic state management and thread parking/unparking mechanisms.

### Core Structure
- **RawMutex (L32-56):** Main mutex struct with single `state: AtomicU8` field
- **State Management:** Uses 2-bit atomic state with `LOCKED_BIT` (L26) and `PARKED_BIT` (L29) flags
- **State Table (L36-54):** Documents 4 possible states based on bit combinations

### Key Constants
- **TOKEN_NORMAL (L19):** Standard unpark token for normal lock acquisition
- **TOKEN_HANDOFF (L23):** Special unpark token for direct mutex handoff without unlock
- **LOCKED_BIT/PARKED_BIT (L26,29):** Bit masks for atomic state manipulation

### Lock API Implementation
**RawMutex trait (L58-117):**
- `lock()` (L66): Fast-path CAS, falls back to `lock_slow()`
- `try_lock()` (L78): Non-blocking acquisition with retry loop
- `unlock()` (L100): Fast-path release, falls back to `unlock_slow()`
- `is_locked()` (L113): Simple state check

**RawMutexFair trait (L119-139):**
- `unlock_fair()` (L121): Fair unlock ensuring FIFO thread wakeup
- `bump()` (L134): Yield to waiting threads if any are parked

**RawMutexTimed trait (L141-178):**
- `try_lock_until()` (L146): Lock with absolute deadline
- `try_lock_for()` (L163): Lock with relative timeout

### Core Algorithms
**lock_slow() (L210-289):** Complex parking logic with:
- Spin-wait optimization before parking
- State validation during park operations
- Timeout handling with proper cleanup
- Direct handoff recognition via `TOKEN_HANDOFF`

**unlock_slow() (L292-323):** Unpark logic with fairness control:
- Callback-based state management during unpark
- Fair vs normal unlock behavior based on `force_fair` parameter
- Proper state cleanup when no more threads waiting

**bump_slow() (L326-330):** Fair yielding implementation

### Utility Methods
- **mark_parked_if_locked() (L184-200):** Conditional parking bit setting for Condvar integration
- **mark_parked() (L205-207):** Unconditional parking bit setting

### Dependencies
- **parking_lot_core:** Core parking/unparking primitives
- **lock_api:** Generic mutex trait definitions
- **deadlock module:** Deadlock detection integration
- **util module:** Timeout utilities

### Architectural Patterns
- Lock-free fast paths with atomic compare-exchange operations
- Fallback to parking lot core for contended cases
- Fairness control through token-based handoff mechanism
- Integration with deadlock detection system
- Spin-wait optimization before expensive parking operations