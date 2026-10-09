# flutter_probe

The Flutter example the adapter's tests and docs use: a counter app (`lib/main.dart`), a widget
test (`test/widget_test.dart`) and an integration test (`integration_test/app_test.dart`).

Only the Dart sources and `pubspec.yaml` are committed. The platform folders the Flutter tool needs
to run the app are generated, once, with:

```bash
flutter create --platforms=windows,web .
flutter pub get
```

The e2e helper (`tests/e2e/dart-example-utils.ts`, `prepareFlutterProbe`) runs exactly that.

| File | Breakpoint markers |
|---|---|
| `lib/main.dart` | `BP-FMAIN` (main's first line), `BP-INCREMENT` (inside `setState`), `BP-BUILD` (in `build`) |
| `test/widget_test.dart` | `BP-WIDGET` (in the `increments` test body) |
| `integration_test/app_test.dart` | `BP-INTEGRATION` (in the test body; the app's `BP-INCREMENT` hits when the test taps) |

```bash
flutter test                                  # the widget tests
flutter test --name increments                # one of them
flutter run -d windows                        # the app on the desktop
flutter test integration_test -d windows      # the integration test on the desktop
```
