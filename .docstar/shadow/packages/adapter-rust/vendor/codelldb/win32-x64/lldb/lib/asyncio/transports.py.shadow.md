# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/transports.py
@source-hash: 940108bc133de399
@generated: 2026-02-09T18:10:30Z

**Primary Purpose**: Defines abstract transport classes for asyncio framework, providing interfaces for different types of network communication patterns including read-only, write-only, bidirectional, datagram, and subprocess transports.

**Key Classes and Their Roles**:

- **BaseTransport (L9-44)**: Foundation class for all transports
  - Manages optional metadata via `_extra` dict (L17)
  - Defines core interface: `get_extra_info()` (L19), `is_closing()` (L23), `close()` (L27), protocol management (L37-43)
  - All methods except `get_extra_info()` raise NotImplementedError

- **ReadTransport (L46-70)**: Interface for receive-only transports
  - Extends BaseTransport with reading control methods
  - Key methods: `is_reading()` (L51), `pause_reading()` (L55), `resume_reading()` (L63)
  - All methods raise NotImplementedError (pure interface)

- **WriteTransport (L72-146)**: Interface for send-only transports
  - Manages write flow control with high/low water marks (L77-96)
  - Core write operations: `write()` (L108), `writelines()` (L116-123), `write_eof()` (L125)
  - `writelines()` is the only implemented method - concatenates data and calls `write()` (L122-123)
  - Buffer management: `get_write_buffer_size()` (L98), `get_write_buffer_limits()` (L102)
  - Transport lifecycle: `abort()` for immediate closure (L138)

- **Transport (L148-170)**: Bidirectional transport interface
  - Multiple inheritance from ReadTransport and WriteTransport
  - Pure interface class - only `writelines()` inherited implementation

- **DatagramTransport (L172-195)**: UDP/datagram-specific interface  
  - Extends BaseTransport with `sendto()` method (L177) for addressed packet sending
  - Includes `abort()` method (L187) for immediate closure

- **SubprocessTransport (L197-249)**: Subprocess management interface
  - Process control: `get_pid()` (L201), `get_returncode()` (L205), `send_signal()` (L217)
  - Process lifecycle: `terminate()` (L225), `kill()` (L239) 
  - Pipe access: `get_pipe_transport()` (L213)

- **_FlowControlMixin (L251-335)**: Concrete flow control implementation
  - Manages write buffer flow control with pause/resume logic
  - Key attributes: `_protocol_paused` (L274), `_high_water`/`_low_water` (L268)
  - Auto-pause/resume protocol based on buffer size thresholds (L277-309)
  - Default buffer limits: 64KB high, 16KB low (L317, L321)
  - Exception handling for protocol callback failures (L287-293, L303-309)

**Architecture Patterns**:
- Interface segregation: separate read/write concerns into focused interfaces
- Template method pattern: abstract base classes define interface, concrete classes implement behavior
- Mixin pattern: `_FlowControlMixin` provides reusable flow control logic
- Protocol-transport separation: transports manage I/O, protocols handle application logic

**Dependencies**:
- Designed for asyncio event loop integration (L272, L288, L304)
- Expects protocol objects with pause_writing/resume_writing callbacks
- Built for async/non-blocking I/O patterns

**Critical Constraints**:
- Buffer limits must satisfy: high >= low >= 0 (L323-325)
- Flow control mixin requires loop parameter (L272 assertion)
- All transport methods are async-safe (non-blocking)