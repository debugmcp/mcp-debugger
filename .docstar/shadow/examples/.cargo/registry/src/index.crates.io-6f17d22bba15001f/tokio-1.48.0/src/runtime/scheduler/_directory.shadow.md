# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/
@generated: 2026-02-09T18:16:54Z

## Purpose
This directory implements the complete scheduler architecture for Tokio's runtime, providing both single-threaded (`current_thread`) and multi-threaded (`multi_thread`) execution models. It serves as the core execution engine that manages task scheduling, work distribution, and runtime observability across different threading configurations.

## Key Components

### Scheduler Variants
- **`current_thread/`**: Single-threaded scheduler implementation optimized for scenarios where async tasks run on a single thread without work-stealing overhead
- **`multi_thread/`**: Multi-threaded scheduler with comprehensive observability and diagnostic capabilities, including work-stealing, distributed coordination, and advanced metrics collection
- **`inject/`**: Shared injection queue mechanisms used across scheduler implementations for task submission from external threads

### Integration Architecture
The directory provides a unified scheduler abstraction that allows Tokio applications to choose between execution models based on performance requirements and deployment constraints. The multi-threaded variant extends the base functionality with rich introspection capabilities for production monitoring and debugging.

## Public API Surface

### Runtime Configuration
- Scheduler selection APIs for choosing between single-threaded and multi-threaded execution
- Runtime builder integration for configuring worker threads, queue sizes, and observability features

### Observability APIs (Multi-threaded)
- **Core Metrics**: `Handle::num_workers()`, `Handle::num_alive_tasks()`, `Handle::injection_queue_depth()`
- **Per-worker Metrics**: `Handle::worker_metrics(index)` for detailed worker-specific performance data
- **Diagnostic Operations**: `Handle::dump()` for async collection of complete runtime state
- **Feature-gated Advanced Metrics**: Spawn counts, blocking thread state, and detailed queue inspection

### Task Execution Interface
- Task spawning and injection mechanisms across different scheduler types
- Work distribution and load balancing coordination
- Integration with Tokio's broader runtime ecosystem

## Internal Organization and Data Flow

### Scheduler Abstraction Layer
1. **Unified Interface**: Common APIs abstract over single-threaded vs multi-threaded implementations
2. **Configuration-driven Selection**: Runtime builders configure appropriate scheduler variant
3. **Injection Queue Integration**: Shared mechanisms for external task submission

### Multi-threaded Coordination Flow
1. **Work Distribution**: Tasks flow from injection queue to worker-specific local queues
2. **Work Stealing**: Load balancing through cooperative task redistribution
3. **Observability Collection**: Non-intrusive metrics gathering across distributed workers
4. **Diagnostic Coordination**: Leader election and barrier synchronization for comprehensive state dumps

### Performance Optimization Patterns
- **Zero-cost Abstractions**: Single-threaded scheduler avoids multi-threading overhead
- **Non-intrusive Observability**: Metrics collection never blocks critical scheduling paths
- **Lock-free Operations**: Work-stealing and queue management minimize synchronization overhead

## Important Patterns

### Scheduler Selection Strategy
- Build-time and runtime configuration determines appropriate scheduler variant
- Feature flags control observability surface area and implementation complexity
- Clean separation between stable APIs and experimental diagnostic features

### Distributed State Management
- Leader election prevents duplicate work in diagnostic operations
- Timeout mechanisms ensure graceful degradation under coordination failures
- Barrier synchronization enables atomic operations across worker threads

### Safety and Correctness
- All scheduler operations maintain Tokio's safety guarantees
- Worker state always remains accessible regardless of observability operation success
- Defensive programming prevents arithmetic underflow and resource exhaustion

## Integration Context
This module serves as the foundational execution engine for Tokio applications, providing the critical infrastructure for async task scheduling and execution. It bridges the gap between Tokio's high-level APIs and the underlying operating system threading primitives, while offering comprehensive observability tools for production monitoring, performance analysis, and debugging distributed async applications. The scheduler architecture enables Tokio to scale from simple single-threaded applications to complex multi-threaded systems with sophisticated monitoring requirements.