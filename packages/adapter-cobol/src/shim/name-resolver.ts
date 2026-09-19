/**
 * COBOL name resolution inside one program: `WS-ID OF WS-GROUP` picks the
 * item named WS-ID that has an ancestor named WS-GROUP. Every qualifier must
 * match an ancestor, in order, walking outward — exactly the rule the compiler
 * applies, so a name that is unique in the program needs no qualifiers and an
 * ambiguous one names every candidate so the user can pick.
 */
import type { CobolDataItem } from '../manifest/schema.js';
import type { ManifestRegistry, ProgramEntry } from './manifest-registry.js';

export type NameResolution =
  | { kind: 'found'; item: CobolDataItem }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'none' };

function qualifiersMatch(registry: ManifestRegistry, entry: ProgramEntry, item: CobolDataItem, qualifiers: readonly string[]): boolean {
  let current = item;
  const seen = new Set<number>();
  for (const qualifier of qualifiers) {
    let matched = false;
    while (current.parentId !== undefined && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = registry.item(entry, current.parentId);
      if (!parent) {
        return false;
      }
      current = parent;
      if (parent.name === qualifier) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return false;
    }
  }
  return true;
}

/** `names` is `[NAME, QUALIFIER1, …]` as written (`NAME OF QUALIFIER1 OF …`), already upper-cased. */
export function resolveDataName(registry: ManifestRegistry, entry: ProgramEntry, names: readonly string[]): NameResolution {
  const [name, ...qualifiers] = names;
  if (!name) {
    return { kind: 'none' };
  }
  const candidates = registry.itemsNamed(entry, name).filter((item) => qualifiersMatch(registry, entry, item, qualifiers));
  if (candidates.length === 1) {
    return { kind: 'found', item: candidates[0] };
  }
  if (candidates.length === 0) {
    return { kind: 'none' };
  }
  return { kind: 'ambiguous', candidates: candidates.map((item) => item.qualifiedName) };
}
