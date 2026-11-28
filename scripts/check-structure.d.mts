/**
 * Types for `check-structure.mjs`, so its TypeScript tests see a real API instead of
 * `@ts-ignore`-ing the import into `any`.
 */

/** A repo-relative, forward-slash source file and its text. */
export interface SourceFile {
  path: string;
  text: string;
}

/** A counted construct with a place in the source. */
export interface LocatedItem {
  file: string;
  line: number;
  /** `Class.method`, `function`, or `(top level)`. */
  where: string;
  /** What the baseline counts the item under within its file (`where`, or `where [language]`). */
  group: string;
  /** The construct's source text, whitespace collapsed, truncated. */
  text: string;
}

/** A session-state writer; `direct` when it does not go through `_updateSessionState`. */
export interface StateWriter extends LocatedItem {
  direct: boolean;
  form: 'call' | 'store setter' | 'assignment' | 'partial update';
}

/** A comparison with, or a `case` on, one language. */
export interface LanguageBranch extends LocatedItem {
  language: string;
  spelling: 'string' | 'enum';
  form: 'comparison' | 'case';
}

/** An engine's policy object and the contract members it uses. */
export interface EnginePolicy {
  binding: string;
  name: string;
  file: string;
  used: Set<string>;
}

export interface PolicyContract {
  /** Interface members, then `getter().switch` members, in declaration order. */
  members: string[];
  /** The descriptor getters whose switches count as members. */
  getters: string[];
  policies: EnginePolicy[];
  usersOf: Map<string, string[]>;
  oneAdapter: { member: string; policy: string }[];
  /** Members no engine policy uses. */
  unused: string[];
  /** `policy: key` for keys a policy sets that the contract does not declare. */
  unknown: string[];
}

export interface Measurement {
  items: {
    sessionStateWriters: StateWriter[];
    directStateWrites: StateWriter[];
    policyMembers: { member: string; users: string[] }[];
    oneAdapterMembers: { member: string; policy: string }[];
    languageBranches: LanguageBranch[];
  };
  contract: PolicyContract;
}

/**
 * Per file, the count of items in each group: the enclosing function (`Class.method`,
 * `(top level)`), and for language branches the function and language.
 */
export type PerFileCounts = Record<string, Record<string, number>>;

/** What `tests/structure-baseline.json` records. */
export interface StructureBaseline {
  sessionStateWriters: PerFileCounts;
  directStateWrites: PerFileCounts;
  policyMembers: string[];
  oneAdapterMembers: Record<string, string>;
  languageBranches: PerFileCounts;
}

export type MeasureId = keyof StructureBaseline;

export interface MeasureDefinition {
  id: MeasureId;
  label: string;
  kind: 'files' | 'names' | 'owners';
  advice: string;
}

export const BASELINE_FILE: string;
export const MEASURES: MeasureDefinition[];

/** A check that cannot be run (exit code 2). */
export class StructureError extends Error {}

export function isSourcePath(file: string): boolean;
export function isPolicyFile(file: string): boolean;
export function collectSources(root: string): SourceFile[];

export function findStateWriters(sources: SourceFile[]): { writers: StateWriter[]; direct: StateWriter[] };
export function measurePolicyContract(sources: SourceFile[]): PolicyContract;
export function findLanguageBranches(sources: SourceFile[], policies: { name: string }[]): LanguageBranch[];
export function measure(sources: SourceFile[]): Measurement;

export function toBaseline(measurement: Measurement): StructureBaseline;
export function parseBaseline(text: string): StructureBaseline;
export function compareMeasure(
  kind: MeasureDefinition['kind'],
  current: StructureBaseline[MeasureId],
  recorded: StructureBaseline[MeasureId]
): { regressed: string[]; improved: string[] };

/** The CLI without the process: never exits, returns what to print and the exit code. */
export function run(root: string, argv: string[]): { code: 0 | 1 | 2; stdout: string; stderr: string };
