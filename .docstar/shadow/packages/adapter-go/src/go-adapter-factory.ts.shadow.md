# packages/adapter-go/src/go-adapter-factory.ts
@source-hash: 913958a35b56d847
@generated: 2026-02-09T18:14:26Z

**Primary Purpose:** Factory implementation for creating Go debug adapter instances with environment validation capabilities.

**Core Class:**
- `GoAdapterFactory` (L18-102): Implements `IAdapterFactory` interface to provide standardized Go debugging support through Delve (dlv)

**Key Methods:**
- `createAdapter()` (L22-24): Factory method that instantiates `GoDebugAdapter` with provided dependencies
- `getMetadata()` (L29-42): Returns static adapter metadata including language info, version, file extensions (.go), and base64-encoded Go gopher icon
- `validate()` (L47-101): Comprehensive async environment validation checking Go/Delve installation and compatibility

**Dependencies:**
- `@debugmcp/shared`: Core interfaces (`IDebugAdapter`, `IAdapterFactory`, `AdapterDependencies`, `AdapterMetadata`, `FactoryValidationResult`, `DebugLanguage`)
- `./go-debug-adapter.js`: Main adapter implementation
- `./utils/go-utils.js`: Utility functions for Go/Delve detection and version checking

**Validation Logic (L47-101):**
- Validates Go executable presence and version (requires Go 1.18+)
- Checks Delve (dlv) installation and DAP (Debug Adapter Protocol) support
- Returns structured validation result with errors, warnings, and environment details
- Provides specific installation commands for missing dependencies

**Key Constants:**
- Minimum Go version: 1.18 (L63-64)
- Delve installation command: `go install github.com/go-delve/delve/cmd/dlv@latest` (L77, L80)
- Adapter version: 0.1.0 (L33)
- Minimum debugger version: 0.17.0 (L37)

**Architecture Pattern:** Standard factory pattern with environment validation, implementing dependency injection for debug adapter creation.