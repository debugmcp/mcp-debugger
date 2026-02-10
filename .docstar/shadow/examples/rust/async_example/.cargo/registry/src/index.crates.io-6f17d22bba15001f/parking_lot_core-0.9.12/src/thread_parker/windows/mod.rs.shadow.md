# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/windows/mod.rs
@source-hash: ff86c7fc19eb139b
@generated: 2026-02-09T18:02:32Z

**Primary Purpose**: Windows-specific thread parking implementation for the parking_lot crate. Provides low-level thread synchronization primitives using Windows APIs with automatic backend selection between WaitOnAddress/WakeByAddress (Windows 8+) and NT Keyed Events (Windows XP+).

**Key Components**:

- **Backend enum (L18-21)**: Abstracts two Windows synchronization mechanisms:
  - `KeyedEvent`: NT Keyed Events for Windows XP+ compatibility
  - `WaitAddress`: WaitOnAddress/WakeByAddress for Windows 8+ (preferred)

- **Global Backend Management (L23, L27-69)**:
  - `BACKEND` static: Atomic pointer for singleton backend instance
  - `Backend::get()` (L27-35): Fast-path singleton access with lazy initialization
  - `Backend::create()` (L37-69): Thread-safe backend initialization with fallback hierarchy and race-safe atomic swap

- **ThreadParker struct (L73-76)**: Main thread parking primitive
  - `key`: AtomicUsize for synchronization state
  - `backend`: Reference to global backend instance

- **ThreadParkerT Implementation (L78-144)**:
  - `new()` (L84-92): Initializes parker with backend reference
  - `prepare_park()` (L96-101): Prepares thread for parking (unsafe)
  - `park()` (L116-121): Blocks thread indefinitely until unparked
  - `park_until()` (L127-132): Blocks with timeout, returns wake/timeout status
  - `timed_out()` (L106-111): Checks if last park operation timed out
  - `unpark_lock()` (L138-143): Creates handle for safe thread unparking

- **UnparkHandle enum (L149-152)**: Type-safe handle for delayed thread unparking
  - Variants match backend types for delegation
  - `unpark()` (L158-163): Performs actual thread wake operation

- **Utility Functions**:
  - `thread_yield()` (L168-175): Yields CPU timeslice using Windows Sleep(0)

**Dependencies**: 
- `bindings` module: Windows API bindings
- `keyed_event` module: NT Keyed Events implementation
- `waitaddress` module: WaitOnAddress API implementation

**Architectural Patterns**:
- Strategy pattern for backend selection
- Lazy singleton initialization with atomic compare-and-swap
- RAII handles for safe resource management
- Trait-based abstraction over platform-specific implementations

**Critical Invariants**:
- Backend initialization is panic-safe and race-free
- Only one backend instance exists globally
- Unpark operations are delayed until queue locks are released
- All parking operations are marked unsafe due to memory ordering requirements