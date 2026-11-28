/**
 * What an attach by processId leaves in a Node.js target (issue #1261): the
 * inspector. Node never closes an inspector a signal opened, and this server
 * closes none, so the inspector stays open, unauthenticated, until the target
 * restarts. The attach answer says whether this attach opened it or found it
 * open; the detach and close answers say what one probe of its address sees.
 */
import type { AttachFootprint } from '@debugmcp/shared';
import { probeInspector, type InspectorProbe } from './inspector-activation.js';

/** The answer field the footprint is reported under. */
export const INSPECTOR_FIELD = 'inspector';

export function inspectorFootprint(
  inspector: { host: string; port: number; alreadyActive: boolean },
  probe: (host: string, port: number) => Promise<InspectorProbe> = probeInspector
): AttachFootprint {
  const where = `${inspector.host}:${inspector.port}`;
  if (inspector.alreadyActive) {
    return {
      field: INSPECTOR_FIELD,
      atAttach: `already open on ${where} before this attach; left as it was`,
      atEnd: async () => `left as it was: it was already open on ${where} before this attach`
    };
  }
  return {
    field: INSPECTOR_FIELD,
    atAttach: `opened by this attach on ${where}; it stays open, unauthenticated, after this session ends, until the target restarts`,
    atEnd: async () => {
      const seen = await probe(inspector.host, inspector.port);
      if (seen.status === 'inspector') {
        return `still listening: ${where}, where this attach opened the inspector, still answers as one, unauthenticated; ` +
          'this server does not close it, and restarting the target does';
      }
      if (seen.status === 'closed') {
        return `no longer listening: ${where}, where this attach opened the inspector, no longer accepts connections`;
      }
      return `not checked: ${where}, where this attach opened the inspector, did not answer as one (${seen.detail}); ` +
        'this server does not close it, and restarting the target does';
    }
  };
}
