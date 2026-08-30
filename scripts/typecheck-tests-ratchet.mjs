/**
 * Test-typing ratchet (issue #562).
 *
 * `tsconfig.spec.json` type-checks the test trees alongside the shipped sources. It does not
 * pass today — the suite carries hundreds of pre-existing mock/type divergences — so this
 * script gates on the *per-file* error count recorded in `tests/typecheck-baseline.json`
 * instead of demanding zero.
 *
 * Per file rather than one total: the errors span nearly every test directory, so a single
 * number would let a new error hide behind an unrelated fix, and moving errors between files
 * would go unnoticed. A per-file map localises the failure to the file that regressed.
 *
 * Known limitation: the unit is a per-file *count*, so a same-file, same-count swap — one
 * error fixed and a different one introduced in the same file — is invisible. The burn-down
 * surfaces it (the count has to reach zero eventually); per-diagnostic fingerprints are the
 * upgrade path if the burn-down stalls.
 *
 * Modes:
 *   (default)  fail when any file's count differs from its baseline — up (new type errors)
 *              or down (a stale baseline that must be re-recorded and committed).
 *   --allow-improvement  gate only: still fail on increases and on files that gained
 *              errors from nothing, but warn instead of failing when a count went down.
 *              For runs that cannot commit a refreshed baseline — Dependabot's, where a
 *              better @types package can make the suite type-cleaner and the bot has no
 *              way to re-record. Never for pre-push or a human PR: a decrease nobody
 *              records is how the baseline and the tree drift apart. Under GITHUB_ACTIONS
 *              it prints a ::warning annotation and a step-summary line, because the PR
 *              it passes may auto-merge and leave main's baseline stale until a human PR
 *              refreshes it -- loud is the whole mitigation.
 *   --update   rewrite the baseline from the current run.
 *   --allow-empty  with --update only: permit recording an empty baseline. A run that
 *              finds nothing is normally a broken program, not a clean suite, so it is
 *              rejected unless this says otherwise.
 *
 * Exit codes: 0 clean, 1 ratchet failure, 2 the check could not be run.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { isMain } from './lib/is-main.mjs';

/** Project that pairs the sources with the tests. */
const PROJECT = 'tsconfig.spec.json';

/** Recorded per-file error counts, relative to the repo root. */
const BASELINE_FILE = 'tests/typecheck-baseline.json';

/**
 * `path/to/file.ts(12,34): error TS2345: message`.
 *
 * tsc's related-information lines are indented, but `(.+?)` eats leading whitespace
 * happily — what actually excludes them is that they carry no `error TSnnnn:` token.
 */
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/**
 * The TS1000-1999 grammar/syntax band.
 *
 * Deliberately the whole band, not just the parser's own errors: a few of these are
 * emitted by the checker and do *not* truncate the semantic pass (TS1205 under
 * `isolatedModules`, TS1259/TS1192 interop, TS1149 casing). Matching them too fails
 * closed — it can abort a run that would in fact have been comparable, which is the
 * safe direction, since the alternative is comparing a run that silently checked
 * nothing.
 */
const SYNTAX_ERROR = /\berror TS1\d{3}:/;

/**
 * What to do about a baseline this script refuses to read.
 *
 * Deleting first is not boilerplate: `--update` reads the baseline before writing one (so
 * the gate's own floor applies to the refresh too), which means a corrupt file blocks its
 * own repair. Without the delete, the obvious next command fails the same way.
 */
const REPAIR_BASELINE =
  `Delete ${BASELINE_FILE} and re-record it with: pnpm run typecheck:tests:update`;

