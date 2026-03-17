# Osoji Improvement Brief — Two Proposals from mcp-debugger Audit

**Project audited**: mcp-debugger v0.18.0 (MCP debug server, TypeScript monorepo)
**Audit date**: March 2026
**Findings**: 1,343 total (271 errors, 304 warnings, 768 infos)
**False positive rate (sampled)**: ~44%

This brief identifies two systematic false-positive patterns observed during triage
of the mcp-debugger audit. Each proposal includes root cause analysis, a concrete
fix suggestion, and real-world examples from the audit.

---

## Proposal 1: Scoped Package Handling in Dead Dependency Detection

### Problem

`@modelcontextprotocol/sdk` was flagged as a dead dependency despite being imported
in 5+ source files. The package is the foundation of the entire MCP server.

**Flagged finding**:
```
category: dead_dependency
path: package.json
message: "@modelcontextprotocol/sdk appears unused"
```

**Actual imports** (confirmed by grep):
| File | Import |
|------|--------|
| `src/server.ts` | `import { Server } from '@modelcontextprotocol/sdk/server/index.js'` |
| `src/cli/stdio-command.ts` | `import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'` |
| `src/cli/sse-command.ts` | `import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'` |
| `src/errors/debug-errors.ts` | `import { McpError } from '@modelcontextprotocol/sdk/types.js'` |
| `src/server.ts` | `import { CallToolRequestSchema, ... } from '@modelcontextprotocol/sdk/types.js'` |

### Root Cause

In osoji's `junk_deps.py` (around line 575), import scanning uses a `\b` word-boundary
regex to match dependency names against import statements. The `@` character in scoped
npm packages (`@org/package`) sits at a word boundary, causing the regex to fail to
match the full scoped package name.

Additionally, `_resolve_import_names_heuristic()` (around line 119) generates candidate
import strings from the dependency name but does not account for npm's scoped package
conventions where:
- `@modelcontextprotocol/sdk` can be imported as `@modelcontextprotocol/sdk`
- Subpath imports use `@modelcontextprotocol/sdk/server/index.js`
- The `@` prefix is part of the package identity, not a word boundary

### Suggested Fix

**Option A** (regex fix): In `scan_imports()`, replace the `\b`-based pattern with one
that handles `@`-prefixed scoped packages:

```python
# Before:
pattern = rf'\b{re.escape(dep_name)}\b'

# After: anchor on non-alphanumeric chars or string boundaries, not \b
# This handles @org/pkg where @ is at a word boundary
pattern = rf'(?:^|[\'\"\/\s])({re.escape(dep_name)}(?:/[^\s\'\"]*)?)'
```

**Option B** (heuristic fix): In `_resolve_import_names_heuristic()`, when the
dependency name starts with `@`, also generate the bare scope + package name as a
candidate (e.g., `@modelcontextprotocol/sdk` → also try `modelcontextprotocol/sdk`
and the full `@modelcontextprotocol/sdk/...` subpath pattern).

### Impact

Every npm project using scoped packages (`@org/package`) is affected. This is
extremely common — `@types/*`, `@babel/*`, `@modelcontextprotocol/*`, `@vscode/*`,
`@debugmcp/*` are all scoped packages. In the mcp-debugger audit, at least 4 scoped
dependencies were flagged as dead despite being actively used.

---

## Proposal 2: Runtime String Contract Awareness

### Problem

Adapter policy files that check strings produced by external debug runtimes were
flagged as `obligation_violation` because the checked strings did not appear in
project documentation or shadow docs. These are protocol-level string constants
defined by external systems (debugpy, js-debug, JDI), not project-internal magic
strings.

**Example findings**:

| File | String | Runtime source |
|------|--------|---------------|
| `packages/adapter-python/src/policies/python-adapter-policy.ts` | `"function variables"` | debugpy scope naming convention |
| `packages/adapter-javascript/src/policies/js-debug-adapter-policy.ts` | `"prototype"` | V8/js-debug object classification |
| `packages/adapter-java/src/policies/java-adapter-policy.ts` | `"jdidapserver"` | JDI bridge process identifier |

These strings are intentional: adapter policies exist specifically to handle
runtime-specific behavior, and the string comparisons implement the Debug Adapter
Protocol's language-specific contracts.

### Root Cause

In osoji's `obligations.py`, the function `_should_ignore_checked_occurrence()`
(around line 391) has no mechanism to recognize files whose primary purpose is to
handle strings from external runtimes. The obligation checker treats all uncovered
string literals equally, regardless of whether:

1. The file is classified as an "adapter" or "policy" file
2. The strings originate from an external protocol (DAP)
3. The file's `FileFacts.classification` or `topics` already indicate runtime
   integration work

### Suggested Fix

Leverage osoji's existing `FactsDB` infrastructure:

1. **Use `FileFacts.classification` and `topics`**: Files classified as
   `adapter`, `policy`, `protocol-handler`, or with topics like `dap`,
   `debug-adapter-protocol` should get relaxed obligation checking for
   string literals.

2. **Add shadow-doc-aware filtering**: Use `FactsDB.docs_referencing()`
   (facts.py line 174) to check if a string literal in a policy file is
   documented by the referenced protocol specification (e.g.,
   `debugAdapterProtocol.json` in the project's `docs/` directory).

3. **Introduce an `external_protocol_strings` annotation**: Allow fact
   extraction to tag string literals in policy files as
   `source: external_runtime`, which the obligation checker can then skip.

```python
# In _should_ignore_checked_occurrence():
def _should_ignore_checked_occurrence(self, file_path, literal, facts_db):
    file_facts = facts_db.get_file_facts(file_path)

    # NEW: Skip obligation checks for protocol/adapter policy files
    if file_facts and file_facts.classification in ('adapter_policy', 'protocol_handler'):
        return True

    # NEW: Skip if string is documented in a referenced protocol spec
    if facts_db.docs_referencing(literal):
        return True

    # ... existing logic ...
```

### Impact

Any project with adapter/plugin/driver patterns that handle strings from external
systems will see false positives from obligation checking. This is common in:
- Language server protocol (LSP) implementations
- Debug adapter protocol (DAP) implementations
- Database driver code checking SQL dialect strings
- API clients checking HTTP status text or error codes

---

## Summary

| # | Proposal | FP category | Estimated FPs eliminated | Effort |
|---|----------|-------------|--------------------------|--------|
| 1 | Scoped package handling | `dead_dependency` | 4 in mcp-debugger; widespread in npm ecosystem | Low (regex fix) |
| 2 | Runtime string awareness | `obligation_violation` | 10 in mcp-debugger; widespread in adapter patterns | Medium (facts integration) |

Both proposals leverage existing osoji infrastructure (regex patterns, FactsDB,
FileFacts classification) and would reduce false positives across a wide range of
projects beyond mcp-debugger.
