# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/mod.rs
@source-hash: 3ce994678a88332c
@generated: 2026-02-09T18:06:39Z

## Primary Purpose

This is Tokio's main I/O module (`tokio::io`) that provides asynchronous versions of standard library I/O traits and utilities. It serves as the foundation for all async I/O operations in Tokio applications.

## Core Traits and Types

**Core Async Traits (L206-220):**
- `AsyncBufRead` - Asynchronous buffered reading interface (L207)
- `AsyncRead` - Core async reading trait (L209-210)  
- `AsyncSeek` - Async seeking in streams (L212-213)
- `AsyncWrite` - Core async writing trait (L215-216)
- `ReadBuf` - Buffer type for async reads (L218-219)

**Standard Library Re-exports (L224):**
- `Error`, `ErrorKind`, `Result`, `SeekFrom` from `std::io` for seamless interop

## Platform-Specific Features

**I/O Driver Components (L226-241):**
- `interest::Interest` and `ready::Ready` - Event notification types (L231-232)
- `PollEvented` - Core async I/O wrapper (L240)

**Unix/BSD Support (L245-262):**
- BSD AIO support with `Aio`, `AioEvent`, `AioSource` types (L251)
- Unix-specific `AsyncFd` for custom file descriptors (L260)

## Standard I/O Streams (L264-275)

When `io_std` feature enabled:
- `stdin()`, `Stdin` - Async standard input (L270-271)
- `stdout()`, `Stdout` - Async standard output (L273-274) 
- `stderr()`, `Stderr` - Async standard error (L267-268)

## Utility Functions and Types (L277-288)

When `io_util` feature enabled, provides comprehensive async I/O utilities:
- **Stream Operations:** `copy`, `copy_bidirectional`, `split`, `join`
- **Extension Traits:** `AsyncReadExt`, `AsyncWriteExt`, `AsyncBufReadExt`, `AsyncSeekExt`
- **Buffered I/O:** `BufReader`, `BufWriter`, `BufStream`
- **Stream Types:** `Chain`, `Take`, `Lines`, `Split`
- **Special Streams:** `empty()`, `repeat()`, `sink()`, `duplex()`, `simplex()`

## Architecture Patterns

**Feature-Gated Compilation:** Extensive use of `cfg_*!` macros for conditional compilation based on enabled features (blocking, networking, utilities, etc.)

**Async-First Design:** All traits follow async/await patterns with cooperative yielding to the Tokio scheduler rather than blocking threads

**Extension Trait Pattern:** Core traits (`AsyncRead`/`AsyncWrite`) contain minimal required methods, with utility methods provided via extension traits (`AsyncReadExt`/`AsyncWriteExt`)

## Key Dependencies

- `std::io` types for error handling and seeking
- Feature-conditional dependencies on networking, filesystem, and process modules
- Integration with Tokio's runtime and scheduler for non-blocking operations

## Critical Constraints

- All I/O types must integrate with futures and never block the thread
- Standard I/O functions require Tokio runtime context and will panic outside runtime
- Proper resource cleanup (flushing buffers) is user responsibility