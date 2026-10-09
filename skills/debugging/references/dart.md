# Dart / Flutter debugging (mcp-debugger)

## Prerequisites

- **The Dart SDK (3.x) or Flutter** — the debugger is the SDK's own debug adapter (`dart debug_adapter`, `flutter debug-adapter`), so nothing is vendored and nothing extra is installed: `winget install Google.DartSDK` / `brew install dart` / the `dart` apt package, or a Flutter checkout (its `bin/cache/dart-sdk` is used when no standalone SDK is found). Found via `DART_SDK` (alias `DART_PATH`) / `FLUTTER_ROOT` (alias `FLUTTER_PATH`), then the project's fvm pin (`.fvmrc`, `.fvm/`), `flutter` and `dart` on PATH, then the usual install directories. `mcp-debugger doctor dart` shows what was found.
- **Flutter runners need a warm tool cache**: run `flutter --version` once after installing. On Windows the adapter runs the Flutter tool snapshot through the bundled Dart directly (Node cannot spawn `flutter.bat` without a shell), which is why the cache must already exist.
- **Windows + the winget Dart SDK**: `dart test` cannot start from a project under `%LOCALAPPDATA%\Temp` (package:test spawns its frontend server by a cwd-relative SDK path — upstream). Keep projects elsewhere; Flutter's bundled Dart is unaffected.
- **Docker**: the image carries the Dart SDK, so Dart programs work in-container; Flutter is host-only.

## Runner selection

`start_debugging` picks one of four SDK adapters from the nearest `pubspec.yaml` above the program (then above the cwd) and the program's path; `"runner"` in `dapLaunchArgs` overrides the choice:

| Runner | Spawns | Chosen when |
|---|---|---|
| `dart` | `dart debug_adapter` | no pubspec, or a pubspec without a Flutter dependency |
| `dart-test` | `dart debug_adapter --test` | a Dart project and the program is under `test/` or `integration_test/` |
| `flutter` | `flutter debug-adapter` | the pubspec depends on `flutter` (or `flutter_test`, `integration_test`, …) |
| `flutter-test` | `flutter debug-adapter --test` | a Flutter project and the program is under `test/` or `integration_test/` |

The launch response's diagnostics name the runner and the reason (`runner: dart-test (dart project (C:/proj/pubspec.yaml), program under test/ or integration_test/)`).

## Launch quickstart

```json
create_debug_session  {"language": "dart", "name": "orders"}
set_breakpoint        {"sessionId": "<id>", "file": "C:/proj/bin/orders.dart", "statement": "final total = sum(prices);"}
start_debugging       {"sessionId": "<id>", "scriptPath": "C:/proj/bin/orders.dart", "args": ["--verbose"], "dapLaunchArgs": {"cwd": "C:/proj"}}
get_stack_trace       {"sessionId": "<id>"}
get_local_variables   {"sessionId": "<id>"}
evaluate_expression   {"sessionId": "<id>", "expression": "order.items.length"}
step_over             {"sessionId": "<id>"}
continue_execution    {"sessionId": "<id>"}
get_output            {"sessionId": "<id>"}
close_debug_session   {"sessionId": "<id>"}
```

One package:test case, and a Flutter app on a device:

```json
start_debugging {"sessionId": "<id>", "scriptPath": "C:/proj/test/orders_test.dart", "args": ["-n", "totals an empty cart"]}
start_debugging {"sessionId": "<id>", "scriptPath": "C:/proj/lib/main.dart", "adapterLaunchConfig": {"deviceId": "windows"}}
```

