# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/doc/
@generated: 2026-02-09T18:16:03Z

## Overview

The `doc` directory contains documentation-only modules for the Tokio crate that serve as API documentation placeholders and cross-references. This directory is exclusively visible on docs.rs and provides structured documentation without actual runtime implementations.

## Key Components

### Core Documentation Infrastructure
- **mod.rs**: Provides the foundational `NotDefinedHere` placeholder type and documentation module structure
- **os.rs**: Platform-specific documentation stubs mirroring standard library OS extensions

### Documentation Placeholder System
- **NotDefinedHere**: An uninhabitable enum that serves as a type alias target for documentation purposes
- **Platform Extensions**: Complete trait and type definitions that mirror `std::os::windows::io` structure
- **Feature-Gated Content**: Conditional compilation based on "net" and "fs" features

## Public API Surface

### Entry Points
- **NotDefinedHere**: Primary placeholder type for cross-referencing actual implementations
- **os::windows::io**: Windows-specific I/O primitives and traits
- **Platform Traits**: AsRawHandle, FromRawHandle, AsRawSocket, FromRawSocket, IntoRawSocket, AsHandle, AsSocket

### Type Aliases
- Raw and owned handle/socket types (RawHandle, OwnedHandle, RawSocket)
- Borrowed handle/socket types with lifetime parameters (BorrowedHandle, BorrowedSocket)

## Internal Organization

### Documentation Strategy
1. **Placeholder Pattern**: Uses uninhabitable types to prevent accidental usage while maintaining documentation completeness
2. **Mirror Architecture**: Replicates standard library module structure for familiar navigation
3. **Cross-Reference System**: Enables type aliases to redirect to actual implementations without circular dependencies

### Data Flow
- Documentation tools can reference types in this module
- All concrete implementations resolve to `NotDefinedHere` placeholder
- Trait signatures define expected interfaces without actual functionality
- Platform-specific extensions are conditionally compiled based on feature flags

## Important Patterns

### Documentation-Only Design
- Zero runtime impact - all code is documentation metadata
- Uninhabitable types prevent accidental instantiation
- Stub implementations return benign values (Ok(())) for completeness

### Feature Gate Management
- Conditional module compilation based on Tokio feature selection
- Platform-specific code organization matching standard library conventions
- Clean separation between documentation artifacts and runtime code

This directory enables comprehensive API documentation while maintaining clean separation from actual implementations, providing a structured way to document complex async I/O primitives and platform-specific extensions.