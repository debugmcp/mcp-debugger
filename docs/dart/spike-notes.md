# Dart/Flutter adapter spike notes (#790, M0)

Measured facts about the Dart SDK's debug adapter (`dart debug_adapter [--test]`) and the Flutter
SDK's (`flutter debug-adapter [--test]`), gathered with a throwaway DAP-over-stdio driver before any
adapter code was written. Numbers are from one Windows 11 box (Dart 3.13.4 via winget, Flutter
3.47.7 stable with its bundled Dart 3.13.5, VS 2022 Build Tools 17.14) on 2026-10-09 unless stated.
Where this document and the adapter disagree, re-measure; where it and the SDK source disagree, the
measurement wins for the SDK versions named.

## Versions and layout

| Thing | Value |
|---|---|
| Dart SDK (standalone) | 3.13.4 stable, winget `Google.DartSDK` (portable) → `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.DartSDK_*\dart-sdk\bin` placed directly on the user PATH (no symlink alias on this box) |
| Flutter SDK | 3.47.7 stable, zip to `C:\src\flutter`; bundled Dart 3.13.5 at `bin\cache\dart-sdk`; `flutter --version` bootstraps `bin\cache` (tool snapshot, engine artifacts) |
| `dart --version` | prints to **stdout** (`Dart SDK version: 3.13.4 (stable) (…) on "windows_x64"`); nothing on stderr |
| `flutter --version --machine` | JSON with `frameworkVersion`, `channel`, `dartSdkVersion`, `flutterRoot`, engine fields; the first call after extraction also prints "Building flutter tool…/Running pub upgrade…" lines **before** the JSON on stdout |
| `flutter devices --machine` | JSON array of `{name,id,isSupported,targetPlatform,emulator,sdk,capabilities{hotReload,hotRestart,screenshot,flutterExit,hardwareRendering,startPaused}}`; here: `windows`, `chrome`, `edge` |
| `dart debug_adapter --help` | flags `--[no-]ipv6`, `--[no-]test` only; stdio DAP, no port |

## Handshake and launch shape (Dart CLI adapter)

- `initialize` response and the `initialized` event arrive in the **same chunk**; a client that arms
  its `initialized` listener after awaiting the response misses it. The proxy listens continuously,
  so this only bit the spike driver.
- Order that works (mirrors the Go/.NET `sendLaunchBeforeConfig` flow): `initialize` →
  `launch` (sent, not awaited) → `setBreakpoints` → `setExceptionBreakpoints` → `configurationDone`
  → launch response. The launch response comes back **~7 ms after configurationDone**, before the
  program has started; the program's first event (`Connecting to VM Service…` output,
  `dart.debuggerUris`) follows ~500–600 ms later. `configFirst` order (config, then launch) also works.
- `dart.debuggerUris { vmServiceUri: "ws://127.0.0.1:<port>/<token>=/ws" }` is emitted once per
  launch (not with `noDebug`).
- Pre-launch `setBreakpoints` answers `{ verified:false, reason:'pending', message:'Breakpoint has
  not yet been resolved', id }`; a `breakpoint` event (`reason:'changed'`, `verified:true`, with
  `column`) follows when the isolate loads the script (same ms as the entry stop).
- Every later `setBreakpoints` for the file (a live re-send while paused included) answers the same
  `pending` shape with **fresh ids** (100000/100001 → 100002/100003 → …), and the verifying
  `breakpoint` events for the new ids arrive **in the same chunk as the response** — measured in the
  proxy log of `examples/dart/hello.dart`: response at 02.493, both events at 02.493, reaching the
  worker's event handler before the response promise settled. The events never carry `source`.
  `stopped{reason:'breakpoint'}` carries **no `hitBreakpointIds`**. Consequences in mcp-debugger: the
  worker fills `source` from the ids each answer named and holds source-less events for ids no answer
  has named yet while a `setBreakpoints` is in flight; the session store treats a `reason:'pending'`
  answer as no verdict on a record it already verified (the fresh id is stamped, nothing else).

## Entry stop

