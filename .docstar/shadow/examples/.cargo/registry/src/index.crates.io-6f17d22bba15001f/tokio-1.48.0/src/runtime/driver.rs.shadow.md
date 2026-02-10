# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/driver.rs
@source-hash: e7df77ee58c167c3
@generated: 2026-02-09T18:06:47Z

**Runtime Driver Abstraction Layer**

This module abstracts Tokio's runtime sub-drivers (IO, signal, process, time) into a unified interface, providing conditional compilation support for different feature combinations.

## Core Architecture

**Driver (L16-18)**: Main driver wrapper containing a `TimeDriver` that orchestrates all sub-drivers.

**Handle (L21-35)**: Unified handle providing access to all sub-driver handles:
- `io`: IO driver handle for async I/O operations
- `signal`: Signal driver handle (Unix-only)
- `time`: Time driver handle for timers/timeouts  
- `clock`: Clock source for time operations

**Cfg (L37-43)**: Configuration struct controlling which drivers are enabled and their parameters.

## Key Operations

**Driver::new() (L46-62)**: Factory method that constructs the driver stack based on configuration:
1. Creates IO stack with optional signal/process drivers
2. Initializes clock for time operations
3. Wraps everything in a time driver
4. Returns driver instance and unified handle

**Parking Interface (L64-75)**: Provides `park()`, `park_timeout()`, and `shutdown()` methods that delegate to the inner time driver.

**Handle::unpark() (L78-85)**: Unparks both time and IO drivers when available.

## Conditional Compilation Structure

The module uses extensive feature-gated compilation blocks:

**IO Driver (L124-229)**: 
- When enabled: `IoStack::Enabled(ProcessDriver)` wrapping signal/process drivers
- When disabled: `IoStack::Disabled(ParkThread)` for basic parking

**Signal Driver (L233-254)**:
- Unix systems: Wraps actual signal driver
- Other platforms: Pass-through to IO driver

**Process Driver (L258-274)**:
- When available: Wraps signal driver with process management
- Otherwise: Direct alias to signal driver

**Time Driver (L278-349)**:
- When enabled: `TimeDriver::Enabled` with actual time driver
- When disabled: `TimeDriver::Disabled` delegating to IO stack

## Handle Accessor Methods

Feature-gated accessors (L87-120) provide type-safe access to sub-drivers:
- `io()`: Returns IO handle with runtime check
- `signal()`: Returns signal handle with runtime check  
- `time()`: Returns time handle with runtime check
- `clock()`: Returns clock reference

Each accessor panics with descriptive messages if the corresponding feature is disabled, guiding users to enable the required runtime builder options.

## Dependencies

- `crate::runtime::park::{ParkThread, UnparkThread}` for basic parking functionality
- Various runtime sub-drivers conditionally imported based on features
- `std::io` and `std::time::Duration` for I/O and timing primitives