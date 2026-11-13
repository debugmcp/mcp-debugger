// A block whose variables leave scope while the function goes on: the stop
// snapshot's diff reports them as gone (issue #1140). Line numbers are
// breakpoint targets for
// tests/adapters/javascript/integration/javascript-snapshot-diff.test.ts;
// do not shift them.
function main() {
  let total = 0;
  for (let i = 0; i < 1; i++) {
    const doubled = (i + 1) * 2;
    total += doubled;
  }
  const done = total > 0;
  return done;
}

main();
