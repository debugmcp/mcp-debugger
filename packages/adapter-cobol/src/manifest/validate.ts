/**
 * Structural invariants of a parsed program, reported as diagnostics.
 *
 * These catch parser drift against a new cobc version (a shape we misread) rather than
 * user errors, which is why violations are `error` level yet never thrown: a manifest
 * with one odd item is still far more useful to a debugger than no manifest.
 */
import type { CobolDataItem, CobolManifestDiagnostic, CobolProgram } from './schema.js';

const NON_STORAGE_LEVELS = new Set([66, 78, 88]);

export function validateProgram(program: CobolProgram): CobolManifestDiagnostic[] {
  const diagnostics: CobolManifestDiagnostic[] = [];
  const items = program.items;
  const report = (message: string, item?: CobolDataItem): void => {
    diagnostics.push(
      item
        ? { level: 'error', message, program: program.programId, item: item.name }
        : { level: 'error', message, program: program.programId }
    );
  };

  items.forEach((item, index) => {
    if (item.id !== index) {
      report(`item id ${item.id} does not match its position ${index}`, item);
    }
    if (!NON_STORAGE_LEVELS.has(item.level) && item.size <= 0 && item.sizeExpr === undefined) {
      report('item has neither a size nor a size expression', item);
    }
    const parent = item.parentId !== undefined ? items[item.parentId] : undefined;
    if (item.parentId !== undefined && !parent) {
      report(`parentId ${item.parentId} does not exist`, item);
    }
    if (parent && !parent.children.includes(item.id)) {
      report(`parent ${parent.name} does not list this item as a child`, item);
    }
    for (const childId of item.children) {
      if (items[childId]?.parentId !== item.id) {
        report(`child ${childId} does not point back to this item`, item);
      }
    }
    if (
      parent &&
      !NON_STORAGE_LEVELS.has(item.level) &&
      parent.storage.symbol === item.storage.symbol &&
      item.sizeExpr === undefined &&
      parent.sizeExpr === undefined
    ) {
      const extent = item.size * (item.occurs ? item.occurs.max : 1);
      if (item.offset < parent.offset || item.offset + extent > parent.offset + parent.size) {
        report(
          `bytes ${item.offset}..${item.offset + extent} fall outside parent ${parent.name} (${parent.offset}..${parent.offset + parent.size})`,
          item
        );
      }
    }
    if (item.occurs && parent && parent.sizeExpr === undefined && item.occurs.elemSize * item.occurs.max > parent.size) {
      report(`OCCURS ${item.occurs.max} x ${item.occurs.elemSize} bytes exceeds parent ${parent.name} size ${parent.size}`, item);
    }
    for (const dim of item.occursDims) {
      if (dim.itemId < 0 || !items[dim.itemId]?.occurs) {
        report(`occurs dimension refers to ${dim.itemId}, which is not an OCCURS item`, item);
      }
    }
    if (item.redefinesItemId !== undefined) {
      const target = items[item.redefinesItemId];
      if (!target) {
        report(`redefinesItemId ${item.redefinesItemId} does not exist`, item);
      } else if (target.storage.symbol !== item.storage.symbol || target.offset !== item.offset) {
        report(`REDEFINES target ${target.name} is at a different address`, item);
      }
    }
    if (item.level === 88 && !item.condition) {
      report('level-88 item has no condition', item);
    }
  });

  for (const root of program.roots) {
    for (const id of root.itemIds) {
      const item = items[id];
      if (!item) {
        report(`root id ${id} in ${root.section} does not exist`);
      } else if (item.parentId !== undefined) {
        report(`root item is not top-level`, item);
      }
    }
  }
  return diagnostics;
}
