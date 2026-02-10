# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/tests/ui/not-quotable.rs
@source-hash: 5759d08849434176
@generated: 2026-02-09T18:06:21Z

## Purpose
Test file for the `quote` crate that demonstrates a compilation error scenario where a non-quotable type is used in a quote macro.

## Core Functionality
- **main() (L4-7)**: Creates an `Ipv4Addr::LOCALHOST` instance and attempts to interpolate it into a `quote!` macro, which should fail compilation since `Ipv4Addr` doesn't implement the `ToTokens` trait required for quotation.

## Dependencies
- **quote::quote (L1)**: The procedural macro being tested for error conditions
- **std::net::Ipv4Addr (L2)**: Standard library IP address type used as a non-quotable example

## Test Pattern
This is a negative test case (UI test) designed to verify that the `quote` macro properly rejects types that cannot be converted to token streams. The file should produce a compilation error when built, demonstrating the quote macro's type safety.

## Key Variables
- **ip (L5)**: `Ipv4Addr::LOCALHOST` instance used to trigger the quotability error
- **quote! { #ip } (L6)**: Macro invocation that should fail because `Ipv4Addr` lacks `ToTokens` implementation