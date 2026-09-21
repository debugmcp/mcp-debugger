import type { CobolShimSessionOptions } from '../shim-protocol.js';
import { normalisePath, type ManifestRegistry } from './manifest-registry.js';
import { programEntryLocation } from './procedure-names.js';

/** Pick the launched program, never an arbitrary dynamic module from the manifest directory. */
export function entryStopLocation(registry: ManifestRegistry, options?: Partial<CobolShimSessionOptions>): { path: string; line: number } | undefined {
  const roots = registry.programs.filter(entry => !entry.program.parentProgramId && entry.program.kind === 'program');
  let candidates = roots.filter(entry => entry.program.isMain);
  if (options?.entrySource) candidates = roots.filter(entry => entry.sourceKey === normalisePath(options.entrySource!)).slice(0, 1);
  else if (options?.entryProgram) candidates = roots.filter(entry => entry.program.programId === options.entryProgram!.toUpperCase());
  else if (candidates.length === 0 && roots.length === 1) candidates = roots;
  if (candidates.length !== 1) return undefined;
  const entry = candidates[0];
  const location = programEntryLocation(entry);
  const source = location && registry.sourceById(entry, location.fileId);
  return location && source ? { path: source.path, line: location.line } : undefined;
}