/** The only trees this ratchet owns: everything else is a broken check, not a failed one. */
const TEST_TREES = [/^tests\//, /^packages\/[^/]+\/tests\//];

/** How many diagnostics to echo per regressed file before summarising the rest. */
const MAX_LINES_PER_FILE = 20;

/**
 * Why this tsc run cannot be trusted, or `null` when it can.
 *
 * Two ways a run looks successful but is not, both of which would read as *fewer* errors and
 * therefore as progress:
 *
 * - A status other than 0 (clean) or 2 (diagnostics emitted) means tsc did not complete. A
 *   config error exits 1, and on Windows a tsc terminated from outside reports
 *   `{status: 1, signal: null}` after printing a clean prefix of real diagnostics.
 * - A grammar/syntax diagnostic (TS1xxx). tsc skips semantic checking entirely when any
 *   file fails to parse, so the baselined errors are never reported and `--update` would
 *   happily record a one-entry baseline. See {@link SYNTAX_ERROR} for why the rule spans
 *   the whole band rather than only the parser's own errors.
 *
 * @param {number | null} status tsc's exit status
 * @param {string} output combined stdout/stderr
 * @returns {string | null} message for `fail`, or null when the run is usable
 */
export function unusableRunReason(status, output) {
  if (status !== 0 && status !== 2) {
    return (
      `tsc exited ${status}, which is neither 0 (clean) nor 2 (diagnostics emitted), so the ` +
      `check did not complete.\n\n${output.trim()}`
    );
  }

  const syntax = output.split(/\r?\n/).filter(line => SYNTAX_ERROR.test(line));
  if (syntax.length > 0) {
    return (
      `tsc reported a grammar/syntax diagnostic (TS1xxx). Because tsc skips semantic ` +
      `checking when any file fails to parse, this run cannot be compared against the ` +
      `baseline — fix that diagnostic first:\n\n${syntax.slice(0, 10).join('\n')}`
    );
  }

  if (status !== 0 && !output.split(/\r?\n/).some(line => DIAGNOSTIC.test(line))) {
    return `tsc exited ${status} without reporting any parseable error.\n\n${output.trim()}`;
  }

  return null;
}

/**
 * Type-check `tsconfig.spec.json` and return tsc's raw diagnostic text.
 *
 * @param {string} root repo root
 * @returns {string} combined stdout/stderr
 */
function runTsc(root) {
  const require = createRequire(import.meta.url);

  let tsc;
  try {
    tsc = require.resolve('typescript/bin/tsc');
  } catch (error) {
    fail(`Cannot resolve typescript/bin/tsc — run 'pnpm install' first.\n${describe(error)}`);
  }

  const result = spawnSync(process.execPath, [tsc, '-p', PROJECT, '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  });

  if (result.error) {
    fail(`Failed to launch tsc (${process.execPath} ${tsc}).\n${describe(result.error)}`);
  }
  if (result.signal) {
    fail(`tsc was killed by signal ${result.signal}.`);
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const reason = unusableRunReason(result.status, output);
  if (reason) fail(reason);

  return output;
}

/**
 * Group tsc diagnostics by the file that produced them.
 *
 * Paths are normalised to repo-relative forward slashes so a baseline written on Windows
 * matches one verified on Linux.
 *
 * @param {string} output tsc diagnostic text
 * @param {string} root repo root
 * @returns {Map<string, string[]>} file -> diagnostic lines
 */
export function parseDiagnostics(output, root) {
  const byFile = new Map();

  for (const line of output.split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(line);
    if (!match) continue;

    const file = normalise(match[1], root);
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(line.trim());
  }

  return byFile;
}

/**
 * Repo-relative, forward-slash form of a path tsc reported.
 *
 * Splits on both separators rather than `path.sep`, so a Windows-style path stays
 * normalised even when the comparison runs on Linux CI.
 */
function normalise(file, root) {
  return path.relative(root, path.resolve(root, file)).split(/[\\/]/).join('/');
}

/** Does this key name a file in a tree the ratchet owns? */
export function isTestTreePath(file) {
  return TEST_TREES.some(tree => tree.test(file));
}

/**
 * Keys that name something outside `tests/` and a package's own `tests/` directory.
 *
 * A diagnostic anchored to `tsconfig.spec.json` (a config error such as TS5023/TS5101), to
 * `src/**`, or to a `../` path outside the repo is not a test that regressed — it is the
 * check itself being broken, and baselining it with `--update` would hide the breakage.
 *
 * @param {Iterable<string>} keys normalised paths
 * @returns {string[]} the offenders, sorted
 */
export function pathsOutsideTestTrees(keys) {
  return [...keys].filter(key => !isTestTreePath(key)).sort();
}

/**
 * Compare the current run against the baseline.
 *
 * @param {Map<string, string[]>} current file -> diagnostic lines
 * @param {Record<string, number>} baseline file -> recorded error count
 * @returns {{ regressed: string[], improved: string[] }} sorted file lists
 */
export function compare(current, baseline) {
  const regressed = [];
  const improved = [];

  for (const file of new Set([...current.keys(), ...Object.keys(baseline)])) {
    const now = current.get(file)?.length ?? 0;
    const then = baseline[file] ?? 0;
    if (now > then) regressed.push(file);
    else if (now < then) improved.push(file);
  }

  return { regressed: regressed.sort(), improved: improved.sort() };
}

/**
 * The gate itself: what a comparison means for this run.
 *
 * `regressed` wins over `stale` — new errors are the thing worth reporting first. A count
 * that went *down* is progress, but it fails too: the baseline is now a lie, and letting it
 * pass is how CI and the working tree drift apart.
 *
 * `allowImprovement` downgrades only that second case to `stale-allowed`, which the caller
 * reports and then passes. It never softens `regressed`: a run that cannot re-record the
 * baseline still must not be able to add type errors.
 *
 * @param {{ regressed: string[], improved: string[] }} comparison from `compare`
 * @param {{ allowImprovement?: boolean }} [options]
 * @returns {'regressed' | 'stale' | 'stale-allowed' | 'ok'}
 */
export function verdict(comparison, { allowImprovement = false } = {}) {
  if (comparison.regressed.length > 0) return 'regressed';
  if (comparison.improved.length > 0) return allowImprovement ? 'stale-allowed' : 'stale';
  return 'ok';
}

/**
 * Why an all-clear run cannot be trusted, or `null` when it can.
 *
 * A status-0 run with no diagnostics at all is indistinguishable from a spec program that
 * stopped matching the test trees — a broken `include`, an `exclude` that grew too wide.
 * Nothing about that is a parse error, so {@link unusableRunReason} lets it through, and
 * every baselined file then reads as improved: the gate says "refresh the baseline", the
 * refresh records `{}`, and CI goes green with nothing type-checked.
 *
 * @param {number} currentFiles files with diagnostics in this run
 * @param {number} baselineFiles files recorded in the baseline
 * @param {boolean} allowEmpty caller passed `--allow-empty`
 * @returns {string | null} message for `fail`, or null
 */
export function emptyRunReason(currentFiles, baselineFiles, allowEmpty) {
  if (currentFiles > 0 || baselineFiles === 0 || allowEmpty) return null;

  return (
    `tsc reported no errors at all, but ${BASELINE_FILE} records ${baselineFiles} file(s). ` +
    `That is far more likely to be a program that no longer includes the test trees than a ` +
    `suite that became type-clean at once. Check what the program actually covers:\n` +
    `  npx tsc -p ${PROJECT} --listFilesOnly | grep -c '/tests/'\n` +
    `If the debt genuinely reached zero, record that explicitly:\n` +
    `  pnpm run typecheck:tests:update -- --allow-empty`
  );
}

/**
 * The GitHub Actions annotation for a baseline this run has just outgrown.
 *
 * `--allow-improvement` passes a run whose test suite got type-cleaner, and the PR that
 * earns it (Dependabot's) can auto-merge -- with `GITHUB_TOKEN`, which suppresses push CI
 * on main, so nothing downstream notices. The next human PR and every developer's pre-push
 * then fail on a baseline nobody touched. There is no token here to push a refresh to the
 * bot's branch, so the mitigation is to be impossible to miss instead: an annotation on
 * the baseline file itself, plus a line in the job summary.
 *
 * @param {string[]} improved files whose counts went down
 * @param {{ githubActions?: boolean }} [options]
 * @returns {string | null} the `::warning` line, or null when there is nothing to say
 */
export function staleBaselineAnnotation(improved, { githubActions = false } = {}) {
  if (!githubActions || improved.length === 0) return null;

  return (
    `::warning file=${BASELINE_FILE}::Baseline is stale after this bump: ${improved.length} ` +
    `file(s) now have fewer type errors than recorded. Run 'pnpm run typecheck:tests:update' ` +
    `and commit ${BASELINE_FILE} in the next PR.`
  );
}

/** Append a line to the job summary, if this run has one. Never fatal. */
function appendStepSummary(line) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    fs.appendFileSync(file, `${line}\n`);
  } catch (error) {
    console.error(`typecheck:tests: could not write the step summary: ${describe(error)}`);
  }
}

/**
 * Read the baseline, or exit with a pointer to `typecheck:tests:update`.
 *
 * @param {string} root repo root
 * @param {{ required?: boolean }} [options] `required: false` for `--update`, which is
 *   allowed to run before the baseline exists
 */
function readBaseline(root, { required = true } = {}) {
  const file = path.join(root, BASELINE_FILE);
  if (!fs.existsSync(file)) {
    if (!required) return {};
    fail(`Missing ${BASELINE_FILE}. Create it with: pnpm run typecheck:tests:update`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    fail(`${BASELINE_FILE} is not valid JSON. ${REPAIR_BASELINE}\n${describe(error)}`);
  }

  // Valid JSON of the wrong shape would otherwise read as "every file regressed", or
  // throw a raw TypeError out of `compare`. Reject it as a broken check (exit 2), not
  // as a failed one (exit 1).
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(
      `${BASELINE_FILE} must be a JSON object of "file": count pairs, got ${kindOf(parsed)}. ` +
      REPAIR_BASELINE
    );
  }
  for (const [entry, count] of Object.entries(parsed)) {
    if (!Number.isInteger(count) || count < 0) {
      fail(
        `${BASELINE_FILE} has a bad entry for '${entry}': expected a non-negative integer, ` +
        `got ${JSON.stringify(count)}. ${REPAIR_BASELINE}`
      );
    }
  }

  const foreign = pathsOutsideTestTrees(Object.keys(parsed));
  if (foreign.length > 0) {
    fail(
      `${BASELINE_FILE} records ${foreign.length} path(s) outside tests/** and ` +
      `packages/*/tests/**. ${REPAIR_BASELINE}\n${foreign.map(key => `  ${key}`).join('\n')}`
    );
  }

  return parsed;
}

/**
 * Write the baseline: keys sorted, two-space indent, trailing newline, so re-running
 * `--update` on an unchanged tree produces no diff.
 *
 * @param {string} root repo root
 * @param {Map<string, string[]>} current file -> diagnostic lines
 */
function writeBaseline(root, current) {
  const counts = {};
  for (const file of [...current.keys()].sort()) counts[file] = current.get(file).length;
  fs.writeFileSync(path.join(root, BASELINE_FILE), `${JSON.stringify(counts, null, 2)}\n`);
}

/** Total errors in the current run. */
function totalCurrent(current) {
  let count = 0;
  for (const lines of current.values()) count += lines.length;
  return count;
}

/** Total errors recorded in the baseline. */
function totalBaseline(baseline) {
  return Object.values(baseline).reduce((sum, count) => sum + count, 0);
}

/** Abort with a message and the "could not run" exit code. */
function fail(message) {
  console.error(`typecheck:tests: ${message}`);
  process.exit(2);
}

/** Coarse type name for an error message: `null`, `an array`, `a number`, ... */
function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/** Human-readable form of a thrown value. */
function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(root, argv) {
  const update = argv.includes('--update');
  const allowEmpty = argv.includes('--allow-empty');
  const allowImprovement = argv.includes('--allow-improvement');
  // pnpm forwards the `--` separator itself (`pnpm run typecheck:tests -- --update`).
  const known = ['--', '--update', '--allow-empty', '--allow-improvement'];
  const unknown = argv.filter(arg => !known.includes(arg));
  if (unknown.length > 0) {
    fail(
      `Unknown argument(s): ${unknown.join(' ')}. ` +
      `Usage: node scripts/typecheck-tests-ratchet.mjs ` +
      `[--allow-improvement | --update [--allow-empty]]`
    );
  }
  if (allowEmpty && !update) {
    fail('--allow-empty only means anything with --update; the gate never records a baseline.');
  }
  if (allowImprovement && update) {
    fail('--allow-improvement only means anything for the gate; --update rewrites the baseline.');
  }

  const current = parseDiagnostics(runTsc(root), root);

  const foreign = pathsOutsideTestTrees(current.keys());
  if (foreign.length > 0) {
    fail(
      `tsc reported errors outside tests/** and packages/*/tests/**, which means the check ` +
      `itself is broken rather than a test having regressed:\n` +
      foreign.map(key => `  ${key}: ${current.get(key)?.[0] ?? ''}`).join('\n')
    );
  }

  // Read before writing, so `--update` is held to the same floor the gate is.
  const baseline = readBaseline(root, { required: !update });

  const empty = emptyRunReason(current.size, Object.keys(baseline).length, allowEmpty);
  if (empty) fail(empty);

  if (update) {
    writeBaseline(root, current);
    console.log(
      `typecheck:tests: baseline updated — ${totalCurrent(current)} error(s) across ` +
      `${current.size} file(s) recorded in ${BASELINE_FILE}.`
    );
    return;
  }

  const comparison = compare(current, baseline);
  const { regressed, improved } = comparison;
  const outcome = verdict(comparison, { allowImprovement });

  if (outcome === 'regressed') {
    console.error(`\ntypecheck:tests: ${regressed.length} file(s) gained type errors.\n`);
    for (const file of regressed) {
      const lines = current.get(file) ?? [];
      console.error(`  ${file}: ${baseline[file] ?? 0} -> ${lines.length}`);
      for (const line of lines.slice(0, MAX_LINES_PER_FILE)) console.error(`    ${line}`);
      if (lines.length > MAX_LINES_PER_FILE) {
        console.error(`    ... and ${lines.length - MAX_LINES_PER_FILE} more`);
      }
    }
    console.error(
      `\nFix the new errors — that is the point of the ratchet. Re-record the baseline only\n` +
      `when the errors are genuinely unavoidable:\n` +
      `  pnpm run typecheck:tests:update\n`
    );
    process.exit(1);
  }

  if (outcome === 'stale' || outcome === 'stale-allowed') {
    // Both modes report the shrunken counts; only the strict one exits non-zero.
    const log = outcome === 'stale' ? console.error : console.warn;
    log(
      `\ntypecheck:tests: ${improved.length} file(s) have FEWER errors than ${BASELINE_FILE} records.\n`
    );
    for (const file of improved) {
      log(`  ${file}: ${baseline[file]} -> ${current.get(file)?.length ?? 0}`);
    }
    if (outcome === 'stale') {
      console.error(
        `\nThat is progress, but the baseline is now stale. Refresh and commit it with:\n` +
        `  pnpm run typecheck:tests:update\n`
      );
      process.exit(1);
    }
    log(
      `\n--allow-improvement: passing anyway, because this run cannot commit the refresh.\n` +
      `Someone on a writable branch should run\n` +
      `  pnpm run typecheck:tests:update\n` +
      `and commit ${BASELINE_FILE}.\n`
    );
    // If this PR auto-merges, main's baseline is stale from here until a human
    // PR refreshes it, and no push CI will say so. Make the run itself say it.
    const annotation = staleBaselineAnnotation(improved, {
      githubActions: process.env.GITHUB_ACTIONS === 'true'
    });
    if (annotation) {
      console.log(annotation);
      appendStepSummary(
        `> [!WARNING]\n> \`${BASELINE_FILE}\` is stale after this bump: ${improved.length} ` +
        `file(s) now have fewer type errors than recorded. Run ` +
        `\`pnpm run typecheck:tests:update\` and commit it in the next PR.`
      );
    }
  }

  console.log(
    `typecheck:tests: ${totalCurrent(current)} error(s) across ${current.size} file(s); ` +
    `baseline ${totalBaseline(baseline)} across ${Object.keys(baseline).length}.`
  );
}

if (isMain(import.meta.url)) {
  main(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), process.argv.slice(2));
}
