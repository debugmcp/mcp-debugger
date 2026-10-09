# Known Issues

Current user-facing caveats and their workarounds. Contributor notes about running the
CI workflows locally (Act, WSL2) live in
[Local CI/CD Testing with Act](./ACT_LOCAL_CI_TESTING.md).

## Native debugging inside Docker requires Linux-compiled binaries

The Docker image ships CodeLLDB and enables Rust and C/C++ (issue #328), but container LLDB can only debug **Linux-compiled** binaries. Binaries compiled on the host (Windows/macOS, or a mismatched glibc) and mounted into the container have DWARF/symbol data the container's LLDB cannot use — breakpoints won't bind or symbols won't resolve. Either compile inside the container (the image ships `g++`; the cpp adapter's source-file launch does this automatically) or cross-compile for linux-x64. For host-compiled binaries, use a host (stdio/http) deployment where the debugger runs next to the toolchain that produced them.

## The container needs `docker run -i`

The image's default command is `stdio`, so stdin *is* the MCP transport. Once a client has
spoken, stdin EOF means that client is gone and the server exits — which is what lets
`docker run -i --rm ...` clean itself up (issue #633).

Without `-i`, stdin is closed before any client ever speaks. That is the one case the
server deliberately keeps alive (a detached container is a supported deployment), so it
never exits, `--rm` never fires, and every session leaves a stopped container behind.
Always pass `-i` when the container is your MCP server:

```bash
docker run -i --rm -v $(pwd):/workspace debugmcp/mcp-debugger:latest
```

## Attach is not available for every language

`list_supported_languages` reports per-mode availability (`modes.launch` / `modes.attach`)
with reasons. The gaps worth knowing up front:

- **Rust and Go have no attach implementation.** Both adapter factories declare
  `modes: { launch: true, attach: 'none' }`, and `attach_to_process` fails fast with
  `Attach mode is not implemented for '<language>'` before any session state changes.
  Use `start_debugging` to launch the program instead.
- **C/C++ attach is attach-by-PID only.** `attach_to_process` requires a numeric
  `processId`; a `host`/`port` target is rejected with *"C/C++ attach requires a numeric
  processId (attach-by-PID). Name/host-based attach is not supported yet."* On Linux,
  attaching to a process you did not start may also need `kernel.yama.ptrace_scope`
  relaxed. See the [C/C++ guide](./cpp/README.md). The COBOL adapter, which runs the
  same engine behind its DAP shim, has the same PID-only restriction
  ([COBOL guide](./cobol/README.md)).
- **.NET attach is also PID-only.** netcoredbg has no host/port attach, so `processId` is
  required and a `host`/`port` pair is dropped — there is no remote-attach form of the
  call. See the [.NET guide](./dotnet/README.md).
- **Dart/Flutter attach is by VM-service URI, never by PID.** `attach_to_process` takes
  `adapterConfig.vmServiceUri` (the `ws://…/<token>=/ws` URI a VM started with
  `--enable-vm-service` prints, or `flutter run --machine`'s `app.debugPort`) or
  `adapterConfig.vmServiceInfoFile` (written by `--write-service-info=<file>`); a
  `processId` is rejected with that hint. A bare `host`/`port` pair is turned into
  `ws://host:port/ws`, which only works for a VM started with
  `--disable-service-auth-codes`. The `dart-test`/`flutter-test` runners refuse attach
  altogether (the SDK test adapters only launch). See the
  [Dart/Flutter guide](./dart/README.md).

Python, Ruby, JavaScript, and Java can attach to a remote target over host/port, and
Dart/Flutter by VM-service URI (reach it through a port mapping, `kubectl port-forward`, or
an SSH tunnel — these debug sockets are unauthenticated, apart from the token in a Dart
VM-service URI).

## Logpoints are rejected by Java, .NET, and Ruby

`set_breakpoint` with `logMessage` is supported by the Python, JavaScript, Go, Rust,
C/C++, COBOL, Dart/Flutter, and mock adapters. On Java, .NET, and Ruby it is a hard error
(`Logpoints (logMessage) not supported by the <language> adapter`) rather than a
silent downgrade: rdbg, for example, accepts `logMessage` and then ignores it, turning
the logpoint into a *pausing* breakpoint — the opposite of what a logpoint promises
(issue #469). On those three languages there is no non-pausing substitute: use a
conditional breakpoint and accept the stop (on Java, `suspendPolicy: "thread"` at least
limits the stop to one thread), or add the logging to the program itself.

## Ruby attach captures no program output

Ruby attach connects straight to a listening `rdbg --open` DAP socket, so there is no
adapter process between mcp-debugger and the target and nothing to capture its stdio.
`get_output` returns nothing for an attached Ruby session — the program's stdout/stderr
stay on whatever terminal (or pod log) started it. Launch mode is unaffected. See the
[Ruby guide](./ruby/README.md).

## Ruby launch sessions do not break on uncaught exceptions by default

Launch sessions default `breakOnExceptions` to `"uncaught"`, so a crashing program pauses
at the crash site instead of terminating. Ruby is the exception: rdbg has no uncaught-only
filter, so Ruby launches default to `"none"`. Pass `breakOnExceptions: "all"` explicitly to
pause on raised exceptions in Ruby — it will also stop on caught ones.

(Attach sessions never apply a language default; their `breakOnExceptions` default is
`"none"` for every language.)

## Dart/Flutter: what the SDK debug adapter does differently

The Dart adapter drives the SDK's own `dart debug_adapter` / `flutter debug-adapter`, so
these are the SDK's behaviours — measured in [the spike](./dart/spike-notes.md) against
Dart 3.13 and Flutter 3.47 — and none of them is a session error.

- **`step_over` stops twice per source line.** The VM steps per token position (`next` on
  one line stops at column 26, then at column 32); the `granularity` the adapter accepts is
  ignored. Expect two `step_over` calls per line, or set a breakpoint on the line you want.
- **A logpoint's `condition` is ignored.** `logMessage` works (interpolated `{expr}` values
  arrive in `get_output` without pausing), but a `condition` on the same breakpoint does not
  gate it — every hit logs. Put the filter in the message, or use a conditional breakpoint.
- **`hitCondition` is accepted and ignored.** The SDK adapter does not advertise
  `supportsHitConditionalBreakpoints`; a hit count neither errors nor takes effect.
- **A paused idle isolate shows an empty stack.** Attach pauses the target by default, and
  an isolate idle in an `await` has nothing on its stack, so `get_stack_trace` is empty (and
  stays empty across retries). Set a breakpoint and `continue_execution` — the stop at the
  breakpoint has a real stack — or pass `stopOnEntry: false` on attach to skip the pause.
- **`flutter test` and `flutter run` sessions end without an exit code.** The Flutter
  adapter sends `terminated` but no `exited` event, so `exitCode` is unknown in
  `list_debug_sessions`; the test results (`✓ name`) are in `get_output`. The Dart CLI
  adapter does report `exited` (255 for an uncaught exception).
- **`dart test` fails under `%LOCALAPPDATA%\Temp` with the winget SDK (Windows).**
  package:test spawns its frontend server through a cwd-relative SDK path that does not
  resolve from there (`The system cannot find the file specified … dartaotruntime.exe`).
  Upstream package:test; keep projects out of Temp — Flutter's bundled Dart is unaffected.
