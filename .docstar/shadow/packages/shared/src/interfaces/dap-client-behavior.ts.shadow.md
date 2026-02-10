# packages/shared/src/interfaces/dap-client-behavior.ts
@source-hash: a571e684752f8a27
@generated: 2026-02-10T00:41:08Z

**Primary Purpose**: Interface definitions for DAP (Debug Adapter Protocol) client behavior configuration system. This file defines the contract for customizing how debug adapters handle reverse requests, child session management, and various debugging behaviors.

**Core Interfaces:**

- **ReverseRequestResult (L11-15)**: Return type for reverse request handlers, indicating whether the request was handled and optionally specifying child session creation with configuration.

- **ChildSessionConfig (L20-25)**: Configuration object for spawning child debug sessions, containing host/port networking details, pending session ID, and parent configuration passthrough.

- **DapClientContext (L30-35)**: Execution context provided to reverse request handlers, offering response utilities, child session creation capability, and tracking collections for active children and adopted targets.

- **DapClientBehavior (L40-91)**: Main configuration interface defining customizable behaviors per debug adapter type, including:
  - Reverse request handling (L45-48)
  - Command routing to child sessions (L53)
  - Breakpoint mirroring (L58)
  - Session lifecycle coordination (L63, L68, L83)
  - Adapter ID normalization (L73)
  - Timing configuration (L78)
  - Stack trace child dependency handling (L90)

**Key Dependencies:**
- `@vscode/debugprotocol` for standard DAP types and interfaces

**Architectural Patterns:**
- Strategy pattern: DapClientBehavior allows different adapters to implement custom handling
- Context object pattern: DapClientContext provides necessary utilities and state to handlers
- Configuration object pattern: Interfaces use optional properties for flexible customization

**Notable Design Decisions:**
- All behavior methods are optional, allowing minimal configuration overrides
- Child session management is abstracted through configuration objects rather than direct API calls
- Reverse request handling returns structured result rather than boolean, enabling complex workflows