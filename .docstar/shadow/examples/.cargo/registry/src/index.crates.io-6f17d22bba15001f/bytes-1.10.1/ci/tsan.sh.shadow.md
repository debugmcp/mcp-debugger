# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/ci/tsan.sh
@source-hash: 466b86b19225dd26
@generated: 2026-02-09T18:11:22Z

**Purpose**: CI script for running sanitized tests on the `bytes` crate to detect memory safety and concurrency issues.

**Key Operations**:
- **Environment Setup (L5)**: Configures ASAN options to disable ODR violation detection and leak detection
- **Address Sanitizer Run (L7-9)**: Executes cargo tests with address sanitizer enabled via RUSTFLAGS, targeting specific test suites (`test_bytes`, `test_buf`, `test_buf_mut`)
- **Thread Sanitizer Run (L11-13)**: Executes cargo tests with thread sanitizer enabled, using `-Zbuild-std` flag for standard library rebuilding

**Target Configuration**: All tests run against `x86_64-unknown-linux-gnu` target

**Test Coverage**: Focuses on three core test modules that likely correspond to the main components of the bytes crate (Bytes, Buf, BufMut types)

**Script Behavior**: 
- Uses `set -ex` (L3) for strict error handling and command echoing
- Two-phase sanitizer testing approach for comprehensive memory safety validation
- Requires nightly Rust toolchain due to unstable sanitizer features