# packages/shared/src/interfaces/dap-client-behavior.ts
@source-hash: a571e684752f8a27
@generated: 2026-02-09T18:14:10Z

This TypeScript interface file defines the behavior configuration system for Debug Adapter Protocol (DAP) clients, enabling customization of debug session management and adapter-specific behaviors.

## Core Purpose
Provides a clean separation of DAP client-specific behaviors from main interfaces, allowing adapters to customize debug session handling, child session management, and protocol routing behaviors.

## Key Interfaces

### ReverseRequestResult (L11-15)
Return type for reverse request handlers, controlling whether requests were handled and if child sessions should be created. Contains optional child session configuration.

### ChildSessionConfig (L20-25)
Configuration structure for spawning child debug sessions, specifying connection details (host/port), session identifiers (pendingId), and parent configuration inheritance.

### DapClientContext (L30-35)
Context object passed to behavior handlers, providing access to protocol communication (`sendResponse`), child session management (`createChildSession`), and session state tracking (`activeChildren`, `adoptedTargets`).

### DapClientBehavior (L40-91)
Main behavior configuration interface with optional customization points:
- `handleReverseRequest` (L45-48): Custom handler for reverse requests from debug adapters
- `childRoutedCommands` (L53): Commands that bypass parent and route directly to child sessions
- Breakpoint management: `mirrorBreakpointsToChild` (L58)
- Session lifecycle: `deferParentConfigDone` (L63), `pauseAfterChildAttach` (L68), `suppressPostAttachConfigDone` (L83)
- Adapter normalization: `normalizeAdapterId` (L73) for mapping adapter IDs
- Timing controls: `childInitTimeout` (L78)
- Stack trace handling: `stackTraceRequiresChild` (L90) for child-dependent operations

## Dependencies
- `@vscode/debugprotocol`: Provides core DAP types and protocol definitions

## Architecture Patterns
- Interface segregation: Separates client behaviors from core protocol handling
- Strategy pattern: Allows per-adapter behavior customization through optional methods
- Context passing: Provides rich context objects for behavior implementations
- Optional configuration: All behavior methods are optional, enabling incremental customization

## Key Design Decisions
- All behavior methods are optional, providing sensible defaults
- Child session management is first-class with dedicated configuration and lifecycle hooks
- Reverse request handling is abstracted to support adapter-specific protocols
- Command routing can be customized to support multi-session debugging scenarios