# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/ptr_expose.rs
@source-hash: fcabc6c53ec57662
@generated: 2026-02-09T18:06:56Z

## Purpose
Provides miri-compatible pointer address exposure and reconstruction utilities to maintain strict provenance semantics during testing while falling back to simple pointer casts in normal execution.

## Key Components

### PtrExposeDomain<T> (L11-15)
Generic domain for managing pointer provenance mappings. Contains:
- `map: Mutex<BTreeMap<usize, *const T>>` - Thread-safe storage for address-to-pointer mappings (miri only)
- `_phantom: PhantomData<T>` - Zero-cost generic type marker

### Core Methods

**new() (L21-27)**
- `const fn` constructor initializing empty domain
- Conditionally creates mutex-wrapped BTreeMap under miri

**expose_provenance() (L30-44)**
- Converts pointer to address while preserving provenance information
- Under miri: stores pointer in map indexed by address via `transmute`
- Normal execution: simple `ptr as usize` cast
- Returns the memory address as `usize`

**from_exposed_addr() (L48-62)**
- Reconstructs pointer from previously exposed address
- Under miri: lookups stored pointer, uses `unwrap_unchecked()` to intentionally fail if not found
- Normal execution: direct `addr as *const T` cast
- Allows clippy exception for `from_*` naming convention

**unexpose_provenance() (L65-76)**
- Removes address-to-pointer mapping when no longer needed
- Under miri: removes entry from map, intentionally panics if not found via `unwrap_unchecked()`
- No-op in normal execution

## Architecture Decisions

### Conditional Compilation Strategy
Uses `#[cfg(miri)]` attributes throughout to provide dual implementations:
- Miri path: Full provenance tracking with hash map storage
- Normal path: Zero-cost pointer casts

### Safety Model
- Manual `unsafe impl<T> Sync` (L18) - justified because actual pointer usage is inherently unsafe
- Strategic use of `unwrap_unchecked()` (L55, L74) to trigger miri failures for debugging
- `transmute` usage (L35, L69) documented as equivalent to unstable `pointer::addr`

## Dependencies
- `std::marker::PhantomData` for zero-cost generics
- `crate::loom::sync::Mutex` and `std::collections::BTreeMap` for miri-only thread-safe storage

## Critical Invariants
- Address-pointer mappings must be consistent across expose/unexpose cycles
- Failure to find previously exposed addresses should trigger immediate miri errors for debugging