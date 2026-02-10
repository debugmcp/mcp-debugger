# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/signal/windows/sys.rs
@source-hash: c6f156404e3436b4
@generated: 2026-02-09T18:03:23Z

## Primary Purpose
Windows-specific signal handling implementation for Tokio async runtime. Provides async interfaces for Windows Console Control events (Ctrl+C, Ctrl+Break, etc.) using Windows system APIs.

## Key Components

**Public Signal Functions (L10-28):**
- `ctrl_break()` (L10-12) - Creates future for CTRL_BREAK_EVENT
- `ctrl_close()` (L14-16) - Creates future for CTRL_CLOSE_EVENT  
- `ctrl_c()` (L18-20) - Creates future for CTRL_C_EVENT
- `ctrl_logoff()` (L22-24) - Creates future for CTRL_LOGOFF_EVENT
- `ctrl_shutdown()` (L26-28) - Creates future for CTRL_SHUTDOWN_EVENT

**Core Infrastructure:**
- `new()` (L30-34) - Common signal registration logic, initializes global handler and returns RxFuture
- `event_requires_infinite_sleep_in_handler()` (L36-49) - Determines which events require infinite loop to prevent process termination
- `OsStorage` struct (L52-94) - Storage implementation for EventInfo mapping to Windows console events
- `OsExtraData` struct (L96-103) - Empty extra data container

**System Integration:**
- `global_init()` (L105-122) - One-time initialization using `Once`, registers Windows console control handler
- `handler()` (L124-147) - Unsafe system callback function that processes Windows console events, broadcasts to listeners, and implements infinite sleep for terminating events

## Critical Dependencies
- `windows_sys::Win32::System::Console` - Windows API bindings for console control events
- `crate::signal::registry` - Cross-platform signal registry infrastructure
- `crate::signal::RxFuture` - Async future wrapper for signal reception

## Architectural Patterns
- **Platform Abstraction**: Implements Storage and Init traits for cross-platform signal handling
- **Global State Management**: Uses `std::sync::Once` for thread-safe initialization
- **Event Broadcasting**: Leverages shared registry for multi-listener support
- **Async Bridge**: Converts Windows callback-based signals to async futures

## Critical Constraints
- Handler function must never return for CTRL_CLOSE, CTRL_LOGOFF, and CTRL_SHUTDOWN events to prevent immediate process termination
- All signal handling occurs in separate Windows-spawned threads (no Unix signal restrictions)
- Global handler registration is one-time only per process
- Event IDs are cast between u32 (Windows) and EventId (internal) types

## Test Infrastructure (L149-262)
Comprehensive test suite with `raise_event()` helper (L156-164) for simulating Windows console events without actual OS integration.