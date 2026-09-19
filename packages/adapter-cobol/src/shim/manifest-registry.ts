/**
 * The COBOL symbol manifests of a session, and the lookups the shim needs at a
 * stop: which program owns a frame, which source line a paragraph range covers,
 * which data items answer to a name.
 *
 * Paths are compared case-insensitively with separators normalised because the
 * engine and the manifest disagree on Windows (CodeLLDB reports
 * `C:\work\x.cob`, cobc wrote `C:/work/x.cob` into `#line`), and because a
 * manifest built on one case-insensitive filesystem is read on another.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  CobolDataItem,
  CobolManifest,
  CobolProcRange,
  CobolProgram,
  CobolSection,
  CobolSourceFile
} from '../manifest/schema.js';
import type { ShimLogger } from './logger.js';

export const MANIFEST_SUFFIX = '.cobol-symbols.json';

/** A program together with the manifest (translation unit) it came from. */
export interface ProgramEntry {
  program: CobolProgram;
  manifest: CobolManifest;
  /** Normalised path of the program's own source file (`sources[program.sourceFileId]`). */
  sourceKey: string;
}

export interface ProcedureLocation {
  paragraph?: string;
  section?: string;
}

export function normalisePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function isManifest(value: unknown): value is CobolManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1 && Array.isArray(record.programs) && Array.isArray(record.sources);
}

export class ManifestRegistry {
  private readonly entries: ProgramEntry[] = [];
  private readonly byFunction = new Map<string, ProgramEntry>();
  private readonly loadedDirs = new Set<string>();
  /** Normalised path of every source (program or copybook) any loaded manifest mentions. */
  private readonly sourceKeys = new Set<string>();

  constructor(private readonly logger: ShimLogger) {}

  get programCount(): number {
    return this.entries.length;
  }

  get programs(): readonly ProgramEntry[] {
    return this.entries;
  }

  /** Load every `*.cobol-symbols.json` of every directory not loaded before; failures are logged, never thrown. */
  loadDirs(dirs: readonly string[]): void {
    for (const dir of dirs) {
      const key = normalisePath(path.resolve(dir));
      if (this.loadedDirs.has(key)) {
        continue;
      }
      this.loadedDirs.add(key);
      let names: string[];
      try {
        names = readdirSync(dir);
      } catch (error) {
        this.logger.warn(`manifest dir unreadable: ${dir}`, error);
        continue;
      }
      for (const name of names.filter((n) => n.endsWith(MANIFEST_SUFFIX)).sort()) {
        const file = path.join(dir, name);
        try {
          const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
          if (!isManifest(parsed)) {
            this.logger.warn(`not a COBOL symbol manifest (schemaVersion/programs/sources): ${file}`);
            continue;
          }
          this.addManifest(parsed, file);
        } catch (error) {
          this.logger.warn(`manifest unreadable: ${file}`, error);
        }
      }
    }
  }

  addManifest(manifest: CobolManifest, origin = '<memory>'): void {
    for (const source of manifest.sources) {
      this.sourceKeys.add(normalisePath(source.path));
    }
    for (const program of manifest.programs) {
      if (!Array.isArray(program.procedure.statements)) {
        program.procedure.statements = []; // a manifest from before statement locations
      }
      const own = manifest.sources.find((s) => s.id === program.sourceFileId);
      const entry: ProgramEntry = { program, manifest, sourceKey: own ? normalisePath(own.path) : '' };
      this.entries.push(entry);
      for (const fn of [program.cFunction, program.cEntry]) {
        if (this.byFunction.has(fn)) {
          this.logger.warn(`duplicate C function ${fn} (program ${program.programId} from ${origin}); first definition wins`);
          continue;
        }
        this.byFunction.set(fn, entry);
      }
    }
    this.logger.info(`loaded manifest ${origin}: ${manifest.programs.map((p) => p.programId).join(', ')}`);
  }

  /** The program whose body function (`HELLO_`) or entry wrapper (`HELLO`) has this name. */
  programByFunction(name: string | undefined): ProgramEntry | undefined {
    return name ? this.byFunction.get(name) : undefined;
  }

  /** Programs that own a source file: their own file, or a file their procedure ranges point into. */
  programsBySource(sourcePath: string | undefined): ProgramEntry[] {
    if (!sourcePath) {
      return [];
    }
    const key = normalisePath(sourcePath);
    return this.entries.filter((entry) => {
      if (entry.sourceKey === key) {
        return true;
      }
      const fileId = this.sourceIdByPath(entry, key);
      if (fileId === undefined) {
        return false;
      }
      const { sections, paragraphs } = entry.program.procedure;
      return sections.some((r) => r.sourceFileId === fileId) || paragraphs.some((r) => r.sourceFileId === fileId);
    });
  }

  isManifestSource(sourcePath: string | undefined): boolean {
    return sourcePath !== undefined && this.sourceKeys.has(normalisePath(sourcePath));
  }

