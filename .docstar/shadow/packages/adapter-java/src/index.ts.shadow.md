# packages/adapter-java/src/index.ts
@source-hash: 71da5a1378549f96
@generated: 2026-02-09T18:14:28Z

## Java Debug Adapter Package Entry Point

This file serves as the main export module for the Java debug adapter within the MCP (Model Context Protocol) debugger system. It orchestrates the public API surface for Java debugging capabilities.

### Core Components

**Primary Exports:**
- `JavaAdapterFactory` (L9) - Factory class for creating Java debug adapter instances, enabling dynamic loading by the adapter registry
- `JavaDebugAdapter` (L10) - Main adapter implementation handling Java debugging sessions
- `JavaLaunchConfig` type (L11) - TypeScript interface defining configuration options for launching Java debug sessions

**Utility Modules:**
- Java utilities (L12) - General-purpose Java debugging helper functions and constants
- `JdbParser` (L13) - Parser for JDB (Java Debugger) command output and responses
- `JdbWrapper` (L20) - Wrapper class providing higher-level interface to the JDB command-line tool

**Type Definitions:**
- `JdbStoppedEvent`, `JdbStackFrame`, `JdbVariable`, `JdbThread` (L14-19) - Core data structures representing debugging state from JDB parser
- `JdbConfig`, `JdbBreakpoint` (L21) - Configuration and breakpoint management types for JDB wrapper

### Architecture Pattern

Follows a layered export strategy where the index acts as a facade, exposing:
1. High-level adapter interfaces (factory + adapter)
2. Mid-level parsing and wrapping utilities
3. Low-level type definitions for debugging primitives

The module is designed for consumption by a debugger registry system that dynamically loads language-specific adapters.