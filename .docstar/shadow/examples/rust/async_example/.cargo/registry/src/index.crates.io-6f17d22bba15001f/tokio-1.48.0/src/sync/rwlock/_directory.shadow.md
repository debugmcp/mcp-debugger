# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/rwlock/
@generated: 2026-02-09T18:16:13Z

## Purpose
This directory implements RAII guard types for Tokio's async `RwLock`, providing safe access to protected data through various ownership models. The guards automatically manage lock acquisition/release and enable safe data transformations while maintaining proper synchronization semantics.

## Key Components and Architecture

The module provides six distinct guard types organized into three ownership patterns:

### Borrowed Guards (Lifetime-based)
- **RwLockReadGuard**: Shared read access with lifetime constraints
- **RwLockWriteGuard**: Exclusive write access with lifetime constraints  
- **RwLockMappedWriteGuard**: Mapped exclusive write access (no downgrade capability)

### Owned Guards (Arc-based)
- **OwnedRwLockReadGuard**: Shared read access with Arc ownership transfer
- **OwnedRwLockWriteGuard**: Exclusive write access with Arc ownership
- **OwnedRwLockMappedWriteGuard**: Mapped exclusive write access with Arc ownership

## Core Design Patterns

### RAII Resource Management
All guards implement Drop to automatically release semaphore permits, ensuring locks cannot leak. The underlying synchronization uses a batch semaphore where read guards hold 1 permit and write guards hold multiple permits for exclusive access.

### Guard Transformation Pipeline
Guards support safe transformations through:
- **Mapping**: Project to data subsets via closures (`map()`, `try_map()`)
- **Downgrading**: Convert write guards to read guards (except mapped variants)
- **Ownership Transfer**: Convert between borrowed and owned variants

### Memory Safety Architecture
- Raw pointers (`*const T`, `*mut T`) provide direct data access
- `PhantomData` markers ensure proper lifetime and variance relationships
- `skip_drop()` pattern prevents double-drops during transformations using `ManuallyDrop`
- Inner helper structs facilitate ownership transfer without triggering destructors

## Public API Surface

### Primary Entry Points
Guards are typically created by `RwLock::read()`, `RwLock::write()`, and their owned variants, not directly constructed.

### Core Operations
- **Data Access**: `Deref`/`DerefMut` traits provide transparent access to protected data
- **Mapping**: Transform guards to access data subsets while preserving lock ownership
- **Downgrading**: Convert exclusive write access to shared read access (except mapped guards)
- **Lock References**: `rwlock()` methods provide access to underlying lock for identification

### Transformation Methods
- `map<F, U>()` - Transform data focus with closure
- `try_map<F, U>()` - Conditional mapping that can fail
- `downgrade()` - Convert write to read access (where supported)
- `into_mapped()` - Convert to mapped variant

## Internal Organization

### Synchronization Layer
All guards interact with `crate::sync::batch_semaphore::Semaphore` for permit management. Write guards acquire multiple permits for exclusivity, read guards acquire single permits for shared access.

### Data Flow Pattern
1. Lock acquisition creates appropriate guard type
2. Guard provides safe data access via Deref traits
3. Transformations use `skip_drop()` to transfer ownership safely
4. Drop implementation automatically releases permits

### Key Invariants
- Raw data pointers must remain valid for guard lifetime
- Permits must be released exactly once per guard
- Mapped guards cannot be downgraded (prevents undefined behavior)
- Arc references prevent premature lock deallocation in owned variants

## Important Conventions
- Guards use unsafe pointer operations internally but provide safe public APIs
- Optional tracing integration provides runtime observability (tokio_unstable feature)
- Consistent error handling patterns across try_* methods
- Helper Inner structs mirror main guard fields for drop-safe transformations

## Dependencies
- `crate::sync::batch_semaphore` - Core synchronization primitive
- `std::sync::Arc` - Reference counting for owned variants
- `tracing` (optional) - Runtime observability and debugging
- `std::marker::PhantomData` - Type system integration for lifetimes and variance