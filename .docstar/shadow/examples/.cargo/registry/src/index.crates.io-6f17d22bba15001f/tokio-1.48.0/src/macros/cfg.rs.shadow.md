# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/cfg.rs
@source-hash: 20c39ae4441ce378
@generated: 2026-02-09T18:06:50Z

## Purpose and Responsibility

Tokio's conditional compilation configuration macros - provides a centralized collection of declarative macros for feature-gated and platform-specific code compilation. Ensures consistent cfg attributes across the codebase and proper documentation generation for docs.rs.

## Key Macros and Their Roles

### General Purpose Configuration
- **`feature!` (L24-35)**: Generic macro accepting arbitrary feature/config flag combinations with automatic docsrs propagation
- **`cfg_metrics_variant` (L688-698)**: Dual-implementation macro providing stable/unstable variant selection

### Platform-Specific Macros
- **`cfg_windows` (L39-47)**: Windows-only code with docs.rs compatibility (`all(doc, docsrs), windows`)  
- **`cfg_unix` (L51-59)**: Unix-only code with docs.rs compatibility
- **`cfg_unstable_windows` (L63-71)**: Windows code requiring `tokio_unstable` flag
- **`cfg_net_unix` (L362-370)**, **`cfg_net_windows` (L372-380)**: Platform + network feature combinations

### Feature Gate Macros
Core feature enablement with docsrs documentation:
- **`cfg_fs` (L117-125)**: File system operations
- **`cfg_net` (L321-329)**: Network functionality  
- **`cfg_process` (L382-392)**: Process management (excludes loom/wasi)
- **`cfg_signal` (L411-421)**: Signal handling (excludes loom/wasi)
- **`cfg_sync` (L449-457)**: Synchronization primitives
- **`cfg_rt` (L465-473)**: Runtime functionality
- **`cfg_time` (L551-559)**: Time/timer features
- **`cfg_macros` (L256-264)**: Procedural macros

### Runtime and Driver Configuration
- **`cfg_io_driver` (L137-167)**: I/O driver for net/process/signal/io-uring combinations
- **`cfg_io_driver_impl` (L169-187)**: Implementation variant without docsrs attrs
- **`cfg_not_io_driver` (L189-207)**: Negated I/O driver conditions
- **`cfg_rt_multi_thread` (L481-489)**: Multi-threaded runtime
- **`cfg_block_on` (L74-86)**: Blocking operations (fs/net/io-std/rt features)

### Unstable and Experimental Features
- **`cfg_unstable` (L577-585)**: General unstable flag gating
- **`cfg_unstable_metrics` (L266-274)**: Metrics with `tokio_unstable`
- **`cfg_trace` (L567-575)**: Tracing with unstable + tracing feature
- **`cfg_taskdump` (L497-514)**: Task dumping (Linux x86*/aarch64 only)
- **`cfg_io_uring` (L700-713)**: io_uring support (Linux + multiple features)

### Specialized Internal Macros
- **`cfg_atomic_waker_impl` (L88-103)**: AtomicWaker for specific features, excludes loom
- **`cfg_aio` (L105-115)**: FreeBSD AIO with network feature
- **`cfg_64bit_metrics` (L277-285)**: Requires 64-bit atomics support
- **`cfg_coop` (L596-612)**: Cooperative scheduling (any major feature enabled)
- **`cfg_loom` (L244-248)**, **`cfg_not_loom` (L250-254)**: Loom testing framework control

## Architectural Patterns

1. **Consistent Documentation**: Most macros include `#[cfg_attr(docsrs, doc(cfg(...)))]` for conditional API documentation
2. **Feature Composition**: Complex combinations like `cfg_io_driver` aggregate multiple related features
3. **Platform Exclusions**: Process/signal macros explicitly exclude WASI and loom testing
4. **Negation Variants**: Systematic provision of `cfg_not_*` variants for inverse conditions
5. **Unstable Gating**: Experimental features consistently require `tokio_unstable` cfg flag

## Dependencies and Relationships

- Integrates with docs.rs documentation system via `doc(cfg(...))` attributes
- Coordinates with Tokio's feature flag system defined in Cargo.toml
- Supports loom-based concurrency testing framework
- Handles platform-specific compilation for Unix, Windows, Linux, WASI
- Manages experimental io_uring and taskdump functionality

## Critical Constraints

- All macros follow `$($item:item)*` pattern for item-level application
- Platform-specific macros use `any(all(doc, docsrs), platform)` pattern for documentation builds
- Unstable features require explicit `tokio_unstable` cfg flag
- Process and signal functionality excluded on WASI targets
- 64-bit atomic operations conditionally available based on target capabilities