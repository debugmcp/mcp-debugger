/**
 * Hand-built manifests mirroring examples/cobol/hello.cob and examples/cobol/calls/*.cob,
 * with the storage symbols the spike measured (`b_19`, `b_24`, `cob_local_ptr`, …).
 * Bytes for the fake engine's memory live beside them.
 */
import path from 'node:path';
import type { CobolDataItem, CobolFieldAttr, CobolManifest, CobolProgram, CobolSection } from '../../../src/manifest/schema.js';
import { COB_TYPE } from '../../../src/manifest/attr-constants.js';
import { ascii, type MemorySymbol } from './fake-engine.js';

const GROUP_ATTR: CobolFieldAttr = { type: COB_TYPE.GROUP, digits: 0, scale: 0, flags: 0 };
const ALNUM: CobolFieldAttr = { type: COB_TYPE.ALPHANUMERIC, digits: 0, scale: 0, flags: 0 };
const numericDisplay = (digits: number, scale = 0, signed = false): CobolFieldAttr => ({
  type: COB_TYPE.NUMERIC_DISPLAY,
  digits,
  scale,
  flags: signed ? 0x0001 : 0
});
/** `S9(9) COMP` as cobc writes it on x86-64: BINARY_TRUNC | BINARY_SWAP | HAVE_SIGN. */
const comp = (digits: number, signed: boolean): CobolFieldAttr => ({
  type: COB_TYPE.NUMERIC_BINARY,
  digits,
  scale: 0,
  flags: 0x0820 | (signed ? 0x0001 : 0)
});

type ItemSpec = Partial<CobolDataItem> & Pick<CobolDataItem, 'name' | 'level' | 'size'>;

function makeItems(section: CobolSection, specs: ItemSpec[], firstId = 0): CobolDataItem[] {
  return specs.map((spec, i) => ({
    id: firstId + i,
    qualifiedName: spec.name,
    section,
    children: [],
    storage: { kind: 'static', symbol: 'b_0' },
    offset: 0,
    usage: 'DISPLAY',
    occursDims: [],
    flags: {},
    ...spec
  }));
}

