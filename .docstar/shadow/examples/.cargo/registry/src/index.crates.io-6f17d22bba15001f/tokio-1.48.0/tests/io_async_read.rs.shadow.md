# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_async_read.rs
@source-hash: a590efe9bb01986f
@generated: 2026-02-09T18:12:10Z

**Purpose**: Test file ensuring object safety of Tokio's `AsyncRead` trait

**Primary Responsibility**: Validates that `AsyncRead` trait can be used as a trait object (`dyn AsyncRead`), which is essential for dynamic dispatch scenarios in async I/O operations.

**Key Functions**:
- `assert_obj_safe()` (L6-10): Compile-time test that verifies `AsyncRead` trait is object-safe by attempting to create a boxed trait object
- `_assert<T>()` (L8): Generic helper function that serves as a type witness for the object safety check

**Dependencies**:
- `tokio::io::AsyncRead` (L4): The core async read trait being tested for object safety

**Test Configuration**:
- Conditional compilation on "full" feature flag (L2)
- Rust 2018 idioms warnings enabled (L1)

**Architectural Purpose**: This is a minimal but critical test ensuring that `AsyncRead` maintains object safety, which allows it to be used in scenarios requiring dynamic dispatch (e.g., `Vec<Box<dyn AsyncRead>>`, function parameters accepting trait objects). Object safety is a compile-time property that can be broken by trait changes, making this test a safeguard against API regressions.