/**
 * A child whose breakpoint binds on another line than the one asked for
 * (issue #1211).
 *
 * The same three timer ticks as child.js, with a comment line inside the
 * tick: a breakpoint asked for on that line binds on the statement below it.
 * The fork's own records must follow: the adapter's id, the bound line, and
 * `verified` once it has stopped there. The suite finds the lines by their
 * markers.
 */
console.log('child start');
let total = 0;
let i = 0;
const timer = setInterval(() => {
  // ASKED: a breakpoint asked for on this line binds on the next one
  total += i; // BOUND
  console.log(`child step ${i}`);
  i += 1; // SECOND
  if (i === 3) {
    clearInterval(timer);
    console.log(`child done ${total}`);
    process.exit(0);
  }
}, 200);
