# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/local_runtime/options.rs
@source-hash: 6890ad0b10cb0b0b
@generated: 2026-02-09T18:03:01Z

## Purpose
Configuration options struct specifically for LocalRuntime in Tokio's local runtime system. Currently serves as a placeholder/marker type with no actual configuration fields, designed for future extensibility.

## Key Components
- **LocalOptions struct (L15-18)**: Main configuration type with `#[non_exhaustive]` attribute allowing future field additions without breaking changes
- **_phantom field (L17)**: `PhantomData<*mut u8>` marker that makes the struct `!Send + !Sync`, ensuring it cannot be transferred between threads

## Design Patterns
- **Future-proofing**: Uses `#[non_exhaustive]` and placeholder structure for anticipated features like `!Send + !Sync` hooks
- **Thread locality enforcement**: Raw pointer phantom data prevents accidental cross-thread usage
- **Default construction**: Implements `Default` trait for easy instantiation

## Dependencies
- `std::marker::PhantomData` for zero-cost type markers
- Integrates with `crate::runtime::Builder::build_local` and `crate::runtime::LocalRuntime`

## Usage Context
Used with `LocalOptions::default()` and passed to `Builder::build_local()` for creating thread-local Tokio runtimes. The empty structure indicates this is primarily architectural scaffolding awaiting future local runtime configuration options.