| Mode | Observed sequence |
|---|---|
| default (adapter sets `--pause_isolates_on_start` itself) | `thread started` → `stopped{reason:'entry'}` → `continued` **1 ms later** → program runs. A `continue` request sent 2 ms after that transient stop **succeeds** (no error). |
| user flag `vmAdditionalArgs: ['--pause_isolates_on_start']` (hyphen spelling `--pause-isolates-on-start` behaves the same) | `stopped{entry}` is **durable** (nothing for 3 s); `stackTrace` returns **0 frames**; `stepIn` from it lands in `_RawReceivePort._handleMessage` (isolate_patch.dart), not in `main`. Every spawned isolate also stops at entry and must be continued per thread. In `--test` mode there are two such stops (package:test runner isolate, then the test isolate). |
| breakpoint on the `main(` declaration line | binds on that line (verified, column 32) and **hits first**, frame `main@<line>` with `args` in Locals. This is the usable "stop at entry" for Dart programs. |

Consequence for the adapter: `stopOnEntry` = temporary breakpoint on the program's `main(` line
(regex on the source), relabelled `entry` on hit; the durable VM pause is not worth exposing. With
`stopOnEntry:false` nothing extra is needed: the adapter's own transient entry stop is followed by
`continued`, and the core's auto-`continue` is harmless.

## Exit

- Default: `stopped{reason:'exit'}` (pause_isolates_on_exit) → `thread exited` → `exited{exitCode}` +
  `output "\nExited.\n"` (no category) + `terminated`, ~25–30 ms after the exit stop. The adapter
  resumes the exit pause itself; no `continued` precedes `exited`.
- `vmAdditionalArgs: ['--pause_isolates_on_exit=false']` (the adapter treats it as user-set and does
  not add its own) **removes the exit stop entirely**; all output, including a final line without a
  newline, still arrives before `exited`. `--no-pause-isolates-on-exit` does **not** work (the
  adapter still appends its own `--pause_isolates_on_exit`, which wins).
- Uncaught exception: exit code 255 and `output "\nExited (255).\n"`.
- The adapter process stays alive after `terminated` until `disconnect`.

## Stops, stepping, inspection

- Threads = isolates, ids 1, 2, …; `thread started/exited` events per isolate.
- Scopes at a frame: `Locals`, `Globals` (`expensive:false`); at an exception stop a third scope
  `Exceptions` appears. Variables carry `value` and `variablesReference`; `type` was absent in the
  samples; lists render as `List (3 items)` with a reference.
- `evaluate` with `frameId` works for locals and member access (`counter.value`); an unknown name
  gives `Undefined name 'x'.`; `$_threadException` evaluates to the current exception object.
- `next` stops **twice per source line** (once per token position: e.g. line 29 col 26, then col 32);
  `granularity: 'line' | 'statement'` is accepted and ignored. Steps take 3–30 ms. Stepping over an
  `await` lands on the next line with the stack `main@32`, `<asynchronous gap>@0` (frame
  `presentationHint:'label'`, line 0).
- Frames below `main` are SDK internals (`_delayEntrypointInvocation.<anonymous closure>`,
  `_RawReceivePort._handleMessage`) whose `source.path` points into the SDK's `lib/_internal/vm/lib`.
- `pause` on a running isolate: `stopped{reason:'pause'}` in 2–3 ms (one 9 s outlier in the very
  first batch, not reproduced in three later rounds). While the isolate is idle in an `await`, the
  stack is **empty** and stays empty across retries; `pause` while already paused succeeds.
- `continue { threadId: 999 }` → error `Thread 999 was not found`.

## Breakpoints

- Conditional breakpoints work (`tick == 25`). `hitCondition` is accepted and silently ignored
  (`supportsHitConditionalBreakpoints` is not advertised).
- Logpoints work: `logMessage: 'tick is {tick} and double {tick * 2}'` produces `output` events
  (no category, trailing newline) without stopping. **A `condition` on a logpoint line is ignored**
  (every hit logs).
- `setFunctionBreakpoints`, `exceptionInfo`, `completions` → `Unknown command …`; `restart` →
  `restartRequest was called on an adapter that does not provide an implementation` (Dart CLI).

