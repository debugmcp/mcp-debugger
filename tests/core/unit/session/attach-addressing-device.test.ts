/**
 * A Flutter attach may address an app on a device by `adapterConfig.deviceId` alone: `flutter
 * attach -d <id>` discovers the app's VM service on the device (issue #882). The gate must count
 * that as naming a target, so `create_debug_session`'s attach shortcut (issue #905) fires on it.
 */
import { describe, expect, it } from 'vitest';
import { ADAPTER_CONFIG_TARGET_KEYS, namesAttachTarget } from '../../../../src/session/attach/attach-addressing.js';

describe('attach addressing: deviceId names a target (issue #882)', () => {
  it('counts adapterConfig.deviceId as an attach target', () => {
    expect(namesAttachTarget({ adapterConfig: { deviceId: 'emulator-5554' } })).toBe(true);
    expect(ADAPTER_CONFIG_TARGET_KEYS).toContain('deviceId');
  });

  it('still refuses an empty deviceId as naming nothing', () => {
    expect(namesAttachTarget({ adapterConfig: { deviceId: '' } })).toBe(false);
  });
});
