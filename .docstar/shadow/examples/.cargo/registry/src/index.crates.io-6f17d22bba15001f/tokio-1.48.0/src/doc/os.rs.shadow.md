# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/doc/os.rs
@source-hash: 6e11b38bbd5a1cb4
@generated: 2026-02-09T18:06:28Z

## Purpose
Documentation stub module that provides platform-specific Windows OS extensions for Tokio, mirroring the standard library's `std::os::windows` structure. Acts as a documentation placeholder pointing to actual std implementations.

## Module Structure
- **windows** (L6-68): Root Windows platform extensions module
  - **io** (L10-67): Windows-specific I/O primitive extensions

## Key Types
- **RawHandle** (L12): Type alias for raw Windows handles, aliased to `crate::doc::NotDefinedHere`
- **OwnedHandle** (L15): Type alias for owned Windows handles, aliased to `crate::doc::NotDefinedHere` 
- **RawSocket** (L30): Type alias for raw Windows sockets, aliased to `crate::doc::NotDefinedHere`
- **BorrowedHandle** (L51): Generic type alias for borrowed Windows handles with lifetime parameter
- **BorrowedSocket** (L60): Generic type alias for borrowed Windows sockets with lifetime parameter

## Key Traits
- **AsRawHandle** (L18-21): Trait for converting to raw handles
  - `as_raw_handle(&self) -> RawHandle` (L20)
- **FromRawHandle** (L24-27): Trait for constructing from raw handles
  - `unsafe fn from_raw_handle(handle: RawHandle) -> Self` (L26)
- **AsRawSocket** (L33-36): Trait for converting to raw sockets
  - `as_raw_socket(&self) -> RawSocket` (L35)
- **FromRawSocket** (L39-42): Trait for constructing from raw sockets
  - `unsafe fn from_raw_socket(sock: RawSocket) -> Self` (L41)
- **IntoRawSocket** (L45-48): Trait for consuming conversion to raw sockets
  - `into_raw_socket(self) -> RawSocket` (L47)
- **AsHandle** (L54-57): Trait for converting to borrowed handles
  - `as_handle(&self) -> BorrowedHandle<'_>` (L56)
- **AsSocket** (L63-66): Trait for converting to borrowed sockets
  - `as_socket(&self) -> BorrowedSocket<'_>` (L65)

## Dependencies
- `crate::doc::NotDefinedHere`: Placeholder type used for all type aliases

## Architectural Notes
This is a documentation-only module that mirrors `std::os::windows::io` structure without actual implementations. All concrete types resolve to `NotDefinedHere` placeholder, while traits define the expected interface signatures. Used for maintaining API documentation consistency while deferring actual implementations to the standard library.