## Exceptions

| Filters | Stops |
|---|---|
| `['Unhandled']` | one `stopped{reason:'exception', text:'ArgumentError (Invalid argument(s): b must not be zero)'}` at the throw site inside `divide` (the uncaught one); the caught throw does not stop |
| `['All']` | two stops (caught, then uncaught) |

## `dart debug_adapter --test`

- `launch { program: <test file>, cwd, args: ['-n', 'adds numbers'] }` runs the named test; the
  breakpoint in the test body hits on **thread 2** (thread 1 is the runner) ~0.9 s after launch;
  frames: `main.<anonymous closure>@8`, `Declarer.test.<anonymous closure>.<anonymous closure>`,
  `<asynchronous gap>`, …; Locals show the test body's variables.
- `dart.testNotification` events: `start`, `suite`, `testStart` (the "loading <file>" pseudo-test),
  `allSuites`, `testDone` (`hidden:true`), `group`, `testStart` (the test), `testDone`
  (`result:'success'`), `done`. The adapter **also** prints `✓ adds numbers` as a `console` output
  event, so test results reach `get_output` without any translation.
- A compile error in the test file: the launch response **fails** with `Session terminated before
  debugger initialized:  (1)`, the compiler diagnostics arrive as `stderr` output events carrying
  `source`/`line`/`column`, then `output "\nExited (1).\n"` and `terminated` — **no `exited` event**.
- Attach is refused by the test adapter (not measured here; by source).

## Attach (Dart CLI adapter)

- Target started with `dart --enable-vm-service=0 --pause_isolates_on_start --write-service-info=<f>
  run bin/pause.dart`; `attach { vmServiceInfoFile: <f>, cwd }` → entry stop (durable, the target
  set the flag) **226 ms** after the attach request; breakpoints set before `configurationDone`
  resolve and hit after `continue`.
- Target started with `--enable-vm-service=8181 --disable-service-auth-codes`; `attach
  { vmServiceUri: 'ws://127.0.0.1:8181/ws' }` works (no entry stop: the program was already running).
  The target's own banner lines ("The Dart VM service is listening on …") arrive as `stdout`
  output events after attach.
- `disconnect` and `terminate` on an attach **detach** (`output "\nDetached.\n"`, `terminated`,
  no `exited`); the target keeps running.

## Launch teardown

- `terminate` while the program runs: response in ~320 ms, then `exited{exitCode:-1}` +
  `terminated` (one 10.3 s outlier in the first batch). `disconnect`: ~310 ms, same events.
- `noDebug: true`: no stops, no `dart.debuggerUris`, program output, `exited 0`, `terminated`.

## Environment quirks worth a doctor hint

- With the winget Dart SDK, `dart test` **fails** when the project's cwd is under
  `%LOCALAPPDATA%\Temp\…` ("The system cannot find the file specified … Command:
  ..\..\..\..\..\..\..\Microsoft\WinGet\Packages\…\dartaotruntime.exe …" — package:test spawns the
  frontend server through a cwd-relative SDK path). The same project under `C:\src` or
  `%USERPROFILE%\projects` works; Flutter's bundled Dart worked from every location tried.
  Upstream, not ours; keep examples out of Temp and say so in the docs.

## Flutter (Windows) — measured in the second half of the spike

Spawned exactly as the adapter will on Windows: `C:\src\flutter\bin\cache\dart-sdk\bin\dart.exe
--packages=C:\src\flutter\packages\flutter_tools\.dart_tool\package_config.json
C:\src\flutter\bin\cache\flutter_tools.snapshot debug-adapter [--test]` with env `FLUTTER_ROOT`.

- `initialize` answers in ~600 ms (run and test adapters); the capability set is identical to the
  Dart CLI adapter's, including `supportsRestartRequest:false` at this point (the `capabilities`
  event after `app.start` is where Flutter flips it — see below).
### `flutter debug-adapter --test` (widget test)

