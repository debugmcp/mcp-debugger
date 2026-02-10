# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/future/trace.rs
@source-hash: c42712a8d372922e
@generated: 2026-02-09T18:06:29Z

**Primary Purpose:** Provides tracing integration for futures in the Tokio async runtime. Defines a trait abstraction to extract tracing span IDs from instrumented futures.

**Core Components:**

- **InstrumentedFuture trait (L3-5):** Crate-internal trait extending Future with tracing capability
  - `id()` method returns optional tracing span ID for the future
  - Enables runtime inspection of future tracing state

- **Instrumented implementation (L7-11):** Implements InstrumentedFuture for `tracing::instrument::Instrumented<F>`
  - Delegates to underlying span's ID via `self.span().id()`
  - Bridges tracing crate's instrumentation with Tokio's future management

**Dependencies:**
- `std::future::Future` - Standard library future trait
- `tracing` crate - Structured logging and instrumentation framework
- Uses `tracing::instrument::Instrumented` wrapper type

**Architectural Pattern:** 
- Trait-based abstraction allowing Tokio to query tracing information without tight coupling
- Enables optional tracing integration - futures can be traced or untraced
- Supports Tokio's internal diagnostics and debugging capabilities

**Usage Context:**
Part of Tokio's tracing infrastructure, likely used by task spawning and scheduling systems to correlate async operations with their tracing spans for observability.