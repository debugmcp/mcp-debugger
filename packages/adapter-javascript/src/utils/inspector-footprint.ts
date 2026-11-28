/**
 * What an attach by processId leaves in a Node.js target (issue #1261): an
 * inspector, which this server does not close. Each sentence says only what
 * this attach observed, in order, and what this server does: never what
 * opened the inspector, nor how long it will listen.
 */
import type { AttachFootprint } from '@debugmcp/shared';
import { probeInspector, type InspectorProbe } from './inspector-activation.js';

/** The answer field the footprint is reported under. */
export const INSPECTOR_FIELD = 'inspector';

type Probe = (host: string, port: number) => Promise<InspectorProbe>;

/** After an activation that answered: one was already there, or one answered after the signal. */
export function inspectorFootprint(
  inspector: { pid: number; host: string; port: number; alreadyActive: boolean },
  probe: Probe = probeInspector
): AttachFootprint {
  const where = `${inspector.host}:${inspector.port}`;
  if (inspector.alreadyActive) {
    // Whose inspector it is is not observed: a title ending in `[digits]` can be a script's path (issue #1261).
    const found = `an inspector answered this attach's first probe on ${where}, so no signal was sent`;
    return {
      field: INSPECTOR_FIELD,
      atAttach: `already open: ${found}; this server does not close it`,
      atEnd: async () => `left as it was: ${found}; this server does not close it`
    };
  }
  const appeared = `one answered there after this attach signalled PID ${inspector.pid}`;
  return {
    field: INSPECTOR_FIELD,
    atAttach: `signalled: ${where} refused this attach's first probe, this attach then signalled PID ${inspector.pid}, ` +
      'and an inspector answered there after the signal, unauthenticated; this server does not close it',
    atEnd: async () => {
      const seen = await probe(inspector.host, inspector.port);
      if (seen.status === 'inspector') {
        return `listening: an inspector answers on ${where}, unauthenticated (${appeared}); this server does not close it`;
      }
      if (seen.status === 'closed') {
        return `not listening: ${where} no longer accepts connections (${appeared})`;
      }
      return `not checked: ${where} did not answer as an inspector (${seen.detail}); ${appeared}, and this server does not close it`;
    }
  };
}

/** After an activation that failed once the signal was sent: no inspector of the PID was identified where it looked. */
export function signalledFootprint(signal: { pid: number; host: string; port: number }): AttachFootprint {
  const text = `signalled: this attach signalled PID ${signal.pid}, and no inspector of it was identified on ${signal.host}:${signal.port}; ` +
    'one may now be open on another port, and this server does not close it';
  return { field: INSPECTOR_FIELD, atAttach: text, atEnd: async () => text };
}