export function helloManifest(root: string): CobolManifest {
  const source = path.join(root, 'hello.cob');
  const items = makeItems('WORKING-STORAGE', [
    { name: 'WS-SCALED', level: 1, size: 7, storage: { kind: 'static', symbol: 'b_19' }, attr: numericDisplay(7, 2, true), picture: 'S9(5)V99' },
    { name: 'WS-GROUP', level: 1, size: 25, storage: { kind: 'static', symbol: 'b_24' }, attr: GROUP_ATTR, usage: 'GROUP', children: [2, 3, 4] },
    { name: 'WS-ID', level: 5, size: 4, parentId: 1, qualifiedName: 'WS-ID OF WS-GROUP', storage: { kind: 'static', symbol: 'b_24' }, offset: 0, attr: numericDisplay(4), picture: '9(4)' },
    { name: 'WS-NAME', level: 5, size: 20, parentId: 1, qualifiedName: 'WS-NAME OF WS-GROUP', storage: { kind: 'static', symbol: 'b_24' }, offset: 4, attr: ALNUM, picture: 'X(20)' },
    { name: 'WS-STATUS', level: 5, size: 1, parentId: 1, qualifiedName: 'WS-STATUS OF WS-GROUP', storage: { kind: 'static', symbol: 'b_24' }, offset: 24, attr: ALNUM, picture: 'X', children: [5, 6] },
    { name: 'WS-STATUS-ACTIVE', level: 88, size: 0, parentId: 4, qualifiedName: 'WS-STATUS-ACTIVE OF WS-STATUS OF WS-GROUP', storage: { kind: 'static', symbol: 'b_24' }, offset: 24, condition: { values: [{ lo: 'A', resolved: true }], raw: 'VALUE "A"' } },
    { name: 'WS-STATUS-CLOSED', level: 88, size: 0, parentId: 4, qualifiedName: 'WS-STATUS-CLOSED OF WS-STATUS OF WS-GROUP', storage: { kind: 'static', symbol: 'b_24' }, offset: 24, condition: { values: [{ lo: 'C', resolved: true }, { lo: 'X', resolved: true }], raw: 'VALUE "C" "X"' } },
    { name: 'WS-TABLE', level: 1, size: 20, storage: { kind: 'static', symbol: 'b_30' }, attr: GROUP_ATTR, usage: 'GROUP', children: [8] },
    { name: 'WS-ENTRY', level: 5, size: 4, parentId: 7, qualifiedName: 'WS-ENTRY OF WS-TABLE', storage: { kind: 'static', symbol: 'b_30' }, attr: GROUP_ATTR, usage: 'GROUP', children: [9], occurs: { min: 5, max: 5, elemSize: 4 }, occursDims: [{ itemId: 8, elemSize: 4, max: 5 }] },
    { name: 'WS-AMOUNT', level: 10, size: 4, parentId: 8, qualifiedName: 'WS-AMOUNT OF WS-ENTRY OF WS-TABLE', storage: { kind: 'static', symbol: 'b_30' }, attr: numericDisplay(4), picture: '9(4)', occursDims: [{ itemId: 8, elemSize: 4, max: 5 }] },
    { name: 'WS-COUNT', level: 1, size: 1, storage: { kind: 'static', symbol: 'b_33' }, attr: numericDisplay(1), picture: '9' },
    { name: 'WS-ODO', level: 1, size: 9, storage: { kind: 'static', symbol: 'b_35' }, sizeExpr: 'cob_get_numdisp (b_33, 1)', attr: GROUP_ATTR, usage: 'GROUP', children: [12] },
    { name: 'WS-ITEM', level: 5, size: 1, parentId: 11, qualifiedName: 'WS-ITEM OF WS-ODO', storage: { kind: 'static', symbol: 'b_35' }, attr: ALNUM, picture: 'X', occurs: { min: 1, max: 9, elemSize: 1, dependingOnItemId: 10 }, occursDims: [{ itemId: 12, elemSize: 1, max: 9 }] },
    { name: 'WS-RAW', level: 1, size: 8, storage: { kind: 'static', symbol: 'b_38' }, attr: ALNUM, picture: 'X(8)' },
    { name: 'WS-ALT', level: 1, size: 8, storage: { kind: 'static', symbol: 'b_38' }, attr: numericDisplay(8), picture: '9(8)', redefinesItemId: 13 },
    { name: 'WS-IDX', level: 1, size: 2, storage: { kind: 'static', symbol: 'b_41' }, attr: comp(4, false), usage: 'COMP', picture: '9(4) COMP' },
    { name: 'WS-DUP', level: 1, size: 3, storage: { kind: 'static', symbol: 'b_44' }, attr: GROUP_ATTR, usage: 'GROUP', children: [17] },
    { name: 'WS-ID', level: 5, size: 3, parentId: 16, qualifiedName: 'WS-ID OF WS-DUP', storage: { kind: 'static', symbol: 'b_44' }, attr: numericDisplay(3), picture: '9(3)' }
  ]);
  const program: CobolProgram = {
    programId: 'HELLO',
    cFunction: 'HELLO_',
    cEntry: 'HELLO',
    kind: 'program',
    isMain: true,
    sourceFileId: 1,
    generated: { c: path.join(root, 'build', 'hello.c') },
    items,
    roots: [{ section: 'WORKING-STORAGE', itemIds: [0, 1, 7, 10, 11, 13, 14, 15, 16] }],
    files: [],
    procedure: {
      sections: [],
      paragraphs: [
        { name: '0000-MAIN', kind: 'paragraph', sourceFileId: 1, startLine: 31, endLine: 35 },
        { name: '1000-INIT', kind: 'paragraph', sourceFileId: 1, startLine: 36, endLine: 40 }
      ]
    },
    procedureDivisionLine: 30,
    lineMap: [
      { cLine: 127, sourceFileId: 1, line: 32 },
      { cLine: 139, sourceFileId: 1, line: 34 }
    ]
  };
  return {
    schemaVersion: 1,
    generator: { cobcVersion: '3.2.0', argv: [], dumpComments: true, generatedAt: '2026-09-19T00:00:00Z', platform: 'linux', arch: 'x64' },
    sources: [{ id: 1, path: source, kind: 'program' }],
    programs: [program],
    diagnostics: []
  };
}

