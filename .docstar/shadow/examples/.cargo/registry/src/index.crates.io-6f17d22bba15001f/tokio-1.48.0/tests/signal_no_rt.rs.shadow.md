# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/signal_no_rt.rs
@source-hash: 74b028898bbd23b0
@generated: 2026-02-09T18:12:23Z

## Primary Purpose
Test file ensuring proper panic behavior when creating Unix signals outside of a Tokio runtime context.

## Key Test Function
- `no_runtime_panics_creating_signals()` (L9-12): Validates that calling `signal()` without an active Tokio runtime properly panics as expected. Uses `#[should_panic]` attribute to verify the panic occurs.

## Dependencies
- `tokio::signal::unix::{signal, SignalKind}` (L6): Core signal handling functionality being tested

## Platform Constraints
- Unix-only test (`#[cfg(unix)]` L3)
- Requires "full" feature flag (`#[cfg(feature = "full")]` L2) 
- Excluded from Miri testing due to lack of `sigaction` support (`#[cfg(not(miri))]` L4)
- Ignored on WASI targets due to panic recovery limitations (L8)

## Test Pattern
Demonstrates negative testing pattern - verifying that improper API usage (signal creation without runtime) results in expected failure rather than silent bugs or undefined behavior.