# Java Adapter Assessment

Status as of 2026-02-26. Honest evaluation of the current Java debugging support.

## What's solid

- **Attach mode is genuinely useful.** Connecting to a running JVM with JDWP is the standard Java debugging workflow, and it works end-to-end: breakpoints fire, variables resolve, stepping works, continue works. The E2E test proves it with hard assertions on actual runtime values (a=42, b=58 in compute()).
- **The adapter/proxy plumbing is correct.** The `sendConfigDoneWithAttach`, `sendConfigDoneWithLaunch`, thread discovery, awaitable `onStopped` — these are real fixes to real protocol ordering bugs.
- **The test infrastructure is honest.** If something breaks, the tests fail. No more defensive conditionals that silently pass.

## What's fragile

- **Attach mode breakpoint re-send is a timing hack.** We sleep 500ms, hope the class loaded, re-send breakpoints. The fixture has a `Thread.sleep(2000)` specifically to create this window. If the JVM is slow to load or the class loads faster than 500ms and executes past the breakpoint before re-send, it breaks. There's no event-driven signal for "class loaded" coming from KDA.

- **Launch mode classpath is a hack.** We compile into `build/classes/java/main/` to trick KDA's `ProjectClassesResolver` into finding the class. Real Gradle/Maven projects would work naturally, but any user with a standalone `.java` file will hit `ClassNotFoundException` and have no idea why unless they read our docs. That's a poor UX compared to `python script.py` or `node script.js` which just work.

- **KDA itself is the weak link.** It's a v0.4.4 project primarily designed for Kotlin in editors. We're fighting it at every turn:
  - Ignores `classPaths` in launch args
  - Deferred breakpoints report verified but don't fire
  - `setBreakpoints` throws NPE in `DAPConverter.toInternalSource` on re-send during launch
  - Blocks launch/attach responses until configurationDone (unusual DAP behavior)
  - Line numbers sometimes 0

  Every one of these required a workaround in our code. If KDA releases a new version, any of these behaviors could change and silently break us.

## Alternative backends to consider

### 1. JDWP directly

Speak the Java Debug Wire Protocol directly to the JVM, without any intermediary adapter. The JVM's JDWP agent (`-agentlib:jdwp`) exposes a well-documented binary protocol over TCP. We would implement a JDWP client that translates between our DAP proxy layer and JDWP packets.

**Pros:**
- Zero external dependencies — every JVM ships with JDWP
- No vendored binaries, no version skew risk
- Full control over classpath, breakpoint, and thread management
- JDWP supports class-prepare events natively, which solves the deferred breakpoint problem cleanly (set a class-prepare event filter, get notified when the class loads, then set the breakpoint)
- The protocol is stable — hasn't changed significantly in decades
- Attach mode becomes trivial (just open a TCP socket)
- Launch mode becomes straightforward (spawn JVM with `-agentlib:jdwp`, connect)

**Cons:**
- Significant implementation effort — JDWP is a binary protocol with its own packet framing, ID management, and type system
- Must implement variable inspection (object references, array access, string value retrieval) from scratch
- Must handle thread suspension/resumption semantics correctly
- Need to map JDWP concepts (frames, slots, type tags) to DAP concepts (scopes, variables, stack frames)
- No existing Node.js JDWP client library to build on (would need to write from scratch or port from Java/Python)

**Assessment:** Highest-effort option but eliminates every KDA workaround. The result would be the most reliable and dependency-free Java debugging support possible. Best long-term investment if Java is a priority.

### 2. JDB (Java Debugger CLI)

JDB is the command-line debugger bundled with the JDK. A previous attempt existed in this codebase (per changelog) but was removed. JDB is a text-based interface over JDI, not DAP-native.

**Pros:**
- Ships with every JDK, no installation required
- Simpler than raw JDWP — JDB handles the protocol details
- Text output is parseable

**Cons:**
- Not DAP-native — requires a translation layer parsing JDB's text output
- Text parsing is inherently fragile (output format varies across JDK versions)
- No structured data — variable values, stack frames come as human-readable strings
- Interactive command model doesn't map cleanly to request/response DAP pattern
- The previous attempt was removed, suggesting fundamental issues were encountered

**Assessment:** Lowest-effort option but also lowest-quality. Text parsing makes it fragile across JDK versions.

### 3. Eclipse JDT debug adapter (java-debug)

This is what VS Code uses for Java debugging. It's the `microsoft/java-debug` project, built on Eclipse JDT.

**Pros:**
- Battle-tested, most mature Java debug adapter
- Handles classpath resolution correctly (via JDT project model)
- Deferred breakpoints work properly
- Full DAP implementation with no quirks
- Actively maintained by Microsoft

**Cons:**
- Requires Eclipse JDT Language Server as a runtime dependency — heavyweight (~200MB)
- Complex setup: needs a workspace, project configuration, JDT initialization
- Designed for IDE integration, not lightweight CLI usage
- Would need to vendor or require user installation of JDT LS
- Overkill for simple standalone file debugging

**Assessment:** Best debugging experience but the dependency weight makes it impractical for a lightweight MCP tool.

### 4. Keep KDA (current approach)

Continue with kotlin-debug-adapter, working around its limitations.

**Pros:**
- Already implemented and tested
- Lightweight vendored binary (~5MB)
- Works for the common case (Gradle/Maven projects in attach mode)

**Cons:**
- Every limitation requires a workaround in our code
- Fragile coupling to KDA's undocumented behaviors
- Launch mode only works with build-system projects
- Deferred breakpoints require timing hacks

**Assessment:** Acceptable for now. Attach mode is production-worthy, launch mode is a demo.

## Recommendation

If Java support is a priority, **JDWP directly** is the strongest long-term path. It eliminates every KDA workaround, has zero dependencies, and produces the most reliable result. The implementation cost is high but bounded — JDWP is a well-documented, stable protocol.

If Java support is secondary, **keep KDA for attach mode and demote launch mode to experimental**. The attach workflow (user manages their own JVM) sidesteps all classpath issues and is the natural workflow for Java developers anyway.