/** CALLMAIN (WORKING-STORAGE group passed BY REFERENCE) and CALLSUB (LOCAL-STORAGE + LINKAGE). */
export function callsManifest(root: string): CobolManifest {
  const mainSource = path.join(root, 'calls', 'main.cob');
  const subSource = path.join(root, 'calls', 'sub.cob');
  const mainItems = makeItems('WORKING-STORAGE', [
    { name: 'WS-ARG-REC', level: 1, size: 22, storage: { kind: 'static', symbol: 'b_8' }, attr: GROUP_ATTR, usage: 'GROUP', children: [1, 2, 3, 4] },
    { name: 'WS-ARG-A', level: 5, size: 4, parentId: 0, qualifiedName: 'WS-ARG-A OF WS-ARG-REC', storage: { kind: 'static', symbol: 'b_8' }, offset: 0, attr: comp(9, true), usage: 'COMP' },
    { name: 'WS-ARG-B', level: 5, size: 4, parentId: 0, qualifiedName: 'WS-ARG-B OF WS-ARG-REC', storage: { kind: 'static', symbol: 'b_8' }, offset: 4, attr: comp(9, true), usage: 'COMP' },
    { name: 'WS-ARG-SUM', level: 5, size: 4, parentId: 0, qualifiedName: 'WS-ARG-SUM OF WS-ARG-REC', storage: { kind: 'static', symbol: 'b_8' }, offset: 8, attr: comp(9, true), usage: 'COMP' },
    { name: 'WS-ARG-NAME', level: 5, size: 10, parentId: 0, qualifiedName: 'WS-ARG-NAME OF WS-ARG-REC', storage: { kind: 'static', symbol: 'b_8' }, offset: 12, attr: ALNUM, picture: 'X(10)' }
  ]);
  const subItems = [
    ...makeItems('LOCAL-STORAGE', [
      { name: 'LS-WORK', level: 1, size: 4, storage: { kind: 'local', symbol: 'cob_local_ptr' }, offset: 0, attr: comp(9, true), usage: 'COMP' },
      { name: 'LS-TAG', level: 1, size: 6, storage: { kind: 'local', symbol: 'cob_local_ptr' }, offset: 4, attr: ALNUM, picture: 'X(6)' }
    ]),
    ...makeItems(
      'LINKAGE',
      [
        { name: 'LK-ARG-REC', level: 1, size: 22, storage: { kind: 'linkage', symbol: 'b_19' }, attr: GROUP_ATTR, usage: 'GROUP', children: [3, 4, 5, 6] },
        { name: 'LK-A', level: 5, size: 4, parentId: 2, qualifiedName: 'LK-A OF LK-ARG-REC', storage: { kind: 'linkage', symbol: 'b_19' }, offset: 0, attr: comp(9, true), usage: 'COMP' },
        { name: 'LK-B', level: 5, size: 4, parentId: 2, qualifiedName: 'LK-B OF LK-ARG-REC', storage: { kind: 'linkage', symbol: 'b_19' }, offset: 4, attr: comp(9, true), usage: 'COMP' },
        { name: 'LK-SUM', level: 5, size: 4, parentId: 2, qualifiedName: 'LK-SUM OF LK-ARG-REC', storage: { kind: 'linkage', symbol: 'b_19' }, offset: 8, attr: comp(9, true), usage: 'COMP' },
        { name: 'LK-NAME', level: 5, size: 10, parentId: 2, qualifiedName: 'LK-NAME OF LK-ARG-REC', storage: { kind: 'linkage', symbol: 'b_19' }, offset: 12, attr: ALNUM, picture: 'X(10)' }
      ],
      2
    )
  ];
  const callmain: CobolProgram = {
    programId: 'CALLMAIN',
    cFunction: 'CALLMAIN_',
    cEntry: 'CALLMAIN',
    kind: 'program',
    isMain: true,
    sourceFileId: 1,
    generated: { c: path.join(root, 'build', 'main.c') },
    items: mainItems,
    roots: [{ section: 'WORKING-STORAGE', itemIds: [0] }],
    files: [],
    procedure: { sections: [], paragraphs: [{ name: '0000-MAIN', kind: 'paragraph', sourceFileId: 1, startLine: 11, endLine: 15 }] },
    procedureDivisionLine: 10,
    lineMap: [{ cLine: 139, sourceFileId: 1, line: 13 }]
  };
  const callsub: CobolProgram = {
    programId: 'CALLSUB',
    cFunction: 'CALLSUB_',
    cEntry: 'CALLSUB',
    kind: 'program',
    isMain: false,
    sourceFileId: 2,
    generated: { c: path.join(root, 'build', 'sub.c') },
    items: subItems,
    roots: [
      { section: 'LOCAL-STORAGE', itemIds: [0, 1] },
      { section: 'LINKAGE', itemIds: [2] }
    ],
    files: [],
    procedure: { sections: [], paragraphs: [{ name: '0000-SUB-MAIN', kind: 'paragraph', sourceFileId: 2, startLine: 14, endLine: 18 }] },
    procedureDivisionLine: 13,
    lineMap: [{ cLine: 60, sourceFileId: 2, line: 15 }]
  };
  return {
    schemaVersion: 1,
    generator: { cobcVersion: '3.2.0', argv: [], dumpComments: true, generatedAt: '2026-09-19T00:00:00Z', platform: 'linux', arch: 'x64' },
    sources: [
      { id: 1, path: mainSource, kind: 'program' },
      { id: 2, path: subSource, kind: 'program' }
    ],
    programs: [callmain, callsub],
    diagnostics: []
  };
}

