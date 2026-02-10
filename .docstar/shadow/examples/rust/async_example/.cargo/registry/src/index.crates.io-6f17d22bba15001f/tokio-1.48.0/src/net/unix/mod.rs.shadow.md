# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/mod.rs
@source-hash: c7ba74bc1919e683
@generated: 2026-02-09T18:02:54Z

## Purpose
Module definition file for Unix-specific networking types in Tokio async runtime. Serves as the public interface for Unix domain socket functionality while organizing internal components.

## Key Components

### Public Type Aliases (L29-39)
- `uid_t` (L31): User ID type, aliased to `u32`
- `gid_t` (L35): Group ID type, aliased to `u32`  
- `pid_t` (L39): Process/process group ID type, aliased to `i32`

### Module Organization
- **Hidden Modules**: `datagram` (L6) - marked `#[doc(hidden)]` for backward compatibility
- **Internal Modules**: `listener` (L8), `socket` (L10), `stream` (L21-22) - crate-private components
- **Public Modules**: `pipe` (L27) - exposed for public use

### Re-exported Types
- **Stream Splitting**: `ReadHalf`, `WriteHalf` (L13) from `split` module
- **Owned Stream Splitting**: `OwnedReadHalf`, `OwnedWriteHalf`, `ReuniteError` (L16) from `split_owned`
- **Address Types**: `SocketAddr` (L19) from `socketaddr` module
- **Credentials**: `UCred` (L25) from `ucred` module
- **Internal Stream**: `UnixStream` (L22) - crate-internal re-export

## Architecture Notes
- **Legacy Compatibility**: `datagram` module kept public but hidden to prevent breaking changes
- **Visibility Strategy**: Mixed public/crate-private modules based on intended usage
- **Type Safety**: Unix system types properly aliased with consistent naming
- **Modular Design**: Functionality split across focused submodules