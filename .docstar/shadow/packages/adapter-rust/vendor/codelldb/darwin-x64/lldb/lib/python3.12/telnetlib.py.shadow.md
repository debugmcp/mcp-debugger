# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/telnetlib.py
@source-hash: 9b0e127e2d0853cc
@generated: 2026-02-09T18:08:19Z

## Telnet Client Implementation

**Primary Purpose**: Implements a TELNET client class following RFC 854 for establishing and managing connections to telnet servers with full protocol support including option negotiation.

**Key Components**:

### Core Class
- `Telnet (L144-650)`: Main client interface with connection management, protocol handling, and multiple read strategies
  - Constructor `__init__ (L200-222)`: Initializes state, optionally auto-connects if host provided
  - `open (L224-239)`: Establishes socket connection with audit logging
  - `close (L267-275)`: Cleanly shuts down connection and resets state

### Protocol Constants (L53-133)
- Telnet command bytes (IAC, DO, DONT, WILL, WONT, etc.)
- Protocol option codes (BINARY, ECHO, LINEMODE, etc.) mapped from RFC standards
- Special characters (NULL, control sequences)

### Reading Methods (Multiple strategies for different use cases)
- `read_until (L298-333)`: Blocks until expected string found or timeout, uses selector for efficient waiting
- `read_all (L335-343)`: Reads all available data until EOF
- `read_some (L345-358)`: Guarantees at least one byte unless EOF
- `read_very_eager/read_eager (L360-386)`: Non-blocking reads with different eagerness levels
- `read_lazy/read_very_lazy (L388-410)`: Process queued data without socket I/O
- `read_sb_data (L412-422)`: Extracts subnegotiation data between SB...SE sequences

### Protocol Processing
- `process_rawq (L428-497)`: Core protocol parser handling IAC sequences, option negotiation, and subnegotiation
  - Maintains state machines for IAC command processing
  - Separates normal data from protocol commands into different buffers
  - Handles automatic WONT/DONT responses when no callback set
- `rawq_getchar (L499-515)`: Character-level raw queue access with EOF handling
- `fill_rawq (L517-532)`: Single recv() call to populate raw buffer (50-byte chunks)

### Utilities
- `write (L285-296)`: Sends data with IAC escaping and audit logging
- `sock_avail (L534-538)`: Non-blocking socket data availability check using selector
- `set_option_negotiation_callback (L424-426)`: Custom protocol option handler
- `expect (L589-643)`: Regex-based pattern matching with timeout support

### Interactive Features
- `interact (L540-564)`: Basic telnet client with stdin/socket multiplexing
- `mt_interact (L566-574)` + `listener (L576-587)`: Multithreaded version for Windows

### Internal State Management
- Raw queue (`rawq`/`irawq`) for unprocessed socket data
- Cooked queue (`cookedq`) for application-ready data  
- Subnegotiation buffer (`sbdataq`) for option data
- IAC sequence buffer (`iacseq`) for command parsing
- EOF and subnegotiation flags

### Selector Strategy (L138-141)
Chooses PollSelector over SelectSelector when available for better performance.

**Key Patterns**:
- Queue-based buffering separates raw socket data from processed application data
- State machine approach for IAC command parsing
- Context manager support via `__enter__`/`__exit__` (L645-649)
- Defensive programming with EOF checks and connection state management
- Audit trail integration for security monitoring

**Dependencies**: socket, selectors, sys, time.monotonic, warnings, _thread (conditional)

**Critical Constraints**: 
- Connection cannot be reopened once closed
- IAC bytes in user data must be doubled for proper escaping
- Some read methods may return empty strings for reasons other than EOF