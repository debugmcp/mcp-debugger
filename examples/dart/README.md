# Dart examples

Programs the Dart adapter's tests and the docs use. They run against the Dart SDK's own debug
adapter (`dart debug_adapter`), which ships with every Dart and Flutter install.

## Prerequisites

- Dart SDK 3.x on PATH (`dart --version`), or Flutter, whose `bin/cache/dart-sdk` the adapter finds
  through `flutter` on PATH / `FLUTTER_ROOT`. Standalone installs: <https://dart.dev/get-dart>
  (Windows: `winget install Google.DartSDK`; macOS: `brew install dart`; Linux: the `dart` apt package).
- For `dart_probe/`, resolve its one dev dependency once: `cd dart_probe && dart pub get`.

Do not run `dart test` from a project under `%LOCALAPPDATA%\Temp` with the winget SDK: package:test
spawns the frontend server by a relative path that does not resolve from there.

## Programs

| Program | What it exercises | Breakpoint lines |
|---|---|---|
| `hello.dart` | A single file with no `pubspec.yaml` — the Docker and canary target | `BP-HELLO` line 3 |
| `dart_probe/bin/app.dart` | Locals, a class value, `await` stepping, a spawned isolate, stderr, a last line without a newline | `BP-MAIN` 29, `BP-ASYNC` 16, `BP-AFTER-AWAIT` 32, `BP-ISOLATE` 22, `BP-AFTER-ISOLATE` 36 |
| `dart_probe/bin/pause.dart` | A long-running loop for attach and pause (prints its pid and `tick=` lines) | `BP-TICK` 10 |
| `dart_probe/bin/throws.dart` | A caught then an uncaught `ArgumentError` for the exception filters (exit code 255) | throw site line 2 |
| `dart_probe/test/math_test.dart` | Two package:test cases, one failing on purpose (`dart-test` runner, `-n 'adds numbers'`) | `BP-TEST` 8 |

The `// BP-NAME` comments mark the lines the tests break on; the e2e helpers locate them by name,
so edits that move a line do not break the suite.

## Running

```bash
dart run hello.dart
cd dart_probe && dart pub get && dart run bin/app.dart && dart test -n 'adds numbers'
```

Attach target with the VM service enabled (the adapter attaches by URI or service-info file):

```bash
dart --enable-vm-service=0 --pause_isolates_on_start --write-service-info=/tmp/dart-vm.json run bin/pause.dart
```

The host e2e suites are `tests/e2e/mcp-server-smoke-dart.test.ts` and
`tests/e2e/mcp-server-smoke-dart-attach.test.ts`; they self-skip without a Dart SDK.