/** Big-endian unsigned/two's-complement bytes of `value` (COMP storage on x86-64 is byte-swapped). */
export function beInt(value: number, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let v = BigInt.asUintN(size * 8, BigInt(value));
  for (let i = size - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** The HELLO program's storage at the `hello.cob:32` stop of the spike. */
export function helloMemory(): Record<string, MemorySymbol> {
  return {
    // S9(5)V99 = -123.45: trailing digit 5 overpunched negative → 'u'.
    b_19: { address: 0x7ff0_0000_1000n, bytes: ascii('001234u') },
    b_24: { address: 0x7ff0_0000_2000n, bytes: ascii('0042' + 'ALICE'.padEnd(20, ' ') + 'A') },
    b_30: { address: 0x7ff0_0000_3000n, bytes: ascii('01000200030004000500') },
    b_33: { address: 0x7ff0_0000_4000n, bytes: ascii('3') },
    b_35: { address: 0x7ff0_0000_5000n, bytes: ascii('ABC      ') },
    b_38: { address: 0x7ff0_0000_6000n, bytes: ascii('00001234') },
    b_41: { address: 0x7ff0_0000_7000n, bytes: beInt(2, 2) },
    b_44: { address: 0x7ff0_0000_8000n, bytes: ascii('007') }
  };
}

/** CALLSUB's storage while paused inside it, `LK-ARG-REC` pointing at CALLMAIN's `WS-ARG-REC`. */
export function callsMemory(options: { linkageNull?: boolean } = {}): Record<string, MemorySymbol> {
  const record = new Uint8Array(22);
  record.set(beInt(1000, 4), 0);
  record.set(beInt(234, 4), 4);
  record.set(beInt(0, 4), 8);
  record.set(ascii('CALLER'.padEnd(10, ' ')), 12);
  const local = new Uint8Array(10);
  local.set(beInt(0, 4), 0);
  local.set(ascii('LOCAL '), 4);
  return {
    b_8: { address: 0x7ff0_0001_0000n, bytes: record },
    b_19: { address: options.linkageNull ? 0n : 0x7ff0_0001_0000n, bytes: record },
    cob_local_ptr: { address: 0x7ff0_0002_0000n, bytes: local }
  };
}
