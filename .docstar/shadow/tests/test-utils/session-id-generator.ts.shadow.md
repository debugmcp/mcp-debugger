# tests/test-utils/session-id-generator.ts
@source-hash: 08c0b8adea108bbd
@generated: 2026-02-09T18:15:08Z

## Primary Purpose
Test utility module for generating unique session identifiers that help track resource leaks and identify problematic tests during test execution.

## Key Functions

### getTestSessionId (L11-30)
Generates unique session IDs with test name integration and collision prevention.
- **Input**: Optional test name string
- **Output**: Formatted session ID string
- **Format**: `session-{cleanName}-{timestamp}-{random}` or `session-unknown-{timestamp}-{random}`
- **Name sanitization**: Removes special characters, collapses multiple dashes, trims leading/trailing dashes, limits to 30 chars (L19-23)
- **Uniqueness**: Combines millisecond timestamp with 3-character base36 random suffix (L26-27)

### getTestNameFromSessionId (L37-43)
Reverse parser to extract test names from session IDs for debugging purposes.
- **Input**: Session ID string
- **Output**: Test name string or null if invalid format
- **Pattern matching**: Uses regex to validate session ID format and extract name portion (L38)
- **Name restoration**: Converts dashes back to spaces for readability (L40)

## Architecture Patterns
- **Bidirectional transformation**: Name → session ID → name roundtrip capability
- **Defensive fallback**: Handles missing test names gracefully with "unknown" prefix
- **Collision resistance**: Multi-layer uniqueness (timestamp + random + test context)

## Dependencies
- No external dependencies, uses only built-in JavaScript APIs (Date, Math, String methods)

## Critical Constraints
- Session ID format must match regex pattern `^session-([^-]+(?:-[^-]+)*)-\d+-[a-z0-9]+$` for proper parsing
- Test name length restricted to 30 characters after sanitization
- Random suffix limited to 3 characters for brevity while maintaining reasonable collision resistance