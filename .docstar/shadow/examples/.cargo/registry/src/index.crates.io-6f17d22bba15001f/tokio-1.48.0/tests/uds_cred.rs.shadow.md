# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/uds_cred.rs
@source-hash: 67685a854e26480b
@generated: 2026-02-09T18:12:31Z

## Primary Purpose
Test file validating Unix domain socket peer credential functionality in Tokio's networking layer. Specifically tests that `UnixStream::pair()` creates socket pairs where both ends can retrieve identical peer credentials matching the current process's effective UID/GID.

## Key Components
- **test_socket_pair** (L15-26): Core test function that creates a Unix socket pair, retrieves peer credentials from both endpoints, and validates they match the current process's effective user/group IDs
- **Platform constraints** (L3, L11-14): Conditional compilation excluding DragonFly BSD, miri, and special handling for NetBSD due to platform-specific socket limitations

## Dependencies
- `tokio::net::UnixStream` (L5): Tokio's Unix domain socket implementation
- `libc::{getegid, geteuid}` (L7-8): System calls for retrieving effective user/group IDs

## Test Logic Flow
1. Creates socket pair using `UnixStream::pair()` (L16)
2. Retrieves peer credentials from both sockets (L17-18)
3. Validates credential equality between endpoints (L19)
4. Compares credentials against actual process UID/GID (L21-25)

## Platform Compatibility
- Unix-only functionality with explicit exclusions for platforms lacking `getsockopt` support
- NetBSD ignored due to `getpeereid()` limitations with `socketpair()`-created sockets
- Requires "full" feature flag for complete Tokio functionality