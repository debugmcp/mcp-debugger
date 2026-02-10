# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/telnetlib.py
@source-hash: 9b0e127e2d0853cc
@generated: 2026-02-09T18:10:16Z

## Telnet Client Implementation

**Purpose**: Full implementation of a TELNET protocol client based on RFC 854, providing connection management, protocol negotiation, and data reading capabilities with various buffering strategies.

**Core Architecture**:
- Main class `Telnet` (L144-649) handles all telnet operations
- Dual-buffer system: raw queue (`rawq`) for incoming data, cooked queue (`cookedq`) for processed data
- IAC (Interpret As Command) sequence processing for protocol negotiation
- Subnegotiation data handling via separate buffer (`sbdataq`)

**Key Components**:

### Connection Management
- `__init__(host, port, timeout)` (L200-222): Constructor with optional auto-connect
- `open(host, port, timeout)` (L224-239): Establishes TCP connection, defaults to port 23
- `close()` (L267-275): Cleanly closes connection and resets state
- `get_socket()` (L277-279): Exposes underlying socket for advanced use

### Data Writing
- `write(buffer)` (L285-296): Sends data with IAC character escaping (doubles IAC bytes)

### Data Reading Methods (Multiple Strategies)
- `read_until(match, timeout)` (L298-333): Blocks until pattern found or timeout
- `read_all()` (L335-343): Reads everything until EOF
- `read_some()` (L345-358): Reads at least one byte, blocks if needed
- `read_very_eager()` (L360-372): Non-blocking, reads all immediately available data
- `read_eager()` (L374-386): Non-blocking, reads available data if any
- `read_lazy()` (L388-397): Processes only queued data, no socket I/O
- `read_very_lazy()` (L399-410): Returns only cooked queue contents
- `read_sb_data()` (L412-422): Returns subnegotiation data between SB...SE sequences

### Protocol Processing
- `process_rawq()` (L428-497): Core telnet protocol parser, handles IAC sequences and option negotiation
- `rawq_getchar()` (L499-515): Character-by-character raw queue consumption
- `fill_rawq()` (L517-532): Single recv() call to fill raw buffer (50 bytes)

### Advanced Features
- `expect(list, timeout)` (L589-643): Pattern matching with regex support
- `interact()` (L540-564): Simple telnet client interface
- `mt_interact()` (L566-574): Multithreaded interaction for Windows
- `set_option_negotiation_callback(callback)` (L424-426): Custom protocol handling

### Protocol Constants
Comprehensive telnet protocol definitions (L46-133):
- Command bytes: IAC, DO, DONT, WILL, WONT, etc.
- Control codes: NOP, BRK, IP, AO, etc.  
- Option codes: BINARY, ECHO, LINEMODE, NAWS, etc.

### Selector Strategy
Automatically chooses `PollSelector` over `SelectSelector` if available (L138-141) for efficient I/O multiplexing.

**Key Invariants**:
- IAC bytes in user data are automatically doubled for protocol compliance
- Raw queue processing maintains telnet protocol state machine
- EOF detection triggers across all read methods
- Connection state properly managed through open/close lifecycle

**Dependencies**: socket, selectors, sys, time.monotonic, warnings, _thread (for mt_interact)

**Usage Pattern**: Create instance → open() → read/write operations → close() or use context manager