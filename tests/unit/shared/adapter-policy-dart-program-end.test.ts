/**
 * `AdapterPolicy.explainProgramEnd` for Dart (issue #877): a `flutter run` whose `deviceId` matched
 * no device prints the devices it found and exits ~3 s after the launch answered (measured), so the
 * answers that report the program's end carry that list as `availableDevices`.
 */
import { describe, expect, it } from 'vitest';
import { DartAdapterPolicy, PythonAdapterPolicy, explainFlutterProgramEnd, parseFlutterDeviceMiss, type AdapterPolicy } from '@debugmcp/shared';

const MISS = "[mcp-debugger] Warning: runner: flutter (flutter project (C:\\proj\\pubspec.yaml))\nNo supported devices found with name or id matching \'bogus\'.\n\nThe following devices were found:\nsdk gphone64 x86 64 (mobile) • emulator-5554 • android-x64    • Android 15 (API 35) (emulator)\nWindows (desktop)            • windows       • windows-x64    • Microsoft Windows [Version 10.0.26200.9711]\nChrome (web)                 • chrome        • web-javascript • Google Chrome 155.0.8059.85\n";

const NONE_SUPPORTED_TEXT =
  'No supported devices connected.\n' +
  '\n' +
  'The following devices were found, but are not supported by this project:\n' +
  'Windows (desktop) • windows • windows-x64    • Microsoft Windows [Version 10.0.26200.9711]\n' +
  'Chrome (web)      • chrome  • web-javascript • Google Chrome 156.0.8078.48\n' +
  'Edge (web)        • edge    • web-javascript • Microsoft Edge 156.0.4314.42\n' +
  'If you would like your app to run on web or windows, consider running `flutter create .` to generate projects for these platforms.\n' +
  '\n' +
  'Exited (1).\n';

describe('DartAdapterPolicy.explainProgramEnd (issue #877)', () => {
  const explain = DartAdapterPolicy.explainProgramEnd;

  it('names the devices flutter run listed when deviceId matched none, as availableDevices', () => {
    const explanation = explain({ outputTail: MISS, exitCode: undefined });
    expect(explanation?.data?.requestedDeviceId).toBe('bogus');
    expect(explanation?.data?.availableDevices).toEqual([
      { id: 'emulator-5554', name: 'sdk gphone64 x86 64', kind: 'mobile', targetPlatform: 'android-x64' },
      { id: 'windows', name: 'Windows', kind: 'desktop', targetPlatform: 'windows-x64' },
      { id: 'chrome', name: 'Chrome', kind: 'web', targetPlatform: 'web-javascript' },
    ]);
    expect(explanation?.note).toMatch(/'bogus' matched no device/);
    expect(explanation?.note).toMatch(/emulator-5554, windows, chrome/);
    expect(explanation?.note).toMatch(/flutter emulators --launch/);
  });

  it('says when no device is connected at all', () => {
    const explanation = explain({ outputTail: 'Launching lib/main.dart...\nNo supported devices connected.\n', exitCode: 1 });
    expect(explanation?.note).toMatch(/no device is connected/);
    expect(explanation?.data?.availableDevices).toEqual([]);
  });

  it('adds nothing to an ordinary end', () => {
    expect(explain({ outputTail: 'counter=1\nExited (0).\n', exitCode: 0 })).toBeUndefined();
  });

  it('is absent on the other policies', () => {
    expect((PythonAdapterPolicy as AdapterPolicy).explainProgramEnd).toBeUndefined();
  });

  it('reads the measured no-supported-device shape: the devices the project has no platform for, and flutter\'s remedy line', () => {
    const parsed = parseFlutterDeviceMiss(NONE_SUPPORTED_TEXT);
    expect(parsed?.requested).toBeUndefined();
    expect(parsed?.devices.map((d) => d.id)).toEqual(['windows', 'chrome', 'edge']);
    expect(parsed?.devices.every((d) => d.supportedByProject === false)).toBe(true);
    expect(parsed?.hint).toBe('If you would like your app to run on web or windows, consider running `flutter create .` to generate projects for these platforms.');

    const explained = explainFlutterProgramEnd(NONE_SUPPORTED_TEXT);
    expect(explained?.note).toBe(
      'no device this project supports is connected; flutter found windows, chrome, edge, which the project has no platform for (details in availableDevices) — If you would like your app to run on web or windows, consider running `flutter create .` to generate projects for these platforms. Otherwise boot an emulator (flutter emulators --launch <id>) or plug a device in.'
    );
    expect(explained?.data).toEqual({ availableDevices: parsed?.devices });
  });

  it('says a deviceId matched nothing when flutter found no device at all', () => {
    const explained = explainFlutterProgramEnd("No supported devices found with name or id matching 'bogus'.\n\n");
    expect(explained?.note).toBe("deviceId 'bogus' matched no device; flutter found no device — boot an emulator (flutter emulators --launch <id>), plug a device in, or pass deviceId: \"chrome\" for the web.");
    expect(explained?.data).toEqual({ requestedDeviceId: 'bogus', availableDevices: [] });
  });
});
