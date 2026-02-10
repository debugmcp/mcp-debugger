# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_copy_bidirectional.rs
@source-hash: d3a5ba84cdeeb939
@generated: 2026-02-09T18:12:18Z

## Test Suite for tokio::io::copy_bidirectional

This test file validates the behavior of Tokio's `copy_bidirectional` function, which copies data simultaneously in both directions between two streams. The test suite covers basic functionality, error handling, and cooperative behavior.

### Core Test Infrastructure

- **make_socketpair() (L9-18)**: Creates a connected pair of TCP streams using localhost binding for isolated testing
- **block_write() (L20-36)**: Utility that writes data in a loop with timeout, simulating write-heavy operations
- **symmetric() (L38-59)**: Meta-test function that runs each test scenario twice with stream arguments reversed, ensuring bidirectional symmetry

### Test Cases

1. **test_basic_transfer (L61-71)**: Validates basic data flow - writes "test" to stream A and verifies it's received on stream B
2. **test_transfer_after_close (L73-91)**: Tests half-closed connection behavior - after shutting down one direction, data can still flow in the other direction; returns transfer statistics (0, 4)
3. **blocking_one_side_does_not_block_other (L93-114)**: Ensures that blocking writes on one side don't prevent data flow in the opposite direction
4. **immediate_exit_on_write_error (L117-132)**: Verifies that write errors cause immediate function termination using mock streams
5. **immediate_exit_on_read_error (L134-143)**: Verifies that read errors cause immediate function termination
6. **copy_bidirectional_is_cooperative (L145-168)**: Tests that the function yields control cooperatively in infinite loops, preventing task starvation

### Dependencies & Architecture

- Uses real TCP sockets for integration tests (excluded on WASI platform)
- Leverages `tokio_test::io::Builder` for mock stream testing with controlled error injection
- All socket-based tests skip execution under Miri due to lack of socket support
- Employs `tokio::select!` for concurrent operations and timeout handling

### Key Patterns

- Symmetric testing ensures argument order independence
- Mock streams validate error propagation without network dependencies  
- Cooperative behavior testing prevents scheduler monopolization
- Proper resource cleanup with explicit drops and shutdown calls