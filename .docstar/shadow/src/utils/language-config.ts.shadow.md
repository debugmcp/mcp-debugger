# src/utils/language-config.ts
@source-hash: 212e67099ac1af79
@generated: 2026-02-10T00:41:51Z

## Purpose
Utility module for runtime language adapter control through environment variable configuration. Enables selective disabling of language support in MCP (Model Context Protocol) systems for debugging purposes.

## Key Components

### Constants
- `DISABLE_ENV_KEY` (L5): Environment variable name `'DEBUG_MCP_DISABLE_LANGUAGES'` used to specify disabled languages

### Core Functions

**getDisabledLanguages(env?)** (L10-24)
- Parses comma-separated language list from environment variable
- Returns normalized `Set<string>` of lowercase, trimmed language identifiers
- Handles missing/empty environment variable gracefully (returns empty set)
- Accepts optional `env` parameter for testing (defaults to `process.env`)

**isLanguageDisabled(language, env?)** (L29-38)
- Boolean check for whether specific language is disabled
- Case-insensitive comparison (normalizes input to lowercase)
- Returns `false` for falsy language inputs
- Leverages `getDisabledLanguages()` for consistent parsing

## Architecture Patterns
- **Environment-driven configuration**: Uses environment variables for runtime behavior control
- **Testability**: Functions accept environment parameter overrides for unit testing
- **Defensive programming**: Handles edge cases (empty strings, missing env vars, falsy inputs)
- **Normalization**: Consistent lowercase conversion and whitespace trimming

## Usage Context
Primarily used in debugging scenarios where specific language adapters need to be disabled without code changes. The `DEBUG_MCP_` prefix suggests this is debugging infrastructure rather than production feature configuration.

## Dependencies
- Node.js `process.env` API
- No external dependencies