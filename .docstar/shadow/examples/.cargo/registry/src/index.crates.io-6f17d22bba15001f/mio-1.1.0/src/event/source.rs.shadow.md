# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/event/source.rs
@source-hash: d2d1aaff10fb31e7
@generated: 2026-02-09T18:06:25Z

## Purpose and Responsibility

This file defines the core `Source` trait that enables event sources to be registered with Mio's event loop system. It provides the fundamental abstraction for any object that needs to be monitored for I/O events.

## Key Components

### Source Trait (L75-112)
The main trait that all event sources must implement. Contains three required methods:
- `register()` (L83-88): Initial registration with a Registry using token and interest flags
- `reregister()` (L97-102): Updates registration parameters for already registered sources  
- `deregister()` (L111): Removes source from Registry monitoring

All methods take `&mut self`, `&Registry`, and return `io::Result<()>`. The `register` and `reregister` methods also accept `Token` and `Interest` parameters.

### Box<T> Implementation (L114-139)
Provides automatic `Source` implementation for boxed trait objects, delegating all calls to the inner type via double dereference (`(**self)`).

## Dependencies

- `crate::{Interest, Registry, Token}`: Core Mio types for event system integration
- `std::io`: Standard I/O error handling

## Architectural Patterns

**Delegation Pattern**: The trait is designed for delegation - implementations should typically forward calls to underlying system handles (sockets, file descriptors) rather than implementing platform-specific logic directly.

**Resource Management Contract**: Unlike typical Rust drop semantics, Sources must be manually deregistered before being dropped to prevent resource leaks, since deregistration requires Registry access.

**User-Facing Abstraction**: The trait methods are not intended for direct use - users should call equivalent methods on `Registry` instead.

## Critical Constraints

1. **Manual Deregistration Required**: Sources must be explicitly deregistered before drop to avoid leaking system resources
2. **Registry Coupling**: All operations require a Registry reference, preventing automatic cleanup
3. **Mutable Reference Requirement**: All trait methods require `&mut self`, ensuring exclusive access during registration operations

## Implementation Notes

The trait documentation includes a complete example (L41-74) showing delegation pattern implementation using `TcpStream`. The Box implementation enables trait objects while maintaining the same interface contract.