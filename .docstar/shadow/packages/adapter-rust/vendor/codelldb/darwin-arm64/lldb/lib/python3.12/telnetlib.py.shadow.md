# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/telnetlib.py
@source-hash: 9b0e127e2d0853cc
@generated: 2026-02-09T18:07:33Z

## Python telnetlib.py - Deprecated TELNET Client Implementation

**Purpose**: Implements a TELNET protocol client class following RFC 854. This module is deprecated as of Python 3.11 and scheduled for removal in Python 3.13.

### Core Architecture

**Telnet Class (L144-649)**: Main interface providing connection management and protocol handling with dual-queue architecture:
- `rawq`: Raw data buffer from socket
- `cookedq`: Processed data after protocol negotiation  
- `sbdataq`: Subnegotiation data queue
- `iacseq`: IAC (Interpret As Command) sequence buffer

### Connection Management
- `__init__(host, port, timeout)` (L200-222): Constructor with optional auto-connection
- `open(host, port, timeout)` (L224-239): Establishes TCP connection, defaults to port 23
- `close()` (L267-275): Clean connection teardown
- `get_socket()` (L277-279): Exposes underlying socket object

### Data Reading Methods (Hierarchical Blocking Behavior)
- `read_until(match, timeout)` (L298-333): Blocks until pattern found or timeout
- `read_all()` (L335-343): Blocks until EOF, reads everything
- `read_some()` (L345-358): Blocks until at least 1 byte available
- `read_very_eager()` (L360-372): Non-blocking, reads all available data
- `read_eager()` (L374-386): Non-blocking, reads if data immediately available
- `read_lazy()` (L388-397): No I/O, processes existing raw queue only
- `read_very_lazy()` (L399-410): No I/O, returns cooked queue contents
- `read_sb_data()` (L412-422): Returns subnegotiation data

### Protocol Processing
- `process_rawq()` (L428-497): Core protocol parser handling IAC sequences, option negotiation
- `rawq_getchar()` (L499-515): Character-by-character raw queue consumption
- `fill_rawq()` (L517-532): Single recv() call to populate raw buffer (50 byte chunks)

### Interactive Features
- `interact()` (L540-564): Terminal emulator using selectors (Unix/Linux)
- `mt_interact()` (L566-574): Multithreaded version for Windows
- `expect(patterns, timeout)` (L589-643): Pattern matching with regex support

### Protocol Constants
- **Command bytes** (L53-70): IAC, DO, DONT, WILL, WONT, SE, SB, etc.
- **Option codes** (L75-133): BINARY, ECHO, LINEMODE, NAWS, etc. following IANA assignments
- **Selector choice** (L138-141): Prefers PollSelector over SelectSelector for efficiency

### Key Dependencies
- `socket`: TCP connection management
- `selectors`: Non-blocking I/O multiplexing  
- `_time`: Monotonic timing for timeouts
- `sys.audit`: Security auditing for open/write operations

### Critical Invariants
- IAC bytes in user data must be doubled (IAC+IAC) for proper escaping
- Raw queue processing is character-by-character to handle protocol sequences
- EOF detection relies on empty recv() return
- Option negotiation sends automatic WONT/DONT responses unless callback provided