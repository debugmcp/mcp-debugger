# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/no_rt.rs
@source-hash: d614b5fc7a69f8c0
@generated: 2026-02-09T18:12:21Z

## Purpose
Test file that verifies Tokio runtime components properly panic when used outside a Tokio runtime context. Ensures runtime-dependent operations fail fast with clear error messages.

## Key Test Functions

**timeout_panics_when_no_tokio_context (L11-17)**: Tests that `tokio::time::timeout` panics when called without an active Tokio reactor. Uses `futures::executor::block_on` to run async code outside Tokio context and expects specific panic message.

**panics_when_no_reactor (L19-28)**: Tests that `TcpStream::connect` panics when no Tokio reactor is running. Creates a standard library TcpListener, then attempts to connect using Tokio's async TcpStream outside runtime context.

**io_panics_when_no_tokio_context (L36-46)**: Tests that converting a standard library TcpListener to Tokio's TcpListener panics when no Tokio context exists. Uses `from_std` conversion method.

**timeout_value (L30-34)**: Helper async function that creates a oneshot channel and applies a 10ms timeout to the receiver. Used by the timeout panic test.

## Dependencies
- `tokio::net::TcpStream` - Async TCP stream requiring reactor
- `tokio::sync::oneshot` - Async channel for timeout test
- `tokio::time::{timeout, Duration}` - Async timeout functionality
- `futures::executor::block_on` - Non-Tokio async executor for isolation
- `std::net::TcpListener` - Standard library TCP listener

## Test Strategy
All tests use `#[should_panic]` with expected message matching to ensure proper error handling. Tests are disabled on WASI (no panic recovery) and Miri (no socket support). The pattern isolates Tokio operations from their required runtime context to verify defensive programming.

## Critical Invariant
All Tokio reactor-dependent operations must detect missing runtime context and panic with the specific message: "there is no reactor running, must be called from the context of a Tokio 1.x runtime"