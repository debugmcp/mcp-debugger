/**
 * Types for the plain-JS build script, so the test ratchet can import it.
 * Keep in step with compile-jdi-bridge.js.
 */
export const BUILD_RECORD: string;
export const TARGET_RELEASE: number;

export interface BridgePaths {
  sourceFile: string;
  classFile: string;
  outDir: string;
}

/** sha256 (hex) of the file's bytes. */
export function sourceSha256(file: string): string;

/** Whether the class must be (re)compiled: missing, or not compiled from this source. */
export function needsCompilation(paths: BridgePaths): boolean;

/** Write `{ sourceSha256, release }` beside the class. */
export function writeBuildRecord(outDir: string, sourceFile: string): void;

/**
 * Give a class that has no record one, naming the source beside it (a build that
 * predates the record). Returns whether a record was written.
 */
export function ensureBuildRecord(paths: BridgePaths): boolean;