- `scriptPath` is the **`.dart` entrypoint** (`bin/app.dart`, `lib/main.dart`, a `test/*_test.dart` file). Pass the project root as `dapLaunchArgs.cwd` when the program reads relative paths (there is no top-level `cwd`). Program args go in top-level `args`: for `dart test` they are package:test's (`-n <name>` runs one test), for `flutter test` the tool's (`--name <name>`).
- `dapLaunchArgs` keys (equally accepted in `adapterLaunchConfig`, which wins on a conflict): `runner`; Flutter-only `deviceId` (→ `flutter run -d <id>`; `flutter devices` lists them) and `flutterMode` (`debug` by default; `profile`/`release` run the app but **turn the debugger off** — no breakpoints or variables, and the response says so); and the SDK adapter's own keys, forwarded as-is: `toolArgs` (extra `flutter run` / `dart` tool options, e.g. `["--dart-define=FLAVOR=dev"]`), `vmAdditionalArgs` (Dart VM flags; the Flutter adapter ignores it — use `toolArgs`), `debugExternalPackageLibraries`, `debugSdkLibraries`, `evaluateToStringInDebugViews` (defaulted to `true`), `evaluateGettersInDebugViews`, `showGettersInDebugViews`, `additionalProjectPaths`, `customTool`, `customToolReplacesArgs`, `sendLogsToClient`. `env` reaches the program.
- Breakpoints set before launch answer `verified: false` ("Breakpoint has not yet been resolved") and verify when the isolate loads the script — normal. A breakpoint in a test body hits on the test isolate (thread 2 under `dart test`; under `integration_test/` the app and the test share one isolate).
- A Flutter launch answers `pending: true` while the tool builds and starts the app (a warm Windows desktop run reaches its first breakpoint in ~9 s, a cold one in ~25 s; a first Android debug APK takes minutes) — `wait_for_stop` with a generous `timeout`. The tool's progress lines (`✓ Built …`) arrive in `get_output`.

## Attach (by VM-service URI, never by PID)

```json
attach_to_process {"sessionId": "<id>", "adapterConfig": {"vmServiceUri": "ws://127.0.0.1:8181/abc123=/ws", "cwd": "C:/proj"}}
attach_to_process {"sessionId": "<id>", "adapterConfig": {"vmServiceInfoFile": "C:/proj/.dart_tool/vm.json"}}
attach_to_process {"sessionId": "<id>", "adapterConfig": {"vmServiceUri": "ws://127.0.0.1:50321/x=/ws", "runner": "flutter", "deviceId": "windows"}}
```

- Start the target with the VM service on: `dart --enable-vm-service=0 --pause_isolates_on_start --write-service-info=C:/proj/.dart_tool/vm.json run bin/server.dart` (port `0` = any free port; the file holds the URI with its auth token; `--pause_isolates_on_start` holds `main` until you attach and `continue_execution` — drop it for a live service). Or `dart --enable-vm-service=8181 --disable-service-auth-codes run …` and attach by `host`/`port` (`localhost`, `8181`), which the adapter turns into `ws://localhost:8181/ws` — without `--disable-service-auth-codes` that URI is refused, so pass the full tokened one. The URI of a session this server launched itself is in its `dart.debuggerUris` log line.
- A Flutter app started outside the debugger (`flutter run -d <device> --machine`) reports its URI in the `app.debugPort` event; attach with `runner: "flutter"` (or a `cwd` inside the Flutter project) and the same `deviceId`. Measured on Windows desktop; attaching to an app on the Android emulator is an M3 item (the adb port forward belongs to the other tool).
- `processId` is rejected with the hint above; the `dart-test`/`flutter-test` runners refuse attach (the SDK test adapters only launch).
- **The target is paused after attach** (omitting `stopOnEntry` means `true`). An isolate idle in an `await` has an **empty stack** at that pause: set a breakpoint and `continue_execution`, and the breakpoint stop has frames and locals. For a live service pass `stopOnEntry: false`.
- `detach_from_process` leaves the target running. Output from an attached program reaches `get_output` only from the attach on.

## Quirks

