# packages\shared\src\interfaces\adapter-policy.ts
@source-hash: e01a3cba740d740a
@generated: 2026-02-16T08:23:57Z

**Purpose**: Defines the `AdapterPolicy` interface for abstracting debug adapter-specific behaviors in the DAP (Debug Adapter Protocol) transport layer. This allows the core DAP system to remain generic while handling adapter-specific quirks like multi-session debugging, reverse startDebugging, and initialization sequences.

**Key Types and Enums**:
- `ChildSessionStrategy` (L21-25): Enum defining strategies for creating child debug sessions ('none', 'launchWithPendingTarget', 'attachByPort', 'adoptInParent')
- `CommandHandling` (L30-34): Result interface for command queuing decisions with shouldQueue/shouldDefer flags
- `AdapterSpecificState` (L39-43): Extensible state container with initialized/configurationDone flags

**Core Interface**:
- `AdapterPolicy` (L45-322): Main interface with 20+ methods covering:
  - **Multi-session support** (L52-82): Methods for reverse startDebugging, child session strategies, and readiness detection
  - **Stack frame filtering** (L85-101): Optional methods for removing internal/framework frames
  - **Variable extraction** (L103-126): Language-specific local variable extraction logic
  - **Adapter configuration** (L129-159): DAP type configuration, executable resolution, debugger requirements
  - **Handshake and initialization** (L161-194): Custom initialization sequences and executable validation
  - **Command queueing** (L196-219): State-aware command queuing and processing
  - **State management** (L222-249): Methods for creating and updating adapter-specific state
  - **Connection status** (L252-270): Methods to check initialization and connection readiness
  - **Behavior configuration** (L272-298): Grouped initialization and DAP client behavior flags
  - **Adapter spawning** (L300-321): Optional configuration for spawning adapter processes

**Default Implementation**:
- `DefaultAdapterPolicy` (L330-361): Placeholder implementation that throws errors for unsupported operations like child sessions. Used as fallback while determining the correct adapter policy to use.

**Key Dependencies**:
- `@vscode/debugprotocol` for DAP types (L15)
- Local models for `StackFrame`, `Variable` (L16)
- `DapClientBehavior` interface (L17)
- `SessionState` from shared package (L18)
- `LanguageSpecificLaunchConfig` (L19)

**Architecture Notes**:
- Policy pattern allows pluggable adapter-specific behaviors without modifying core DAP transport
- Extensive optional methods enable incremental adapter implementation
- State management is delegated to individual policies for maximum flexibility
- Default policy serves as safe fallback preventing runtime errors during adapter selection