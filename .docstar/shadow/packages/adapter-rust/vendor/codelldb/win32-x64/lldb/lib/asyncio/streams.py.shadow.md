# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/streams.py
@source-hash: 6ec5c70fd95b0d51
@generated: 2026-02-09T18:12:27Z

## Primary Purpose

This module provides high-level async stream I/O primitives for asyncio, offering convenient interfaces for TCP/UNIX socket connections with automatic flow control and buffering. It acts as a bridge between low-level asyncio transport/protocol interfaces and user-friendly stream operations.

## Core Components

### Connection Factories

- `open_connection()` (L26-51): Creates TCP client connection, returns (reader, writer) pair
- `start_server()` (L54-84): Creates TCP server with callback for each client connection  
- `open_unix_connection()` (L90-100): Creates UNIX domain socket client connection (when available)
- `start_unix_server()` (L102-113): Creates UNIX domain socket server (when available)

All use default buffer limit of 64 KiB (`_DEFAULT_LIMIT = 2**16`, L23) and follow same pattern: create StreamReader, wrap with StreamReaderProtocol, establish connection via event loop.

### Flow Control Foundation

**FlowControlMixin** (L116-178): Base class providing backpressure management
- Tracks paused state and drain waiters queue (L131-133)
- `pause_writing()/resume_writing()` (L135-150): Protocol-level flow control hooks
- `_drain_helper()` (L164-174): Core async method for handling write backpressure
- `connection_lost()` (L151-163): Cleanup and waiter notification on disconnect

### Protocol Adapter

**StreamReaderProtocol** (L180-313): Bridges asyncio Protocol interface to StreamReader
- Uses weak reference to StreamReader to prevent cycles (L194)
- Handles client connection callbacks with automatic Task creation (L241-262)
- Manages SSL detection and connection lifecycle (L224-282)
- Forwards data/EOF to underlying reader (L284-298)
- Includes garbage collection protection via `__del__` (L303-312)

### Stream Writer

**StreamWriter** (L315-417): High-level write interface wrapping Transport
- Delegates write operations directly to transport (L345-367)
- `drain()` (L369-392): Key method for flow control - waits for buffer to flush
- `start_tls()` (L394-408): Upgrades connection to TLS
- Automatic cleanup warning in `__del__` for unclosed streams (L410-416)

### Stream Reader  

**StreamReader** (L418-770): Buffered async reader with line/chunk parsing
- Internal buffer with configurable limit for security (L434, L426-427)
- Flow control via transport pause/resume when buffer exceeds 2x limit (L508-519)
- Read methods:
  - `readline()` (L549-578): Reads until newline with limit checking
  - `readuntil()` (L580-669): Reads until arbitrary separator with comprehensive edge case handling
  - `read()` (L671-720): Reads up to n bytes or until EOF
  - `readexactly()` (L722-761): Reads exactly n bytes or raises IncompleteReadError
- Async iterator support for line-by-line processing (L763-770)
- Sophisticated waiter coordination prevents concurrent read operations (L530-533)

## Key Patterns

- **Separation of Concerns**: Reader handles buffering/parsing, Writer handles flow control, Protocol handles network events
- **Weak References**: Protocol uses weak ref to Reader to prevent reference cycles  
- **Future-based Coordination**: Waiters and drain helpers use futures for async synchronization
- **Automatic Resource Management**: Both Reader and Writer have `__del__` cleanup with warnings
- **Flow Control Integration**: Reader automatically pauses/resumes transport based on buffer size

## Critical Constraints

- Buffer limit is both security feature and flow control trigger (L423-424)
- Only one read operation can wait for data at a time (L530-533) 
- Transport pause/resume may not be supported by all transports (L513-517)
- SSL connections require special EOF handling (L293-298)