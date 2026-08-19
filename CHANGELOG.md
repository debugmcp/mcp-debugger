# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Variable responses are size-guarded** — values truncate past 1024 chars, per-call variable count and total response size are capped (all env-tunable), with a `truncation` object explaining what was cut and pointing at the `names: [...]` filter or a targeted `evaluate_expression`; keeps huge scopes from blowing out agent context windows (#356, #359)
- **BREAKING (behavioral): launch sessions now default to `breakOnExceptions: "uncaught"`** — a crashing script pauses at the uncaught exception (`lastStop.reason: "exception"`, stack/locals inspectable, `exceptionInfo` where supported) instead of running to termination. Applies uniformly to Python, JavaScript, Java, Go (panics), .NET, Rust (panics), and the mock adapter; Ruby keeps the old run-to-termination behavior (rdbg has no uncaught-only filter). Pass `breakOnExceptions: "none"` to restore the old behavior per session. Attach sessions are unchanged — no default is ever applied on attach (fixes #244)

### Added
- **C/C++ debugging support** — new `@debugmcp/adapter-cpp` package driving CodeLLDB with a single `cpp` language id for C and C++: launch a prebuilt executable, or pass a lone `.c`/`.cpp` file and the adapter auto-compiles it (`-gdwarf-4 -O0` into `.debug-mcp/` — DWARF-4 explicitly, since MinGW's default DWARF-5 line tables are unreadable by LLDB in PE-COFF; `forceRebuild: true` to override). **Attach by PID** (`attach_to_process {processId}`) makes it the first native-code attach adapter. Advanced CodeLLDB config passes through: `initCommands`, `targetCreateCommands` (core dumps), `processCreateCommands` (gdbserver/QEMU/rr remote stubs), `sourceMap`. MSVC-built binaries are detected with configurable handling (`CPP_MSVC_BEHAVIOR=warn|error|continue` — PDB fidelity is partial; prefer MinGW-w64/DWARF on Windows). Exceptions map `all → cpp_throw` (SIGABRT and signals pause natively). CodeLLDB vendoring/resolution/spawn glue is extracted to a shared `@debugmcp/codelldb-common` package — one ~vendored copy per platform now serves both Rust and C/C++ (#324, #325)
- **`get_output` tool + per-session output resource** — debuggee stdout/stderr is captured into a bounded per-launch ring buffer readable any time (during the run or after exit) via `get_output {sessionId, since}` with cursor-based pagination (`nextSince`); each session also exposes the transcript as MCP resource `debug://sessions/{id}/output` with `resources/subscribe` support and coalesced update notifications (#218)
- **Per-mode language availability + toolchain-less attach** — `list_supported_languages` now reports `modes.launch` / `modes.attach` per language, each with `{supported, available, reason}`; direct-connect attach modes (debugpy, rdbg) no longer require a local language toolchain (the debug engine runs inside the target), and `attach_to_process` on adapters with no attach support (rust, go, mock) fails fast with a clear error instead of timing out (#331)
- **Multi-language Docker image** — the published image now debugs Python, JavaScript, Java, **Rust, and C/C++** natively (shared vendored linux-x64 CodeLLDB via `CODELLDB_PATH`, plus `g++`); Ruby ships **attach-only** (no Ruby runtime in the image); only Go and .NET remain disabled (#328)
- **Kubernetes ephemeral debug sidecar flow** — documented, tested recipe for debugging **compiled** processes in running pods with no in-process debug agent: `kubectl debug --target=<container> --profile=general --image=debugmcp/mcp-debugger` shares the target's PID namespace (and injects `SYS_PTRACE`), then `attach_to_process {processId: 1, adapterConfig: {program: "/proc/1/root/<binary>"}}` attaches CodeLLDB by PID; `examples/sick-pod-cpp` is the runnable demo (#332)
- **`adapterConfig` passthrough on `attach_to_process` / `create_debug_session`** — arbitrary adapter-specific attach/launch keys (e.g. CodeLLDB's `program` for symbol resolution) flow through to the DAP config, making flows like the k8s sidecar self-contained; reserved keys (`request`, `__attachMode`) are stripped with a warning (#336)
- **Launch-time toolchain gate** — `create_debug_session` and `start_debugging` fail fast with an actionable message when the language's launch toolchain is missing, instead of a silent no-op launch (#360)
- **Anchor matching: distinctive substrings + match-quality reporting** — `statement:`/`expectedContent` anchors accept a distinctive substring of the line (not just whole-line equality) and tolerate trailing comments; every inexact match is surfaced via `matchQuality` (`exact`/`substring`/`comment-stripped`) with candidate lists in warnings, so a weak anchor is visible instead of silently trusted (#367, #379)
- **Stop reason persisted on the session** — the most recent stop's reason/location survives past the stop event as `lastStop`, reported by `list_debug_sessions` and `get_stack_trace`, so a late-arriving client can tell why the session is paused (#214)
- **Agent skill + in-band guidance** — `skills/debugging/` ships an installable agent skill (golden path, bisection discipline, attach recipes, per-language references); the server serves condensed MCP `instructions` on connect and a `debugging-workflow` prompt (#239)
- **JIT-diagnostics demos** — `.github/actions/debug-failing-test` composite action (auto-debug a failing test in CI and post root-cause analysis), `examples/sick-pod` (attach to a live Kubernetes service), and the `docs/jit-diagnostics/` tutorial (#241)
- **Four more adapter packages published to npm** — `@debugmcp/adapter-javascript`, `@debugmcp/adapter-go`, `@debugmcp/adapter-java`, and `@debugmcp/adapter-dotnet` are now published standalone for programmatic embedding (the CLI bundle continues to include everything); `adapter-rust`, `adapter-cpp`, and `codelldb-common` remain bundle-only (marked private)
- **Startup reaper for orphaned proxy worker chains** — proxy workers are tagged at spawn with `--mcp-owner-pid` / `--mcp-session-id` argv markers; on startup the server scans for workers whose owner process is dead (server SIGKILLed or hard-crashed — the residual #337 gap) and tears them down: POSIX SIGTERMs the worker so its own shutdown cascades the adapter group/tree kill, with bounded SIGKILL escalation for wedged workers; Windows sweeps the tree directly via `taskkill /T /F`. Workers owned by live servers (concurrent instances) and untagged pre-upgrade workers are never touched. In Kubernetes shared-PID-namespace sidecars this means a fresh debug sidecar automatically reaps chains a hard-killed predecessor left behind (#343)
- **DAP mirror: read-only IDE attach to agent-owned debug sessions** — new `expose_session` / `unexpose_session` tools open a per-session DAP endpoint (loopback-only, random per-expose token presented as `mirrorToken` in the IDE's attach config) hosted in the session's proxy worker, so a human can attach VS Code (`"debugServer": <port>` + `mirrorToken`), nvim-dap, or any DAP client to a live session that no IDE launched — CI, containers, terminal-driven runs — and inspect the actual paused state: threads, stacks, scopes, variables, evaluate (incl. exceptionInfo/loadedSources/modules). A late-joining IDE lands directly on the paused frame via a synthesized `stopped` event from the persisted stop. Execution control stays with the MCP session: continue/step/pause/setVariable and breakpoint changes are rejected (breakpoint config requests soft-succeed as unverified so IDE attach flows survive), and the served capability mask hides control affordances up front. Endpoint closes on unexpose/close/restart/debuggee exit; `list_debug_sessions` shows `exposure: {host, port}` (never the token, which is also redacted from logs). The DAP Content-Length codec was extracted into a shared `dap-framing` module reused by client and mirror (#217)
- **JavaScript function breakpoints via js-debug's CDP proxy** — `set_breakpoint {function}` now works for JavaScript even though upstream js-debug implements no DAP `setFunctionBreakpoints` (declared out of scope in vscode-js-debug#952): the proxy obtains js-debug's `requestCDPProxy` WebSocket from the child session and arms V8's `Debugger.setBreakpointOnFunctionCall` — the same primitive behind Chrome DevTools' `debug(fn)` — with zero new dependencies (Node ≥22's global WebSocket). Names are dotted runtime paths bound to the current function value, not a source-symbol search: main-module `function` declarations bind at the (auto-continued) entry pause, functions in lazily-loaded modules stay pending with an explanatory message and bind automatically at the next pause (verification via breakpoint events), and globally reachable names resolve even while running — attach mode works. Conditions evaluate in callee scope with arguments bound; stops report `reason: "function breakpoint"`; `boundFile`/`boundLine` come from `[[FunctionLocation]]` with scriptParsed/`__filename` fallbacks; remove/clear/`restart_debugging` behave like every other adapter. Name resolution is side-effect-free (V8 `throwOnSideEffect`, retried permissively only on V8's false-positive vetoes such as ESM namespace reads) (#295)
- **Java function breakpoints** — the JDI bridge now implements `setFunctionBreakpoints` natively: `set_breakpoint {function}` accepts bare `method`, `Class.method`, fully-qualified, `Outer.Inner.method`, and `Class.<init>` names, binds every concrete overload at its entry location (jdb's `stop in` technique — full speed, no `MethodEntryRequest`), defers not-yet-loaded classes via `ClassPrepareRequest` with verification reported through breakpoint events, honors `condition`, and stops with `reason: "function breakpoint"`. Bare names skip JDK-internal classes; qualified names can still target them (#292)
- **Function breakpoints: symbol-addressed breakpoints** — `set_breakpoint` accepts `function: "name"` (with optional `condition`): break on entry to a symbol via DAP `setFunctionBreakpoints`, with no file or line at all — names survive edits better than lines or statements, and `restart_debugging` re-applies them natively. Session-global semantics throughout: `list_breakpoints` reports them in a separate `functionBreakpoints` array with the adapter's bound location (`boundFile`/`boundLine`), `remove_breakpoint` accepts `function: "name"`, an unscoped `clear_breakpoints` removes them while a file-scoped clear does not. Capability-gated per adapter (Python/Go/Rust/.NET/Java/JavaScript supported — JavaScript via the CDP bridge above; Ruby accepted with a warning and re-checked at launch), with the same launch-time capability drift warning as logpoints. The mock adapter simulates binding via a deterministic function→line table for hermetic e2e coverage (#271)

- **`statement` + matching `expectedContent` accepted** — combining a statement anchor with an `expectedContent` that trim-matches it is now treated as a redundant-but-valid assertion instead of a hard error; only a *different* `expectedContent` (contradictory intent) errors. Controlled trials showed agents combine the two on essentially every content-addressed set, making the old rejection a systematic one-round tax (fixes #280)

- **Statement anchors: content-addressed breakpoints** — `set_breakpoint` accepts `statement: "<exact line text>"` instead of `line`: whole-line trimmed-equality matching (the Edit-tool `old_string` skill agents already practice, instead of line arithmetic they're demonstrably bad at). Ambiguity is an error that lists every `line: content` match (the error is the disambiguation UI; `nearLine` binds to the closest match); blank/comment anchors are rejected. The anchor is stored on the breakpoint record and **re-resolves on `restart_debugging`** against the current file — breakpoints survive the edit that was the point of the session, with moves reported in `data.anchorResolution.moved` and no-longer-matching anchors kept at their previous line with a warning (`data.anchorResolution.stale`) instead of failing the restart. Gated to the `content` addressing mode (the default) (#271)

- **`expectedContent` breakpoint assertions + loud snapping** — `set_breakpoint` accepts an optional `expectedContent`: the exact text you expect on the target line (whitespace-trimmed). On a mismatch the breakpoint is NOT set and the error shows expected vs actual plus the surrounding lines — converting an off-by-one line number from confusing session behavior into an immediate, self-explanatory failure. When an adapter binds a breakpoint to a different line than requested, the response now reports it prominently (`requested line N, bound to line M` in `message`/`warning`, with `requestedLine` alongside the bound `line`) instead of silently mutating the line; asynchronous relocations (js-debug-style breakpoint events) surface in `list_breakpoints` as `line` ≠ `requestedLine`. Session-layer live-sync failures now also reach the `set_breakpoint` response as a `warning` (previously discarded). Content assertions require a server-readable source file (rejected for Java FQCNs and attach sessions with a clear error), and the source-line cache is now mtime-validated so mid-session edits are seen immediately. The new `DEBUG_MCP_BP_ADDRESSING` env flag (`line` | `assert` | `content`, default `content`) restricts addressing features — runtime behavior, tool schema, server instructions, and prompt text all gate together, enabling controlled A/B comparisons of agent debugging behavior (#271)

- **Stop-reason normalization + `stopReason` in pause results** — a new per-adapter `normalizeStopReason` policy hook maps misleading raw DAP stop reasons to canonical ones before they drive auto-continue, `lastStop`, and `exceptionInfo` enrichment: CodeLLDB reports an explicit pause (delivered via SIGSTOP) as `"exception"`, and js-debug reports it as `"step"` — both now surface as `"pause"`, with the adapter's original value preserved as `lastStop.rawReason`. Real exceptions (SIGSEGV, panics) are never reclassified, and normalized pauses no longer trigger a spurious `exceptionInfo` request. `pause_execution` now reports `data.stopReason`/`data.rawStopReason` for fresh stops (stale earlier stops are never echoed)

- **Optimized-binary warning on `get_local_variables`** — when the adapter annotates the locals scope (Delve's `"Locals (warning: optimized function)"` for optimized frames), the response now reports the actual scope name and a `warning` field with remediation guidance (rebuild with `-gcflags="all=-N -l"`, or use Delve debug mode). Previously Go's exact-name scope match silently returned `[]` for optimized frames; the scope is now prefix-matched so available variables are returned. `examples/go/README.md` no longer suggests `buildFlags` with `mode: "exec"` (Delve ignores it there)

- **`restart_debugging` tool** — one call terminates the current debuggee (if any) and relaunches it with the same configuration as the last `start_debugging`, re-applying every current breakpoint; the edit-rerun loop no longer costs close + create + re-set breakpoints + start. Implemented uniformly as terminate+relaunch (the DAP-spec-blessed emulation — no adapter advertises native restart), so all launch-mode languages work identically; runs while running, paused, or after the program exited. The response's `data.outputReset: true` signals that each launch starts a fresh output buffer — read `get_output` from `since: 0`. Attach sessions and never-launched (or dry-run-only) sessions are refused with clear errors (fixes #238)

- **Logpoints** — `set_breakpoint` accepts an optional `logMessage`: instead of pausing, the adapter logs the message (expressions in `{curly braces}` interpolated with live values) as output that lands in `get_output` and the session output resource while the program runs at full speed — the prod-safe just-in-time diagnostics primitive, combinable with `condition`. A single shared `toSourceBreakpoint` mapper now feeds every setBreakpoints construction site (live re-send, launch-time initial breakpoints, js-debug handshake), which also fixes `suspendPolicy` being silently dropped on the launch path. Support is gated per adapter: Python/JavaScript/Go/Rust/mock work; Java/.NET fail fast with a clear error; unknown support (Ruby) is accepted with a warning and re-checked against the adapter's live capabilities at launch. The mock adapter simulates logpoints (logs without stopping) for hermetic e2e coverage (fixes #235)

- **Breakpoint management tools** — new `list_breakpoints` (per-session listing with verified state and adapter-assigned ids, optional file filter), `remove_breakpoint` (by breakpoint id, or by file+line which removes every breakpoint at that location), and `clear_breakpoints` (whole session or one file). Removal and clearing take effect immediately while the debuggee is running or paused (the file's remaining set is re-sent, DAP replace-all) and deliberately keep working after the program exits so breakpoints can be adjusted between launches. DAP `breakpoint` events — previously dropped — are now wired end-to-end, so deferred verifications (debugpy module load, JDI class load, js-debug async binding, netcoredbg pending breakpoints) update the stored state; pre-launch breakpoints are also re-synced once a launch completes so their verified state and adapter ids reach the store on adapters that don't push events (fixes #236)

- **Break-on-exception support** — new `breakOnExceptions` option (`"uncaught"` | `"all"` | `"none"`, default `"none"`) on `start_debugging` and `attach_to_process`: an uncaught exception now pauses at the crash site with the stack and locals inspectable instead of terminating the session. The abstract mode is resolved to per-language debugger filter IDs by the adapter policy (Python `uncaught`/`raised`+`uncaught`, JavaScript `uncaught`/`all` — runtime-verified against js-debug, Java `uncaught`/`caught`+`uncaught`, .NET `user-unhandled`/`all`, Go `fatal`+`panic`, Rust `rust_panic`/`+cpp_throw`, Ruby `all`-only via `any`); an unsupported mode is skipped with a warning and never aborts the launch (fixes #220)
- **Exception detail on stops** — `lastStop` now records the DAP stopped event's `description` and `text` (e.g. exception class and message), surfaced via `list_debug_sessions`, `get_stack_trace`, and the `start_debugging` response (#220)
- **Debuggee exit code surfaced** — the exit code from the DAP `exited` event is stored on the session and returned as `exitCode` in `list_debug_sessions`, making a crash (non-zero) distinguishable from a clean exit (#220)
- **Adapter capabilities captured per session** — the DAP `initialize` response body is no longer discarded: the worker forwards it to the session (`adapterCapabilities`), enabling capability-gated behavior and a startup drift warning when a policy's static exception-filter table references filter IDs the live adapter doesn't advertise (fixes #243)
- **`exceptionInfo` enrichment on exception stops** — when a session pauses with reason `exception` and the adapter supports the DAP `exceptionInfo` request, `lastStop.exceptionInfo` is populated best-effort with `exceptionId`, `breakMode`, and details (message, type names, adapter-side stack trace); surfaced via `list_debug_sessions` and `get_stack_trace`. The request is fire-and-forget after the pause, so the field may appear a moment after the stop; failures are swallowed (#243)

### Fixed
- **JavaScript breakpoints no longer flip back to unverified** — for js-debug's parent/child session architecture, the child session owns the runtime and is now authoritative for breakpoint verified state: child `setBreakpoints` responses are forwarded as synthesized breakpoint events (previously their verified state never reached the session store), and the parent session's pessimistic responses/events can no longer downgrade child-verified breakpoints or clobber child adapter ids. Genuine child-side unbinding (id-matched downgrade) still applies

- **Java stacks paused inside the JDK now show your frames** — the JDK-internal frame filter matched `java.*` prefixes against frame names, but the JDI bridge emits bare method names (`sleep0`), so it never matched; it now also recognizes the declaring-type FQCN that lands in the `file` slot for no-debug-info frames (prefix list extended with `jdk.` and `com.sun.`), with an all-internal fallback so pure-JDK stacks still show frames, and `get_local_variables` picks the first user frame automatically. The JDI bridge also emits fully qualified frame names (`PauseTest.main`, `java.lang.Thread.sleep0`), matching JDWP/IDE conventions

- **`get_local_variables` on a terminated session explains the program finished** and suggests `restart_debugging`, instead of the generic "must be paused at a breakpoint" message

- **`start_debugging` / `attach_to_process` on a session with a live proxy no longer destroys the session** — the "already has an active proxy" path called `closeSession`, which removes the session from the store, so the immediately-following state update threw and the tool reported a bogus "Session not found" with the session gone. Both paths now use a session-preserving teardown (listeners removed, worker stopped, adapter slot released) and the relaunch proceeds normally; per-launch breakpoint state (`verified`/`message`/adapter id) is also reset on every new launch so a relaunch reports honest verification (#238)

- **Go exception filters actually arm now** — the #220 filter table used shorthand IDs (`panic`, `fatal`) that Delve silently accepts and ignores; corrected to Delve's real filter IDs (`unrecovered-panic`, `runtime-fatal-throw`), so `breakOnExceptions` (and the new launch default) genuinely pauses Go panics. Caught live by the #243 capability drift warning during #244 validation (#244)
- **Ruby and Rust-on-Windows debuggee output captured** — adapters whose debuggee inherits the adapter process's stdio (rdbg `-c` on all platforms, CodeLLDB's console mode on Windows) now opt into proxy-side forwarding: the adapter's stdout/stderr lines are synthesized into DAP `output` events and land in the same per-session buffer `get_output` reads. rdbg's own `DEBUGGER:` stderr banners are excluded (they still go to the session log, sanitized, as before); the forwarded copy is raw, matching how debugpy/js-debug output reaches the buffer. Ruby attach mode is unchanged — no adapter process exists there, so output stays on the target's own terminal (fixes #222, fixes #223)
- **Go debuggee output captured** — the Go adapter now launches Delve with `outputMode: 'remote'`, so the target program's stdout/stderr arrives as DAP output events and shows up in `get_output` instead of vanishing into dlv's own stdio (fixes #225)
- **Rust launch config uses CodeLLDB's canonical `terminal` attribute** — the adapter emitted a debugpy-style `console` key that CodeLLDB only honors as a legacy alias; it now emits `terminal: 'console'`, translating any user-supplied legacy `console` values (#223 — the Windows output-capture gap the issue uncovered is tracked separately: LLDB's console mode inherits the debuggee's stdio rather than emitting DAP output events)
- **js-debug launch no longer hangs on fast-exiting scripts** — the launch barrier now settles when the debuggee emits `terminated`/`exited` during the launch window, and `dispose()` rejects a still-pending wait as a structural backstop; `start_debugging` for a JavaScript script that crashes (or completes) within seconds of launch now returns promptly with state `stopped` instead of hanging past the MCP client timeout. Also removes an intermittent ~10s stall when js-debug's `initialized` event raced the handshake listener (fixes #242)
- Mock adapter now answers `setExceptionBreakpoints` (previously an unhandled-command error) and emits `exited` before `terminated`, matching real adapter ordering (#220)
- Corrected the JavaScript adapter's declared `exceptionBreakpointFilters` to the IDs js-debug actually reports (`all`, `uncaught`) (#220)
- **Published adapter packages are installable standalone** — `npm publish` from the pnpm workspace shipped literal `workspace:*` dependency ranges that npm cannot install (`EUNSUPPORTEDPROTOCOL`); the release pipeline now resolves them to pinned concrete versions at publish time
- **No more flashing console windows on Windows** — a 30-site `windowsHide` sweep across every spawn path; user-requested `console` modes are still honored, and Python launches run under `pythonw.exe` where appropriate (#215)
- **Session-lifecycle failures return structured `success: false`** with the session's actual state across all session-scoped tools, instead of protocol-level errors (#203)
- **JavaScript debuggee exit code reported** — js-debug never emits a DAP `exited` event; a preload shim now captures and reports the real exit code (#247)
- **npx bundle completeness** — the published CLI bundle now resolves its vendored js-debug (JavaScript sessions previously reported unavailable / silently no-opped), and ships the Java JDI bridge source and the JS exit-code shim (#354, #364)
- **Ruby: mid-run stdout streaming** via an injected sync prelude (output used to arrive only at exit), `launchConfig.env` and `launchConfig.cwd` now reach the debuggee spawn (rdbg `-c` starts the target at spawn time, so DAP-launch fields were dead letters), and launch sessions ending in a crash now finish `stopped` with a synthesized `exitCode` instead of `error` (terminal-signal FIFO ordering) (#317, #318, #320, #258)
- **Attach lifecycle hardening** — attach failure/teardown now kills the full adapter chain including `lldb-server` (no more orphans), CLI exit paths are bounded and always stop the server, and crash-abandoned HTTP MCP sessions are reaped on a 60s sweep (`MCP_HTTP_STALE_SESSION_MS`, default 30 min) — an HTTP client crash could previously leave an immortal session holding its debuggee (#337)
- **Attach verification surfaces real adapter errors** (bad PID, missing binary, ptrace denial) instead of a generic verify-timeout (#371)
- **.NET attach pauses the target** — netcoredbg does not suspend on attach; the adapter now issues the pause so attach lands inspectable, matching every other adapter (#353); Java attach pause similarly picks a reportable thread (#352)
- **Java: launch sessions report `exitCode`** (#368) and `redefine_classes` re-plants breakpoints in redefined classes — JDWP invalidates them on hot-swap; they are re-created against the new class version (#370)
- **Stack traces never come back empty** — frame-classification fallbacks guarantee at least the top frame with a `hiddenFrames` annotation (#346); LLDB/libc internal frames in Rust/C++ stacks are classified and filtered consistently (#369)
- **Output pipeline correctness** — per-launch output-buffer isolation after `restart_debugging` (no cross-launch sequence bleed) (#358); LLDB DWARF-warning noise filtered from captured output via a policy hook (#361); child-session output events flushed at run-to-completion so fast Docker JS runs don't lose output (#366); non-child adapters no longer pay a 300–450 ms child-event settle at teardown (#378)
- **Host-built Rust/C++ binaries debugged in the container get a derived source map** — DWARF compile dirs are read from the binary and mapped to `/workspace` automatically (#363)
- **`mcp_debugger_launcher` (PyPI) command construction unified** — dry-run output and the executed npx/docker command are now generated from the same source of truth (#345)

### Security
- **Secret redaction on by default** — 17 credential-shape rules (gitleaks-derived: PATs, cloud keys, JWTs, private key blocks, …) plus a sensitive-variable-name set mask values as labeled placeholders (`<redacted:github-pat>`) across `get_variables`, `get_local_variables`, child expansion, `evaluate_expression`, and captured output before they reach the MCP client; the env sanitizer shares the same rule table, closing a raw-DAP-body log leak. Opt out per server with `DEBUG_MCP_NO_REDACT=1`. `pwd` was later dropped from the name set (too many false positives on working-directory variables) (#237, #315, #365)
- **Least-privilege variable access mode** — `DEBUG_MCP_VARIABLE_ACCESS=explicit` makes `get_variables` require explicit `names: [...]` instead of dumping whole scopes; the `names` filter also works in open mode (misses reported via `notFound`) (#316)
- **Vendored debug engines are digest-pinned** — js-debug (previously vendored from the floating `latest` release) is pinned to v1.112.0 and CodeLLDB to 1.11.8 via committed `vendor-manifest.json` files; both vendor scripts verify every downloaded artifact against the pinned SHA-256s and fail closed, since GitHub release assets are mutable ("same tag" ≠ "same bytes")
- **npm OIDC trusted publishing** — previously published `@debugmcp/*` packages now publish via npm trusted publishing (short-lived OIDC credentials bound to the release workflow; no long-lived token), with sigstore provenance on every package; first-ever publishes use a scoped token once, then migrate
- **Ownership + SBOMs** — Sycamore LLC named as the accountable steward (MAINTAINERS/GOVERNANCE/SUPPORT.md); SPDX + CycloneDX SBOMs attached to every GitHub release; project contacts moved to `security@debugmcp.io` / `admin@debugmcp.io`; a security [assurance case](docs/assurance-case.md) documents threats → controls → residual risks (#240)

## [0.23.0] - 2026-07-09

### Added
- **`verifyTimeout` parameter** on `create_debug_session` and `attach_to_process` — controls how long (ms) attach mode waits for the debugger to report at least one thread before failing the attach (default: 5000, max: 600000). Increase for targets slow to become debuggable, e.g. a busy or warming JVM (#147, fixes #143)
- **`timeout` parameter** on `evaluate_expression` and `redefine_classes` — controls the max time (ms) to wait for the operation to complete (default: 30000, max: 600000) (#148, fixes #142)

### Fixed
- **Slow step/pause no longer reported as failure** — `step_over`, `step_into`, `step_out`, `pause_execution`, and `continue_execution` now return `pending: true` with a truthful "still running" message instead of `success: false` when the operation outlives its grace window (#144)
- **Python attach handshake** — attach-first DAP handshake sequencing for debugpy attach (#149, fixes #145)
- **DAP disconnect ordering** — send DAP disconnect before destroying the socket; Windows launch-mode tree-kill now runs first, with an already-exited PID guard (#157, fixes #156)
- **Dev proxy backend output** — line-buffered and sanitized before logging, matching the main proxy's handling (#158, fixes #154)

### Security
- **Comprehensive stderr/env secret-redaction audit** across the proxy and dev-proxy, closing gaps where adapter/backend output could leak into logs or tool errors unsanitized (#150, #152, #155, fixes #146, #151, #153)
- **All 23 open dependency advisories resolved** via `pnpm.overrides` (hono, fast-uri, vite, qs, ip-address, esbuild, brace-expansion); CI's `pnpm audit` step is no longer `continue-on-error` (#160)
- **CI workflow token permissions job-scoped**; the last unpinned GitHub Action (`dependabot/fetch-metadata`) SHA-pinned; a stray compiled Go example binary untracked (#161)
- **Dependency pinning sweep** — hash-pinned pip installs (`pip`, `debugpy`), pnpm installed via corepack instead of `npm install -g`, `ruby:3.3-slim` pinned by digest, Dependabot now covers the `docker` ecosystem (#163)
- **Signed release artifacts** — GitHub releases now ship the published npm tarballs alongside SLSA provenance (`multiple.intoto.jsonl`), verifiable with `slsa-verifier` (#164)
- **OpenSSF Scorecard 6.0 → 8.7** and an [OpenSSF Best Practices "passing" badge](https://www.bestpractices.dev/projects/13543) (#160–#164, #174)

### Changed
- Added `fast-check` property-based tests covering the log sanitizers, stream line-buffering, and DAP wire framing — caught and fixed a real bug where env vars named `__proto__` were silently dropped by the sanitizer (#162)

## [0.22.0] - 2026-07-06

### Added
- **Ruby debugging support** – launch and attach via `rdbg` (debug gem) DAP, including remote attach to containers and Kubernetes pods through port forwarding; conditional breakpoints, locals, repl-context expression evaluation, detach/re-attach (adapted from PR #88, contributed by [@Poyraxx](https://github.com/Poyraxx))
- **Direct-connect attach** – adapter policies can now return a `connect`-mode spawn config to attach straight to an already-listening DAP server without spawning an adapter process; policy selection is driven by the session language via a single shared `getPolicyForLanguage()` mapping instead of adapter-command sniffing
- **Ruby documentation** – `docs/ruby/README.md` user guide with verified launch/attach flows and Docker/Kubernetes remote-attach walkthroughs (`examples/ruby/remote-attach/`)

### Fixed
- **JavaScript attach mode** – establish the js-debug child session when attaching, so breakpoints, stepping, and inspection work for attached Node.js processes (#131, fixes #124)
- **Truthful attach failures** – `attach_to_process` now reports adapter/connection errors instead of returning an empty success (#129)
- **`pause_execution` state** – reports the correct session state instead of a stale one (#119)
- **Proxy lifecycle** – the per-session proxy process is stopped when a debuggee terminates naturally, eliminating leaked proxy processes (#127)
- **Server orphan self-defense** – a stdin watchdog shuts the server down when its MCP client disappears, and backend shutdown is graceful across stdio/http/sse commands (#130)
- **Proxy bootstrap heartbeat** – removed a one-sided heartbeat that could kill healthy proxies during slow startups (#126, fixes #123)
- **Logging** – per-process log files prevent multi-process rotation races, and a rotation-failure latch stops runaway retry loops (#128, fixes #121)
- **Python interpreter validation** – a configured `pythonPath` is validated for debugpy availability up front, with a clear error instead of a hang (#107, fixes #106)
- **Java adapter vendoring** – honors `SKIP_ADAPTER_VENDOR` and skips gracefully on a `javac` older than JDK 21 (#116)
- Attach sessions no longer apply host-side file existence checks to breakpoint paths — attach targets may run on a remote filesystem (container, pod, other machine)
- `test:unit` now actually runs the per-adapter unit suites on Windows (the `tests/adapters/*/unit` glob never expanded under cmd.exe)
- CLI bundle prepare-pack workspace list updated for new adapter packages

### Changed
- Test suite parallelized and hardened via Vitest projects — unit suite runtime dropped from ~12 minutes to ~10 seconds (#110)
- README refreshed with current capabilities and language matrix (#87)

### Dependencies
- Bumped `commander` 14 → 15. The CLI surface is unchanged; `commander` is bundled into the published CLI, so end-user installs are unaffected. (#92)

## [0.21.0] - 2026-05-30

### Changed
- **Minimum Node.js raised to 22.** All packages now declare `engines.node >=22.0.0`, and the Docker image builds on `node:22-slim`. Node 18 and 20 are no longer supported (Node 20 reached end-of-life April 2026).

### Dependencies
- Bumped `which` 6 → 7 (requires Node 22+). The API is unchanged, and `which` is bundled into the `@debugmcp/mcp-debugger` npx CLI, so end-user installs are unaffected. (supersedes #76)

## [0.20.0] - 2026-03-29

### Added
- **`redefine_classes` MCP tool** — hot-swap changed Java classes into a running JVM without restarting the debug session (21 MCP tools total) (PR #26, contributed by [@Finomosec](https://github.com/Finomosec))
- E2E tests for `redefine_classes` and Java ClassPrepareEvent/BreakpointEvent race condition
- `redefine_classes` documentation in `docs/java/README.md`

### Fixed
- **Attach-mode stopOnEntry** — restore default to preserve paused state; pass `stopOnEntry` through to attach and default to `false` in `create_debug_session`
- **Java event loop race** — prevent `ClassPrepareEvent` from resuming stopped threads (PR #27, contributed by [@Finomosec](https://github.com/Finomosec))
- **Java attach suspend** — suspend VM on attach when `stopOnEntry` is true
- Remove dead `ProcessAdapter` class and unrecognized `--no-wait` arg from debugpy E2E test

### Changed
- Comprehensive osoji sweeps — dead code removal, stale docs rewrite, test robustness improvements
- Replace istanbul ignore comments with real unit tests
- Fix comprehensive test matrix failures; add dotnet/java language coverage

## [0.19.0] - 2026-03-22

### Added
- **.NET/C# debug adapter** — full debugging via netcoredbg with launch/attach modes, conditional breakpoints, exception breakpoints, TCP-to-stdio bridge, and Portable PDB support (PR #24, contributed by [@bob7123](https://github.com/bob7123))
- **`list_threads` MCP tool** — list all threads in the debugged process (20 MCP tools total)
- **`pause_execution` enhanced** — optional `threadId` parameter to pause a specific thread
- **Java pause command** — `pause_execution` support for Java adapter
- **Java per-breakpoint suspend policy** — control thread suspension behavior per breakpoint (PR #25, contributed by [@Finomosec](https://github.com/Finomosec))
- **Batteries-included CLI bundle** — Rust, Java, and .NET adapters now bundled in `@debugmcp/mcp-debugger`
- Pause test programs for Go, .NET, Java
- Regression tests for Go and .NET pause fixes
- Adapter registry, server coverage, and Go policy unit tests
- Bridge fallback and bundle asset verification tests
- Disconnect/detach safety tests

### Fixed
- Go and .NET pause workflow failures
- Latent bugs in adapter loader, mock DAP parser, Java adapter, and Docker entrypoint
- Fail fast with clear error when Docker daemon is not running
- netcoredbg bridge path resolution for spaces in paths and NPX bundle variants
- `dapLaunchArgs.program` preservation for compiled languages
- Comprehensive osoji audit remediations (runtime bugs, dead code, stale docs)
- 0% coverage files addressed after Vitest 4 upgrade

### Changed
- Adapter loading, error handling, logging, and language-specific documentation updated
- Test robustness improvements and dead code removal

## [0.18.1] - 2026-03-11

### Added
- Java FQCN (Fully Qualified Class Name) support as breakpoint file parameter — pass class names like `com.example.MyClass` instead of file paths

### Fixed
- Multi-breakpoint aggregation and sourcePath-based breakpoint cleanup
- Moved `isJavaFqcn` into adapter policy layer following Open/Closed principle

## [0.18.0] - 2026-03-05

### Added
- **Go debugging support** – full Delve DAP adapter with debug, test, exec, replay, and core modes, goroutine-aware stack traces, and automatic `dlv` detection (contributed by [@swinyx](https://github.com/swinyx))
- **Java debugging support** – JDI bridge (`JdiDapServer.java`) with launch and attach modes, variable inspection, and deferred breakpoints via ClassPrepareRequest (contributed by [@roofpig95008](https://github.com/roofpig95008))
- **Java attach mode** – connect to running JVMs via JDWP agent for debugging servers and complex applications
- **Java expression evaluation** – full expression evaluator supporting field access, method calls, array indexing, arithmetic, string concatenation, casting, `instanceof`, ternary, and unary operators
- **Java conditional breakpoints** – conditions evaluated server-side via the expression evaluator
- **Java documentation** – `docs/java/README.md` user guide covering prerequisites, JDI bridge architecture, and troubleshooting
- **CI Go + Java toolchains** – workflow now installs Go 1.21, Delve, and JDK 21 for cross-platform E2E testing
- **Dev proxy** – lightweight MCP proxy for hot-reloading mcp-debugger during development without restarting Claude Code
- **Dev proxy STDIO backend transport mode** – STDIO transport option for the dev proxy

### Changed
- **Java backend** – replaced KDA (kotlin-debug-adapter) and stdio-tcp-bridge with a single JDI bridge (`JdiDapServer.java`) using `com.sun.jdi.*` directly; zero external dependencies, compiles on first use
- **Java minimum JDK** – recommended JDK 21+ to match `--release 21` bridge compilation target; the adapter warns (but does not error) when Java is below 21, and the runtime adapter warns when Java is below version 11
- Removed dead `sendConfigDoneWithAttach`/`sendConfigDoneWithLaunch` code paths

### Fixed
- **Java inner class breakpoints** – fixed JDWP ClassPrepareRequest filter patterns (`*ClassName$*` silently fails; changed to `ClassName$*`)
- **Java instanceof with interfaces** – `isSubtypeOf` now handles `InterfaceType` subjects and recursive interface-extends-interface chains
- **Java thread ID overflow** – changed from `int` to `long` thread IDs throughout the DAP bridge
- **Java frame ID collisions** – replaced arithmetic encoding (`threadId * 100000 + frameIndex`) with lookup-table approach
- **Java breakpoint IDs** – added unique, monotonically increasing breakpoint IDs per DAP spec
- **Java thread safety** – used `ConcurrentHashMap` and `AtomicInteger` for shared state; added `synchronized` blocks for frame cache access
- **Java boolean operators** – `&&` and `||` parsing now consumes tokens correctly; note that the RHS is still evaluated for JDI side effects before deciding the result value
- **Java thread discovery** – discover JVM threads via DAP threads request instead of hardcoding threadId=1
- **Java variable access** – document and enforce `javac -g` requirement for LocalVariableTable (JDI needs it for local variable inspection)
- Block EventSource phantom reconnection in SSE transport
- Coerce stringified tool arguments from SSE transport
- Docker Java support, crash safety, and continue-execution state race
- Auto-detach safety for attach sessions
- Prevent orphan child processes from holding ports after SSE crash
- Prevent SSE backend from crashing immediately after startup
- Two-phase initialized event handling for Delve on Windows
- Replace printf-generated Docker entry.sh with version-controlled script
- Downgrade missing debugpy to warning for virtualenv support
- Prevent Docker path double-prefixing with idempotent resolution
- Bundled Go adapter and mock-adapter-process for npx distribution
- Resolved `workspace:*` dependency resolution during `pnpm pack`
- Fixed cross-test pollution from `process.env.PATH` in Go/Python unit tests
- Added Go adapter to Dockerfile and fixed Windows volume mount paths

### Removed
- **Java jdb adapter** – jdb text-parsing approach proved too fragile; replaced by JDI bridge

## [0.17.0] - 2025-11-22

### Added
- **Rust adapter (Alpha)** – integrates CodeLLDB to support Cargo projects, async runtimes, and cross-platform execution with smart rebuild detection

### Improved
- **Stepping UX** – every `step_*` response now embeds current source context so agents see the active file/line instead of generic “success” acknowledgements

### Packaging
- **CodeLLDB footprint** – CLI bundle ships the Linux x64 CodeLLDB runtime by default (other platforms can point `CODELLDB_PATH` to an installed binary or re-run the vendor script) to stay within npm size limits

## [0.16.0] - 2025-11-09

### Added
- **JavaScript adapter (Alpha)** – full debugging loop backed by bundled `js-debug`, TypeScript detector, and adapter policy orchestration
- **Adapter documentation** – updated `docs/javascript/*` guides covering architecture, source maps, and usage
- **Proxy session analytics** – dry-run/handshake instrumentation persisted in logs for CI triage

### Changed
- **Build system** – migrated CLI bundling from esbuild to tsup (`noExternal: [/./]`) for deterministic workspace packaging
  - Produces self-contained `@debugmcp/mcp-debugger` bundles and trims install size
  - Simplifies npx execution by embedding adapter assets
- **Proxy bundling** – emitted dedicated `proxy-bundle.cjs` process with automatic runtime detection of bundled vs dev mode
- **Adapter wiring** – session manager now loads adapters via registry/policies, enabling future language additions

### Fixed
- Resolved missing dependency errors when running via `npx` (fs-extra, etc.)
- Ensured proxy bootstrap locates `js-debug` artifacts in bundled distributions
- Hardened Windows dry-run handling to avoid silent exits

### Improved
- **npx distribution** – zero-runtime dependencies; CLI bundle (~3 MB) includes all workspace packages, proxy bundle ships with required modules
- **Build performance** – faster incremental builds with tsup and shared cache
- **Deployment simplicity** – single command `npx @debugmcp/mcp-debugger stdio` “just works”; Docker image consumes same artifact layout
- **Documentation footprint** – refreshed build pipeline notes (`docs/development/build-pipeline.md`) and architecture overview

## [0.15.7] - 2025-09-27

### Added
- **Monorepo architecture** - Complete refactor to workspace-based monorepo structure, setting the foundation for multi-language adapter support
  - Extracted Python adapter into `@debugmcp/adapter-python` package
  - Extracted Mock adapter into `@debugmcp/adapter-mock` package  
  - Created shared types and interfaces in `@debugmcp/shared` package
  - Dynamic adapter loading system for extensibility
- **Pre-push lint validation** - ESLint now runs before push to prevent CI failures
- **Typed error system** - Replaced brittle string matching in tests with proper typed errors
- **Validation script** - Test in clean environment before release
- **npx distribution package** - Direct execution support via `npx @debugmcp/mcp-debugger`
- **pnpm workspace support** - Migrated from npm to pnpm for better monorepo management

### Fixed
- Removed unused `SessionNotFoundError` import that was blocking CI
- Docker container file operations now use relative paths
- Docker E2E test converted to use stdio transport for reliability
- Deprecated warnings resolved before release
- Build artifacts removed from git and prevented in CI tests
- Proxy bootstrap JavaScript file restored to fix CI failures
- TypeScript module resolution issues in CI/CD pipeline
- Workspace package type declarations and build order

### Changed
- **Architecture**: Modularized codebase into workspace packages for better maintainability and future language support
- Docker E2E tests now enabled locally by default
- Improved error handling with typed error classes for better reliability
- Enhanced pre-push hooks to match CI validation requirements
- Build system now uses TypeScript composite projects for proper inter-package dependencies

## [0.14.1] - 2025-01-16

### Fixed
- Resolved ESLint violations that were blocking CI/CD pipeline
- Fixed linting issues in proxy modules and test files

## [0.14.0] - 2025-01-15

### Added
- **`evaluate_expression` tool** - Execute expressions in the current debug context to inspect and modify program state dynamically
- **Proxy-ready handshake mechanism** - Ensures reliable proxy initialization and prevents race conditions
- **Orphan process detection** - Automatically terminates proxy processes that become orphaned

### Fixed
- Memory leak in DAP client buffer management - Improved from O(n²) to O(n) complexity
- Race condition in MinimalDapClient causing unhandled error events during connection phase
- Race condition in proxy initialization causing unhandled promise rejections
- Proxy processes becoming orphaned after test suite execution on Linux

### Changed
- Proxy initialization timeout reduced from 30s to 10s to prevent resource consumption
- Improved error handling in ProxyProcessAdapter with proper promise lifecycle management

## [0.13.0] - 2025-01-15

### Added
- Initial implementation of `evaluate_expression` tool for dynamic debugging capabilities

## [0.12.0] - 2025-07-28

### Added

- **Path validation** to prevent crashes from non-existent files - immediate feedback instead of cryptic "[WinError 267]" errors
- **Line context in `set_breakpoint` responses** - enables AI agents to make intelligent breakpoint placement decisions
- **`get_source_context` tool implementation** - previously unimplemented tool now provides source code exploration capabilities
- **Efficient line reading with LRU caching** - optimized file access for repeated operations on the same files

### Fixed

- Cryptic "[WinError 267] The directory name is invalid" crashes when debugging with non-existent files
- Silent acceptance of invalid breakpoints - now provides immediate validation feedback
- Missing implementation of `get_source_context` tool

### Changed

- `set_breakpoint` now returns immediate feedback for missing files with clear error messages
- Improved error messages throughout - all file-related errors now include resolved paths and helpful context
- `set_breakpoint` responses now include optional `context` field with line content and surrounding code

## [0.11.2] - 2025-01-14

### Fixed

- PyPI package deployment workflow - fixed invalid classifier format that was preventing successful uploads
- npm package deployment - added missing provenance configuration for trusted publishing

### Changed

- Updated Python package classifiers to use standard PyPI format
- Enhanced CI/CD workflows for more reliable multi-platform releases

## [0.11.1] - 2025-01-13

### Fixed

- Release workflow to use correct secret name for PyPI deployment
- Documentation references to old package names

## [0.11.0] - 2025-01-13

### Breaking Changes

- Package renamed from `debug-mcp-server` to `@debugmcp/mcp-debugger` on npm
- Python launcher renamed to `debug-mcp-server-launcher` on PyPI
- Docker image moved to `debugmcp/mcp-debugger` on Docker Hub

### Added

- Official organization structure under `debugmcp` namespace
- Multi-platform Docker builds (amd64, arm64)
- Comprehensive deployment documentation

### Fixed

- CI/CD workflows for seamless releases across all platforms

## [0.10.0] - 2025-06-24

### Added

- **Dynamic Tool Documentation**: Tool descriptions now adapt to runtime environment (host vs container), helping LLMs understand path requirements without trial and error
- **Structured JSON Logging**: All debugging operations emit structured JSON logs for visualization and monitoring
  - Tool invocations with sanitized parameters
  - Debug state changes (paused/running/stopped)
  - Breakpoint lifecycle events
  - Variable inspections with truncated values
- **Comprehensive Smoke Tests**: Added SSE and container transport smoke tests to complement existing stdio tests
  - Tests for all transport mechanisms (stdio, SSE, containerized)
  - Cross-platform volume mounting verification
  - Smart Docker image caching for faster tests
- **Path Translation System**: Improved dependency injection for container/host path flexibility
- **Test Utilities**: Enhanced test helpers for smoke tests including Docker utilities

### Changed

- **Docker Image Optimization**: Reduced image size by 64% (670MB → 240MB), improving deployment size and container startup time
  - Switched to Alpine Linux base image
  - Implemented esbuild bundling for JavaScript dependencies
  - Optimized multi-stage build process
- **Container Proxy Bundling**: Fixed proxy dependency issues in Alpine environments
- **Parameter Validation**: Improved validation with proper MCP error responses
- **Error Messages**: Enhanced error messages with clearer context for debugging

### Fixed

- Container proxy dependency resolution in Alpine Linux environments
- Test mocking issues in dynamic tool documentation
- Path handling edge cases in container mode
- Various test stability improvements

## [0.9.0] - 2025-01-09

### Breaking Changes

- SessionManager constructor changed to use dependency injection (backward compatibility maintained but deprecated)
- Removed ActiveDebugRun type in favor of ProxyManager architecture

### Added

- **Vitest Migration**: Complete migration from Jest to Vitest for native ESM support (10-20x faster test execution)
- **Dependency Injection**: Comprehensive dependency injection system with factories for all major components
- **Error Handling**: Centralized error messages module with user-friendly timeout explanations
- **Proxy Architecture**: Three-layer proxy architecture (core/worker/entry) for better separation of concerns
- **Functional Core**: Pure functional DAP handling logic with no side effects
- **Documentation**:
  - Comprehensive developer documentation in `docs/development/`
  - Architecture diagrams and patterns guide in `docs/architecture/` and `docs/patterns/`
  - LLM collaboration journey documentation
- **Test Utilities**: Extensive test helper functions and mock factories

### Changed

- **Test Coverage**: Increased from <20% to >90% with 657 passing tests (up from 355)
- **SessionManager**: Reduced complexity by 40% through ProxyManager delegation
- **Code Organization**: Improved separation of concerns with clear module boundaries
- **Event Management**: Proper lifecycle management with cleanup on session close

### Fixed

- Memory leak in event handlers (proper cleanup in closeSession)
- Race condition in dry run (replaced hardcoded timeout with event-based coordination)
- Unhandled promise rejections in tests
- Enhanced timeout error messages for better debugging

### Removed

- Jest test runner and all Jest-related dependencies
- Obsolete test files and configurations
- python-utils.ts from core (refactored and consolidated into `packages/adapter-python/src/utils/python-utils.ts`)
- Various deprecated provider and protocol files

## [0.1.0] - 2025-05-27

### Added

- Initial public release of `debug-mcp-server`.
- Core functionality for Python debugging using the Debug Adapter Protocol (DAP) via `debugpy`.
- MCP server implementation with tools for:
    - Creating and managing debug sessions (`create_debug_session`, `list_debug_sessions`, `close_debug_session`).
    - Debug actions: `set_breakpoint`, `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`.
    - State inspection: `get_stack_trace`, `get_scopes`, `get_variables`.
- Support for both STDIN/STDOUT and HTTP transport for MCP communication.
- Basic CLI to start the server with transport and logging options.
- Python "launcher" package (`debug-mcp-server-launcher`) for PyPI, to aid users in running the server and ensuring `debugpy` is available.
- Dockerfile for building and running the server in a containerized environment, including OCI labels.
- GitHub Actions CI setup for:
    - Building and testing on Ubuntu and Windows.
    - Linting with ESLint.
    - Publishing Docker image to Docker Hub on version tags.
    - Publishing Python launcher package to PyPI on version tags.
- Project structure including:
    - `LICENSE` (MIT).
    - `CONTRIBUTING.md` (basic template).
    - GitHub issue and pull request templates.
    - `README.md` with quick start, features, and usage instructions.
    - `docs/` directory with initial documentation (`quickstart.md`).
    - `examples/` directory with:
        - `python_simple_swap/`: A buggy Python script and a demo script showing how to debug it using MCP tools.
        - `agent_demo.py`: A minimal example of an LLM agent loop interacting with the server.
- Unit and integration tests for core functionality. (E2E tests for HTTP transport are currently skipped due to environment complexities).
- `pyproject.toml` for the Python launcher and `package.json` for the Node.js server.

### Changed

- Build output directory standardized to `dist/`.

### Known Issues

- E2E tests for HTTP transport (`tests/e2e/debugpy-connection.test.ts`) are temporarily skipped due to challenges with JavaScript environment setup (fetch/ReadableStream polyfills in Jest/JSDOM). These will be revisited.
- Placeholder URLs and names (e.g., for repository, Docker Hub user, author) in `package.json`, `pyproject.toml`, `Dockerfile`, `README.md`, and example scripts need to be updated with actual project details.
