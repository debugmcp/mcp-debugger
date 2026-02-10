# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/fill_buf.rs
@source-hash: 223725d828071e92
@generated: 2026-02-09T18:02:45Z

**Purpose:** Future implementation for the `fill_buf` operation on async buffered readers. Provides a way to asynchronously access the internal buffer of a buffered reader without consuming data.

**Key Components:**

- **FillBuf struct (L14-18):** Pin-projected future that wraps an optional mutable reference to an `AsyncBufRead` reader. Uses `PhantomPinned` for safe pinning semantics.

- **fill_buf constructor (L21-29):** Creates a `FillBuf` future from any `AsyncBufRead + Unpin` reader. Returns a future that will resolve to a slice of the reader's internal buffer.

- **Future implementation (L31-58):** Core async logic that:
  - Takes ownership of the reader reference on first poll (L37)
  - Delegates to the reader's `poll_fill_buf` method (L38)
  - On success, uses unsafe transmute to extend slice lifetime to match future's lifetime (L49)
  - On pending, restores reader reference for next poll (L54)

**Critical Safety Invariant:** The unsafe lifetime transmute (L39-50) is safe because the reader is set to `None` when returning a successful result, preventing re-polling after completion. The extensive safety comment explains this is a workaround for current borrow checker limitations.

**Dependencies:**
- `pin_project_lite` for safe pin projection
- `AsyncBufRead` trait from tokio's io module
- Standard future/async machinery

**Usage Pattern:** This is an internal utility future returned by `AsyncBufReadExt::fill_buf()`, allowing users to inspect buffered data without advancing the read position.