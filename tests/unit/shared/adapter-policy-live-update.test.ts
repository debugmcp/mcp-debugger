/**
 * `AdapterPolicy.liveUpdate` (issue #876): the one policy member behind `hot_reload` — apply
 * changed code to the running program and keep its state. Java implements it with the JDI
 * bridge's `redefineClasses` (HotSwap); Flutter with the SDK adapter's `hotReload`, gated on the
 * app having started (learned from the adapter's `flutter.appStart` / `flutter.appStarted`
 * events). Every other policy has none, and `hot_reload` refuses them by name.
 */
import { describe, expect, it } from 'vitest';
import { DartAdapterPolicy, JavaAdapterPolicy, MockAdapterPolicy, PythonAdapterPolicy, type AdapterPolicy, type LiveUpdatePolicy } from '@debugmcp/shared';

describe('AdapterPolicy.liveUpdate (issue #876)', () => {
  describe('dart (Flutter hot reload)', () => {
    const lu: LiveUpdatePolicy = DartAdapterPolicy.liveUpdate;

    it('asks the worker for the Flutter app events and names hotReload as a resume', () => {
      expect(lu.events).toEqual(['flutter.appStart', 'flutter.appStarted']);
      expect(lu.resumeCommands).toEqual(['hotReload']);
    });

    it('learns the app from flutter.appStart and its start from flutter.appStarted', () => {
      const afterStart = lu.onEvent!(undefined, 'flutter.appStart', { launchMode: 'run', supportsRestart: true });
      expect(lu.request({}, afterStart)).toEqual({ refused: expect.stringMatching(/not reported appStarted/) });
      const started = lu.onEvent!(afterStart, 'flutter.appStarted', {});
      expect(lu.request({}, started)).toEqual({ command: 'hotReload' });
    });

    it('refuses a plain Dart session, which has no Flutter app, by name', () => {
      expect(lu.request({}, undefined)).toEqual({ refused: expect.stringMatching(/runs `dart`/) });
    });

    it('refuses the Java hot-swap argument', () => {
      const started = lu.onEvent!(lu.onEvent!(undefined, 'flutter.appStart', {}), 'flutter.appStarted', {});
      expect(lu.request({ classesDir: 'C:/classes' }, started)).toEqual({ refused: expect.stringMatching(/classesDir/) });
    });

    it('says the reassemble may stop the program, and that every reload changed code', () => {
      expect(lu.mayStopDuringUpdate).toBe(true);
      expect(lu.changed(undefined)).toBe(true);
    });
  });

  describe('java (JVM HotSwap)', () => {
    const lu: LiveUpdatePolicy = JavaAdapterPolicy.liveUpdate;

    it('needs classesDir and sends redefineClasses with sinceTimestamp defaulted to 0', () => {
      expect(lu.request({}, undefined)).toEqual({ refused: expect.stringMatching(/classesDir/) });
      expect(lu.request({ classesDir: '/c', sinceTimestamp: 5 }, undefined)).toEqual({ command: 'redefineClasses', args: { classesDir: '/c', sinceTimestamp: 5 } });
      expect(lu.request({ classesDir: '/c' }, undefined)).toEqual({ command: 'redefineClasses', args: { classesDir: '/c', sinceTimestamp: 0 } });
    });

    it('counts a redefine as a code change only when something was redefined, and never stops the program', () => {
      expect(lu.changed({ body: { redefinedCount: 0 } } as never)).toBe(false);
      expect(lu.changed({ body: { redefinedCount: 2 } } as never)).toBe(true);
      expect(lu.mayStopDuringUpdate ?? false).toBe(false);
      expect(lu.events ?? []).toEqual([]);
    });
  });

  it('the other policies have none', () => {
    expect((MockAdapterPolicy as AdapterPolicy).liveUpdate).toBeUndefined();
    expect((PythonAdapterPolicy as AdapterPolicy).liveUpdate).toBeUndefined();
  });
});