- `launch { program: test/widget_test.dart, cwd, args: ['--name', 'increments'] }`: the launch
  response arrives when the test VM is connected (**6.4 s** after the request on the cold run,
  which includes compiling the test kernel), `dart.debuggerUris` just before it, then a transient
  `stopped{entry}` and the breakpoint stop at **6.9 s** (warm: response 2.8 s, breakpoint 3.3 s). `dart.testNotification`
  `start/suite/testStart(loading)` arrive ~1.3 s after launch, long before the VM connects.
- Frames at the test breakpoint: `main.<anonymous closure>@8`, `<asynchronous gap>`,
  `testWidgets.<anonymous closure>.<anonymous closure>@192 (widget_tester.dart)`, `<asynchronous
  gap>`; Locals: `tester`; `evaluate('find.text("count: 0").evaluate().length')` → `1` (method calls
  on framework objects work in the test isolate).
- Flutter registers `dart.serviceRegistered` (`flutterVersion`, `compileExpression`) and ~40
  `dart.serviceExtensionAdded` (`ext.flutter.*`) events right after connecting — noise to ignore.
- `debugPrint` inside the app shows up twice: as `dart.testNotification {type:'print'}` and as a
  `stdout` output event. The test result is a `console` output line `✓ increments` plus
  `testDone{result:'success'}`, `allSuites`, `done{success:true}`.
- End of run: `output "\nExited.\n"` and `terminated` — **no `exited` event** from the Flutter test
  adapter (the js-debug precedent: exit code only through `terminated`).
- A compile error in the test file: launch response fails (`Session terminated before debugger
  initialized:  (1)`), diagnostics as `stderr` output events with `source`/`line`/`column`, then
  `terminated`.

### `flutter debug-adapter` — `flutter run -d windows` (cold)

- `launch { program: lib/main.dart, cwd, toolArgs: ['-d','windows'] }` with two breakpoints
  (`build()`, `increment()`): launch response in **33 ms** (like Dart CLI, right after
  configurationDone); `capabilities { supportsRestartRequest: true }` and `flutter.appStart
  { appId, deviceId:'windows', directory, supportsRestart:true, launchMode:'run', … }` at **1.1 s**;
  the Windows runner build + app start take until **24.4 s** (`dart.debuggerUris`), then `thread
  started`, transient `stopped{entry}` (+`continued` 2 ms later), `flutter.appStarted`, five
  `dart.serviceRegistered`, both `breakpoint` events `verified:true`, ~70 `dart.serviceExtensionAdded`,
  and the `build()` breakpoint at **24.5 s**. (Warm numbers below.)
- At the `build()` stop: frames `_ProbeAppState.build@30`, `StatefulElement.build@5944`,
  `ComponentElement.performRebuild@5830`; Locals `context=StatefulElement`, `this=_ProbeAppState`;
  `evaluate` of `counter` → `0`, `this` → `_ProbeAppState`, `history` → `List (0 items)`,
  `widget` → `ProbeApp` — widget state is readable through `this`.
- `restart` (hot restart): response `success`; `thread exited` + `thread started` (a **new isolate
  id**), transient `stopped{entry}`, both breakpoints re-verified by `breakpoint` events, and the
  `build()` breakpoint hits again **399 ms** after the request. The old thread id is gone.
- `hotReload` custom request: `success`; the reassemble runs `build()` and the breakpoint hits
  while the request is still in flight (the stop preceded the response; a client must listen for
  the stop before sending the request). `flutter.serviceExtensionStateChanged` events
  (`ext.flutter.connectedVmServiceUri`, `ext.flutter.activeDevToolsServerAddress`) follow start-up.
- `terminate` with the app paused at a breakpoint: response in **955 ms**, `terminated`, **no
  `exited`**, and the **adapter process exits by itself (code 0)** right after — unlike the Dart
  CLI adapter, which stays alive until `disconnect`.

### `flutter run -d windows` — warm, and the no-breakpoint entry sequence

- Warm (runner already built): `flutter.appStart` at 1.26 s, `dart.debuggerUris` at **8.65 s**,
  `build()` breakpoint at **8.8 s** (cold was 24.5 s). Hot restart re-hits in 398 ms; hot reload
  re-hits ~1.1 s after the request.
