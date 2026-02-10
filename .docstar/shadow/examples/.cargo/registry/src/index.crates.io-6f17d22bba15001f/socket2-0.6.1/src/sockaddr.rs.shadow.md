# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/socket2-0.6.1/src/sockaddr.rs
@source-hash: f33b6146ac3f49b5
@generated: 2026-02-09T18:11:53Z

## Purpose
Cross-platform socket address abstraction layer providing safe Rust wrappers around platform-specific `sockaddr` structures. Enables interoperability between Rust's standard library socket types and low-level system calls.

## Key Types

### `SockAddrStorage` (L29-76)
- Transparent wrapper around platform `sockaddr_storage`
- Zero-initialized storage for any socket address family
- Methods:
  - `zeroed()` (L36): Creates zero-initialized storage
  - `size_of()` (L43): Returns storage size as `socklen_t`
  - `view_as<T>()` (L70): Unsafe cast to specific `sockaddr_*` type

### `SockAddr` (L91-333)
- Main socket address type containing `sockaddr_storage` and length
- Core methods:
  - `new()` (L142): Unsafe constructor from storage and length
  - `try_init()` (L194): Safe initialization via callback pattern
  - `unix()` (L215): Unix domain socket constructor
  - Address family queries: `is_ipv4()` (L260), `is_ipv6()` (L266), `is_unix()` (L272)
  - Conversions: `as_socket()` (L278), `as_socket_ipv4()` (L310), `as_socket_ipv6()` (L319)
  - Getters: `family()` (L233), `domain()` (L238), `len()` (L243), `as_ptr()` (L248)

## Type Aliases
- `socklen_t` (L15): Platform-specific socket length type
- `sa_family_t` (L19): Platform-specific address family type

## Conversions (L335-420)
- `From<SocketAddr>`: Delegates to IPv4/IPv6 implementations
- `From<SocketAddrV4>` (L344): Builds `sockaddr_in` structure with platform-specific `ss_len` field handling
- `From<SocketAddrV6>` (L378): Builds `sockaddr_in6` structure with Windows/Unix scope ID differences

## Platform Compatibility
- Conditional compilation for BSD-style `ss_len` field (L356-373, L400-417)
- Windows-specific `SOCKADDR_IN6_0` anonymous union handling (L394-397)
- Unix domain socket support via `crate::sys::unix_sockaddr()`

## Safety Considerations
- Extensive use of unsafe pointer casting between `sockaddr_*` types
- Relies on C struct layout guarantees and `repr(transparent)`
- Careful length tracking to prevent buffer overruns
- Zero-initialization ensures valid uninitialized state

## Dependencies
- `crate::sys`: Platform-specific socket constants and types
- `crate::Domain`: Socket domain abstraction
- Standard library networking types for conversions