/**
 * Fixture for JavaScript function-breakpoint smoke tests (issue #295).
 * Runs as ESM (repo root package.json is "type": "module").
 * Line layout is asserted by tests/e2e/mcp-server-smoke-js-function-bp.test.ts:
 * compute is declared at line 9 (its entry statement is line 10).
 */
console.log('function bp fixture start');

function compute(x) {
  console.log('compute called with', x);
  return x * 2;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let helper = null;

(async () => {
  await sleep(300);
  compute(3);
  helper = await import('./function_bp_helper.js');
  compute(7);
  await sleep(200);
  helper.doWork();
  await sleep(3000);
  compute(99);
  console.log('FUNCTION_BP_FIXTURE_DONE');
})();
