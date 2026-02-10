# src/utils/type-guards.ts
@source-hash: 672866784577006e
@generated: 2026-02-09T18:15:07Z

**Primary Purpose & Responsibility**
Runtime type validation and safety utilities for DAP adapter commands and proxy initialization payloads. Ensures type safety at critical system boundaries (IPC, serialization, process spawning) by providing comprehensive validation guards and safe serialization functions.

**Core Dependencies**
- `AdapterCommand` from `@debugmcp/shared` - Primary type being validated
- `ProxyInitPayload` from `../proxy/dap-proxy-interfaces.js` - DAP proxy initialization structure

**Key Functions & Their Roles**

**Type Guards (L13-86)**
- `isValidAdapterCommand(obj: unknown): obj is AdapterCommand` (L13-49) - Core type guard validating AdapterCommand structure: required `command` (string), `args` (string[]), optional `env` (Record<string, string>)
- `hasValidAdapterCommand(payload: ProxyInitPayload): boolean` (L80-86) - Validates optional adapterCommand field in ProxyInitPayload

**Validation Functions (L55-123)**
- `validateAdapterCommand(obj: unknown, source: string): AdapterCommand` (L55-74) - Throws descriptive errors with validation details if type guard fails
- `validateProxyInitPayload(payload: unknown): ProxyInitPayload` (L92-123) - Validates required fields: cmd, sessionId, executablePath, adapterHost, adapterPort, logDir, scriptPath; validates optional adapterCommand and launchConfig

**Serialization Safety (L129-148)**
- `serializeAdapterCommand(cmd: AdapterCommand): string` (L129-132) - Pre-validates before JSON serialization
- `deserializeAdapterCommand(data: string, source: string): AdapterCommand` (L138-148) - Post-validates after JSON parsing with error handling

**Creation & Access Utilities (L154-188)**
- `createAdapterCommand(command: string, args?: string[], env?: Record<string, string>): AdapterCommand` (L154-171) - Factory function with validation ensuring all required fields present
- `getAdapterCommandProperty<K>(cmd: unknown, property: K, defaultValue: AdapterCommand[K]): AdapterCommand[K]` (L177-188) - Type-safe property access with fallback defaults

**Logging Utility (L194-213)**
- `logAdapterCommandValidation(cmd: unknown, source: string, isValid: boolean, details?: unknown): void` (L194-213) - Consistent validation logging with timestamps and structured output

**Architectural Patterns**
- Defensive programming with exhaustive null/undefined checks
- Source tracking for debugging (all validation functions accept source parameter)
- Consistent error formatting with structured details
- Type narrowing through progressive validation
- Fail-fast validation with descriptive error messages

**Critical Invariants**
- AdapterCommand must have non-empty string `command` and string[] `args`
- Environment variables must be string-to-string mappings
- All validation failures include source context for debugging
- Serialization is always preceded by validation
- Property access defaults prevent undefined propagation