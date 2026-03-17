# Osoji Audit Triage — mcp-debugger

**Audit date**: March 2026
**Project version**: 0.18.0
**Triage date**: 2026-03-12

## Summary

| Metric | Count |
|--------|-------|
| Total findings (error+warning) | 575 |
| True positives | 367 |
| False positives | 86 |
| Downgraded to info | 99 |
| Already fixed (pre-triage) | 10 |
| Fixed during triage | 14 |
| Remaining (not-fixing/to-do) | ~353 |

**Overall false positive rate**: 15% (86/575)
**Overall true positive rate**: 64% (367/575)
**Downgrade rate**: 17% (99/575)

## Fixes Applied

### Pre-existing fixes (from initial sampling)

| # | File | Type | Fix |
|---|------|------|-----|
| 1 | `examples/README.md:29` | doc | "line 42" → "line 46" |
| 2 | `docs/architecture/api-reference.md:19` | doc | Path → `packages/shared/src/interfaces/debug-adapter.ts` |
| 3 | `docs/architecture/current-python-dependencies.md` | doc | Path → `packages/adapter-python/src/utils/python-utils.ts` (2 refs) |
| 4 | `docs/python_debugging_notes.md:9` | doc | `dap-proxy.ts` → split module references |
| 5 | `docs/architecture/js-debug-vendoring.md:1` | doc | "PROVISIONAL...in progress" → "IMPLEMENTED" |
| 6 | `docs/architecture/adapter-development-guide.md` | doc | Version 0.14.x/0.15.0 → 0.18.0 (3 refs) |
| 7 | `docs/patterns/event-management.md` | doc | Added design-intent disclaimer header |
| 8 | `examples/go/README.md:57` | doc | Added "memoized" to fibonacci implementation list |
| 9 | `packages/adapter-javascript/src/javascript-debug-adapter.ts:436-444` | code | Rewrote misleading async/deasync comment |
| 10 | `src/proxy/signal-debug.ts` | code | Deleted dead file (never imported) |
| 11 | `tests/test-utils/mocks/dap-client.ts:127-129` | code | Deleted dead `resetMockDapClient` export |

### New fixes from triage (latent bugs in production code)

| # | File | Type | Fix |
|---|------|------|-----|
| 12 | `src/session/session-manager-core.ts` (handleExited) | bug | Added `cleanupProxyEventHandlers()` call — was leaking listeners |
| 13 | `src/session/session-manager-core.ts` (handleError) | bug | Added `cleanupProxyEventHandlers()` call — was leaking listeners |
| 14 | `packages/adapter-go/src/go-debug-adapter.ts` (validateEnvironment) | bug | Was passing Delve path to `getGoVersion()`; now uses `findGoExecutable()` |
| 15 | `packages/adapter-python/src/python-debug-adapter.ts` (checkPythonVersion/checkDebugpyInstalled) | bug | Cache key mismatch: resolve uses `'default'`, lookup used resolved path; now tries both |

### Verification

- `npm run build` — passes
- `npm run test:unit` — 105 files, 1283 tests pass
- `grep signal-debug src/` — no dangling imports
- `grep resetMockDapClient` — no dangling imports

---

## Findings by Category

### doc_incorrect_content (230 findings)

**Verdict distribution**: 170 TP, 10 FP, 50 INFO

