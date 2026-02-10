# tests/adapters/go/unit/go-adapter-factory.test.ts
@source-hash: 1fd5f417e1c012fd
@generated: 2026-02-09T18:14:14Z

This is a comprehensive test file for the GoAdapterFactory class, validating its ability to create Go debug adapters and validate development environment requirements.

## Primary Purpose
Tests the GoAdapterFactory's adapter creation, metadata retrieval, and environment validation capabilities. Ensures proper integration with Go toolchain (Go compiler and Delve debugger) and validates version compatibility requirements.

## Key Test Structure
- **GoAdapterFactory test suite (L53-259)**: Main test container
- **createMockDependencies helper (L19-51)**: Creates mock AdapterDependencies with stubbed fileSystem, logger, environment, and processLauncher
- **Mock setup (L9-17)**: Mocks child_process.spawn for process execution simulation

## Core Test Groups

### createAdapter tests (L66-76)
- Validates GoDebugAdapter instance creation (L67-70)
- Confirms correct DebugLanguage.GO assignment (L72-75)

### getMetadata tests (L78-99)
- Verifies adapter metadata including language, display name, version (L79-87)
- Validates documentation URL presence (L89-92)
- Confirms SVG icon embedding (L94-98)

### validate tests (L101-258)
Critical environment validation scenarios:
- **Happy path (L102-133)**: Go 1.21.0 + Delve 1.21.0 with DAP support
- **Go not found (L135-144)**: PATH manipulation and access rejection
- **Go version too old (L146-173)**: Go 1.16.0 rejection (requires 1.18+)
- **Delve missing (L175-203)**: Go present but dlv unavailable
- **DAP unsupported (L205-236)**: Old Delve without Debug Adapter Protocol
- **Platform details (L238-257)**: Validation result includes system info

## Mock Implementation Patterns
Complex spawn mocking (L105-124, L149-167, L185-198, L208-230, L241-250) simulates:
- Version command outputs for go/dlv
- Exit codes for success/failure scenarios  
- DAP support verification via `dlv dap --help`

## Dependencies
- **@debugmcp/shared**: AdapterDependencies interface, DebugLanguage enum
- **@debugmcp/adapter-go**: GoAdapterFactory, GoDebugAdapter classes
- **vitest**: Testing framework with mocking capabilities
- **Node.js modules**: events, child_process, fs for system interaction

## Key Validation Logic
Environment validation checks Go >= 1.18, Delve presence, and DAP support. Mock implementations simulate various toolchain states to ensure robust error handling and requirement verification.