# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/telnetlib.py
@source-hash: 9b0e127e2d0853cc
@generated: 2026-02-09T18:09:21Z

**Purpose:** TELNET protocol client implementation providing a socket-based interface for communicating with TELNET servers, with full protocol negotiation and multiple read strategies.

**Core Class:**
- `Telnet` (L144-649): Main client class for TELNET connections
  - Constructor (L200-222): Initializes connection parameters, optionally connects immediately
  - `open()` (L224-239): Establishes socket connection to host/port with audit logging
  - `close()` (L267-275): Cleanly closes connection and resets state
  - Connection state tracked via `sock`, `eof`, internal queues

**Data Flow Architecture:**
Two-stage buffering system for protocol processing:
- Raw queue (`rawq`, `irawq`): Unprocessed socket data
- Cooked queue (`cookedq`): Protocol-processed, application-ready data
- SB data queue (`sbdataq`): Subnegotiation sequence data
- `fill_rawq()` (L517-532): Single recv() call to populate raw buffer
- `process_rawq()` (L428-497): Core protocol parser, handles IAC sequences and options
- `rawq_getchar()` (L499-515): Character-by-character raw queue consumption

**Read Methods (Multiple Strategies):**
- `read_until(match, timeout)` (L298-333): Blocking read until pattern found or timeout
- `read_all()` (L335-343): Blocking read until EOF
- `read_some()` (L345-358): Blocking read for at least one byte
- `read_very_eager()` (L360-372): Non-blocking read of all available data
- `read_eager()` (L374-386): Non-blocking read with socket availability check
- `read_lazy()` (L388-397): Process existing raw queue only
- `read_very_lazy()` (L399-410): Return existing cooked queue only
- `read_sb_data()` (L412-422): Return subnegotiation data

**Protocol Implementation:**
- TELNET constants (L53-133): IAC commands, options from RFC 854 and IANA registry
- Protocol negotiation via `option_callback` mechanism (L424-426)
- Automatic IAC doubling in `write()` (L285-296) for data transparency
- Command processing handles DO/DONT/WILL/WONT sequences (L479-492)
- Subnegotiation (SB/SE) sequence handling (L459-474)

**Interactive Features:**
- `interact()` (L540-564): Basic terminal emulation using selectors
- `mt_interact()` (L566-574): Windows-specific multithreaded version
- `expect()` (L589-643): Regex-based pattern matching with timeout
- Context manager support (L645-649)

**I/O and Selection:**
- Selector abstraction: Uses `PollSelector` or `SelectSelector` (L138-141)
- `sock_avail()` (L534-538): Non-blocking socket readiness check
- Timeout handling with monotonic clock for precision
- File descriptor interface via `fileno()` (L281-283)

**Dependencies:**
- Standard library: socket, selectors, sys, time, warnings
- Audit hooks for security monitoring (L238, L294)
- Deprecation warning for Python 3.13 removal (L42)

**Key Invariants:**
- Raw queue index (`irawq`) maintained for efficient character access
- IAC sequence state (`iacseq`) preserved across calls
- EOF state synchronized between socket and internal flags
- SB flag tracks subnegotiation mode