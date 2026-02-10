# tests/test-utils/mocks/mock-command-finder.ts
@source-hash: 8985139ac91c4714
@generated: 2026-02-10T00:41:29Z

## Purpose
Mock implementation of CommandFinder interface for testing command resolution behavior without actual filesystem lookups. Provides controllable responses and call tracking for unit tests.

## Core Class
**MockCommandFinder (L10-72)** - Test double that implements CommandFinder interface
- Maintains pre-configured command-to-path mappings via responses Map (L11)
- Tracks command lookup history in callHistory array (L12)
- Enables deterministic testing of command resolution scenarios

## Key Methods
**setResponse(command, response) (L19-21)** - Configure mock behavior by mapping command names to either file paths (strings) or Error instances

**find(command) (L29-43)** - Core interface method that:
- Records command in call history (L30)
- Returns pre-configured response if exists
- Throws CommandNotFoundError if no response configured (L35)
- Throws configured Error instance if response is Error type (L38-40)

**Test Utilities:**
- clearResponses() (L48-50) - Reset response mappings
- getCallHistory() (L55-57) - Retrieve copy of command lookup history
- clearHistory() (L62-64) - Reset call tracking
- reset() (L69-72) - Complete cleanup of both responses and history

## Dependencies
- Imports CommandFinder interface and CommandNotFoundError from '@debugmcp/adapter-python' (L4-5)
- Uses TypeScript strict typing throughout

## Test Design Patterns
- Follows test double pattern with configurable behavior
- Provides both positive (return path) and negative (throw error) test scenarios
- Includes verification capabilities via call history tracking
- Immutable history access via array copy in getCallHistory()

## Key Invariants
- All find() calls are recorded regardless of success/failure
- Unconfigured commands always throw CommandNotFoundError
- Error responses are re-thrown as-is to preserve exception types