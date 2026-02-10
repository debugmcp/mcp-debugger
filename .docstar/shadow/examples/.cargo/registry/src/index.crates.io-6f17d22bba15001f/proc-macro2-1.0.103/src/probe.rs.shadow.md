# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/probe.rs
@source-hash: 2b57e8ebf46a7c60
@generated: 2026-02-09T18:11:38Z

## Primary Purpose
Feature probing module for proc-macro2 crate that conditionally exposes different proc_macro span-related functionality based on Rust compiler feature availability.

## Module Structure
- **proc_macro_span module (L3-4)**: Conditionally compiled when `proc_macro_span` feature is available
- **proc_macro_span_file module (L6-7)**: Conditionally compiled when `proc_macro_span_file` feature is available  
- **proc_macro_span_location module (L9-10)**: Conditionally compiled when `proc_macro_span_location` feature is available

## Architectural Pattern
Uses conditional compilation (`#[cfg(...)]`) to provide different span implementations depending on which proc_macro features the Rust compiler supports. This allows proc-macro2 to adapt to different Rust versions and feature sets.

## Key Dependencies
- Depends on Rust compiler feature flags for proc_macro span functionality
- Each submodule likely provides feature-specific implementations of span operations

## Design Intent
Acts as a feature detection and abstraction layer, allowing the proc-macro2 crate to work across different Rust compiler versions with varying levels of proc_macro span support.