| # | File | Line | Sev | Verdict | Status | Note |
|---|------|------|-----|---------|--------|------|
| 1 | examples/go/README.md | — | error | TP | fixed | Go fibonacci has 3 impls, not 2 |
| 2 | examples/go/README.md | — | warning | FP | — | Doc correctly describes optional override |
| 3 | examples/go/README.md | — | warning | INFO | — | Minor: substitutePath is valid Delve config |
| 4 | examples/README.md | — | error | TP | fixed | Bug is at L46, not L42 |
| 5 | examples/visualizer/README.md | — | error | INFO | — | Visualizer files deleted in working tree |
| 6 | examples/visualizer/README.md | — | error | INFO | — | Visualizer files deleted in working tree |
| 7 | docs/rust-debugging-windows.md | — | error | TP | to-do | Uses heuristic scanning, not PE import tables |
| 8 | examples/visualizer/capture_guide.md | — | error | INFO | — | Visualizer files deleted in working tree |
| 9 | examples/visualizer/capture_guide.md | — | error | INFO | — | Visualizer files deleted in working tree |
| 10 | docs/validation-script.md | — | error | FP | — | npm run validate exists in package.json |
| 11 | docs/validation-script.md | — | error | TP | to-do | Doc overstates "catches uncommitted files" |
| 12 | docs/commit-workflow.md | — | error | FP | — | commit:fast script exists in package.json |
| 13 | docs/architecture/js-debug-vendoring.md | — | error | TP | to-do | Canonical output is .js, not .cjs |
| 14 | docs/architecture/js-debug-vendoring.md | — | warning | TP | to-do | Search is extraction-root-wide, not dirname |
| 15 | docs/architecture/js-debug-vendoring.md | — | warning | TP | to-do | Adapter uses port+host, doc omits host |
| 16 | docs/stack-trace-filtering.md | — | error | TP | to-do | Java also has stack-frame filtering |
| 17 | docs/stack-trace-filtering.md | — | warning | TP | to-do | Java policy has filterStackFrames |
| 18 | docs/windows-launcher-guide.md | — | error | INFO | — | Minor: doc is tutorial guidance, not spec |
| 19 | assets/README.md | — | error | TP | to-do | CLI only accepts paths, not sizes |
| 20 | docs/patterns/event-management.md | — | error | TP | to-do | Uses handleAutoContinue(), not this.continue() |
| 21 | docs/patterns/event-management.md | — | error | TP | to-do | Error cleanup is stop-state-guarded |
| 22 | docs/patterns/event-management.md | — | error | TP | to-do | Readiness also listens for terminated/exited/exit |
| 23 | docs/patterns/event-management.md | — | error | TP | to-do | stepOver subscribes to more events now |
| 24 | docs/patterns/event-management.md | — | warning | INFO | — | Test pattern description, minor mismatch |
| 25 | docs/rust-debugging.md | — | error | TP | to-do | cargo.target is binary name, not build mode |
| 26 | docs/rust-debugging.md | — | error | TP | to-do | Windows fallback uses explicit MSVC target |
| 27 | docs/rust-debugging.md | — | error | TP | to-do | Async snippet uses nested runtime incorrectly |
| 28 | docs/go/README.md | — | error | TP | to-do | Should use adapterLaunchConfig, not dapLaunchArgs |
| 29 | docs/ACT_LOCAL_CI_TESTING.md | — | warning | FP | — | act:* npm scripts exist in package.json |
| 30 | docs/ACT_LOCAL_CI_TESTING.md | — | warning | INFO | — | npm ci vs pnpm install is minor detail |
| 31 | docs/agent-debugging-guide.md | — | error | TP | to-do | handleAutoContinue throws, not functional |
| 32 | docs/agent-debugging-guide.md | — | error | TP | to-do | continueOnAttach not in launch contract |
| 33 | docs/agent-debugging-guide.md | — | warning | FP | — | Doc gives advice, frameId is optional |
| 34 | docs/javascript/typescript-source-map-investigation.md | — | warning | TP | to-do | Uses detectBinary, not detectTsRunners |
| 35 | docs/javascript/typescript-source-map-investigation.md | — | error | TP | to-do | TS now enables source maps and outFiles |
| 36 | docs/javascript/typescript-source-map-investigation.md | — | error | TP | to-do | Snippet shows which('tsx'), now detectBinary |
| 37 | docs/javascript/typescript-source-map-investigation.md | — | error | TP | to-do | Sample tsconfig omits several real settings |
| 38 | docs/javascript/architecture-diagram.md | — | error | TP | to-do | ChildSessionManager is in proxy layer |
| 39 | docs/javascript/architecture-diagram.md | — | error | TP | to-do | "state synchronization" overstates role |
| 40 | docs/vitest-llm-config.md | — | error | TP | to-do | Config has no onConsoleLog/fileParallelism |
| 41 | docs/vitest-llm-config.md | — | error | TP | to-do | Wrong setup file reference |
| 42 | docs/vitest-llm-config.md | — | error | TP | to-do | show-failures.js streams all output live |
| 43 | docs/vitest-llm-config.md | — | error | TP | to-do | test-summary.js also prints file paths+hints |
| 44 | docs/python_debugging_notes.md | — | error | TP | to-do | Fixture has distinct sample_function frame |
| 45 | docs/docker-support.md | — | warning | TP | to-do | Script is at scripts/docker-build.sh |
| 46 | docs/docker-support.md | — | warning | TP | to-do | Container pre-registers rust adapter |
| 47 | docs/architecture/component-design.md | — | warning | TP | to-do | session-manager.ts is thin facade now |
| 48 | docs/architecture/component-design.md | — | error | TP | to-do | API surface inherited from Operations class |
| 49 | docs/architecture/component-design.md | — | error | TP | to-do | handleAutoContinue throws, not implemented |
| 50 | docs/architecture/component-design.md | — | warning | TP | to-do | Worker uses validateProxyInitPayload now |
| 51 | docs/architecture/component-design.md | — | error | TP | to-do | Proxy script lookup changed, no .cjs fallback |
| 52 | docs/architecture/component-design.md | — | warning | TP | to-do | IDependencies is small bag; richer in container |
| 53 | docs/getting-started.md | — | error | TP | to-do | L21 is inside fibonacci_iterative (L19-28) |
| 54 | docs/architecture/mock-adapter-design.md | — | error | TP | to-do | State machine more permissive than documented |
| 55 | docs/architecture/mock-adapter-design.md | — | error | TP | to-do | Step methods not on MockDebugAdapter |
| 56 | docs/architecture/mock-adapter-design.md | — | error | TP | to-do | Enum only has NONE/EXECUTABLE_NOT_FOUND/CONNECTION_TIMEOUT |
| 57 | docs/architecture/mock-adapter-design.md | — | warning | TP | to-do | Config only has connectionDelay/supportedFeatures/errorScenarios |
| 58 | docs/architecture/mock-adapter-design.md | — | error | TP | to-do | Process also accepts --host flag |
| 59 | docs/architecture/mock-adapter-design.md | — | error | TP | to-do | Default is stdio, TCP is conditional |
| 60 | docs/architecture/mock-adapter-design.md | — | warning | TP | to-do | createSession uses positional args |
| 61 | docs/architecture/mock-adapter-design.md | — | warning | TP | to-do | startDebugging arg order is wrong |
| 62 | docs/ai-integration.md | — | error | TP | to-do | handleAutoContinue throws, not functional |
| 63 | docs/java/README.md | — | warning | TP | to-do | Default host is localhost, not 127.0.0.1 |
| 64 | docs/javascript/README.md | — | error | TP | to-do | autoAttachChildProcesses is false by default |
| 65 | docs/javascript/README.md | — | warning | INFO | — | TS detection nuance, doc is simplification |
| 66 | docs/javascript/README.md | — | error | INFO | — | Omitting some examples is minor |
| 67 | assets/screenshots/README.md | — | error | INFO | — | Line numbers in screenshot READMEs are fragile |
| 68 | docs/tool-reference.md | — | error | TP | to-do | Multiple languages supported, not just Python |
| 69 | docs/tool-reference.md | — | error | TP | to-do | Default name is session-{8chars} not Debug-{timestamp} |
| 70 | docs/tool-reference.md | — | warning | TP | to-do | pause_execution is registered, mock supports it |
| 71 | docs/tool-reference.md | — | error | TP | to-do | evaluate_expression is implemented |
| 72 | docs/tool-reference.md | — | warning | TP | to-do | Path should be examples/javascript/ |
| 73 | docs/python/README.md | — | error | TP | to-do | get_variables needs variablesReference, not scope name |
| 74 | docs/vitest-llm-optimization.md | — | error | TP | to-do | Routes to test:coverage with TAP reporter |
| 75 | docs/vitest-llm-optimization.md | — | error | TP | to-do | test:int maps to test:integration |
| 76 | docs/vitest-llm-optimization.md | — | error | TP | to-do | Only adds --progress=plain when not present |
| 77 | packages/mcp-debugger/README.md | — | error | TP | to-do | JS and Go also bundled, not just Python+Mock |
| 78 | packages/mcp-debugger/README.md | — | error | TP | to-do | check-rust-binary command undocumented |
| 79 | packages/adapter-javascript/docs/README.md | — | error | FP | — | Named export is the loader contract |
| 80 | packages/adapter-javascript/docs/README.md | — | error | INFO | — | .js only check is a minor impl detail |
| 81 | packages/adapter-javascript/docs/README.md | — | error | TP | to-do | Adapter uses TCP, not --stdio |
| 82 | packages/adapter-javascript/docs/README.md | — | error | TP | to-do | Vendored output includes sidecars |
| 83 | packages/adapter-javascript/docs/README.md | — | warning | INFO | — | Single type file is a minor omission |
| 84 | packages/adapter-javascript/docs/README.md | — | error | TP | to-do | 6 languages including Java, not 5 |
| 85 | docs/logging-format-specification.md | — | error | TP | to-do | Multiple log files exist, not just one |
| 86 | docs/logging-format-specification.md | — | error | TP | to-do | Duplicate timestamp key is invalid JSON |
| 87 | packages/adapter-javascript/docs/LESSONS_LEARNED.md | — | error | TP | to-do | Command now includes host argument |
| 88 | packages/adapter-javascript/docs/LESSONS_LEARNED.md | — | error | INFO | — | Adapter still defaults to 127.0.0.1 |
| 89 | packages/adapter-javascript/docs/LESSONS_LEARNED.md | — | error | INFO | — | Historical lesson, file ref may be stale |
| 90 | docs/development/testing-guide.md | — | error | TP | to-do | Correct path is tests/test-utils/helpers/ |
| 91 | docs/development/testing-guide.md | — | warning | TP | to-do | Fixture path and exports changed |
| 92 | docs/development/testing-guide.md | — | error | TP | to-do | Integration test is now MCP black-box |
| 93 | docs/development/testing-guide.md | — | error | TP | to-do | No coverage thresholds in vitest config |
| 94 | docs/development/testing-guide.md | — | warning | INFO | — | Test org is approximate, not strict mirror |
| 95 | docs/patterns/dependency-injection.md | — | error | TP | to-do | ProxyManager constructor has 4 params |
| 96 | docs/patterns/dependency-injection.md | — | error | TP | to-do | Missing environment and adapterRegistry |
| 97 | docs/architecture/current-python-dependencies.md | — | error | TP | to-do | session-manager.ts is thin facade now |
| 98 | docs/architecture/current-python-dependencies.md | — | error | TP | to-do | Server supports dynamic multi-language |
| 99 | docs/architecture/current-python-dependencies.md | — | error | TP | to-do | File renamed to dap-proxy-adapter-manager.ts |
| 100 | docs/architecture/current-python-dependencies.md | — | error | TP | to-do | ProxyConfig is in proxy-config.ts, executablePath optional |
| 101 | docs/architecture/current-python-dependencies.md | — | warning | INFO | — | Python env vars are adapter-internal |
| 102 | docs/release-checklist.md | — | error | TP | to-do | Dry-run misses adapter-go and adapter-java |
| 103 | docs/release-checklist.md | — | error | TP | to-do | Pack only checks 4 packages, not all |
| 104 | docs/quickstart.md | — | error | TP | to-do | Requires Node 18+, not 16+ |
| 105 | docs/quickstart.md | — | error | TP | to-do | Missing stdio subcommand |
| 106 | docs/quickstart.md | — | error | TP | to-do | --log-level/--log-file are on stdio subcommand |
| 107 | docs/quickstart.md | — | error | TP | to-do | Package is @debugmcp/mcp-debugger |
| 108 | docs/quickstart.md | — | error | TP | to-do | CLI binary is dist/cli, not dist/index.js |
| 109 | docs/quickstart.md | — | warning | TP | to-do | Same dist/cli vs dist/index.js issue |
| 110 | docs/quickstart.md | — | error | INFO | — | Minor: variable availability at breakpoint |
| 111 | docs/development/dap-sequence-reference.md | — | error | FP | — | SessionState is legacy but still used |
| 112 | docs/development/dap-sequence-reference.md | — | error | INFO | — | STOPPED vs TERMINATED naming is nuanced |
| 113 | docs/development/dap-sequence-reference.md | — | warning | FP | — | ExecutionState.TERMINATED exists in enum |
| 114 | docs/architecture/adapter-development-guide.md | — | error | TP | to-do | Loader uses named export, not default |
| 115 | docs/architecture/adapter-development-guide.md | — | error | TP | to-do | Sample code would not compile |
| 116 | docs/architecture/adapter-development-guide.md | — | warning | TP | to-do | Should use language field, not name |
| 117 | docs/architecture/adapter-development-guide.md | — | warning | TP | to-do | language must be DebugLanguage, not arbitrary |
| 118 | Roadmap.md | — | error | TP | to-do | Java adapter package still exists |
| 119 | packages/shared/README.md | — | error | TP | to-do | No type-check script in package.json |
| 120 | packages/shared/README.md | — | error | TP | to-do | BaseAdapterFactory is in interfaces/adapter-registry |
| 121 | packages/shared/README.md | — | error | TP | to-do | AdapterFactory also exported as base class |
| 122 | packages/shared/README.md | — | error | TP | to-do | Java omitted from language list |
| 123 | packages/shared/README.md | — | error | TP | to-do | JavaAdapterPolicy missing from policy list |
| 124 | packages/shared/README.md | — | error | TP | to-do | AdapterCommand is debug-adapter contract |
| 125 | docs/usage.md | — | error | TP | to-do | Package is @debugmcp/mcp-debugger |
| 126 | docs/usage.md | — | warning | TP | to-do | CLI binary is dist/cli, not dist/index.js |
| 127 | docs/usage.md | — | error | TP | to-do | get_source_context is implemented |
| 128 | docs/usage.md | — | error | INFO | — | pause response wording is approximately correct |
| 129 | docs/architecture/adapter-pattern-design.md | — | error | TP | to-do | create_debug_session also supports port |
| 130 | docs/architecture/adapter-pattern-design.md | — | error | TP | to-do | Multiple languages, not Python-only |
| 131 | docs/architecture/adapter-pattern-design.md | — | warning | TP | to-do | Validation happens in ProxyManager.start |
| 132 | docs/architecture/adapter-pattern-design.md | — | error | TP | to-do | Server still does language validation |
| 133 | docs/architecture/adapter-pattern-design.md | — | warning | INFO | — | Event model description is architectural |
| 134 | docs/architecture/refactoring-impact-analysis.md | — | error | TP | to-do | DebugLanguage already has 6 members |
| 135 | docs/architecture/refactoring-impact-analysis.md | — | error | TP | to-do | Multi-language code already exists |
| 136 | docs/architecture/adapter-policy-pattern.md | — | error | TP | to-do | Interface has many more members now |
| 137 | docs/architecture/adapter-policy-pattern.md | — | error | TP | to-do | Policy used before/during proxy startup |
| 138 | docs/architecture/adapter-policy-pattern.md | — | error | TP | to-do | JS policy is js-debug, not pwa-node |
| 139 | docs/architecture/adapter-policy-pattern.md | — | error | TP | to-do | JS filters <node_internals> only |
| 140 | docs/architecture/adapter-policy-pattern.md | — | error | TP | to-do | selectPolicy misses Rust/Go/Java |
| 141 | docs/troubleshooting.md | — | error | TP | to-do | Host mode passes paths through, not rejects |
| 142 | docs/troubleshooting.md | — | error | TP | to-do | Default is /workspace not /workspace/ |
| 143 | docs/troubleshooting.md | — | warning | INFO | — | Both env vars documented is minor |
| 144 | docs/troubleshooting.md | — | error | TP | to-do | No fixed default port 5679 in startup |
| 145 | docs/architecture/dual-pattern-decision-guide.md | — | error | TP | to-do | Duplicate resolveExecutablePath in example |
| 146 | docs/architecture/dual-pattern-decision-guide.md | — | error | TP | to-do | create requires language + adapterConfig |
| 147 | docs/architecture/dual-pattern-decision-guide.md | — | warning | INFO | — | Policy weight varies by language, minor |
| 148 | docs/architecture/dual-pattern-decision-guide.md | — | error | TP | to-do | IDebugAdapter needed for session startup |
| 149 | docs/sse-environment-fix.md | — | error | TP | to-do | Retry uses temp error listener, not null |
| 150 | docs/sse-environment-fix.md | — | error | TP | to-do | Retry params differ from doc claim |
| 151 | docs/sse-environment-fix.md | — | warning | TP | to-do | Worker uses policy-derived spawn, not debugpy |
| 152 | docs/sse-environment-fix.md | — | error | INFO | — | start-sse-server-enhanced.cmd may exist |
| 153 | docs/sse-session-persistence-fix.md | — | warning | INFO | — | .cmd vs .sh is minor platform detail |
| 154 | docs/development/llm-collaboration-journey.md | — | error | INFO | — | Historical narrative, minor inaccuracy |
| 155 | docs/development/llm-collaboration-journey.md | — | error | TP | to-do | WeakMap cleanup uses removeListener pattern |
| 156 | docs/development/llm-collaboration-journey.md | — | error | FP | — | Data layer returning empty is intentional |
| 157 | docs/development/build-pipeline.md | — | warning | INFO | — | CLI delegation detail is minor |
| 158 | docs/development/build-pipeline.md | — | error | TP | to-do | Proxy bundle path is dist/proxy/proxy-bundle.cjs |
| 159 | docs/development/build-pipeline.md | — | error | INFO | — | CJS rationale is a simplification |
| 160 | docs/architecture/api-reference.md | — | error | TP | to-do | create() is async, returns Promise |
| 161 | docs/architecture/api-reference.md | — | error | TP | to-do | Constructor doesn't take adapter/config |
| 162 | docs/architecture/api-reference.md | — | error | TP | to-do | Events list is wrong; uses typed events |
| 163 | docs/architecture/api-reference.md | — | error | TP | to-do | setBreakpoints vs setBreakpoint, return types |
| 164 | docs/architecture/api-reference.md | — | error | TP | to-do | DebugLanguage has 6 members, not 2 |
| 165 | docs/architecture/api-reference.md | — | warning | INFO | — | Missing optional details param, minor |
| 166 | docs/error-handling-guide.md | — | error | INFO | — | Some paths use plain Error, minor scope |
| 167 | docs/error-handling-guide.md | — | error | TP | to-do | Missing session throws, not returns empty |
| 168 | docs/error-handling-guide.md | — | error | TP | to-do | isRecoverableError is specific, not generic |
| 169 | docs/architecture/system-overview.md | — | error | TP | to-do | CLI has stdio/sse/check-rust-binary, no tcp |
| 170 | docs/architecture/system-overview.md | — | error | TP | to-do | Missing environment and adapterRegistry deps |
| 171 | docs/architecture/system-overview.md | — | error | TP | to-do | ProxyState uses lowercase string values |
| 172 | docs/architecture/system-overview.md | — | warning | TP | to-do | File renamed to dap-proxy-adapter-manager.ts |
| 173 | docs/architecture/system-overview.md | — | error | TP | to-do | Four components, not three layers |
| 174 | docs/architecture/system-overview.md | — | error | TP | to-do | Transports are stdio and SSE, not TCP |
| 175 | docs/architecture/system-overview.md | — | warning | INFO | — | dist/index.js vs dist/cli for source vs pkg |
| 176 | docs/architecture/system-overview.md | — | warning | INFO | — | cli.mjs is intermediate artifact |
| 177 | docs/architecture/system-overview.md | — | error | TP | to-do | tcp subcommand does not exist |
| 178 | docs/architecture/system-overview.md | — | warning | INFO | — | Error message wording is generic now |
| 179 | docs/architecture/current-component-diagram.md | — | error | TP | to-do | Server does dynamic language discovery |
| 180 | docs/architecture/current-component-diagram.md | — | error | TP | to-do | Session creation delegates to store+policy |
| 181 | docs/architecture/current-component-diagram.md | — | error | TP | to-do | SessionStore is policy-driven, not Python |
| 182 | docs/architecture/current-component-diagram.md | — | error | TP | to-do | ProxyManager is language-agnostic now |
| 183 | docs/architecture/current-component-diagram.md | — | error | TP | to-do | ProxyConfig is language-agnostic |
| 184 | docs/architecture/current-component-diagram.md | — | error | TP | to-do | DebugLanguage has 6 members |
| 185 | docs/patterns/error-handling.md | — | error | TP | to-do | Implementation is in operations/core, not facade |
| 186 | docs/patterns/error-handling.md | — | error | TP | to-do | Timeout in _executeStepOperation, wrong file |
| 187 | docs/patterns/error-handling.md | — | error | TP | to-do | Cleanup is in session-manager-core.ts |
| 188 | docs/patterns/error-handling.md | — | error | TP | to-do | Retry API signature differs from impl |
| 189 | docs/patterns/error-handling.md | — | error | TP | to-do | operationFailed not in ErrorMessages |
| 190 | docs/architecture/dynamic-loading-architecture.md | — | error | TP | to-do | Java uses default export with lazy import |
| 191 | docs/architecture/dynamic-loading-architecture.md | — | error | TP | to-do | validateOnRegister is false in production |
| 192 | docs/development/debugging-guide.md | — | error | TP | to-do | Console output silenced in index.ts |
| 193 | docs/development/debugging-guide.md | — | error | TP | to-do | /health endpoint already exists |
| 194 | docs/development/debugging-guide.md | — | error | TP | to-do | Transport is external to DebugMcpServer |
| 195 | docs/development/debugging-guide.md | — | error | TP | to-do | requestId vs request_seq layer confusion |
| 196 | docs/development/debugging-guide.md | — | error | TP | to-do | Should use vitest, not npm test --reporter |
| 197 | docs/architecture/adapter-api-reference.md | — | error | TP | to-do | Loader uses named export, not default |
| 198 | docs/architecture/adapter-api-reference.md | — | error | TP | to-do | Return type includes installed field |
| 199 | docs/architecture/adapter-api-reference.md | — | warning | INFO | — | Case sensitivity of state values is minor |
| 200 | docs/architecture/adapter-api-reference.md | — | error | TP | to-do | Java uses lazy import, not direct ref |
| 201 | tests/e2e/npx/README.md | — | error | TP | to-do | Warn threshold is 10MB, not 8MB |
| 202 | docs/architecture/testing-architecture.md | — | error | TP | to-do | Coverage uses Istanbul, not v8 |
| 203 | docs/architecture/testing-architecture.md | — | error | TP | to-do | Path is tests/test-utils/helpers/ |
| 204 | docs/architecture/testing-architecture.md | — | error | TP | to-do | Port manager at different path, BASE_PORT 5679 |
| 205 | docs/architecture/testing-architecture.md | — | error | TP | to-do | Integration test path moved |
| 206 | docs/architecture/testing-architecture.md | — | error | TP | to-do | Test uses MCP tools, not SessionManager API |
| 207 | docs/architecture/testing-architecture.md | — | error | TP | to-do | waitForCondition accepts async predicates |
| 208 | tests/exploratory/FINDINGS.md | — | error | TP | to-do | docker-entry.sh is checked-in with correct $@ |
| 209 | tests/exploratory/FINDINGS.md | — | error | TP | to-do | Docker entrypoint test exists |
| 210 | tests/e2e/README.md | — | warning | TP | to-do | Container tests are under tests/e2e/docker/ |
| 211 | CHANGELOG.md | — | error | TP | to-do | Java adapter requires JDK 11+, not 21+ |
| 212 | docs/development/setup-guide.md | — | error | TP | to-do | Placeholder URL, should be debugmcp/mcp-debugger |
| 213 | docs/development/setup-guide.md | — | warning | FP | — | pnpm is the dev requirement |
| 214 | docs/development/setup-guide.md | — | warning | INFO | — | -p may be Commander alias for --port |
| 215 | docs/development/setup-guide.md | — | warning | INFO | — | stdio is default subcommand |
| 216 | docs/development/setup-guide.md | — | error | TP | to-do | MCP_SERVER_PORT, DEBUG not used by server |
| 217 | docs/development/setup-guide.md | — | warning | FP | — | build:clean exists in root package.json |
| 218 | CLAUDE.md | — | error | TP | to-do | Host-mode rejects relative; uses MCP_WORKSPACE_ROOT |
| 219 | CLAUDE.md | — | error | TP | to-do | Server uses effectivePath, not original |
| 220 | CLAUDE.md | — | warning | TP | to-do | ProxyCore doesn't exist; it's ProxyRunner |
| 221 | CLAUDE.md | — | error | TP | to-do | 6 known adapters including Java |
| 222 | CLAUDE.md | — | error | TP | to-do | Also need default export { name, factory } |
| 223 | CLAUDE.md | — | warning | INFO | — | --dry-run is internal, minor |
| 224 | CLAUDE.md | — | error | TP | to-do | DEBUG=* not the logging control |
| 225 | CLAUDE.md | — | error | FP | — | 19 tools counted correctly |
| 226 | README.md | — | error | TP | to-do | Windows Rust supported with GNU toolchain |
| 227 | README.md | — | error | TP | to-do | Placeholder clone URL |
| 228 | README.md | — | error | INFO | — | Machine-specific path is from install script |
| 229 | README.md | — | error | TP | to-do | pause_execution always throws |
| 230 | README.md | — | error | TP | to-do | Rust adapter works on Windows with GNU |