  sourceById(entry: ProgramEntry, fileId: number): CobolSourceFile | undefined {
    return entry.manifest.sources.find((s) => s.id === fileId);
  }

  /** The manifest source id for a path as the engine reports it, within one program's translation unit. */
  sourceIdByPath(entry: ProgramEntry, sourcePath: string): number | undefined {
    const key = normalisePath(sourcePath);
    return entry.manifest.sources.find((s) => normalisePath(s.path) === key)?.id;
  }

  /** True when the path is one of the generated C files of this program (or looks like one). */
  isGeneratedSource(entry: ProgramEntry, sourcePath: string | undefined): boolean {
    if (!sourcePath) {
      return false;
    }
    const base = path.basename(sourcePath).toLowerCase();
    const generated = entry.program.generated;
    for (const candidate of [generated.c, generated.h, generated.lh]) {
      if (candidate && path.basename(candidate).toLowerCase() === base) {
        return true;
      }
    }
    return /\.c(\.l?\.h)?$/i.test(base);
  }

  /**
   * Generated-C line → COBOL location: the `#line` row with the largest `cLine <= line`.
   * cobc's self-resets (`#line 127 "hello.c"`) are not rows, so the generated lines the
   * engine reports between two statements map to the statement before them — which is
   * the statement being executed.
   */
  mapGeneratedLine(entry: ProgramEntry, line: number): { source: CobolSourceFile; line: number } | undefined {
    let best: { cLine: number; sourceFileId: number; line: number } | undefined;
    for (const row of entry.program.lineMap) {
      if (row.cLine <= line && (!best || row.cLine > best.cLine)) {
        best = row;
      }
    }
    if (!best) {
      return undefined;
    }
    const source = this.sourceById(entry, best.sourceFileId);
    return source ? { source, line: best.line } : undefined;
  }

  procedureAt(entry: ProgramEntry, fileId: number, line: number): ProcedureLocation {
    const inRange = (r: CobolProcRange): boolean => r.sourceFileId === fileId && r.startLine <= line && line <= r.endLine;
    const paragraph = entry.program.procedure.paragraphs.find(inRange);
    const section = entry.program.procedure.sections.find(inRange);
    return {
      paragraph: paragraph?.name,
      section: paragraph?.sectionName ?? section?.name
    };
  }

  /**
   * A stop "lands" on COBOL only in the PROCEDURE DIVISION: `stepIn` into a callee first
   * stops on its DATA DIVISION VALUE initialisation lines, which are not statements.
   * A program without any procedure information counts every line of its source.
   */
  isLandedLocation(entry: ProgramEntry, fileId: number, line: number): boolean {
    const program = entry.program;
    if (program.procedure.statements.length > 0) {
      // Every statement cobc attributed, copybook statements included, plus each
      // paragraph/section header line.
      return this.landedKeysFor(entry).has(`${fileId}:${line}`);
    }
    // Manifests written before statement locations existed: the program's own file from
    // the PROCEDURE DIVISION on, other files only inside a known paragraph/section.
    const hasRanges = program.procedure.paragraphs.length > 0 || program.procedure.sections.length > 0;
    if (fileId === program.sourceFileId && program.procedureDivisionLine !== undefined) {
      if (line >= program.procedureDivisionLine) {
        return true;
      }
    } else if (fileId === program.sourceFileId && !hasRanges) {
      return true;
    }
    const location = this.procedureAt(entry, fileId, line);
    return location.paragraph !== undefined || location.section !== undefined;
  }

  private readonly landedKeys = new WeakMap<ProgramEntry, Set<string>>();

  private landedKeysFor(entry: ProgramEntry): Set<string> {
    let keys = this.landedKeys.get(entry);
    if (!keys) {
      keys = new Set<string>();
      for (const statement of entry.program.procedure.statements) {
        keys.add(`${statement.sourceFileId}:${statement.line}`);
      }
      for (const range of [...entry.program.procedure.paragraphs, ...entry.program.procedure.sections]) {
        keys.add(`${range.sourceFileId}:${range.startLine}`);
      }
      this.landedKeys.set(entry, keys);
    }
    return keys;
  }

  itemsNamed(entry: ProgramEntry, name: string): CobolDataItem[] {
    const upper = name.toUpperCase();
    return entry.program.items.filter((item) => item.name === upper);
  }

  rootsOf(entry: ProgramEntry, section: CobolSection): CobolDataItem[] {
    const ids = entry.program.roots.find((r) => r.section === section)?.itemIds ?? [];
    return ids.map((id) => this.item(entry, id)).filter((item): item is CobolDataItem => item !== undefined);
  }

  /** `id` is the index into `items` by contract; the scan is a fallback for a re-ordered manifest. */
  item(entry: ProgramEntry, id: number): CobolDataItem | undefined {
    const direct = entry.program.items[id];
    return direct?.id === id ? direct : entry.program.items.find((item) => item.id === id);
  }
}
