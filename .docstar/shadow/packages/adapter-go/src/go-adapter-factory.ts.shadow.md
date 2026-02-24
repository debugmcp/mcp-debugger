# packages\adapter-go\src\go-adapter-factory.ts
@source-hash: ac440ee53e7b99ef
@generated: 2026-02-24T01:54:09Z

## Purpose
Factory implementation for creating Go debug adapter instances with environment validation. Implements the adapter factory interface pattern for dependency injection in the MCP debugger system.

## Key Components

### GoAdapterFactory Class (L18-102)
- Implements `IAdapterFactory` interface for Go language debugging
- Provides adapter creation, metadata, and environment validation
- Central factory for instantiating Go debug adapters with proper dependencies

### Core Methods
- **createAdapter** (L22-24): Instantiates `GoDebugAdapter` with injected dependencies
- **getMetadata** (L29-42): Returns Go adapter metadata including language, version, file extensions, and embedded gopher icon
- **validate** (L47-102): Performs comprehensive environment validation for Go and Delve installation

## Dependencies
- Imports from `@debugmcp/shared`: Core interfaces, types, and enums
- Uses `GoDebugAdapter` from local module (L11)
- Utilizes Go-specific utilities from `./utils/go-utils.js` (L13)

## Validation Logic (L47-102)
Performs multi-step environment checks:
1. **Go executable detection** - finds Go binary in PATH
2. **Version verification** - requires Go 1.18+ (L62-65)
3. **Delve installation** - locates dlv debugger binary
4. **DAP support check** - verifies Delve supports Debug Adapter Protocol (L75-79)

Returns structured validation result with errors, warnings, and system details including platform info.

## Metadata Configuration (L30-41)
- Language: Go (DebugLanguage.GO)
- File extensions: ['.go']
- Minimum debugger version: '0.17.0'
- Embedded SVG icon (base64 encoded Go gopher)
- Documentation URL and version information

## Error Handling
- Graceful fallback for missing tools with installation instructions
- Clear error messages for version incompatibilities
- Distinguishes between critical errors and warnings for better UX