---

### dead_symbol (76 findings)

**Verdict distribution**: 68 TP, 4 FP, 1 INFO, 3 TP/fixed

Key clusters of dead symbols:
- `tests/test-utils/promise-tracker.ts` — entire module never imported (7 symbols)
- `tests/e2e/test-event-utils.ts` — entire module never imported (10 symbols)
- `tests/test-utils/helpers/test-utils.ts` — 10 exported helpers never called
- `tests/test-utils/helpers/test-setup.ts` — 7 exported helpers never called
- `tests/e2e/smoke-test-utils.ts` — 7 exported helpers never called
- `src/errors/debug-errors.ts` — 6 error classes never instantiated
- `tests/unit/test-utils/mock-factories.ts` — 4 factory helpers never called
- `tests/test-utils/mocks/mock-adapter-registry.ts` — 5 helpers never called

| # | File | Line | Verdict | Note |
|---|------|------|---------|------|
| 1 | src/cli/commands/check-rust-binary.ts | 27 | FP | Used as param type in same file |
| 2 | src/proxy/signal-debug.ts | 8 | TP/fixed | File deleted |
| 3 | src/cli/stdio-command.ts | 6 | FP | Used as param type in same file |
| 4 | tests/test-utils/mocks/dap-client.ts | 127 | TP/fixed | resetMockDapClient removed |
| 5 | src/cli/setup.ts | 14 | FP | Used as param type in same file |
| 6 | src/cli/setup.ts | 18 | FP | Used for setupStdioCommand |
| 7 | src/cli/setup.ts | 19 | FP | Used for setupSSECommand |
| 8–9 | tests/unit/proxy/proxy-manager-test-setup.ts | 11,40 | TP | No callers |
| 10–19 | tests/test-utils/helpers/test-utils.ts | various | TP | 10 helpers never called |
| 20–24 | tests/test-utils/mocks/mock-adapter-registry.ts | various | TP | 5 helpers never called |
| 25–31 | tests/test-utils/helpers/test-setup.ts | various | TP | 7 helpers never called |
| 32–38 | tests/e2e/smoke-test-utils.ts | various | TP | 7 helpers never called |
| 39–45 | tests/test-utils/promise-tracker.ts | various | TP | Entire module dead |
| 46–55 | tests/e2e/test-event-utils.ts | various | TP | Entire module dead |
| 56–58 | tests/test-utils/helpers/test-dependencies.ts | various | TP | 3 helpers never called |
| 59–61 | tests/test-utils/helpers/process-tracker.js | various | TP | Entire module dead |
| 62 | tests/e2e/npx/npx-test-utils.ts | 404 | TP | No callers |
| 63 | tests/test-utils/helpers/session-helpers.ts | 57 | TP | Module never imported |
| 64–69 | src/errors/debug-errors.ts | various | TP | 6 error classes never used |
| 70–73 | tests/unit/test-utils/mock-factories.ts | various | TP | 4 factory helpers never called |
| 74 | src/proxy/dap-proxy-interfaces.ts | 225 | TP | No callers |
| 75 | tests/implementations/test/fake-process-launcher.ts | 197 | INFO | Class used internally |
| 76 | tests/unit/test-utils/auto-mock.ts | 307 | TP | No callers |

