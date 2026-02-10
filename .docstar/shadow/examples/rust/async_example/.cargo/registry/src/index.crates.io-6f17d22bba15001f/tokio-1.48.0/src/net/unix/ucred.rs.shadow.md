# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/ucred.rs
@source-hash: 948a7238fb059e13
@generated: 2026-02-09T18:03:07Z

## Purpose
Unix domain socket peer credential management for Tokio's async networking. Provides cross-platform abstraction for retrieving process credentials (PID, UID, GID) from connected Unix socket peers.

## Core Components

### UCred Struct (L4-12)
- **Purpose**: Immutable process credential container  
- **Fields**: 
  - `pid`: Optional process ID (Some platforms don't support PID retrieval)
  - `uid`: User ID (always available)
  - `gid`: Group ID (always available)
- **Traits**: Copy, Clone, Eq, PartialEq, Hash, Debug for value semantics

### UCred Methods (L14-32)
- `uid()` (L16): Returns user ID
- `gid()` (L21): Returns group ID  
- `pid()` (L29): Returns optional process ID with platform compatibility note

## Platform-Specific Implementations

### Linux-like Systems (L76-131)
- **Platforms**: Linux, Android, RedOx, OpenBSD, Haiku, Cygwin
- **Implementation**: `impl_linux::get_peer_cred()` (L93-130)
- **Mechanism**: Uses `getsockopt()` with `SO_PEERCRED` to retrieve `ucred` struct
- **Features**: Full PID support, size validation, unsafe FFI calls

### NetBSD/QNX Systems (L134-173)  
- **Platforms**: NetBSD, QNX Neutrino
- **Implementation**: `impl_netbsd::get_peer_cred()` (L142-172)
- **Mechanism**: Uses `LOCAL_PEEREID` socket option with `unpcbid` struct
- **Features**: Full credential support including PID

### BSD Systems (L176-204)
- **Platforms**: DragonFly BSD, FreeBSD
- **Implementation**: `impl_bsd::get_peer_cred()` (L184-203)
- **Mechanism**: Uses `getpeereid()` system call
- **Limitation**: No PID support (returns None)

### Apple Systems (L213-257)
- **Platforms**: macOS, iOS, tvOS, watchOS, visionOS  
- **Implementation**: `impl_macos::get_peer_cred()` (L222-256)
- **Mechanism**: Combines `getpeereid()` for UID/GID and `getsockopt(LOCAL_PEEREPID)` for PID
- **Features**: Full credential support with dual API approach

### Solaris Systems (L260-290)
- **Platforms**: Solaris, Illumos
- **Implementation**: `impl_solaris::get_peer_cred()` (L266-289)
- **Mechanism**: Uses `getpeerucred()` with credential object management
- **Features**: Full support, requires explicit memory cleanup via `ucred_free()`

### AIX Systems (L293-318)
- **Platform**: IBM AIX
- **Implementation**: `impl_aix::get_peer_cred()` (L298-317)  
- **Mechanism**: Uses `getpeereid()` system call
- **Limitation**: No PID support

### Embedded/Limited Systems (L321-332)
- **Platforms**: ESP-IDF, PlayStation Vita
- **Implementation**: `impl_noproc::get_peer_cred()` (L325-331)
- **Behavior**: Returns dummy credentials (UID=0, GID=0, PID=None)

## Dependencies
- `crate::net::unix`: Internal Unix networking types
- `libc`: Platform-specific system call bindings
- `std::io`: Error handling and raw file descriptor access

## Architecture Patterns
- **Conditional Compilation**: Extensive use of `#[cfg()]` for platform-specific code selection
- **Module Re-exports**: Clean API surface via selective `pub(crate) use` statements (L42-66)
- **Unsafe FFI**: All implementations use unsafe blocks for system call interactions
- **Error Propagation**: Consistent `io::Result<UCred>` return type across all implementations
- **Memory Safety**: Platform-appropriate memory management (stack allocation, MaybeUninit, explicit free)