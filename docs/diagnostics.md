# Diagnostics Guide

Nine language adapters, each with its own external prerequisites — and nearly all real-world setup friction is environmental: debugpy missing from the active Python, `dlv` not on PATH, a JDK that is too old, `NETCOREDBG_PATH` unset, Yama blocking attach on Linux, a wrong volume mount in container mode. This guide gathers every prerequisite, failure signature, and diagnostic tool in one place.

## Start here: `mcp-debugger doctor`

The `doctor` subcommand checks every adapter's runtime and debug backend in one pass:

```bash
npx @debugmcp/mcp-debugger doctor          # or: node dist/index.js doctor (repo checkout)
```

```text
mcp-debugger doctor 0.25.0 (win32-x64, node v24.14.1)

Adapter     Runtime                                          Debug backend                             Verdict
mock        (built-in)                                       (built-in)                                ✅ ok
python      Python 3.13.12 C:\...\py.EXE                     debugpy 1.8.20                            ✅ ok
javascript  Node.js v24.14.1                                 js-debug (vendored)                       ✅ ok
ruby        Ruby 3.4.9 C:\Ruby34-x64\bin\ruby.exe            rdbg 1.11.0 C:\Ruby34-x64\bin\rdbg.bat    ✅ ok
rust        Rust 1.94.1                                      CodeLLDB 1.11.8 (vendored) C:\...         ⚠️ warn
go          Go 1.26.1 C:\Program Files\Go\bin\go.exe         Delve 1.26.3 ~\go\bin\dlv.exe             ✅ ok
java        Java 21.0.10 C:\...\jdk-21\bin\java.exe          JDI bridge C:\...\java\out                ✅ ok
dotnet      .NET SDK 8.0.420                                 netcoredbg 3.1.3-1 C:\...\netcoredbg.exe  ✅ ok
cpp         C/C++ compiler g++ (MSYS2) 15.2.0                CodeLLDB 1.11.8 (vendored) C:\...         ✅ ok

Platform checks
  ✅ container mode: not running in container mode
  — workspace mount: host mode
  — yama ptrace_scope: linux only

Fixes
  rust: Rust MSVC toolchain detected. CodeLLDB works best with the GNU toolchain (x86_64-pc-windows-gnu) or DWARF debug info.

1 of 9 adapters need attention. Run 'mcp-debugger doctor <language>' to gate the exit code on a specific language.
```

Usage notes:

- **`doctor [languages...]`** gates the exit code on the named languages: exit `0` when every requested language is `ok` or `warn`, `1` when any is `broken`, `missing`, or `disabled` (or a name is unknown). With no languages the run is informational and always exits `0`. `2` means doctor itself failed. CI can gate a job with `mcp-debugger doctor python go`.
- **`--json`** emits a machine-readable report (`schemaVersion: 1`) with each language's verdict, errors/warnings, launch/attach availability, raw probe details, and per-probe timing.
- **`--timeout <ms>`** caps each language's probe (default 10000). A timed-out probe is reported as `broken` with `probe.timedOut: true`.
- **Doctor vs the server:** `list_supported_languages` and the launch gate *fail open* — when a toolchain probe crashes, the server assumes the language is available rather than blocking a launch it could not assess. Doctor reports the same probe honestly (`broken` + `probe.failed`), so doctor may say `broken` where `list_supported_languages` says available. The verdict rails are otherwise identical: both run the same per-adapter validation.
- **Source checkouts:** doctor reports `missing` for adapters whose `dist/` is not built. Run `pnpm install && npm run build` first.

## Per-language prerequisites

