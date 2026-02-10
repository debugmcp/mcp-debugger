# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/zzz_stable.rs
@source-hash: 2a862e59cb446235
@generated: 2026-02-09T18:12:04Z

**Purpose**: Test module that displays a conditional warning when syn library tests run on stable Rust instead of nightly compiler.

**Conditional Compilation**: 
- Only compiles when `syn_disable_nightly_tests` cfg flag is set (L1)
- Indicates this code runs specifically when nightly-only tests are disabled

**Dependencies**:
- `std::io` for I/O operations and error handling
- `termcolor` crate for colored terminal output (L4)

**Key Components**:

**MSG Constant (L6-14)**: Multi-line string literal containing warning text about incomplete test coverage on stable Rust. Explains that some syn parser tests require nightly compiler access to unstable librustc data structures.

**notice() Test Function (L16-33)**: 
- Single test that outputs formatted warning to stderr
- Parses MSG to isolate "WARNING" header for special formatting (L18-21)
- Uses termcolor to apply yellow foreground color and bold formatting to different message segments (L23-29)
- Returns `io::Result<()>` for proper error propagation

**Output Strategy**:
- Splits message into three parts: before header, header, after header
- Applies different color formatting to each segment for visual emphasis
- Uses `StandardStream::stderr()` with auto color choice detection
- Properly resets terminal colors after output (L30)

**Architectural Note**: This is a notification mechanism rather than a functional test - it informs developers when running on stable Rust that some parser comparison tests are unavailable due to compiler limitations.