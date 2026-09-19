/**
 * Overlay a listing symbol table onto a program parsed from the dump routine.
 *
 * Both enumerate the same tree in declaration order, so the merge is a forward walk: for
 * each dumped item, the next listing row with the same name and level is its counterpart.
 * The listing contributes the source picture (which replaces the reconstruction) and a
 * size cross-check; anything that does not line up becomes a diagnostic, never a failure,
 * because a stale or truncated listing must not block debugging.
 *
 * Level-88 rows the dump did not mention (cobc 3.1.2 writes no condition comments at all)
 * are added as placeholder items under their conditional variable — the names are still
 * worth showing, and the empty VALUE list plus a warning says why they cannot be evaluated.
 */
import type { CobolDataItem, CobolManifestDiagnostic, CobolProgram } from './schema.js';
import type { ListingProgram, ListingRow } from './parse-symbol-listing.js';

/** The listing prints names in a 30-column field, so a longer name matches by its first 30 characters. */
const LISTING_NAME_WIDTH = 30;

function nameMatches(rowName: string, itemName: string): boolean {
  if (rowName === itemName) {
    return true;
  }
  return rowName.length === LISTING_NAME_WIDTH && itemName.length > LISTING_NAME_WIDTH && itemName.startsWith(rowName);
}

function rowMatches(row: ListingRow, item: CobolDataItem): boolean {
  return nameMatches(row.name, item.name) && row.level === item.level && (row.section === undefined || row.section === item.section);
}

export function mergeListingIntoProgram(program: CobolProgram, listing: ListingProgram): CobolManifestDiagnostic[] {
  const diagnostics: CobolManifestDiagnostic[] = [];
  const rows = listing.rows;
  const rowToItem = new Map<number, CobolDataItem>();
  const qualifiedNames = new Set(program.items.map((i) => i.qualifiedName));
  let cursor = 0;
  let unmatched = 0;

  const warn = (message: string, item?: string): void => {
    diagnostics.push(item ? { level: 'warn', message, program: program.programId, item } : { level: 'warn', message, program: program.programId });
  };

  /** Conditional variable of the 88 row at `index`: the nearest preceding non-88 row. */
  const conditionalVariableFor = (index: number): CobolDataItem | undefined => {
    for (let k = index - 1; k >= 0; k -= 1) {
      if (rows[k].level !== 88) {
        return rowToItem.get(k);
      }
    }
    return undefined;
  };

  const synthesizeCondition = (index: number): void => {
    const row = rows[index];
    const parent = conditionalVariableFor(index);
    if (!parent || parent.children.some((id) => program.items[id].name === row.name)) {
      return;
    }
    let qualifiedName = `${row.name} OF ${parent.qualifiedName}`;
    for (let n = 2; qualifiedNames.has(qualifiedName); n += 1) {
      qualifiedName = `${row.name} OF ${parent.qualifiedName} #${n}`;
    }
    qualifiedNames.add(qualifiedName);
    const item: CobolDataItem = {
      id: program.items.length,
      name: row.name,
      qualifiedName,
      level: 88,
      section: parent.section,
      parentId: parent.id,
      children: [],
      storage: { ...parent.storage },
      offset: parent.offset,
      size: parent.size,
      usage: parent.usage,
      occursDims: [...parent.occursDims],
      flags: {},
      condition: { values: [], raw: '' }
    };
    if (parent.fileName !== undefined) {
      item.fileName = parent.fileName;
    }
    if (parent.sizeExpr !== undefined) {
      item.sizeExpr = parent.sizeExpr;
    }
    if (parent.attr) {
      item.attr = parent.attr;
    }
    program.items.push(item);
    parent.children.push(item.id);
    warn('level-88 item taken from the listing; this cobc version does not dump its VALUE list, so it cannot be evaluated', row.name);
  };

  // Level-88 rows the walk skips over belong to the most recently matched variable.
  const consumeSkippedConditions = (from: number, to: number): void => {
    for (let j = from; j < to; j += 1) {
      if (rows[j].level === 88) {
        synthesizeCondition(j);
      }
    }
  };

  const dumped = [...program.items];
  for (const item of dumped) {
    if (item.storage.kind === 'register' || item.level === 0) {
      continue; // special registers, index-names and FD record areas are not listed
    }
    let found = -1;
    for (let j = cursor; j < rows.length; j += 1) {
      if (rowMatches(rows[j], item)) {
        found = j;
        break;
      }
    }
    if (found < 0) {
      unmatched += 1;
      warn(`listing has no row for level ${item.level} ${item.name}`, item.name);
      continue;
    }
    consumeSkippedConditions(cursor, found);
    cursor = found + 1;
    const row = rows[found];
    rowToItem.set(found, item);
    if (row.picture) {
      item.picture = row.picture;
    }
    if (row.type === 'INDEX') {
      item.usage = 'INDEX';
    } else if (row.type === 'POINTER') {
      item.usage = 'POINTER';
    }
    // The listing prints a group's total (elements x max) for an OCCURS group but the
    // element size for an OCCURS elementary item; the dump always gives one element.
    const sizeAgrees =
      row.size === undefined ||
      row.size === item.size ||
      (item.occurs !== undefined && row.size === item.size * item.occurs.max);
    if (!sizeAgrees && item.sizeExpr === undefined && item.level !== 88) {
      warn(`listing size ${row.size} differs from dumped size ${item.size}`, item.name);
    }
  }
  consumeSkippedConditions(cursor, rows.length);

  const leftover = rows.slice(cursor).filter((r) => r.level !== 88).length;
  if (unmatched === 0 && leftover > 0) {
    warn(`listing has ${leftover} row(s) after the last dumped item`);
  }
  return diagnostics;
}