---

### dead_code (67 findings)

**Verdict distribution**: 56 TP, 2 FP, 3 INFO, 6 TP/fixed

Key clusters:
- `tests/adapters/python/integration/python_debug_workflow.test.ts` — 4 unused imports
- `tests/core/unit/server/*.test.ts` — various unused imports and dead mocks
- `src/proxy/minimal-dap.ts` — 3 fields written but never read

(Full table omitted for brevity — see agent output for per-finding details)

---

### latent_bug (66 findings)

**Verdict distribution**: 17 TP, 28 FP, 21 INFO

**Critical production bugs (fixed):**

| # | File | Line | Verdict | Status | Note |
|---|------|------|---------|--------|------|
| 43 | src/session/session-manager-core.ts | 302-309 | TP | fixed | handleExited leaked listeners |
| 44 | src/session/session-manager-core.ts | 337-344 | TP | fixed | handleError leaked listeners |
| 13 | packages/adapter-go/src/go-debug-adapter.ts | 164-170 | TP | fixed | Passed Delve path to getGoVersion |
| 19 | packages/adapter-python/src/python-debug-adapter.ts | 600-610 | TP | fixed | Cache key mismatch |
| 20 | packages/adapter-python/src/python-debug-adapter.ts | 620-640 | TP | fixed | Same cache key issue |