- **`step_over` stops twice per source line** — the VM steps per token position (one line: column 26, then column 32); `granularity` is accepted and ignored. Two `step_over` calls per line, or breakpoint the line you want. Stepping over an `await` lands on the next line with an `<asynchronous gap>` label frame in the stack; `get_stack_trace` hides it and the SDK-internal frames below `main` (`includeInternals: true` shows them).
- **Scopes are `Locals` and `Globals`** (plus `Exceptions` at an exception stop); `get_local_variables` is `Locals`. Containers (`List (3 items)`, objects) expand through `variablesReference`; `evaluate_expression` takes any Dart expression in the frame (`counter.value`; `find.text("x").evaluate().length` in a widget test; `this.counter` in a widget's state) — an unknown name answers `Undefined name 'x'.`; `$_threadException` is the current exception object.
- **Exceptions**: the launch default `breakOnExceptions: "uncaught"` is the SDK's `Unhandled` filter (one stop at the throw site of the uncaught exception, `lastStop.text` = `ArgumentError (Invalid argument(s): …)`); `"all"` is `All` (caught throws stop too). No `exceptionInfo` — the class and message are in `lastStop.text`. An uncaught exception exits a Dart CLI program with code 255.
- **`stopOnEntry: true`** is a temporary breakpoint on the program's `main(` line (the VM's own entry pause is a stop the adapter resumes itself 1 ms later, never usable) — it reports as reason `entry` with `args` in Locals and needs `main(` in the program file.
- **Logpoints** work (`logMessage: "tick={tick} double={tick * 2}"` → `get_output`, no pause) but **a `condition` on a logpoint is ignored** — every hit logs. **`hitCondition` is accepted and ignored.** **No function breakpoints** (`set_breakpoint {function}` is rejected up front); address by `statement` or line instead.
- **Threads are isolates** (`list_threads`): a spawned isolate is a new thread; under `dart test` thread 1 is the runner and the test body runs on thread 2. `pause_execution` answers in a few ms.
- **Exit**: a Dart CLI program ends with `exited {exitCode}` then `terminated` (the adapter switches the SDK's own pause-on-exit stop off); **`flutter run`/`flutter test` end with `terminated` and no `exited`**, so `exitCode` is unknown — read the `✓ name` lines in `get_output` for test results. A test file that does not compile fails `start_debugging` with `Session terminated before debugger initialized: (1)`; the compiler diagnostics are in `get_output` as stderr entries.
- **`noDebug: true`** really turns the debugger off (no stops, no VM-service URI; the program runs to its exit).
- **Flutter**: hot restart (the DAP `restart` Flutter advertises once the app starts; measured to re-hit a breakpoint ~0.4 s later on desktop) is where `restart_debugging` will land for Flutter — today `restart_debugging` relaunches. `flutterMode: "profile"` / `"release"` runs without a debugger. Integration tests (`integration_test/`) run under `flutter-test` on a device (`deviceId`); the app and the test share one isolate, so breakpoints in both hit on the same thread. Dart ships now; Flutter desktop/web/tests is the next milestone and emulators the one after — `flutter run`/`flutter test` on Windows desktop and the Android emulator were measured in the spike and go through these same keys, but are not yet covered by the suite.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No Dart SDK found" / "Dart SDK not found" | `dart` not on PATH, `DART_SDK`/`FLUTTER_ROOT` unset | Install Dart or Flutter; set `DART_SDK` (or `FLUTTER_ROOT`) to the install root |
| "No Flutter SDK found for a Flutter project" | The pubspec depends on Flutter but no checkout was found | `FLUTTER_ROOT`, `flutter` on PATH, or an fvm pin (`.fvmrc`) |
| A Flutter launch fails mentioning `FLUTTER_ROOT` or the tool snapshot (Windows) | Flutter tool cache not built yet | `flutter --version` once |
| `Session terminated before debugger initialized: (1)` | The program or test file does not compile | Read the stderr entries in `get_output` (file/line/column) |
| `dart test` dies with `The system cannot find the file specified … dartaotruntime.exe` (Windows) | Project under `%LOCALAPPDATA%\Temp` with the winget SDK (upstream package:test) | Move the project out of Temp |
| "Dart attaches by VM-service URI, not by process id" | `processId` passed to `attach_to_process` | `adapterConfig.vmServiceUri` or `vmServiceInfoFile` |
| Attach by `host`/`port` never connects | The VM wants its auth token in the URI | Start the target with `--disable-service-auth-codes`, or pass the full `ws://…/<token>=/ws` URI |
| Empty `get_stack_trace` after attach | The isolate is idle in an `await` | Set a breakpoint and `continue_execution`; or attach with `stopOnEntry: false` |
| Breakpoint stays `verified: false` | Script not loaded yet (test isolate, lazily loaded library) | Wait for the launch's first stop; it verifies on load |
| A Flutter launch on a device hangs, or `adb: device offline` | A previous instance is still being replaced / stale adb forwards | `adb shell am force-stop <package>` and `adb forward --remove-all` before launching |
| "The dart-test runner does not support attach" | The attach's `cwd`/`runner` resolved to a test runner | Attach with `runner: "dart"` (or `"flutter"`); the test adapters only launch |
