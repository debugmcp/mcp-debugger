# tests/test-utils/session-id-generator.ts
@source-hash: 08c0b8adea108bbd
@generated: 2026-02-10T00:41:55Z

## Purpose
Test utility module for generating unique session IDs that help track test execution and identify resource/promise leaks in test environments.

## Key Functions

### `getTestSessionId(testName?: string)` (L11-30)
- **Purpose**: Generates unique session IDs for test identification
- **Input**: Optional test name string
- **Output**: Formatted session ID string
- **Logic**:
  - Fallback mode (L12-15): Returns `session-unknown-{timestamp}-{random}` when no test name provided
  - Name cleaning (L19-23): Sanitizes test name by removing special chars, collapsing dashes, trimming, and limiting to 30 chars
  - ID composition (L26-29): Combines `session-{cleanName}-{timestamp}-{random}` format
- **Uniqueness**: Uses `Date.now()` timestamp + 3-char random base36 suffix

### `getTestNameFromSessionId(sessionId: string)` (L37-43)
- **Purpose**: Reverse-parses session IDs to extract original test names for debugging
- **Input**: Session ID string to parse
- **Output**: Test name string or null if invalid format
- **Logic**: Uses regex `/^session-([^-]+(?:-[^-]+)*)-\d+-[a-z0-9]+$/` to match expected format and converts dashes back to spaces

## Architecture Patterns
- **Bidirectional encoding**: Clean encoding with reversible parsing
- **Defensive design**: Graceful fallback for missing test names
- **Collision avoidance**: Multi-factor uniqueness (timestamp + randomness)

## Dependencies
- Standard JavaScript Date and Math APIs only
- No external dependencies

## Use Case
Primarily for test debugging and resource leak detection by providing traceable identifiers that can be correlated back to specific test cases.