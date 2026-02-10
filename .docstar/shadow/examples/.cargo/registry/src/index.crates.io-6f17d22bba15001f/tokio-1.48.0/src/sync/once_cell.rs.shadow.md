# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/once_cell.rs
@source-hash: 86ac0b303c673a00
@generated: 2026-02-09T18:06:49Z

## Purpose

Thread-safe asynchronous OnceCell implementation for Tokio, providing write-once initialization with async initialization support. Designed for global variables that need one-time async initialization.

## Core Architecture

**OnceCell<T> (L70-74)**: Main struct with three fields:
- `value_set: AtomicBool` - tracks initialization state with acquire/release ordering
- `value: UnsafeCell<MaybeUninit<T>>` - stores the actual value
- `semaphore: Semaphore` - coordinates concurrent access (1 permit when empty, closed when initialized)

**Safety Invariants (L11-25)**:
- Only thread holding semaphore permit can modify `value` when `value_set` is false
- Any thread can access `value` immutably when `value_set` is true
- Semaphore closure implies `value_set` is true (but not vice versa)

## Key Methods

**Construction**:
- `new()` (L127-133): Creates empty cell with 1-permit semaphore
- `const_new()` (L168-174): Const version for static initialization
- `new_with(Option<T>)` (L185-191): Conditional initialization
- `const_new_with(T)` (L223-229): Const version with immediate value

**Access**:
- `initialized()` (L233-237): Check state with Acquire ordering
- `get()` (L273-279): Safe optional access to value
- `get_mut()` (L287-293): Mutable access with exclusive borrow

**Initialization**:
- `set(T)` (L306-331): Non-blocking attempt to initialize, returns SetError on failure
- `get_or_init<F,Fut>()` (L346-381): Async initialization with closure, waits for concurrent initialization
- `get_or_try_init<E,F,Fut>()` (L396-434): Fallible async initialization

**Value Extraction**:
- `into_inner()` (L438-446): Consumes cell, returns Option<T>
- `take()` (L450-452): Empties cell via std::mem::take

## Critical Internal Methods

**set_value() (L255-269)**: Core initialization logic that:
1. Writes value using unsafe pointer operations
2. Sets `value_set` with Release ordering
3. Closes semaphore to prevent further initialization
4. Forgets permit to avoid double-drop

**get_unchecked() (L246-248)**: Unsafe direct access assuming initialization

## Error Handling

**SetError<T> (L471-479)**: Enum for set() failures:
- `AlreadyInitializedError(T)` - cell already has value
- `InitializingError(T)` - concurrent initialization in progress

## Thread Safety

- `Send` bound (L465): T must be Send for OnceCell<T> to be Send
- `Sync` bound (L460): T must be Send + Sync for OnceCell<T> to be Sync
- Safety relies on semaphore coordination and atomic ordering

## Standard Traits

Implements Default, Debug, Clone (for T: Clone), PartialEq/Eq, From<T>, and custom Drop (L104-113) that safely destroys initialized values.