**Unfixed TPs (scripts/tests, lower priority):**

| # | File | Line | Verdict | Note |
|---|------|------|---------|------|
| 4 | examples/debugging/test-sse-js-debug-fix.js | 194-196 | TP | .killed true after kill(); SIGKILL never sent |
| 12 | mcp_debugger_launcher/.../detectors.py | 75 | TP | `docker ping` not a valid command |
| 17 | packages/adapter-javascript/scripts/build-js-debug.js | 359-363 | TP | opts.env never passed to spawn |
| 25 | scripts/check-adapters.js | 241-246 | TP | Unmatched adapter leaves status undefined |
| 27 | scripts/docker-build.sh | 8-10 | TP | Success message even if docker build fails |
| 31 | scripts/safe-commit.sh | 25 | TP | shift runs even when $1 isn't --skip-tests |
| 33 | scripts/test-docker-local.sh | 73-81 | TP | set -e aborts before $? captured |
| 34 | scripts/test-mcp-integration.sh | 54 | TP | Command substitution fails under set -e |
| 35 | scripts/test-mcp-integration.sh | 72 | TP | Same set -e issue |
| 47 | tests/e2e/debugpy-connection.test.ts | 229-231 | TP | Rethrows instead of retrying |
| 54 | tests/stress/cross-transport-parity.test.ts | 230-254 | TP | Spawned process leaked on test failure |
| 63 | tests/unit/adapters/adapter-registry.test.ts | 35 | TP | getFactory undefined; TS error |
| 66 | tests/unit/test-utils/auto-mock.ts | 307-334 | TP | Returns Proxy but declared void |

