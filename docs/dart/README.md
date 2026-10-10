# Dart and Flutter debugging

mcp-debugger debugs Dart programs, package:test suites, and Flutter apps and tests with the debug
adapter that ships inside the SDK itself: `dart debug_adapter` for Dart, `flutter debug-adapter`
for Flutter, each with a `--test` variant for the test runners. Nothing is vendored or downloaded:
the adapter finds the SDK on the machine and runs it. Both servers speak the Debug Adapter Protocol
over stdio, so the adapter puts a small TCP-to-stdio bridge in front of them for the proxy.

The measured facts behind every statement here are in [spike-notes.md](spike-notes.md).

## Requirements

- **Dart SDK 3.x** (`dart --version`), or **Flutter**, which bundles one at `bin/cache/dart-sdk`.
  Install: <https://dart.dev/get-dart> (Windows `winget install Google.DartSDK`, macOS
  `brew install dart`, Linux the `dart` package) or <https://docs.flutter.dev/get-started/install>.
- Discovery order: `DART_SDK` / `FLUTTER_ROOT` → the project's fvm pin (`.fvmrc`,
  `.fvm/flutter_sdk`) → `flutter` on PATH → `dart` on PATH → common install directories. A `dart`
  found inside a Flutter checkout identifies that Flutter root too. `mcp-debugger doctor dart`
  shows what was found.
- Flutter projects need a warm tool cache: run `flutter --version` once after installing. The
  adapter runs that command itself as its toolchain probe, which also rebuilds a stale tool
  snapshot.
- Flutter targets need their platform toolchain (`flutter doctor`): Visual Studio Build Tools for
  `-d windows`, Chrome for `-d chrome`, the Android SDK and an emulator for `-d emulator-5554`.

## Which adapter runs: the `runner`

The adapter picks the SDK adapter from the project and the program:

| Runner | Spawned | Chosen when |
|---|---|---|
| `dart` | `dart debug_adapter` | a Dart project (or no pubspec at all) and the program is not a test |
| `dart-test` | `dart debug_adapter --test` | the program is under the project's `test/` directory |
| `flutter` | `flutter debug-adapter` | the nearest `pubspec.yaml` depends on `flutter` (or `flutter_test`) |
| `flutter-test` | `flutter debug-adapter --test` | a Flutter project and the program is under `test/` or `integration_test/` |

Set `runner` explicitly in `adapterLaunchConfig` (or `dapLaunchArgs`) to override. The launch
response names the runner and the pubspec it was derived from.

On Windows the Flutter adapter is started without `flutter.bat` (Node cannot spawn a batch file
without a shell): the adapter runs Flutter's bundled `dart.exe` on the tool snapshot exactly the way
the batch file does, with `FLUTTER_ROOT` set.

## Launch

```json
{ "sessionId": "…", "scriptPath": "/repo/app/bin/main.dart", "args": ["--flag"], "dapLaunchArgs": { "stopOnEntry": false } }
```

Launch options, all under `adapterLaunchConfig` (or `dapLaunchArgs`):

| Key | Runners | Meaning |
|---|---|---|
| `runner` | all | force `dart`, `dart-test`, `flutter` or `flutter-test` |
| `deviceId` | Flutter | the `flutter run -d <id>` target (`windows`, `chrome`, `emulator-5554`, …; see `flutter devices`) |
| `flutterMode` | Flutter | `debug` (default), `profile` or `release`; the Flutter tool turns the debugger off in the last two, and the launch response says so |
| `toolArgs` | all | extra arguments for `dart run` / `flutter run` / `flutter test` |
| `vmAdditionalArgs` | Dart | extra Dart VM flags |
| `debugExternalPackageLibraries`, `debugSdkLibraries` | all | step into package / SDK code (default off) |
| `evaluateToStringInDebugViews` | all | call `toString()` for values (the adapter defaults this to on) |
| `evaluateGettersInDebugViews`, `showGettersInDebugViews`, `additionalProjectPaths`, `sendLogsToClient`, `customTool`, `customToolReplacesArgs`, `vmServicePort` | all | passed through to the SDK adapter unchanged |

`args` go to the program, or to the test runner for the test runners: `["-n", "adds numbers"]`
runs one `dart test` case, `["--name", "increments"]` one `flutter test` case.

`stopOnEntry: true` stops on the first line of `main` (the adapter arms a breakpoint on the
program's `main(` declaration line, which the VM binds to main's first statement, and reports the
hit as the entry stop; the breakpoint never appears in `list_breakpoints`). If the program file
declares no `main(` — main lives in another file — the launch answer carries a warning and no
entry stop comes: set a breakpoint on main's first statement instead. The SDK adapter's own entry
pause is bookkeeping it resumes itself a millisecond later; mcp-debugger holds it briefly and
reports it only when the adapter does not resume it (a VM started with
`--pause_isolates_on_start`).

`noDebug: true` runs the program without a debugger: no breakpoints, no exception stops, output
and exit code only.

Exceptions: `breakOnExceptions: "uncaught"` (the launch default) maps to the SDK filter
`Unhandled`, `"all"` to `All`. An exception stop carries the exception's description, and an
`Exceptions` scope joins `Locals` and `Globals`.

## Attach

Dart attaches by VM-service URI, never by process id:

```json
{ "sessionId": "…", "adapterConfig": { "vmServiceUri": "ws://127.0.0.1:8181/ws" } }
{ "sessionId": "…", "adapterConfig": { "vmServiceInfoFile": "/tmp/dart-vm.json" } }
```

