/**
 * The child the subprocess-tree parent forks (issue #1082).
 *
 * Three ticks of a timer with a breakpoint on the tick's first statement: a
 * child session adopted with the parent's breakpoints stops here three
 * times, and the total it prints at the end is the proof it ran to
 * completion. A timer rather than a loop, so that an adoption that resumes
 * the park a few milliseconds late still meets the breakpoint.
 */
console.log('child start');
let total = 0;
let i = 0;
const timer = setInterval(() => {
  total += i; // BREAKPOINT
  console.log(`child step ${i}`);
  i += 1;
  if (i === 3) {
    clearInterval(timer);
    console.log(`child done ${total}`);
    process.exit(0);
  }
}, 200);