- No breakpoints: `capabilities` 1.3 s → `thread started` 8.8 s → `stopped{entry}` → `continued`
  **2 ms later** (transient; `flutter.appStarted` in between). Nothing else stops. There is no
  `vmAdditionalArgs` for Flutter, so the Dart user-flag trick does not apply; a `main(`-line
  breakpoint is the only entry stop (same mechanism as Dart; not separately measured on Flutter).
- `disconnect` on a launched app: response in **895 ms**, `terminated`, five
  `dart.serviceUnregistered` events, no `exited`, and the adapter process exits (code 0).

### `flutter debug-adapter --test` with `integration_test/` on the Windows desktop embedder

- `launch { program: integration_test/app_test.dart, cwd, toolArgs: ['-d','windows'] }` with one
  breakpoint in the test body and one inside the app's `increment()`: the adapter builds the
  desktop app (`✓ Built build\windows\x64\runner\Debug\flutter_probe.exe` as a `stdout` output
  event), connects, transient `stopped{entry}` → `continued`, launch response at **13.5 s**, the
  test breakpoint at **14.5 s** (frame `main.<anonymous closure>@11`, Locals `tester`), and after
  `continue` the test's `tester.tap(...)` hits the app breakpoint at **14.6 s** (frame
  `_ProbeAppState.increment.<anonymous closure>@22`, Locals `this`; `evaluate('this.counter')` → `0`,
  `counter` → `0`). Both breakpoints live in the **same isolate/thread (1)**: for integration tests
  the app isolate is the test isolate.
- Then `counter=1` (stdout), `✓ device increment` (console), `dart.testNotification` sequence
  `start/suite/testStart(loading)/debug/testDone/group/testStart/print/testDone/
  testStart((tearDownAll))/testDone/allSuites/done`, `output "\nExited.\n"`, `terminated`,
  no `exited`.
- Breakpoints set before launch answer `verified:false` and are verified by `breakpoint` events
  once the app isolate loads the scripts (same as Dart CLI).

### Attach to a running `flutter run --machine` app (Windows desktop)

- The app was started outside the debugger with `dart.exe --packages=… flutter_tools.snapshot run
  -d windows --machine` (spawning `flutter.bat` through `cmd.exe` from Node mangles the quoting);
  its machine stream: `daemon.connected`, `app.start`, `app.progress…`, **`app.debugPort`**
  (`params.wsUri = ws://127.0.0.1:<port>/<token>=/ws`) at **8.5 s**, `app.devTools`, `app.dtd`,
  `app.started`.
- DAP `attach { vmServiceUri, cwd, toolArgs: ['-d','windows'] }` (breakpoint on `build()` set
  before `configurationDone`): attach response in **28 ms**; `capabilities { supportsRestartRequest:
  true }` + `flutter.appStart { launchMode:'attach', mode:'debug', directory:null }` at ~1 s; the
  adapter's `flutter attach` connects to the VM at **~2.3 s** (`Connecting to VM Service…`,
  `dart.debuggerUris`, `thread started`, `flutter.appStarted`) and the breakpoint is verified by a
  `breakpoint` event right then. **No entry stop** on attach (the app is running). The breakpoint
  hit ~0.8 s later on the next rebuild (before any hot reload was requested).
- `hotReload` through the attached adapter works: `stdout` output `Reloaded 0 libraries in
  2,126ms (compile: 5 ms, reload: 0 ms, reassemble: 2020 ms)`.
- `disconnect` while paused at the breakpoint: response in **1.9 s**, `output "\nDetached.\n"`,
  `terminated`, **`continued`** for the paused thread (the adapter resumes it on detach), the
  adapter process exits (code 0), and the app keeps running.

## Android emulator

### Toolchain and boot (this box)

