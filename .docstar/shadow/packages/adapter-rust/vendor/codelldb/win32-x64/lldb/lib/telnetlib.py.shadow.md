# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/telnetlib.py
@source-hash: 9b0e127e2d0853cc
@generated: 2026-02-09T18:13:23Z

## Primary Purpose
Python TELNET client implementation based on RFC 854. Provides a complete TELNET protocol client with connection management, protocol negotiation, and various reading modes. **DEPRECATED** - scheduled for removal in Python 3.13.

## Key Classes and Functions

### Telnet Class (L144-650)
Main TELNET client interface providing connection and communication capabilities.

**Core Methods:**
- `__init__(host, port, timeout)` (L200-222): Constructor with optional auto-connect
- `open(host, port, timeout)` (L224-239): Establishes TCP connection to TELNET server
- `close()` (L267-275): Closes connection and resets state
- `write(buffer)` (L285-296): Sends data with IAC character escaping

**Reading Methods (Multiple Strategies):**
- `read_until(match, timeout)` (L298-333): Reads until pattern found or timeout
- `read_all()` (L335-343): Reads all data until EOF (blocking)
- `read_some()` (L345-358): Reads at least one byte (blocking)
- `read_very_eager()` (L360-372): Reads all available data without blocking
- `read_eager()` (L374-386): Reads available data without blocking
- `read_lazy()` (L388-397): Processes existing queue data only
- `read_very_lazy()` (L399-410): Returns cooked queue data only
- `read_sb_data()` (L412-422): Returns subnegotiation data

**Protocol Processing:**
- `process_rawq()` (L428-497): Core protocol parser handling IAC sequences and options
- `rawq_getchar()` (L499-515): Character extraction from raw queue
- `fill_rawq()` (L517-532): Socket receive operation
- `expect(list, timeout)` (L589-643): Pattern matching with regex support

**Utility Methods:**
- `interact()` (L540-564): Interactive terminal emulation
- `mt_interact()` (L566-574): Multi-threaded interaction for Windows
- `set_option_negotiation_callback(callback)` (L424-426): Custom option handling

### Protocol Constants (L53-133)
Comprehensive TELNET protocol definitions:
- Command bytes: IAC, DO, DONT, WILL, WONT, etc. (L53-70)
- Option codes: BINARY, ECHO, LINEMODE, etc. (L75-133)

### Selector Configuration (L138-141)
Chooses optimal I/O multiplexing: PollSelector preferred over SelectSelector for efficiency.

### Test Function (L652-677)
Command-line test utility supporting debug mode and custom host/port.

## Architecture Patterns

**Dual Queue System:**
- `rawq`: Raw socket data with IAC sequences
- `cookedq`: Processed data ready for application consumption
- `sbdataq`: Subnegotiation data buffer

**State Machine Processing:**
- `iacseq`: Tracks IAC command sequence state
- `sb`: Subnegotiation mode flag
- Protocol parsing in `process_rawq()` handles multi-byte commands

**Flexible Reading Modes:**
- Blocking vs non-blocking variants
- Eager (socket I/O) vs lazy (queue-only) processing
- Pattern-based reading with timeout support

## Key Dependencies
- `socket`: TCP connection management
- `selectors`: I/O multiplexing for timeouts and availability checks
- `sys`: Platform detection and audit logging
- `warnings`: Deprecation notice
- `re`: Pattern matching in expect() method

## Critical Constraints
- Buffer size limited to 50 bytes in `fill_rawq()` to avoid quadratic behavior
- IAC characters must be doubled when sending data
- Connection state tracked via `eof` flag
- Thread-safe interaction only on Windows platform