/**
 * The grandchild child_grand.js starts (issue #1082): two ticks over one
 * statement with a breakpoint, then exit 0.
 */
console.log('grandchild start');
let total = 0;
let i = 0;
const timer = setInterval(() => {
  total += i + 1; // BREAKPOINT
  console.log(`grandchild step ${i}`);
  i += 1;
  if (i === 2) {
    clearInterval(timer);
    console.log(`grandchild done ${total}`);
    process.exit(0);
  }
}, 200);
