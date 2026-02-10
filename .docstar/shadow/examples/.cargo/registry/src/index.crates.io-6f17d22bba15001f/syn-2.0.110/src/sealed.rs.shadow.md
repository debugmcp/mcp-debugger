# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/sealed.rs
@source-hash: 6ece3b3dcb30f6bb
@generated: 2026-02-09T18:11:52Z

## Purpose
Defines a sealed trait pattern for the lookahead functionality in the syn parsing library. This file provides trait sealing to prevent external implementations of internal parsing traits.

## Key Components
- **lookahead module (L2)**: Conditionally compiled module that contains the sealed trait, only available when "parsing" feature is enabled
- **Sealed trait (L3)**: A marker trait that requires `Copy` and serves as a sealing mechanism to restrict trait implementations to within the crate

## Dependencies
- Conditional compilation on `parsing` feature flag
- Requires types implementing this trait to also implement `Copy`

## Architectural Pattern
Implements the **sealed trait pattern**, a Rust idiom used to prevent external crates from implementing internal traits while still allowing the trait to be public within the crate boundary. This provides API stability by controlling which types can implement certain traits.

## Usage Context
This sealed trait is likely used as a supertrait bound for parsing-related traits in the syn library, ensuring only internal types can implement key parsing interfaces while maintaining clean public APIs.