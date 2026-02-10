# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/trsock.py
@source-hash: c0eac37debcc51b7
@generated: 2026-02-09T18:10:25Z

**Purpose**: Provides a safe, read-only wrapper around real socket objects for AsyncIO transport exposure, preventing disruptive operations while preserving socket introspection capabilities.

**Architecture**: Single-class wrapper implementing the proxy pattern with selective method delegation and operation restrictions.

## Key Components

**TransportSocket Class (L4-98)**
- Core wrapper class that proxies socket operations while enforcing safety constraints
- Uses `__slots__` optimization (L13) to restrict attributes to `_sock` only
- Constructor (L15-16) accepts and stores the wrapped socket instance

**Socket Property Delegation (L18-28)**
- Exposes read-only socket metadata: `family`, `type`, `proto` properties
- Direct passthrough to underlying socket without modification

**Introspection Methods (L30-51, L56-83)**
- `__repr__` (L30-51): Comprehensive string representation including fd, addresses, and socket info with error handling
- Address methods: `getpeername()`, `getsockname()`, `getsockbyname()` for network information
- File descriptor access: `fileno()`, `dup()`, `get_inheritable()`
- Socket options: `getsockopt()`, `setsockopt()`

**Safety Mechanisms**
- `__getstate__` (L53-54): Prevents serialization with TypeError
- `settimeout()` (L85-89): Only allows 0 timeout, throws ValueError for others
- `gettimeout()` (L91-92): Always returns 0 (non-blocking)
- `setblocking()` (L94-98): Prevents blocking mode, throws ValueError if attempted

**Allowed Operations**
- `shutdown()` (L65-68): Permits graceful connection termination as AsyncIO lacks high-level API
- Socket option manipulation via `getsockopt`/`setsockopt`

**Dependencies**: Standard library `socket` module only

**Key Constraints**:
- Transport sockets must remain non-blocking
- Only zero timeout permitted
- Serialization forbidden
- Most destructive operations (like close) are implicitly banned by not exposing them