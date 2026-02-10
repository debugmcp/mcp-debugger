# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/net_unix_pipe.rs
@source-hash: 5e2d02a361b6a238
@generated: 2026-02-09T18:12:35Z

## Purpose and Responsibility

This test file validates the functionality of Unix named pipes (FIFOs) and anonymous pipes in Tokio's async runtime. It comprehensively tests both file-based named pipes and anonymous pipe pairs with focus on async I/O operations, error handling, and edge cases.

## Key Components

### Helper Utilities

- **TempFifo** (L16-37): RAII wrapper for temporary FIFO files that automatically creates named pipes using `mkfifo` and cleans up on drop
- **write_and_close()** (L99-104): Helper function that opens a sender, writes data, and explicitly closes the writer to test EOF behavior
- **is_nonblocking()** (L280-283): Utility to check if a file descriptor has O_NONBLOCK flag set
- **writable_by_poll()** (L309-311): Helper to test if a writer is ready for non-blocking writes

### Core Test Categories

#### Named Pipe (FIFO) Tests

- **fifo_simple_send()** (L41-68): Basic async read/write test with proper task coordination and yielding
- **fifo_simple_send_sender_first()** (L73-96): Linux/Android-specific test for sender-first scenarios, validates ENXIO error and read-write mode
- **fifo_multiple_writes()** (L110-132): Tests EOF behavior with sequential writer connections
- **fifo_resilient_reader()** (L139-166): Tests read-write mode readers that don't hit EOF when writers disconnect

#### Error Handling and Validation

- **open_detects_not_a_fifo()** (L170-189): Validates proper error detection for non-FIFO files
- **from_file_detects_not_a_fifo()** (L230-251): Tests file type validation when constructing from File objects
- **from_file_detects_wrong_access_mode()** (L255-278): Validates access mode compatibility checks

#### File Descriptor Management

- **from_file()** (L193-226): Tests construction of Receiver/Sender from existing File objects
- **from_file_sets_nonblock()** (L287-307): Ensures pipes are properly set to non-blocking mode

#### Try Operations and Vectored I/O

- **try_read_write()** (L315-352): Tests non-blocking try_read/try_write operations with buffer filling/draining
- **try_read_write_vectored()** (L356-400): Tests vectored I/O operations with chunked data
- **try_read_buf()** (L404-441): Tests buffer-based try_read operations

#### Anonymous Pipe Tests

- **anon_pipe_simple_send()** (L444-469): Basic anonymous pipe communication test
- **anon_pipe_spawn_echo()** (L473-499): Integration test with external process using pipes for stdout redirection
- **anon_pipe_from_owned_fd()** (L504-520): Linux-specific test for creating pipes from raw file descriptors
- **anon_pipe_into_nonblocking_fd()** (L523-533): Tests conversion to non-blocking file descriptors
- **anon_pipe_into_blocking_fd()** (L536-546): Tests conversion to blocking file descriptors

## Dependencies

- **tokio::io**: AsyncReadExt, AsyncWriteExt, Interest for async I/O traits
- **tokio::net::unix::pipe**: Core pipe functionality (Receiver, Sender, OpenOptions)
- **tokio_test**: Task spawning and assertion macros (task, assert_pending, assert_ready_ok)
- **nix**: System calls for mkfifo, pipe2, and file control operations
- **tempfile**: Temporary directory management
- **libc**: OS constants (O_NONBLOCK, ENXIO)

## Notable Patterns

- Extensive use of conditional compilation for platform-specific features (Linux/Android vs general Unix)
- Miri test exclusions for system calls not supported in the interpreter
- Task coordination patterns using tokio_test::task for testing async behavior
- RAII pattern for resource cleanup with TempFifo
- Comprehensive error condition testing with specific error kind validation
- Buffer management patterns for testing pipe capacity limits