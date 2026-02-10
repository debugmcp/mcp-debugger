# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/windows/named_pipe.rs
@source-hash: 75efa818186f671b
@generated: 2026-02-09T18:03:10Z

Tokio Windows named pipe implementation providing async I/O for inter-process communication. This module implements Windows-specific named pipe functionality with both server and client endpoints.

## Core Components

**NamedPipeServer** (L104-107): Primary server-side named pipe implementation wrapping `PollEvented<mio_windows::NamedPipe>`. Supports connection handling, bidirectional I/O, and server lifecycle management.
- `from_raw_handle()` (L128): Unsafe constructor from raw Windows handle
- `connect()` (L192): Async method to wait for client connections  
- `disconnect()` (L233): Force disconnect client connection
- `info()` (L157): Retrieve pipe metadata (mode, end, buffer sizes)
- Non-blocking I/O methods: `try_read()` (L457), `try_write()` (L749), vectorized variants
- Readiness methods: `ready()` (L305), `readable()` (L355), `writable()` (L662)
- Custom I/O: `try_io()` (L849), `async_io()` (L882)

**NamedPipeClient** (L977-980): Client-side counterpart with identical I/O interface but no connection management. Same method signatures as server for symmetric API.

**ServerOptions** (L1734-1750): Builder for server configuration with extensive options:
- Access control: `access_inbound()` (L1885), `access_outbound()` (L1983)
- Security: `first_pipe_instance()` (L2051), `write_dac()` (L2133), `write_owner()` (L2143)
- Pipe behavior: `pipe_mode()` (L1789), `reject_remote_clients()` (L2164)
- Buffer sizing: `max_instances()` (L2224), `out_buffer_size()` (L2235), `in_buffer_size()` (L2245)
- `create()` (L2275): Main factory method using Windows `CreateNamedPipeW`
- `create_with_security_attributes_raw()` (L2304): Unsafe variant with security attributes

**ClientOptions** (L2370-2376): Builder for client configuration:
- Access permissions: `read()` (L2408), `write()` (L2419)
- Security: `security_qos_flags()` (L2445) for impersonation levels
- `open()` (L2510): Factory using Windows `CreateFileW`
- `open_with_security_attributes_raw()` (L2531): Unsafe variant

## Type System

**PipeMode** (L2590-2608): Enum for pipe communication mode - `Byte` (stream) vs `Message` (discrete messages)

**PipeEnd** (L2613-2626): Enum distinguishing client vs server endpoints

**PipeInfo** (L2632-2644): Metadata structure containing mode, end type, instance limits, and buffer sizes

## Implementation Details

Both server and client implement `AsyncRead` (L891, L1680) and `AsyncWrite` (L901, L1690) traits with identical polling behavior. Handle management through `AsRawHandle` and `AsHandle` traits.

Internal utilities:
- `encode_addr()` (L2647): Convert OsStr to null-terminated wide string for Windows APIs
- `named_pipe_info()` (L2656): Extract pipe metadata via `GetNamedPipeInfo`

## Platform Architecture

Conditional compilation separates Windows-specific imports (L21-31) from documentation stubs (L34-39). Uses `mio_windows::NamedPipe` as low-level primitive with Tokio's `PollEvented` wrapper for async integration.

Error handling patterns emphasize Windows-specific error codes like `ERROR_PIPE_BUSY` and `ERROR_PIPE_NOT_CONNECTED` with extensive documentation examples showing proper retry logic and connection loops.