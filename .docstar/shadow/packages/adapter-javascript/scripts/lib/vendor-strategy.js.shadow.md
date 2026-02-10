# packages/adapter-javascript/scripts/lib/vendor-strategy.js
@source-hash: d90cc98474b10b06
@generated: 2026-02-09T18:13:52Z

**Primary Purpose**: Environment-based vendoring strategy determination for JavaScript adapter build system. Provides pure functions to parse environment variables and determine how dependencies should be sourced (local development, build-from-source, or prebuilt artifacts).

**Key Functions**:
- `parseEnvBool(v)` (L18-20): Utility function that coerces any value to boolean, only returning true for case-insensitive string "true"
- `determineVendoringPlan(env)` (L34-43): Core strategy function that returns vendoring mode objects based on environment variable precedence

**Vendoring Strategy Logic** (L34-43):
1. **Local mode**: Returns `{ mode: 'local', localPath: string }` when `JS_DEBUG_LOCAL_PATH` is non-empty
2. **Prebuilt-then-source mode**: Returns `{ mode: 'prebuilt-then-source' }` when `JS_DEBUG_BUILD_FROM_SOURCE=true`  
3. **Prebuilt-only mode**: Returns `{ mode: 'prebuilt-only' }` as default fallback

**Environment Variables**:
- `JS_DEBUG_LOCAL_PATH`: Highest priority - enables local development mode with specified path
- `JS_DEBUG_BUILD_FROM_SOURCE`: Secondary priority - enables source building when "true"
- `JS_DEBUG_FORCE_REBUILD`: Referenced in comments but handled by calling scripts (L28-29)

**Architecture Notes**:
- ESM module with side-effect free exports
- Safe process.env access with fallback for non-Node environments (L34)
- Deterministic behavior with explicit precedence ordering
- Type annotations support both NodeJS.ProcessEnv and generic Record types (L31-32)

**Dependencies**: None - pure utility functions with defensive coding for environment access.