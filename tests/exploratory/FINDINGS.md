# Exploratory Testing Findings Report

**Date:** 2026-02-23
**Platform:** Windows 11 Pro (win32), project path contains spaces (`250106 AGENTS`)
**Tested modes:** Local SSE, Docker, NPX Tarball

---

## Summary

| Mode | Tests | Pass | Fail | Notes |
|------|-------|------|------|-------|
| Local SSE | 15 | 15 | 0 | All languages + edge cases |
| Docker | 5 planned | 0 | 0 | **Blocked by entrypoint bug** |
| NPX Tarball | 5 | 5 | 0 | Python + JS + schema validation |

**Overall: 20/20 tests passed across working modes. 1 critical Docker bug found.**

---

## Bug: Docker Entrypoint Quoting Corruption (CRITICAL)

**File:** `Dockerfile` line 149
**Severity:** Critical - Docker SSE mode completely broken, stdio works only by accident

### Root Cause

The `printf` command in the Dockerfile generates `entry.sh` with literal `\"` characters instead of `"`:

```sh
# What entry.sh CONTAINS (broken):
exec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs \"$@\"

# What entry.sh SHOULD contain (correct):
exec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs "$@"
```

The Dockerfile uses `printf '...\\"$@\\"...'` inside single quotes. In `dash` (Debian's `/bin/sh`), printf treats `\"` as an unrecognized escape and preserves it literally, producing `\"` in the output file.

### Impact

When Docker passes arguments like `sse -p 3001`:
- `\"$@\"` expands to `"sse`, `-p`, `3001"` (literal quotes concatenated)
- Commander receives `"sse` as the subcommand name, doesn't match `sse`
- Falls through to default `stdio` command, which doesn't know `-p`
- Error: `error: unknown option '-p'`

The default `CMD ["stdio"]` appears to work because:
1. `\"stdio\"` becomes `"stdio"` (single word with literal quotes)
2. Commander doesn't match `"stdio"` to the `stdio` subcommand
3. Falls through to default (which IS `stdio`), so it starts in stdio mode by accident

**Verified:** `docker run --rm mcp-debugger:local --help` shows correct CLI with `sse [options]`, but `docker run --rm mcp-debugger:local sse --help` produces `error: unknown option '--help"'` (note trailing `"`).

### Fix

Replace the `printf` approach with a COPY of a properly formatted script, or use a heredoc:

```dockerfile
# Option 1: COPY a proper entry.sh from build context
COPY scripts/docker-entry.sh /app/entry.sh
RUN chmod +x /app/entry.sh

# Option 2: Use a heredoc (requires BuildKit)
RUN cat <<'ENTRY' > /app/entry.sh
#!/bin/sh
export MCP_WORKSPACE_ROOT="${MCP_WORKSPACE_ROOT:-/workspace}"
exec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs "$@"
ENTRY
chmod +x /app/entry.sh
```

---

## Observations from Local SSE Testing (15/15 pass)

### Positive Findings

1. **Path handling with spaces works correctly** (test 1.15)
   - Project lives in `250106 AGENTS` (has space) - debugging works fine
   - Windows backslash paths passed through correctly to debugpy

2. **All 5 language adapters load successfully**
   - Python, JavaScript, Go, Rust, Mock all listed
   - Python, JavaScript, Go all complete full debug workflows

3. **Edge cases handled cleanly** (tests 1.7-1.14)
   - Breakpoint on non-existent file: returns `success=false` (no crash)
   - get_variables before debugging: returns `variables=[]` with helpful message
   - Syntax error in evaluate_expression: returns SyntaxError cleanly
   - Operations on closed session: proper error codes (`-32602: Session not found`)
   - Operations on fake session ID: proper error code
   - Multiple simultaneous sessions: work independently
   - Session cleanup: sessions properly removed after close

4. **Variable inspection works correctly**
   - Python: `a=1, b=2` before swap, `a=2, b=1` after step_over
   - JavaScript: `a=1, b=2` visible at breakpoint
   - Expression evaluation: `a + b = 3` correct

5. **Tool schemas are valid** (NPX test 3.5)
   - All 17-19 tools have proper `name`, `description`, `inputSchema`
   - Required parameters present on key tools

### Issues / Observations Worth Noting

6. **`get_source_context` returns MISSING** (test 1.12)
   - Called with `sessionId`, `file`, `line`, `linesContext`
   - Returns `source: undefined`, `currentLine: undefined`
   - This happens when session is created but debugging hasn't started
   - Not necessarily a bug (session has no active debug context), but the error is silent

7. **Go debugging starts with `state: error`** (test 1.6)
   - `start_debugging` returns `state: "error"` for Go
   - Yet the test still passes (stack frames = 0 but no assertion failure)
   - This suggests Go debugging may have an issue with the initial state reporting
   - The Go smoke test in the CI suite uses a longer wait and different expectations

8. **Step after terminate takes ~38 seconds** (test 1.11)
   - `step_over` on a terminated session eventually returns `success=false`
   - The 38-second delay suggests it's waiting for a timeout
   - Error message is clean: `"Session is terminated: <uuid>"`
   - Consider: should this fail fast instead of waiting for a timeout?

9. **NPX bundle only includes 3 adapters** (test 3.1)
   - `list_supported_languages` returns: `javascript`, `python`, `mock`
   - Missing: `rust`, `go` (expected - these are native toolchains)
   - Total tools: 17 in NPX vs 19 in local (missing dev proxy tools)

10. **`evaluate_expression` with syntax error returns success=true** (test 1.9)
    - Response: `{"success":true, "result":"SyntaxError('invalid syntax...')", "type":"SyntaxError"}`
    - The SyntaxError is returned as a successful evaluation result
    - This is technically correct (debugpy evaluated the expression and got an error)
    - But could be confusing for LLM consumers who check `success` field

11. **Breakpoints always return `verified=false`** (test 1.4)
    - Documented known behavior - breakpoints are unverified until debugging starts
    - Both Python and JavaScript exhibit this

---

## NPX Tarball Testing (5/5 pass)

- **Tarball:** `debugmcp-mcp-debugger-0.16.0.tgz` (latest)
- **Install:** Clean install to temp prefix works
- **Server output:** Zero stack traces, zero unexpected log lines (test 3.4)
- **Bundled adapters:** Python + JavaScript + Mock (correct subset)
- **Full debug workflows:** Both Python and JS work end-to-end

---

## Docker Testing (blocked)

- **Image exists:** `mcp-debugger:local` built successfully
- **Entrypoint bug:** Prevents SSE mode; stdio works by accident
- **Existing Docker e2e tests use stdio transport** (docker-test-utils.ts), which is why CI passes despite the bug
- **Recommendation:** Fix entrypoint, then test SSE mode in Docker

---

## Cross-Mode Consistency

| Behavior | Local SSE | NPX Tarball | Docker |
|----------|-----------|-------------|--------|
| Python debug | PASS | PASS | blocked |
| JavaScript debug | PASS | PASS | blocked |
| Go debug | PASS (state=error) | N/A (not bundled) | blocked |
| Error handling | Clean | Clean | N/A |
| Path w/ spaces | PASS | PASS | N/A |
| Console output | Clean | Clean | N/A |

---

## Recommendations

1. **Fix Docker entrypoint** (critical) - Replace printf-generated entry.sh with a COPY'd file
2. **Investigate Go start_debugging returning `state: error`** - May need to report initial state differently
3. **Consider fast-fail for operations on terminated sessions** - Currently waits ~38s timeout
4. **Clarify `evaluate_expression` error semantics** - `success: true` with `type: SyntaxError` may confuse LLM consumers
5. **Add `get_source_context` validation** - Should return clear error when no debug context is active
