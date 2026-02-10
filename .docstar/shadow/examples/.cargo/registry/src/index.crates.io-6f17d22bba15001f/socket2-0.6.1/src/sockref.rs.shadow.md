# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/socket2-0.6.1/src/sockref.rs
@source-hash: a8f01526da0d800f
@generated: 2026-02-09T18:11:48Z

## Purpose
Provides a safe reference wrapper `SockRef` around socket types, allowing configuration of standard library socket types (like `TcpStream`) using `socket2::Socket` methods without taking ownership.

## Key Components

**SockRef<'s> struct (L61-69)**
- Core wrapper containing `ManuallyDrop<Socket>` to prevent automatic closing
- Uses `PhantomData<&'s Socket>` to enforce lifetime safety
- Lifetime parameter `'s` ensures referenced socket remains valid during `SockRef` lifetime

**Deref implementation (L71-77)**
- Provides transparent access to underlying `Socket` methods
- Returns reference to wrapped socket for method delegation

**Platform-specific From implementations**
- Unix version (L81-94): Converts `&impl AsFd` to `SockRef`
  - Extracts raw file descriptor and validates >= 0
  - Creates Socket using unsafe `from_raw_fd`
- Windows version (L98-111): Converts `&impl AsSocket` to `SockRef`
  - Extracts raw socket handle and validates != INVALID_SOCKET
  - Creates Socket using unsafe `from_raw_socket`

**Debug implementation (L113-121)**
- Displays raw socket handle, local address, and peer address
- Uses `.ok()` to handle potential address lookup failures gracefully

## Architecture Patterns
- **Zero-cost abstraction**: No runtime overhead, just lifetime tracking
- **Platform abstraction**: Unified API over Unix file descriptors and Windows socket handles
- **Memory safety**: `ManuallyDrop` prevents double-close scenarios
- **Lifetime safety**: Phantom data ensures socket outlives reference

## Dependencies
- Standard library: `fmt`, `mem::ManuallyDrop`, `ops::Deref`, `marker::PhantomData`
- Platform-specific: Unix fd traits, Windows socket traits
- Internal: `crate::Socket`

## Usage Contract
- Caller must ensure referenced type is actually a socket (documented in implementation comments)
- Socket must remain valid for lifetime of `SockRef`
- Provides read/write access to socket configuration without ownership transfer