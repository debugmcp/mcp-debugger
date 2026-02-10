# src/utils/type-guards.ts
@source-hash: 672866784577006e
@generated: 2026-02-10T00:41:54Z

## Purpose

Type guards and validation utilities ensuring runtime type safety at critical boundaries like IPC communication and data serialization. Validates `AdapterCommand` and `ProxyInitPayload` types with comprehensive error handling.

## Key Dependencies

- `AdapterCommand` from `@debugmcp/shared` - Core command structure
- `ProxyInitPayload` from `../proxy/dap-proxy-interfaces.js` - Proxy initialization data

## Core Functions

### Type Guards
- `isValidAdapterCommand(obj)` (L13-49): Validates AdapterCommand structure with required `command` (string) and `args` (string[]) fields, plus optional `env` (Record<string, string>)
- `hasValidAdapterCommand(payload)` (L80-86): Checks optional adapterCommand field in ProxyInitPayload

### Validation Functions
- `validateAdapterCommand(obj, source)` (L55-74): Throws descriptive errors with validation details and structured error logging
- `validateProxyInitPayload(payload)` (L92-123): Validates required fields ['cmd', 'sessionId', 'executablePath', 'adapterHost', 'adapterPort', 'logDir', 'scriptPath'] plus optional adapterCommand and launchConfig

### Serialization Utilities
- `serializeAdapterCommand(cmd)` (L129-132): Safe JSON serialization with pre-validation
- `deserializeAdapterCommand(data, source)` (L138-148): Safe JSON parsing with post-validation and error context

### Factory Functions
- `createAdapterCommand(command, args?, env?)` (L154-171): Type-safe command creation with validation
- `getAdapterCommandProperty(cmd, property, defaultValue)` (L177-188): Safe property access with fallback

### Logging
- `logAdapterCommandValidation(cmd, source, isValid, details?)` (L194-213): Consistent validation logging with timestamps

## Architectural Patterns

- **Defense in Depth**: Multiple validation layers (type guards → validators → serializers)
- **Rich Error Context**: All validation failures include source context, expected structure, and received values
- **Fail-Safe Defaults**: Graceful degradation with default values and warnings
- **Structured Logging**: Consistent error reporting format with timestamps and details

## Critical Invariants

- AdapterCommand requires non-empty string `command` and string array `args`
- Environment variables must be string-to-string mappings
- All validation failures log detailed error information
- Serialization/deserialization maintains type safety through validation