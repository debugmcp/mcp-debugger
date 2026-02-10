# src/proxy/dap-proxy-interfaces.ts
@source-hash: e65dcff1d80d9ca6
@generated: 2026-02-09T18:15:09Z

## Core Purpose

Type definitions and interfaces for the DAP (Debug Adapter Protocol) Proxy system, establishing contracts for dependency injection, IPC communication, and debug session management. Serves as the foundational abstraction layer enabling testable and modular debug adapter orchestration.

## Message Protocol Types

**Command Messages (L12-47):**
- `ProxyInitPayload` (L12-32): Initialization command with session config, adapter details, script path, and optional launch parameters
- `DapCommandPayload` (L34-40): DAP command forwarding with request tracking
- `TerminatePayload` (L42-45): Session termination signal
- `ParentCommand` (L47): Union type for all incoming commands

**Response Messages (L51-84):**
- `ProxyMessage` (L51-55): Base response interface with session tracking
- `StatusMessage` (L57-64): Process status updates with exit codes/signals
- `DapResponseMessage` (L66-73): DAP request responses with success/error states
- `DapEventMessage` (L75-79): DAP event forwarding
- `ErrorMessage` (L81-84): Error reporting

## Core Abstractions

**Service Interfaces (L91-150):**
- `ILogger` (L91-96): Structured logging with standard levels
- `IFileSystem` (L101-104): Directory operations abstraction
- `IProcessSpawner` (L109-111): Child process creation wrapper
- `IDapClient` (L116-129): DAP protocol client with lifecycle management and event handling
- `IDapClientFactory` (L134-136): Factory for DAP client instances with policy support
- `IMessageSender` (L141-143): IPC message transmission
- `ILoggerFactory` (L148-150): Delayed logger initialization

## Configuration & State Management

**Configuration Types (L157-172):**
- `AdapterConfig` (L157-164): Debug adapter spawn configuration
- `AdapterSpawnResult` (L169-172): Adapter process metadata

**State Management (L179-205):**
- `ProxyState` (L179-185): State machine enum for proxy lifecycle
- `TrackedRequest` (L190-195): Request timeout and metadata tracking
- `IRequestTracker` (L200-205): Request lifecycle management interface

## Dependency Injection

**Worker Dependencies (L212-218):**
- `DapProxyDependencies` (L212-218): Complete dependency container for the main proxy worker, enabling full testability through interface injection

## DAP Protocol Extensions

**Extended DAP Types (L225-249):**
- `ExtendedLaunchArgs` (L225-234): Launch request with required program field and common debug options
- `ExtendedInitializeArgs` (L239-249): Initialize request with client identification and capability flags

## Key Dependencies

- `@vscode/debugprotocol`: Standard DAP types
- `@debugmcp/shared`: Shared adapter policies and language configs
- `child_process`: Node.js process spawning types

## Architectural Patterns

- **Dependency Injection**: All external dependencies abstracted through interfaces
- **Message Passing**: Structured command/response pattern for IPC
- **State Machine**: Explicit proxy state management
- **Request Tracking**: Timeout-aware request lifecycle management
- **Factory Pattern**: Configurable DAP client creation