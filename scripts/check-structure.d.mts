/**
 * Types for `check-structure.mjs`, so its TypeScript tests see a real API instead of
 * `@ts-ignore`-ing the import into `any`.
 */

/** A counted construct with a place in the source. */
export interface LocatedItem {
  /** What the baseline records: `where :: source text`, with no file or line. */
  key: string;
  file: string;
  line: number;
  /** `Class.method`, `function`, or `(top level)`. */
  where: string;
  /** The construct's source, comments dropped and whitespace collapsed. */
  text: string;
}

/** A place that decides a session's state; `direct` when it bypasses the gate. */
export interface StateWriter extends LocatedItem {
  direct: boolean;
  form: 'call' | 'assignment' | 'destructuring' | 'partial update' | 'Object.assign';
}

/** A branch on one language. */
export interface LanguageBranch extends LocatedItem {
  language: string;
  spelling: string;
  form: 'comparison' | 'case' | 'membership' | 'in' | 'index';
  /** How the operand is known to be a language: typed, enum member, cast, const, string parameter, policy name. */
  via: string;
}

export interface Measurement {
  items: {
    sessionStateWriters: StateWriter[];
    directStateWrites: StateWriter[];
    policyMembers: { key: string; users: string[] }[];
    oneAdapterMembers: { key: string; member: string; policy: string }[];
    languageBranches: LanguageBranch[];
  };
  contract: {
    /** The engine policies' names, in registry order. */
    engines: string[];
    /** Member key to the engines that use it. */
    usersOf: Map<string, string[]>;
    /** Members no read in the core resolves to. */
    unread: string[];
    /** Boolean members the core only truth-tests, where `false` is the same as absent. */
    falseIsAbsent: string[];
    /** Boolean members where `false` counts as a use. */
    falseIsAUse: string[];
    /** `engine: key` for keys an engine sets that the contract does not declare. */
    outside: string[];
  };
}

export type MeasureId = keyof Measurement['items'];

/** One measure in `tests/structure-baseline.json`. */
export interface MeasureRecord {
  count: number;
  items: string[];
  accepted: { item: string; reason: string }[];
}

export type StructureBaseline = Record<MeasureId, MeasureRecord>;

export interface MeasureDefinition {
  id: MeasureId;
  label: string;
  advice: string;
}

export const BASELINE_FILE: string;
export const CONFIG_FILE: string;
export const MEASURES: MeasureDefinition[];

/** A check that cannot be run (exit code 2). */
export class StructureError extends Error {}

export function isSourcePath(file: string): boolean;
export function isPolicyFile(file: string): boolean;

/** Every measure of the tree at `root`, from the checker and the loaded policies. */
export function measure(root: string): Promise<Measurement>;

export function parseBaseline(text: string): StructureBaseline;
export function compareItems(
  currentKeys: string[],
  recordedKeys: string[]
): { outcome: 'growth' | 'reduction' | 'change' | 'same'; added: string[]; removed: string[]; delta: number };

/** The CLI without the process: never exits, returns what to print and the exit code. */
export function run(root: string, argv: string[]): Promise<{ code: 0 | 1 | 2; stdout: string; stderr: string }>;
