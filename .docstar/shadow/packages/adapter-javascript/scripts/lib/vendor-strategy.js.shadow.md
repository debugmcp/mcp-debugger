# packages/adapter-javascript/scripts/lib/vendor-strategy.js
@source-hash: d90cc98474b10b06
@generated: 2026-02-10T00:41:05Z

## Primary Purpose
Utility module for determining vendoring strategies based on environment variables. Provides side-effect-free ESM functions to parse boolean environment values and determine how dependencies should be vendored (local development, build from source, or use prebuilt artifacts).

## Key Functions

### `parseEnvBool(v)` (L18-20)
- **Purpose**: Converts environment variable-like values to boolean
- **Logic**: Only returns `true` for case-insensitive string "true", all other values return `false`
- **Input**: `unknown` type (designed for env var flexibility)
- **Usage**: Helper for parsing boolean environment flags

### `determineVendoringPlan(env)` (L34-43)
- **Purpose**: Central strategy selector that returns vendoring plan based on environment variables
- **Parameters**: `env` object (defaults to `process.env` with safe fallback for non-Node environments)
- **Return Types**:
  - `{ mode: 'local', localPath: string }` - when `JS_DEBUG_LOCAL_PATH` is set (L36-38)
  - `{ mode: 'prebuilt-then-source' }` - when `JS_DEBUG_BUILD_FROM_SOURCE=true` (L39-41) 
  - `{ mode: 'prebuilt-only' }` - default fallback (L42)

## Environment Variables
- **`JS_DEBUG_LOCAL_PATH`**: Triggers local development mode with specified path
- **`JS_DEBUG_BUILD_FROM_SOURCE`**: When "true", enables source building fallback
- **`JS_DEBUG_FORCE_REBUILD`**: Referenced in comments but handled by calling scripts

## Architectural Decisions
- **Side-effect free**: Pure functions with no global state modifications
- **Environment-agnostic**: Safe fallback for non-Node environments (L34)
- **Deterministic**: External concerns (force rebuild, artifact existence) delegated to callers
- **Type-safe returns**: Union types clearly differentiate vendoring modes

## Dependencies
- No external dependencies
- Uses built-in `String()` and string methods only