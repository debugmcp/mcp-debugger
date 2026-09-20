import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseControlFlow } from '../../../src/manifest/parse-control-flow.js';
import { splitProgramSegments } from '../../../src/manifest/parse-procedure-map.js';
import { splitLines } from '../../../src/manifest/c-text.js';

function parse(text: string) { return parseControlFlow(splitProgramSegments(splitLines(text)).segments[0]); }

describe('compiler PERFORM control-flow identities', () => {
  it.each(['3.1.2-linux', '3.2-linux', '3.2-win32'])('recovers return sites and ranges from real %s output', version => {
    const text = readFileSync(new URL(`../../fixtures/cobc/${version}/hello-dw4/hello.c`, import.meta.url), 'utf8');
    const flow = parse(text);
    expect(flow.hasGoto).toBe(false);
    expect(flow.performs).toHaveLength(3);
    for (const call of flow.performs) {
      expect(call.startLabel).toBe(call.endLabel);
      expect(call.callCLine).toBeLessThan(call.returnCLine);
      expect(call.endCLine).toBeGreaterThanOrEqual(call.returnCLine);
      const range = flow.ranges.find(candidate => candidate.labelId === call.startLabel)!;
      expect(range).toBeDefined();
      expect(range.endCLine).toBeGreaterThan(range.startCLine);
      expect(text.split('\n')[call.returnCLine - 1]).toMatch(/^\s*l_\d+:/);
    }
  });

  it('uses generated order for THRU, sections and repeated COPY line numbers', () => {
    const text = [
      "/* PROGRAM-ID 'MAIN' */", 'MAIN_ (const int entry)', '{',
      '/* Line: 20 : PERFORM : main.cob */',
      'frame_ptr->perform_through = 6;', 'frame_ptr->return_address_ptr = &&l_10;', 'goto l_5;', 'l_10:;', 'frame_ptr--;',
      '/* Line: 30 : Section S : main.cob */', 'SECTION_S_l_4:;',
      '/* Line: 1 : Paragraph A : body.cpy */', 'l_5:;',
      '/* Line: 2 : GO TO : body.cpy */', 'goto l_6;',
      '/* Line: 1 : Paragraph B : body.cpy */', 'l_6:;',
      '/* Line: 2 : ADD : body.cpy */', 'add();',
      '/* Line: 50 : Section T : main.cob */', 'SECTION_T_l_7:;',
      '/* Line: 51 : Paragraph UNUSED : main.cob */', 'cob_nop();',
      '/* Line: 60 : last source line : main.cob */', '}', "/* End PROGRAM-ID 'MAIN' */"
    ].join('\n');
    const flow = parse(text);
    expect(flow.hasGoto).toBe(true);
    expect(flow.performs).toEqual([{ callCLine: 4, returnCLine: 8, endCLine: 9, startLabel: 5, endLabel: 6 }]);
    expect(flow.ranges).toEqual([
      { labelId: 4, startCLine: 10, endCLine: 19 },
      { labelId: 5, startCLine: 12, endCLine: 15 },
      { labelId: 6, startCLine: 16, endCLine: 19 },
      { labelId: 7, startCLine: 20, endCLine: 23 }
    ]);
  });

  it('does not invent return sites for unsupported or incomplete compiler output', () => {
    const text = ["/* PROGRAM-ID 'MAIN' */", 'MAIN_ (const int entry)', '{',
      'frame_ptr->perform_through = 0;', 'frame_ptr->return_address_ptr = &&P_cgerror;',
      '/* Line: 20 : PERFORM : main.cob */', 'frame_ptr->perform_through = 5;',
      'frame_ptr->return_address_ptr = &&l_99;', 'goto l_5;',
      '/* Line: 30 : Paragraph A : main.cob */', 'l_5:;', '}', "/* End PROGRAM-ID 'MAIN' */"].join('\n');
    expect(parse(text).performs).toEqual([]);
  });
});
