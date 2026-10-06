// A file whose first declaration is a function the program calls later. For
// such a file js-debug's stopOnEntry breakpoint (line 1, column 1) is resolved
// by V8 to the first breakable position in SOURCE order — inside work() — so
// the "entry" stop is really work's first call (issue #858). Drives the
// function-breakpoint and stopOnEntry e2e cases for that issue.
function work(base) {
  const total = base + 1; // WORK_ENTRY_LINE
  return total;
}
console.log('started');
setTimeout(() => console.log('late total', work(41)), 1500);
