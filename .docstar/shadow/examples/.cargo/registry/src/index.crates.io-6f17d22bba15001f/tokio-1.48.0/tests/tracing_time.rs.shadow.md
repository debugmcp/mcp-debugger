# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tracing_time.rs
@source-hash: f4f1ca5b6d4ba41c
@generated: 2026-02-09T18:12:35Z

## Purpose
Test file ensuring correct tracing instrumentation for Tokio time-related primitives, specifically the `tokio::time::sleep` function. Tests span creation, event emission, and hierarchical relationships in tracing output.

## Key Components
- **test_sleep_creates_span (L12-71)**: Main test function validating that `tokio::time::sleep` creates proper tracing spans with correct names, targets, and parent-child relationships

## Span Hierarchy Being Tested
1. **sleep_span (L14-18)**: Root resource span "runtime.resource" with target "tokio::time::sleep"
2. **async_op_span (L31-35)**: Child span "runtime.resource.async_op" for the async operation
3. **async_op_poll_span (L37-39)**: Grandchild span "runtime.resource.async_op.poll" for polling operations

## Key Events
- **state_update event (L20-29)**: Runtime resource state update event with duration field (note: duration value testing disabled due to instability)

## Dependencies
- `tracing_mock`: Mock tracing subscriber for testing span/event expectations
- `tokio::time::sleep`: The function under test

## Test Flow
1. Sets up mock subscriber with expected span/event sequence (L41-62)
2. Executes `tokio::time::sleep` within tracing context (L64-68)
3. Validates all expectations were met (L70)

## Configuration Requirements
- Requires `tokio_unstable` feature flag
- Requires `tracing` feature
- Requires 64-bit atomic support
- Uses `#![warn(rust_2018_idioms)]` for code quality

## Notable Patterns
- Explicit span ID management for parent-child relationship validation
- Sequential span lifecycle testing (new_span -> enter -> exit -> drop_span)
- Mock subscriber pattern for deterministic tracing validation