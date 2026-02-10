# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/detection.rs
@source-hash: ed9a5f9a979ab012
@generated: 2026-02-09T18:11:42Z

## Primary Purpose

Detects whether code is running inside a procedural macro context vs ordinary Rust compilation. This enables proc-macro2 to choose between native proc_macro APIs and fallback implementations.

## Key Components

### State Management (L1-5)
- `WORKS`: AtomicUsize storing detection state (0=uninitialized, 1=fallback forced, 2=proc_macro available)  
- `INIT`: Once ensures thread-safe initialization

### Core Detection Logic (L7-16)
- `inside_proc_macro()`: Main detection function using cached atomic state
- Returns false if fallback forced (1), true if proc_macro available (2)
- Lazy initialization via `INIT.call_once()` on first call

### Control Functions (L18-24)
- `force_fallback()`: Sets WORKS=1 to disable proc_macro APIs
- `unforce_fallback()`: Resets detection by calling initialize()

### Platform-Specific Initialization

#### Modern Rust (L26-30)
- `initialize()` with `no_is_available` cfg: Uses `proc_macro::is_available()` API
- Stores result as `(available as usize + 1)` in WORKS atomic

#### Legacy Rust (L56-75) 
- `initialize()` without `no_is_available`: Uses panic-based detection
- Temporarily replaces panic hook to suppress stderr output
- Tests `proc_macro::Span::call_site()` via `catch_unwind()`
- Race condition protection through sanity checking hook replacement

## Architecture Notes

- Thread-safe lazy initialization pattern using `Once` + `AtomicUsize`
- Conditional compilation handles different Rust versions
- Fallback detection uses panic handling since proc_macro APIs panic outside macro context
- Race condition mitigation in panic hook swapping (L37-55 comments detail threading concerns)

## Dependencies

- `core::sync::atomic` for lock-free state management
- `std::sync::Once` for initialization synchronization  
- `std::panic` (legacy path) for hook manipulation and unwind catching
- `proc_macro` crate APIs for actual detection tests