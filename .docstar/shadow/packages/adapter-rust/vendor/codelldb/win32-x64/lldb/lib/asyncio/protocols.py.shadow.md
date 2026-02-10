# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/protocols.py
@source-hash: 1d1b49988c338b4e
@generated: 2026-02-09T18:10:22Z

**Purpose**: Defines abstract protocol base classes for Python's asyncio framework, providing interfaces for different types of network communication patterns.

## Core Protocol Hierarchy

### BaseProtocol (L9-64)
- **Role**: Root abstract base class for all protocol interfaces
- **Key Methods**:
  - `connection_made(transport)` (L21): Called when connection established
  - `connection_lost(exc)` (L29): Called when connection closed/lost
  - `pause_writing()` (L37): Flow control when transport buffer exceeds high-water mark
  - `resume_writing()` (L59): Flow control when buffer drains below low-water mark
- **Usage**: Direct implementation only for write-only transports (pipes)

### Protocol (L66-107) 
- **Role**: Interface for bidirectional stream protocols (TCP connections)
- **Extends**: BaseProtocol
- **Additional Methods**:
  - `data_received(data)` (L94): Handles incoming bytes data
  - `eof_received()` (L100): Handles end-of-file signals, return value controls transport closure
- **State Machine**: start → connection_made → [data_received*] → [eof_received?] → connection_lost → end

### BufferedProtocol (L109-160)
- **Role**: High-performance stream protocol with manual buffer management
- **Extends**: BaseProtocol  
- **Key Methods**:
  - `get_buffer(sizehint)` (L135): Allocates receive buffer, must return buffer protocol object
  - `buffer_updated(nbytes)` (L146): Notifies of data written to buffer
  - `eof_received()` (L153): Same EOF handling as Protocol
- **Performance**: Avoids data copies by allowing protocol to control buffer allocation

### DatagramProtocol (L162-175)
- **Role**: Interface for connectionless datagram communication (UDP)
- **Extends**: BaseProtocol
- **Methods**:
  - `datagram_received(data, addr)` (L167): Handles incoming datagrams with sender address
  - `error_received(exc)` (L170): Handles OSError exceptions from send/receive operations

### SubprocessProtocol (L177-198)
- **Role**: Interface for subprocess communication via pipes
- **Extends**: BaseProtocol
- **Methods**:
  - `pipe_data_received(fd, data)` (L182): Data from stdout/stderr pipes
  - `pipe_connection_lost(fd, exc)` (L189): Pipe closure notification
  - `process_exited()` (L196): Process termination notification

## Utility Functions

### _feed_data_to_buffered_proto (L200-216)
- **Purpose**: Helper function to feed data to BufferedProtocol instances
- **Logic**: Iteratively requests buffers and copies data, handling cases where buffer size < data size
- **Error Handling**: Raises RuntimeError if `get_buffer()` returns empty buffer

## Architecture Notes

- All protocols use `__slots__ = ()` for memory efficiency
- Flow control methods (`pause_writing`/`resume_writing`) are called directly, not via EventLoop.call_soon()
- BufferedProtocol designed for high-throughput scenarios requiring buffer control
- State machines documented in docstrings define valid method call sequences