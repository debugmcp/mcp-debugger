/**
 * Fixture for the server's JavaScript stepper: async functions, callbacks
 * the program only scheduled, and a caller's own skip list (issues #1130,
 * #1161).
 *
 * Every line a test steps from carries a marker comment; the tests find
 * lines by marker, so this file can be edited without renumbering them.
 */
let release;
const gate = new Promise((resolve) => {
  release = resolve;
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inner(id) {
  await gate;
  const tag = id; // MARK: in inner, after the gate
  return tag;
}

async function handler(id) {
  const got = await inner(id);
  const out = got * 10; // MARK: the continuation of handler
  return out;
}

async function closing() {
  const opened = await sleep(5); // MARK: an await before the try
  try {
    const row = await sleep(5); // MARK: an await inside the try
    return [opened, row]; // MARK: the return inside the try
  } finally {
    globalThis.closed = true; // MARK: the finally block of an async function
  }
}

function onDone(value) {
  const seen = value; // MARK: in a then callback
  return seen;
}

function onTimer() {
  globalThis.ticked = true; // MARK: in a timer callback
}

async function main() {
  // Three calls of handler in flight at once, each awaiting its own inner.
  const all = Promise.all([handler(1), handler(2), handler(3)]);
  release();
  await all;
  await closing(); // MARK: awaits closing
  const afterClosing = 1; // MARK: after closing
  Promise.resolve(7).then(onDone);
  setTimeout(onTimer, 10);
  await sleep(150);
  return afterClosing;
}

main().then(() => {
  console.log('done');
});
