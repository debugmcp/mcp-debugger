/**
 * Fixture for the server's JavaScript stepper (issues #1130, #1161).
 *
 * Every line a test steps from carries a marker comment; the tests find
 * lines by marker, so this file can be edited without renumbering them.
 */
const { EventEmitter } = require('node:events');

const emitter = new EventEmitter();
function listener(value) {
  const doubled = value * 2; // MARK: in the listener
  return doubled;
}
emitter.on('x', listener);

// Node's once-wrapper calls this one: a longer walk through Node's code than on().
const onceEmitter = new EventEmitter();
function onceListener(value) {
  const tripled = value * 3; // MARK: in the once listener
  return tripled;
}
onceEmitter.once('y', onceListener);

function mapper(value) {
  return value + 1; // MARK: in the mapper
}

function callee() {
  const inside = 1; // MARK: a breakpoint in a callee
  return inside;
}

function inner() {
  return 1;
}

function withFinally() {
  try {
    return inner(); // MARK: return inside try-finally
  } finally {
    globalThis.cleaned = true; // MARK: the finally block
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function workWithFinally() {
  try {
    await sleep(5);
    return 2; // MARK: async return inside try-finally
  } finally {
    globalThis.asyncCleaned = true;
  }
}

function timerCallback() {
  globalThis.fired = true; // MARK: last line of a callback Node called
}

function laterCallback() {
  globalThis.later = true; // MARK: a later task
}

// A plain function, called once: a step that V8 does not lose returns into
// this one call (issue #1161). The same call from an async function is #1174.
function syncPart() {
  const guarded = withFinally(); // MARK: calls withFinally
  const afterFinally = 4; // MARK: after withFinally
  const lazy = require('./lazy.cjs'); // MARK: first load of a module
  const afterRequire = lazy.value + 6; // MARK: after the require
  return [guarded, afterFinally, afterRequire];
}

async function main() {
  console.log('first line printed'); // MARK: the first console.log
  const afterLog = 1; // MARK: after the first console.log
  console.log('a later line printed'); // MARK: a later console.log
  const afterLaterLog = 1; // MARK: after a later console.log
  for (const item of [1, 2, 3]) console.log('item', item); // MARK: a one-line loop
  const mapped = [1, 2].map(mapper); // MARK: a builtin calls the program
  emitter.emit('x', 1); // MARK: Node code calls the program
  const afterEmit = 2; // MARK: after emit
  onceEmitter.emit('y', 1); // MARK: emits to a once listener
  setTimeout(() => {}, 0); // MARK: starts a later task
  const afterTimeout = 3; // MARK: after setTimeout
  const called = callee(); // MARK: calls a function with a breakpoint
  const fromSync = syncPart();
  const awaited = await workWithFinally(); // MARK: awaits workWithFinally
  const afterAwait = 5; // MARK: after the await
  const again = withFinally(); // MARK: calls withFinally from an async function
  const afterAgain = 7; // MARK: after withFinally from an async function
  setTimeout(timerCallback, 0);
  setTimeout(laterCallback, 30);
  await sleep(120);
  return [afterLog, afterLaterLog, mapped, afterEmit, afterTimeout, called, fromSync, awaited, afterAwait, again, afterAgain];
}

main().then(() => {
  console.log('done');
});
