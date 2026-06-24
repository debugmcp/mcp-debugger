/**
 * Flake hunter — repeatedly runs the `unit` project under fresh random shuffle
 * seeds to surface order-dependent tests.
 *
 * Seeded shuffle is enabled in vitest.config.ts (`sequence.shuffle`), so each
 * run reorders tests within every file. This script pins an EXPLICIT random seed
 * per run and prints it, so any failure reproduces exactly with:
 *
 *     vitest run --project unit --sequence.seed=<seed>
 *
 * Usage:
 *     node scripts/flake-hunt.mjs [runs]        # default 10
 *   env:
 *     FLAKE_RUNS=<n>        number of runs (CLI arg wins if given)
 *     FLAKE_PROJECT=<name>  vitest project to loop (default: unit)
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
  const args = ['vitest', 'run', '--project', PROJECT, `--sequence.seed=${seed}`, '--retry=0', '--reporter=dot'];
  const banner = `[flake-hunt] run ${i}/${RUNS}  seed=${seed}`;
  console.log(`\n${'='.repeat(70)}\n${banner}\n  reproduce: vitest run --project ${PROJECT} --sequence.seed=${seed}\n${'='.repeat(70)}`);

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
