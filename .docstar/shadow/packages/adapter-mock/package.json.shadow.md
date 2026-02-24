# packages\adapter-mock\package.json
@source-hash: 332c8f88c06c8296
@generated: 2026-02-24T01:54:04Z

## Package Configuration

Mock debug adapter package configuration for testing MCP (Model Context Protocol) debugger functionality. This package provides a testing implementation of debug adapter protocol interfaces.

### Package Identity
- **Name**: `@debugmcp/adapter-mock` (L2)
- **Version**: 0.18.0 (L3)  
- **Type**: ES module (L5)
- **Entry Point**: `dist/index.js` (L6)
- **Type Definitions**: `dist/index.d.ts` (L7)

### Build Configuration
- **Build Scripts**: TypeScript compilation via `tsc -b` (L12-13)
- **Clean Script**: Removes build artifacts and TypeScript build info (L14)
- **Distribution**: Only `dist/` directory published (L8-10)

### Testing Setup
- **Test Runner**: Vitest (L15-16)
- **Test Dependencies**: `vitest@^3.2.1` for testing framework (L25)

### Dependencies
- **Runtime**: 
  - `@debugmcp/shared@workspace:*` - Shared utilities and types (L19)
  - `@vscode/debugprotocol@^1.68.0` - VS Code debug adapter protocol (L20)
- **Peer**: `@debugmcp/shared@0.18.0` - Version-locked shared dependency (L28)
- **Development**: TypeScript 5.2.2+ and Node.js types (L23-24)

### Publishing
- **Access**: Public npm package (L31-32)
- **Workspace Integration**: Uses workspace protocol for internal dependencies

This package serves as a mock implementation for testing debug adapter functionality within the MCP ecosystem, providing controlled debug protocol responses for testing scenarios.