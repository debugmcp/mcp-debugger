# tests/test-utils/mocks/mock-command-finder.ts
@source-hash: 8985139ac91c4714
@generated: 2026-02-09T18:14:38Z

**Mock implementation of CommandFinder for testing command path resolution**

This file provides a mock implementation of the `CommandFinder` interface from `@debugmcp/adapter-python`, designed for unit testing scenarios where command path resolution needs to be controlled and predictable.

## Primary Class

**MockCommandFinder (L10-72)** - Test double implementing the `CommandFinder` interface
- **Purpose**: Provides controllable, deterministic command path resolution for testing
- **State Management**: 
  - `responses` Map (L11): Stores command→path/error mappings for mocking behavior
  - `callHistory` array (L12): Tracks all command lookup attempts for verification

## Key Methods

**setResponse(command, response) (L19-21)** - Configures mock behavior
- Sets expected return value (string path) or error for a specific command
- Enables test scenarios for both success and failure cases

**find(command) (L29-43)** - Core mocked functionality
- Records command in call history for test verification
- Returns configured response or throws `CommandNotFoundError` if unmocked
- Supports throwing custom Error instances for error testing scenarios

**Test Utilities**:
- `clearResponses()` (L48-50): Resets mock configurations
- `getCallHistory()` (L55-57): Returns copy of command lookup history for assertions
- `clearHistory()` (L62-64): Resets call tracking
- `reset()` (L69-72): Full cleanup of both responses and history

## Dependencies
- Implements `CommandFinder` interface from `@debugmcp/adapter-python`
- Uses `CommandNotFoundError` for consistent error handling

## Testing Patterns
- **Behavior Verification**: Call history tracking enables verification of which commands were looked up
- **Response Control**: Pre-configured responses allow testing both success and error paths
- **Isolation**: Reset capabilities ensure test independence