/**
 * Flake hunter — repeatedly runs the `unit` project under fresh random shuffle
 * seeds to surface order-dependent tests.
 *
 * vitest.config.ts shuffles FILE order only (`sequence.shuffle.files`); aggressive
 * WITHIN-file shuffle is intentionally NOT in the committed config because the
 * serial integration/e2e suites share a live debug session across `it` blocks and
 * would break if reordered. This hunt is unit-only, so it forces within-file
 * shuffle by adding `--sequence.shuffle.tests` on the CLI — that is what catches a
 * unit test relying on a sibling's leftover mock/env state. It pins an EXPLICIT
 * random seed per run and prints it, so any failure reproduces exactly with:
 *
 *     vitest run --project unit --sequence.seed=<seed> --sequence.shuffle.tests
 *
 * Usage:
 *     node scripts/flake-hunt.mjs [runs]        # default 10
 *   env:
 *     FLAKE_RUNS=<n>        number of runs (CLI arg wins if given)
 *     FLAKE_PROJECT=<name>  vitest project to loop (default: unit). NOTE: leave as
 *                           'unit' — forcing within-file shuffle on integration/e2e
 *                           breaks their intentionally-sequential session tests.
 *
 * Exits non-zero (and lists the failing seeds) if any run fails.
 */
import { spawnSync } from 'child_process';

const RUNS = Number(process.argv[2] ?? process.env.FLAKE_RUNS ?? 10);
const PROJECT = process.env.FLAKE_PROJECT ?? 'unit';

if (!Number.isInteger(RUNS) || RUNS < 1) {
  console.error(`[flake-hunt] Invalid run count: ${process.argv[2] ?? process.env.FLAKE_RUNS}`);
  process.exit(2);
}

// 31-bit positive seeds — comfortably within Vitest's accepted range.
const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

console.log(`[flake-hunt] ${RUNS} run(s) of project "${PROJECT}" with fresh seeds\n`);

const failures = [];

for (let i = 1; i <= RUNS; i++) {
  const seed = randomSeed();
  const args = ['vitest', 'run', '--project', PROJECT, `--sequence.seed=${seed}`, '--sequence.shuffle.tests', '--retry=0', '--reporter=dot'];
  const banner = `[flake-hunt] run ${i}/${RUNS}  seed=${seed}`;
  console.log(`\n${'='.repeat(70)}\n${banner}\n  reproduce: vitest run --project ${PROJECT} --sequence.seed=${seed} --sequence.shuffle.tests\n${'='.repeat(70)}`);

  const started = Date.now();
  // `npx` resolves the local vitest binary cross-platform (Windows + CI).
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: true });
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  if (result.status === 0) {
    console.log(`[flake-hunt] run ${i}/${RUNS} PASSED (seed=${seed}, ${secs}s)`);
  } else {
    console.error(`[flake-hunt] run ${i}/${RUNS} FAILED (seed=${seed}, ${secs}s, exit=${result.status})`);
    failures.push(seed);
  }
}

console.log(`\n${'='.repeat(70)}`);
if (failures.length === 0) {
  console.log(`[flake-hunt] ✓ all ${RUNS} run(s) passed — no order-dependent failures detected`);
  process.exit(0);
} else {
  console.error(`[flake-hunt] ✗ ${failures.length}/${RUNS} run(s) failed. Reproduce with:`);
  for (const seed of failures) {
    console.error(`    vitest run --project ${PROJECT} --sequence.seed=${seed}`);
  }
  process.exit(1);
}