| Language | Runtime | Debug backend | Install | Overrides |
|---|---|---|---|---|
| python | Python 3.7+ | debugpy | `pip install debugpy` (same interpreter the session uses) | `PYTHON_PATH` (fallback `PYTHON_EXECUTABLE`), or `executablePath` per session |
| javascript | Node.js 22+ | js-debug (bundled) | nothing — the VSCode Node debugger ships with the adapter | `executablePath` per session; TypeScript needs `tsx`/`ts-node` or compiled output |
| ruby | Ruby 2.7+ (3.1+ recommended) | `debug` gem 1.7+ (`rdbg`) | `gem install debug` | `RUBY_PATH` (fallback `RUBY_EXECUTABLE`), `RDBG_PATH` |
| go | Go 1.18+ | Delve | `go install github.com/go-delve/delve/cmd/dlv@latest` (lands in `~/go/bin` — put it on PATH) | `GOBIN` is searched first, then `GOPATH/bin`, then PATH |
| java | JDK 21+ (`java` + `javac`) | JDI bridge (bundled, compiled on first use via `javac`) | install a JDK; **compile target code with `javac -g`** or variable inspection is empty | `JAVA_HOME`, `JDI_BRIDGE_DIR` (prebuilt bridge classes) |
| dotnet | .NET 6+ SDK | netcoredbg | download from [Samsung releases](https://github.com/Samsung/netcoredbg/releases); Portable PDB symbols required | `NETCOREDBG_PATH`, `NETCOREDBG_X86_PATH` (x86 attach targets) |
| rust | Rust toolchain (rustup) | CodeLLDB (vendored / platform packages) | nothing extra on a normal install; on Windows use the **GNU** toolchain (DWARF) | `CODELLDB_PATH` (used when no vendored copy resolves) |
| cpp | compiler only for source-file launch (`g++`/`clang++`) | CodeLLDB (shared with rust) | nothing for prebuilt binaries; compile with `-gdwarf-4 -O0` | `CODELLDB_PATH`, `CPP_MSVC_BEHAVIOR` (`warn`\|`error`\|`continue`) |
| mock | — | — | nothing (testing adapter) | — |

CodeLLDB resolution order (rust and cpp): **vendored copy → `CODELLDB_PATH` → `@debugmcp/codelldb-<platform>` package** (npm installs exactly the one matching your platform as an optional dependency). Doctor's backend column shows which source won. If you installed with `--omit=optional`, set `CODELLDB_PATH` to a [CodeLLDB release](https://github.com/vadimcn/codelldb/releases) binary.

## Failure signatures

The most common symptom → cause → fix mappings per language. (The agent-facing skill references under `skills/debugging/references/` carry the same tables plus per-language workflow quirks.)

### Cross-language

| Symptom | Cause | Fix |
|---|---|---|
| `File not found` with an unexpected resolved path | Relative path (rejected in host mode; `/workspace/`-prefixed in container mode) | Always pass absolute paths for `file` and `scriptPath` |
| Breakpoint never hits | Wrong path, non-executable line, or the code path never runs | Verify the absolute path matches the running file; pick an executable statement |
| Variables empty / "Session is not paused" | Inspection attempted while the debuggee is running | Wait for `paused` (check `list_debug_sessions`) or call `pause_execution` |
| Language reported unavailable | Toolchain missing, or disabled via `DEBUG_MCP_DISABLE_LANGUAGES` | Run `mcp-debugger doctor <language>` on the server host |

### python

| Symptom | Cause | Fix |
|---|---|---|
| "Python not found" | Interpreter not on PATH | Set `PYTHON_PATH`, or pass `executablePath` in `create_debug_session` |
| Launch fails mentioning debugpy | debugpy not installed for that interpreter | `python -m pip install debugpy` with the same interpreter the session uses |
| Attach fails when passing `processId` | Python attach is port-only | Start the target with `python -m debugpy --listen 127.0.0.1:<port>` and attach with `host`/`port` |

### javascript

| Symptom | Cause | Fix |
|---|---|---|
| `.ts` debugging fails | No `tsx`/`ts-node` available | Install one, or debug the compiled `.js` (source maps still resolve `.ts` breakpoints) |
| Stopped in a Node internal frame at start | Debugger paused before user code | `continue_execution` once |
| Attach connection refused | Target missing `--inspect=<port>` | Restart the target with the inspector flag |

### ruby

| Symptom | Cause | Fix |
|---|---|---|
| "rdbg not found" | debug gem missing or off PATH | `gem install debug`, or set `RDBG_PATH` (and `RUBY_PATH` if ruby itself is missing) |
| Connect refused on attach | Target not listening | Start it with `rdbg --open --host <h> --port <p>`; verify port-forwarding |
| Breakpoint not verified on attach | Host path used for a remote/container target | Use the path as the debuggee sees it (from `get_stack_trace`) |

### go

| Symptom | Cause | Fix |
|---|---|---|
| "Delve not found" | `dlv` not installed or `~/go/bin` off PATH | `go install github.com/go-delve/delve/cmd/dlv@latest`; verify `dlv dap --help` |
| Breakpoints not hit (exec mode) | Optimized binary | Rebuild with `-gcflags="all=-N -l"` |
| "unknown goroutine 1" | `stopOnEntry: true` with Delve | Leave `stopOnEntry` unset; harmless if it appears |

### java

| Symptom | Cause | Fix |
|---|---|---|
| Variables empty at a valid breakpoint | Compiled without `-g` (no `LocalVariableTable`) | `javac -g`, rebuild, restart the session (Gradle/Maven include debug info by default) |
| "Java not found" | No JDK on PATH / `JAVA_HOME` unset | Install JDK 21+ (the JDI bridge compiles with `javac --release 21`) |
| Attach connects but nothing happens | JVM started `suspend=y` still paused | `continue_execution` after attach |

### dotnet

| Symptom | Cause | Fix |
|---|---|---|
| "netcoredbg not found" | Env var/PATH not set | Set `NETCOREDBG_PATH` (new shell after `setx`) or add its directory to PATH |
| Empty variables at breakpoint | Non-Portable PDB (typically .NET Framework) | Compile with `/debug:portable`; on Windows the adapter auto-converts via Pdb2Pdb |
| Launch fails / nothing starts | `program` points at `Program.cs` | Point `scriptPath` at the built assembly: `bin/Debug/netX.0/App.dll` |

### rust

| Symptom | Cause | Fix |
|---|---|---|
| Variables `<unavailable>` (Windows) | MSVC toolchain — PDB symbols LLDB reads only partially | `cargo +stable-gnu build --target x86_64-pc-windows-gnu`; verify with `mcp-debugger check-rust-binary` |
| "Can't find CodeLLDB" | Not vendored / installed with `--omit=optional` | Reinstall with optional deps, or set `CODELLDB_PATH` |
| Breakpoints never hit | Release/optimized build | `cargo build` (debug profile) |

### cpp

| Symptom | Cause | Fix |
|---|---|---|
| Breakpoints never bind | DWARF-5-in-PE (MinGW default), missing debug info, or optimization | Rebuild with `-gdwarf-4 -O0` explicitly |
| Variables `<unavailable>` (Windows) | MSVC PDB binary | Rebuild with MinGW-w64/clang (DWARF); `CPP_MSVC_BEHAVIOR` controls the warning |
| Attach EPERM (Linux) | Yama ptrace scope | See [Linux attach and Yama](#linux-attach-and-yama-ptrace_scope) |

## Linux attach and Yama ptrace_scope

Attaching by PID (cpp, and any future native attach) is gated by the kernel's Yama LSM. `doctor` reads the live value; the semantics:

| `kernel.yama.ptrace_scope` | Meaning for attach |
|---|---|
| 0 | Unrestricted — attach to any process of the same user |
| 1 (most distros' default) | Ancestor-only — attaching to arbitrary PIDs fails with EPERM |
| 2 | Only processes with `CAP_SYS_PTRACE` may attach |
| 3 | Attach disabled entirely until reboot |

Fixes: `sudo sysctl kernel.yama.ptrace_scope=0` on the host, `--cap-add=SYS_PTRACE` for Docker containers, or `kubectl debug --profile=general` for Kubernetes ephemeral containers (it injects `SYS_PTRACE`). A target process can also opt in with `prctl(PR_SET_PTRACER, ...)`. See [docs/cpp/README.md](./cpp/README.md) and the [JIT diagnostics guide](./jit-diagnostics/README.md).

## Container mode

In the Docker image the server runs with `MCP_CONTAINER=true` and resolves all paths against `MCP_WORKSPACE_ROOT` (default `/workspace`). The two failure modes doctor's platform checks catch:

- **`MCP_WORKSPACE_ROOT` unset or not mounted** — you forgot `-v "$(pwd)":/workspace`, so every file lookup fails. Fix the mount; see [docs/docker-support.md](./docker-support.md).
- **Mounted but empty** — the volume points at the wrong host directory.

Go and .NET are disabled in the published image via `DEBUG_MCP_DISABLE_LANGUAGES`; use a host deployment for those. Rust/C++ in-container debugging works for **Linux-compiled** binaries only.

## Debugging the debugger

When a session misbehaves rather than a toolchain:

- **`dryRunSpawn: true`** in `start_debugging` validates the whole spawn (adapter command, paths, environment) without starting a real debug session — the fastest way to distinguish config problems from runtime ones.
- **`DAP_TRACE=1`** captures every DAP frame to a per-session `dap-trace-<sessionId>.ndjson` (off by default, capped at 50 MB; `DAP_TRACE_FILE=<path>` picks an explicit file). This is the ground truth for "what did the adapter actually say".
- **Server log**: `logs/debug-mcp-server-<pid>.log` (working-directory-relative; `--log-file` overrides; the container writes `/app/logs/debug-mcp-server.log`). Set verbosity with `--log-level debug` or `DEBUG_MCP_LOG_LEVEL`.
- **Per-session proxy log**: each session writes `proxy-<sessionId>.log` to the OS temp directory, at the same level as the server log — this is where adapter spawn commands and stderr land.
- Format details: [docs/logging-format-specification.md](./logging-format-specification.md).

## Environment variable reference

The complete set of runtime-affecting variables (the [development setup guide](./development/setup-guide.md) links here as canonical):

| Variable | Purpose |
|---|---|
| `PYTHON_PATH` / `PYTHON_EXECUTABLE` | Pin the Python interpreter (checked in that order) |
| `RUBY_PATH` / `RUBY_EXECUTABLE` | Pin the Ruby interpreter |
| `RDBG_PATH` | Pin the rdbg executable |
| `GOBIN` | Searched first for `dlv` (then `GOPATH/bin`, then PATH) |
| `JAVA_HOME` | JDK root; `bin/java` and `bin/javac` are used from here |
| `JDI_BRIDGE_DIR` | Directory with a prebuilt `JdiDapServer.class` (skips first-use compilation) |
| `NETCOREDBG_PATH` | Path to the netcoredbg executable |
| `NETCOREDBG_X86_PATH` | x86 netcoredbg for attaching to 32-bit processes |
| `CODELLDB_PATH` | CodeLLDB binary, used when no vendored copy resolves (rust + cpp) |
| `CPP_MSVC_BEHAVIOR` | `warn` (default) \| `error` \| `continue` when a cpp target has MSVC PDB symbols |
| `DEBUG_MCP_DISABLE_LANGUAGES` | Comma-separated languages to disable (e.g. `go,dotnet` in the Docker image) |
| `MCP_CONTAINER` | `true` marks container mode (set by the Docker image) |
| `MCP_WORKSPACE_ROOT` | Path-resolution root in container mode (image default `/workspace`) |
| `DEBUG_MCP_LOG_LEVEL` | Server log level (`error`, `warn`, `info`, `debug`) |
| `DAP_TRACE` / `DAP_TRACE_FILE` | Enable per-session DAP frame capture / choose its file |
| `DEBUG_MCP_NO_REDACT` | Disable secret redaction in captured output (diagnosis only) |
| `MCP_SKIP_ORPHAN_REAPERS` | Skip the startup orphan-process scans |

## Additional resources

- [Troubleshooting guide](./troubleshooting.md) — narrative FAQ for session-level problems
- Per-language guides: [python](./python/README.md) · [javascript](./javascript/README.md) · [ruby](./ruby/README.md) · [go](./go/README.md) · [java](./java/README.md) · [dotnet](./dotnet/README.md) · [rust](./rust-debugging.md) · [cpp](./cpp/README.md)
- [Docker support](./docker-support.md) · [Tool reference](./tool-reference.md)
