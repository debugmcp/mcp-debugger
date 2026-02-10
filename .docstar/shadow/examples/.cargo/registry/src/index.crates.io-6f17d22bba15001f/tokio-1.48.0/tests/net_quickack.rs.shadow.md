# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/net_quickack.rs
@source-hash: da223544fbabe7e5
@generated: 2026-02-09T18:12:23Z

## Purpose
Test file for TCP quickack functionality in tokio networking, specifically verifying that TcpStream can enable/disable quickack mode on platforms that support it (Linux, Android, Fuchsia, Cygwin).

## Platform Configuration
- **Conditional compilation** (L2-11): Only runs on specific OS platforms with network feature enabled, excludes Miri due to missing socket support
- **Target platforms**: Linux, Android, Fuchsia, Cygwin only

## Key Components

### Test Function: `socket_works_with_quickack` (L18-71)
Async integration test that validates TCP quickack functionality through client-server communication:

**Server task** (L24-46):
- Binds TcpListener to localhost:0 (L25)
- Sends port to client via oneshot channel (L28)
- Accepts connection and enables quickack (L30-32)
- Performs bidirectional message exchange (L34-38)
- Tests quickack disable functionality (L42-43)
- Gracefully shuts down (L45)

**Client task** (L49-68):
- Connects to server using received port (L50-52)
- Enables quickack and verifies state (L53-54)
- Participates in bidirectional message exchange (L56-60)
- Tests quickack disable functionality (L64-65)
- Gracefully shuts down (L67)

## Dependencies
- `tokio::net::{TcpListener, TcpStream}` - Core TCP networking
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` - Async I/O traits
- `tokio::sync::oneshot` - Port coordination between tasks

## Key Patterns
- **Concurrent testing**: Uses `tokio::spawn` for parallel server/client execution
- **Coordination**: oneshot channel for port sharing between tasks
- **Bidirectional validation**: Both ends test quickack enable/disable cycles
- **Message round-trip**: "Hello, tokio!" used for data integrity verification

## Critical Invariants
- Quickack state must be queryable after setting
- Both enable (true) and disable (false) modes must work correctly
- Socket operations must succeed with quickack enabled/disabled
- Platform-specific feature only available on supported operating systems