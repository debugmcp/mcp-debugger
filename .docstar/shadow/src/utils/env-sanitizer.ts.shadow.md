# src\utils\env-sanitizer.ts
@source-hash: 5abd16b1e57a4dd7
@generated: 2026-02-24T01:54:05Z

Security utility for sanitizing sensitive environment variables from logs and error outputs.

## Core Functions

**`sanitizeEnvForLogging(env)` (L24-34)**: Redacts sensitive environment variable values by matching keys against predefined patterns. Returns a shallow copy with sensitive values replaced by '[REDACTED]'.

**`sanitizePayloadForLogging(payload)` (L40-55)**: Deep-sanitizes complex objects, specifically targeting `adapterCommand.env` fields in proxy init payloads. Preserves object structure while sanitizing nested environment variable collections.

**`sanitizeStderr(lines)` (L66-72)**: Filters stderr output lines to redact any that match sensitive environment variable assignment patterns (e.g., `API_KEY=value` or JSON-style assignments).

## Key Components

**`SENSITIVE_PATTERNS` (L8-19)**: Array of regex patterns detecting common sensitive environment variable naming conventions including API keys, tokens, passwords, credentials, and authentication-related variables.

**`STDERR_SENSITIVE_LINE` (L61)**: Regex pattern for detecting sensitive data in stderr output, matching assignment operators and JSON-style key-value patterns.

## Architecture Notes

- Pattern-based detection relies on common naming conventions rather than exhaustive enumeration
- Functions return new objects/arrays rather than mutating inputs
- Designed for MCP (Model Context Protocol) tool environments where process environments may contain secrets
- Handles both flat environment objects and nested payload structures