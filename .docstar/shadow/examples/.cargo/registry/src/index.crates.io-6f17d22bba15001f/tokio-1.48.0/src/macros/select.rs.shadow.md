# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/select.rs
@source-hash: c5bbacdc5ecd4831
@generated: 2026-02-09T18:06:51Z

## Primary Purpose
This file implements Tokio's `select!` macro, a fundamental asynchronous concurrency primitive that waits on multiple futures concurrently and returns when the first one completes, cancelling the remaining branches.

## Key Macros and Components

### `doc!` Macro (L1-551)
A wrapper macro that contains the comprehensive documentation for `select!`. The documentation is embedded within this macro to keep it organized with conditional compilation support.

### `select!` Macro Implementation (L553-811)
The main macro with two variants:
- **Doc version** (L554-568): Simple placeholder for documentation builds
- **Production version** (L570-811): Complex token-muncher implementation using declarative macro patterns

The implementation follows a sophisticated parsing strategy:
- Uses `@{ }` token accumulation pattern for normalization
- Processes branches recursively, converting various syntax forms into a canonical representation
- Supports `biased;` mode for deterministic polling order
- Handles optional `if` preconditions and `else` branches

### Core Execution Logic (L605-753)
The transformed macro generates:
- An enum (`__tokio_select_util::Out`) with variants for each branch
- Polling loop that respects disabled branches via bitmask
- Pattern matching against future outputs
- Fair scheduling via random starting index (unless `biased;`)

### Helper Macros

#### `count!` Macro (L818-1014) 
Converts underscore tokens to compile-time integers (0-64). Uses exhaustive pattern matching to support up to 64 select branches.

#### `count_field!` Macro (L1018-1214)
Maps underscore patterns to tuple field access (`.0`, `.1`, etc.). Enables indexing into the futures tuple during polling.

#### `select_variant!` Macro (L1218-1411)
Generates enum variant constructors (`_0`, `_1`, etc.) based on underscore patterns. Used for creating the appropriate `Out` enum variant.

## Key Features

### Concurrency Model
- Runs all futures on the current task (concurrent, not parallel)
- First-to-complete semantics with automatic cancellation of other branches
- Budget-aware polling that respects Tokio's cooperative scheduling

### Branch Management
- Supports conditional branches with `if` preconditions (L628-633)
- Pattern matching on future outputs with automatic branch disabling
- Bitmask-based tracking of disabled branches

### Fairness and Bias
- Default random polling order for fairness (L675, L805)
- Optional `biased;` mode for deterministic top-to-bottom polling (L798)
- Prevents starvation in loops with always-ready branches

## Dependencies
- `$crate::macros::support`: Provides `Future`, `Pin`, `Poll`, `IntoFuture`, `poll_fn`
- `$crate::select_priv_*`: Hidden procedural macros for enum generation and pattern cleaning

## Critical Constraints
- Maximum 64 branches due to manual pattern enumeration
- Requires async context (functions, closures, blocks)
- Future pinning safety depends on stack storage guarantees
- Cancellation safety varies by future type - not all operations are safe to cancel mid-execution

## Architectural Decisions
- Token-muncher pattern enables complex syntax normalization without procedural macros
- Exhaustive pattern matching (vs. recursion) avoids macro recursion limits
- Bitmask approach for branch state is more efficient than collections
- Stack pinning strategy avoids heap allocation for temporary futures