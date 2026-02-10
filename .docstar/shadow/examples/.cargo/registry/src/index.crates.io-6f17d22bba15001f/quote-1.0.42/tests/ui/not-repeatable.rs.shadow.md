# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/tests/ui/not-repeatable.rs
@source-hash: a4b115c04e4e4104
@generated: 2026-02-09T18:06:21Z

## Purpose
Test file for the `quote` crate demonstrating compile-time error behavior when attempting to use non-repeatable types in repetition patterns. This is a negative test case that should fail compilation.

## Key Elements
- **Ipv4Addr struct (L3)**: Mock struct representing a non-repeatable type, mimicking `std::net::Ipv4Addr`
- **main function (L5-8)**: Contains the test case that attempts invalid repetition syntax

## Test Pattern
The test demonstrates the quote macro's repetition syntax `#(#variable)*` where:
- `#ip` references the variable (L7)
- `#(...)*` attempts to repeat the pattern
- This should fail because `Ipv4Addr` doesn't implement iterator traits required for repetition

## Dependencies
- `quote` crate for procedural macro functionality (L1)

## Expected Behavior
This file is designed to produce a compilation error, serving as a UI test to verify that the quote macro properly rejects non-repeatable types in repetition contexts. The error helps ensure type safety in macro expansion.