- Start the target with `dart --enable-vm-service=0 --write-service-info=<file> run bin/app.dart`
  (add `--pause_isolates_on_start` to have it wait for the debugger at entry), or read the URI from
  `flutter run --machine`'s `app.debugPort` event or from mcp-debugger's own launch log
  (`dart.debuggerUris`).
- `host` and `port` without a URI become `ws://host:port/ws`, which only works for a VM started
  with `--disable-service-auth-codes`; otherwise pass the full URI with its token.
- A `processId` is refused with a message explaining the above. The test runners refuse attach.
- Flutter attach takes `deviceId` as well (`flutter attach -d <id> --debug-uri <uri>`).
- Detach (`detach_from_process`, or closing the session) leaves the target running.

After attaching to a running program the session is paused; an isolate idle in an `await` shows an
empty stack until it next runs code.

## What works, what does not

| Feature | Dart / Flutter |
|---|---|
| Line breakpoints, conditions, logpoints | yes (a logpoint's `condition` is ignored by the SDK adapter) |
| Function breakpoints, hit-count conditions | no (the SDK adapter does not implement them) |
| Exception filters | `uncaught` / `all` |
| Stepping | yes; `step_over` stops once per token position, so a line with two calls takes two steps; stepping across `await` lands on the next line |
| Variables, scopes, evaluate | `Locals`, `Globals` (+ `Exceptions`); evaluate in the frame, including method calls on objects |
| Threads | one per isolate; a spawned isolate appears and exits as a thread |
| Output | stdout/stderr as output events; `dart test` / `flutter test` also print `✓ name` lines and emit structured test events |
| Exit code | reported for Dart programs; `flutter test` and `flutter run` sessions end with `terminated` only |
| `restart_debugging` | relaunches; hot reload / hot restart are not exposed yet |
| Attach | by URI or service-info file; not by PID |

## Flutter targets

`flutter test` runs headless on every platform. `flutter run` needs a device: `deviceId: "windows"`
(desktop, Visual Studio required), `"chrome"` / `"edge"` (web, through dwds; listed by `flutter
devices` but not yet exercised by the test suite), `"emulator-5554"` (Android, boot it first with
`flutter emulators --launch <id>`). First launches pay the platform build (a Windows runner build,
Gradle for Android); later launches reuse it. `integration_test/` files run through `flutter test`
on the chosen device, and a breakpoint in the app code hits when the test drives it.

Measured through the server on Windows (Flutter 3.47.7, `examples/dart/flutter_probe`,
`tests/e2e/mcp-server-smoke-flutter.test.ts`): a widget-test breakpoint in ~6 s warm, a `build()`
breakpoint under `flutter run -d windows` in ~20 s warm, an `integration_test` breakpoint on the
desktop in ~21 s warm; the first launch of a fresh project takes ~30 s for either. The launch
answers `pending: true` after its one-second hold, so follow it with `wait_for_stop` in slices
under your MCP client's request cap (60 s is a common default; 45 s is safe), called again while
the answer is `pending: true` — one long `timeout` fails on the client side first (measured at
63 s on a Gradle build, #884), and only that call: the program and its breakpoints are untouched.
A `flutter test` or `flutter run` session ends `stopped` without an exit code (the adapter sends
`terminated` only); the `✓ name` lines in `get_output` say how the tests went.

Android emulator (`deviceId: "emulator-5554"`, the AVD booted first; measured the same way with
`tests/e2e/mcp-server-smoke-flutter-android.test.ts`, Gradle warm): a `build()` breakpoint under
`flutter run` in ~21 s, an `integration_test` breakpoint in ~28 s with the app's breakpoint hit by
the test's tap right after; a cold Gradle build on a fresh machine takes minutes and belongs to
the first build, not to the debugger. `flutter run` stops and reinstalls the app itself on every
launch; the e2e helper only warms the build for the device's ABI and does the first install
ahead of the timed cases, because the first run right after a fresh install once ended without
stopping (relaunch if that happens). Attaching to an app another `flutter run` started on the
emulator does not connect yet (#882; see `docs/KNOWN_ISSUES.md`).

## Troubleshooting

- *"No Dart SDK found"* — put `dart` or `flutter` on PATH, or set `DART_SDK` / `FLUTTER_ROOT`;
  `mcp-debugger doctor dart` lists what was tried.
- *"No Flutter SDK found for a Flutter project"* — the pubspec depends on `flutter` but only a
  standalone Dart SDK was found.
- *Launch fails with "Session terminated before debugger initialized"* — the program or test did
  not compile or start; the compiler's diagnostics are in `get_output`.
- *`dart test` fails to load the suite from a project under `%LOCALAPPDATA%\Temp`* with a winget
  Dart SDK — an upstream package:test quirk; move the project.
- *Flutter attach on an Android emulator never reaches `appStarted`* when the app was launched by
  another `flutter run` — being measured; attach to Dart programs and desktop apps works.
- *In a container the launch answers and then nothing happens* — the SDK adapter waits for the
  VM's service-info file in the system temp dir, and a `/tmp` bind-mounted from the host under
  Docker Desktop delivers no file events. The adapter sets `TMPDIR=/var/tmp` for itself when
  `MCP_CONTAINER=true`; set `TMPDIR` to a container-local directory for other layouts.
