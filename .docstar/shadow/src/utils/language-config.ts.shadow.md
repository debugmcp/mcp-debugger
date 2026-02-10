# src/utils/language-config.ts
@source-hash: 212e67099ac1af79
@generated: 2026-02-09T18:15:04Z

## Purpose
Configuration utilities for dynamically enabling/disabling language adapters in an MCP (Model Context Protocol) system based on environment variable flags. Provides runtime control over which language processors are active.

## Key Components

### Constants
- `DISABLE_ENV_KEY` (L5): Environment variable name `'DEBUG_MCP_DISABLE_LANGUAGES'` used to specify disabled languages

### Functions
- `getDisabledLanguages()` (L10-24): Parses comma-separated language names from environment variable into normalized Set. Handles whitespace trimming, lowercasing, and empty token filtering. Returns empty Set if env var not present.
- `isLanguageDisabled()` (L29-38): Checks if a specific language is disabled by consulting the parsed disabled languages set. Case-insensitive comparison, returns false for empty/falsy language names.

## Dependencies
- `NodeJS.ProcessEnv` type for environment access
- Default parameter uses `process.env`

## Key Patterns
- **Environment-driven configuration**: Uses environment variables for runtime behavior modification
- **Defensive parsing**: Handles malformed input (empty tokens, whitespace)
- **Case normalization**: All language names converted to lowercase for consistent matching
- **Testability**: Functions accept env parameter for dependency injection in tests

## Usage Flow
1. Environment variable contains comma-separated language names to disable
2. `getDisabledLanguages()` parses into normalized Set
3. `isLanguageDisabled()` checks membership for specific languages
4. Language adapters can query before activation

## Constraints
- Language names are case-insensitive (normalized to lowercase)
- Empty/whitespace-only language names are ignored
- Environment variable is optional (graceful degradation)