---

### stale_comment / misleading_docstring / commented_out_code (72 findings)

**Verdict distribution**: 30 TP, 20 FP, 21 INFO, 1 TP/fixed

Notable TPs:
- L436-444 in javascript-debug-adapter.ts — **fixed** (misleading async comment)
- `tests/fixtures/python/debug_test_simple.py` — "This is line 13" on line 12
- `tests/e2e/test-event-utils.ts` — says "exponential backoff" but formula is linear
- `scripts/setup/windows-rust-debug.ps1` — says "Prepended" but code appends to PATH
- `src/adapters/adapter-loader.ts:155-156` — references nonexistent `createAdapter`

(Full table in agent output)

---

### doc_misleading_claim / doc_stale_content / doc_obsolete_reference / obligation_violation (57 findings)

**Verdict distribution**: 30 TP, 16 FP, 4 INFO, 1 TP/fixed

**All 10 obligation_violation findings are FP** — runtime string checks from external protocols (debugpy, js-debug, JDI bridge).

Notable TPs:
- `Roadmap.md` — says Java removed in v0.18.0; Java adapter still in codebase
- `docs/architecture/refactoring-impact-analysis.md` — proposes IDebugAdapter; already exists
- `docs/sse-session-persistence-fix.md` — claims multi-client support; SSE rejects reconnects
- `tests/e2e/README.md` — claims "All 5 adapters"; omits Java and Docker tests

(Full table in agent output)

---

## Themes in True Positives

1. **Outdated Python-only claims**: ~20 doc findings still describe mcp-debugger as Python-only when 6 languages are supported
2. **Stale file paths / module renames**: ~25 findings reference old paths (session-manager split, adapter-manager rename, test-utils moves)
3. **handleAutoContinue not implemented**: Referenced in 4+ docs as working, but throws at runtime
4. **CLI surface errors**: tcp subcommand doesn't exist, wrong package name, missing stdio subcommand
5. **Mock adapter design doc**: 8 findings — heavily outdated state machine, config, and error scenarios
6. **Dead test infrastructure**: 40+ exported test helpers in 6 files that are never imported

## Companion Documents

- **Improvement brief**: [`docs/osoji-improvement-brief.md`](./osoji-improvement-brief.md) — two proposals for the osoji project
- **CLAUDE.md**: Updated adapter count and path references
