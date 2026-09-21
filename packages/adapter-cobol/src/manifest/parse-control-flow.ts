import type { CobolControlFlow } from './schema.js';
import type { ProgramSegment } from './parse-procedure-map.js';

/** Preserve compiler label identities and expanded source order, on both cobc 3.1.2 and 3.2. */
export function parseControlFlow(segment: ProgramSegment): CobolControlFlow {
  const { lines, startLine } = segment;
  const ranges: Array<{ labelId?: number; kind: string; startCLine: number }> = [];
  const labels = new Map<number, number>();
  const comments: number[] = [];
  let hasGoto = false;
  let end = segment.endLine;
  lines.forEach((line, i) => {
    const cLine = startLine + i;
    const label = /^\s*l_(\d+)\s*:/.exec(line);
    if (label) labels.set(Number(label[1]), cLine);
    if (/\/\*\s*Line:/.test(line)) comments.push(cLine);
    if (/\/\*\s*Line:.*:\s*GO TO\s*:/.test(line)) hasGoto = true;
    if (/\/\*\s*Line:.*:\s*last source line\b/.test(line)) end = Math.min(end, cLine - 1);
    const range = /\/\*\s*Line:.*:\s*(Paragraph|Section)\s/.exec(line);
    if (!range) return;
    let labelId: number | undefined;
    for (const following of lines.slice(i + 1, i + 6)) {
      if (/\/\*\s*Line:/.test(following)) break;
      const id = /^\s*l_(\d+)\s*:/.exec(following) ?? /(?:PARAGRAPH|SECTION)_\w+_l_(\d+)\s*:/.exec(following);
      if (id) { labelId = Number(id[1]); break; }
    }
    ranges.push({ kind: range[1], startCLine: cLine, labelId });
  });
  const result: CobolControlFlow = { hasGoto, ranges: [], performs: [] };
  ranges.forEach((range, i) => {
    if (range.labelId === undefined) return;
    const next = ranges.slice(i + 1).find(candidate => range.kind === 'Paragraph' || candidate.kind === 'Section');
    result.ranges.push({ labelId: range.labelId, startCLine: range.startCLine, endCLine: next ? next.startCLine - 1 : end });
  });
  lines.forEach((line, i) => {
    const through = /frame_ptr->perform_through\s*=\s*(\d+)\s*;/.exec(line);
    if (!through) return;
    const push = lines.slice(i + 1, i + 14).join('\n');
    const returning = /frame_ptr->return_address_ptr\s*=\s*&&l_(\d+)/.exec(push);
    const go = /\bgoto\s+l_(\d+)\s*;/.exec(push);
    if (!returning || !go) return;
    const returnCLine = labels.get(Number(returning[1]));
    if (returnCLine === undefined) return;
    result.performs.push({
      callCLine: comments.filter(cLine => cLine <= startLine + i).at(-1) ?? startLine + i,
      returnCLine,
      endCLine: (comments.find(cLine => cLine > returnCLine) ?? segment.endLine + 1) - 1,
      startLabel: Number(go[1]), endLabel: Number(through[1])
    });
  });
  return result;
}
