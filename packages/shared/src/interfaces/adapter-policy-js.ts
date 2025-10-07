/**
 * JsDebugAdapterPolicy - policy for VS Code js-debug (pwa-node)
 *
 * Encodes js-debug specific multi-session behavior while preserving
 * generic DAP flow in core code.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from './adapter-policy.js';

export const JsDebugAdapterPolicy: AdapterPolicy = {
  name: 'js-debug',
  supportsReverseStartDebugging: true,
  childSessionStrategy: 'launchWithPendingTarget',
  shouldDeferParentConfigDone: () => true,
  buildChildStartArgs: (pendingId: string, parentConfig: Record<string, unknown>) => {
    const type = typeof parentConfig?.type === 'string' ? (parentConfig.type as string) : 'pwa-node';
    return {
      command: 'attach',
      args: {
        type,
        request: 'attach',
        __pendingTargetId: pendingId,
        continueOnAttach: false
      }
    };
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    // js-debug often signals readiness by posting a 'thread' event or an early 'stopped'.
    // Waiting on these ensures threads() will not be empty.
    return evt?.event === 'thread' || evt?.event === 'stopped';
  }
};
