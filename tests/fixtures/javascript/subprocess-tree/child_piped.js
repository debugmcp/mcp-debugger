let n = 0; // LOGPOINT 1: the first statement of the fork, before any timer
const timer = setInterval(() => {
  n += 1; // LOGPOINT 2: three ticks
  process.stdout.write(JSON.stringify({ n }) + '\n');
  if (n === 3) {
    clearInterval(timer);
    process.exit(0);
  }
}, 200);
// The child parent_piped.js forks (issue #1212): its stdout is a protocol of
// one JSON object per line that the parent parses strictly. The comment is at
// the end so that line 1 is the process's first statement.