- SDK from the command-line tools zip (no Android Studio wizard): `cmdline-tools/latest`,
  `platform-tools` 37.0.1, `emulator` 37.2.12, `platforms;android-35` + `android-36`
  (Flutter 3.47.7's `flutter doctor` demands platform 36), `build-tools` 35 + 36,
  `system-images;android-35;google_apis;x86_64`. Licenses via `sdkmanager --licenses < yes.txt`
  under `cmd.exe` (a PowerShell pipe into the `.bat` did not deliver the answers).
- AVD `mcp_api35` (`pixel_7`, API 35 x86_64). `emulator -accel-check` → WHPX usable.
- Headless boot: `emulator -avd mcp_api35 -no-window -no-boot-anim -no-audio -no-snapshot-save
  -gpu swiftshader_indirect`; `adb devices` lists `emulator-5554` after **4 s**,
  `sys.boot_completed` = 1 after **43 s**. The first `adb` start raised a **Windows Firewall
  dialog** (`adb.exe`, Public profile); until it is approved nothing fails on loopback, but an
  unattended run should pre-create the rule (`netsh advfirewall firewall add rule name=adb.exe
  dir=in action=allow program=<sdk>\platform-tools\adb.exe`). `flutter doctor` lists the device as "offline" until
  then. Flutter's own listing: `flutter emulators` shows `mcp_api35`; `flutter emulators --launch
  mcp_api35` is the documented equivalent (not used here; the raw emulator command gives the
  headless flags).

### Gradle build cost

- `flutter build apk --debug` on a fresh SDK/project: **425 s** (Gradle distribution, Android
  Gradle plugin and dependency downloads dominate; the Gradle task itself reported 422.6 s).
- Second build, nothing changed: **6 s** (Gradle task 4.3 s). A DAP launch on the emulator pays
  the warm cost plus install and app start (below); the cold cost belongs to the first build on a
  machine, not to the debugger, and is far outside any launch ceiling — the adapter must report a
  build in progress rather than time out.

### `flutter run -d emulator-5554` through the DAP (Gradle warm, app not yet installed)

- Launch response **36 ms**; `flutter.appStart { deviceId:'emulator-5554', … }` at 1.3 s; the
  tool's progress lines arrive as `console` output (`Launching lib\main.dart on sdk gphone64 x86 64
  in debug mode...`, `✓ Built build\app\outputs\flutter-apk\app-debug.apk` at **13.3 s**); logcat
  lines (`I/FlutterActivityAndFragmentDelegate…`, `D/FlutterJNI…`, `I/flutter ( pid): …`) arrive as
  `console` before the VM connects and as `stdout` after; `dart.debuggerUris` at **16.5 s**;
  transient `stopped{entry}`; the `build()` breakpoint at **16.8 s**. (Warm app numbers below.)
- Same inspection results as on desktop (`this=_ProbeAppState`, `counter` → `0`, `history`,
  `widget`). Hot restart re-hits the breakpoint in **1.06 s** (new isolate id), hot reload in
  **2.1 s**; `terminate` 1.0 s → `terminated`, no `exited`, adapter exits (code 0).

- Warm (APK already built and installed): `flutter.appStart` 1.5 s, `dart.debuggerUris` **7.2 s**,
  `build()` breakpoint **7.5 s**; hot restart re-hit 1.09 s; hot reload re-hit 2.1 s; `terminate`
  1.04 s. One hung run was observed when the previous app instance was still alive on the
  emulator while the next launch re-installed the APK (`Package … reported as REPLACED … Assuming
  REMOVED` in logcat); `adb shell am force-stop <package>` before launching avoided it.

### `integration_test/` on the emulator through the test adapter

- `launch { program: integration_test/app_test.dart, cwd, toolArgs: ['-d','emulator-5554'] }`:
  launch response at **17.8 s** (APK build + install + start), the test breakpoint at **18.9 s**,
  the app breakpoint hit by the test's tap at **19.1 s** with `this.counter` → `0`; notifications
  and the "Exited." + `terminated` (no `exited`) ending match the desktop run.
- The first attempt failed with `Failed to start Dart Development Service` + `adb.exe: device
  offline` while the previous app instance was still being replaced: stop the app and clear
  forwards (`adb shell am force-stop <pkg>`, `adb forward --remove-all`) before a device launch.

### Attach to a running app on the emulator — NOT working yet (M3 item)

- External `flutter run -d emulator-5554 --machine` reported `app.debugPort` (host-forwarded
  `ws://127.0.0.1:<port>/<token>=/ws`) at **9.8–11 s**. DAP `attach { vmServiceUri, toolArgs:
  ['-d','emulator-5554'] }`: response in 39 ms, `capabilities` + `flutter.appStart{launchMode:
  'attach'}` at 1.4 s, then `Connecting to the VM Service is taking longer than expected...`,
  `Still attempting to connect to the VM Service... try re-running with --host-vmservice-port`,
  and no `flutter.appStarted` within 60 s. `disconnect` detaches cleanly (1.9 s) and the app
  stays alive. The desktop attach with the same recipe works, so the difference is the adb port
  forward owned by the other tool; M3 measures `--host-vmservice-port`/`--device-vmservice-port`
  via `toolArgs`, attaching with the device-side URI, and `--no-dds`.

## Flutter through the server (M2, 2026-10-09)

Measured through `dist/index.js` with `tests/e2e/mcp-server-smoke-flutter.test.ts` against
`examples/dart/flutter_probe` (Flutter 3.47.7, Windows 11, Visual Studio Build Tools 2022):

| Case | First launch of the fresh example | Warm |
|---|---|---|
| widget test, breakpoint in the test body (`flutter debug-adapter --test`, `--name increments`) | ~30 s | 5.8 s whole case |
| widget test, `stopOnEntry: true` (entry breakpoint on the test file's `main(`) | — | 5.6 s whole case |
| `flutter run -d windows`, breakpoint in `build()` | ~30 s | 20 s whole case |
| `integration_test` on `-d windows`, test breakpoint then the app's `increment()` breakpoint on the tap | — | 20.5 s whole case |

- Both runners answer `start_debugging` with `pending: true` after the one-second hold; the first
  stop arrives through `wait_for_stop`.
- At the widget-test breakpoint: frame `main.<anonymous closure>`, Locals `tester = WidgetTester`,
  `find.text("count: 0").evaluate().length` evaluates to `1`.
- At the `build()` breakpoint: frame `_ProbeAppState.build`, Locals `context` and `this`,
  `counter` → `0`, `this.history.length` → `0`.
- At the integration test's app breakpoint: frame `_ProbeAppState.increment.<anonymous closure>`,
  `counter` → `0` (paused before the increment).
- A `flutter test` session ends `stopped` with no `exitCode` (`terminated`, no `exited`); the
  adapter's `✓ increments` / `✓ device increment` lines and the app's `counter=1` are in
  `get_output`. `close_debug_session` on a running `flutter run` terminates the app and the
  adapter exits by itself.

## Android emulator through the server (M3, 2026-10-09)

Measured through `dist/index.js` with `tests/e2e/mcp-server-smoke-flutter-android.test.ts`
(AVD `mcp_api35`, API 35, booted headless; Gradle warm; the debug APK installed up front):

| Case | Result |
|---|---|
| `flutter run -d emulator-5554`, breakpoint in `build()` | `pending: true` at 2.5 s; the breakpoint at **21.3 s**; `_ProbeAppState.build`, `counter` → `0`; `continue` keeps it running; `close_debug_session` terminates the app |
| the same, first launch right after a fresh APK install | ended at 27.9 s with "The program ended without reporting an exit code" and no stop (once; the next launch was fine) — hence the up-front install and the force-stop before every launch |
| `integration_test` on the emulator | test breakpoint at **28.3 s**, the app's `increment()` breakpoint at **28.7 s** on the test's tap, `counter` → `0`, `✓ device increment`, end `stopped` at 31.6 s |

- `flutter build apk --debug` on the fresh example with warm Gradle caches: **45 s**.
- Before each launch: `adb shell am force-stop com.example.flutter_probe`, `adb forward --remove-all`.
- The proxy log records output events by shape only (issue #852): to read the device's output
  after the fact, `get_output` before the session closes.
