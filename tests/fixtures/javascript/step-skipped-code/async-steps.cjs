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

async function getUser(id) {
  await sleep(5);
  return { id };
}

async function load(id) {
  try {
    globalThis.loading = id;
  } finally {
    globalThis.loading = 0;
  }
  const first = id + 1;
  return { // MARK: a statement that awaits on later lines
    user: await getUser(first),
    posts: await getUser(first + 1), // MARK: the second await of the statement
  };
}

let releaseEarly;
const earlyGate = new Promise((resolve) => {
  releaseEarly = resolve;
});

async function early(id) {
  const tag = id; // MARK: in early, before its first await
  await earlyGate;
  return tag;
}

async function relay(id) {
  const got = await early(id);
  const out = got * 10; // MARK: the continuation of relay
  return out;
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
  // The caller does not await the call at once: it runs on while load is suspended.
  const loading = load(1);
  const marker = 2; // MARK: the statement of the caller after load
  await loading;
  // Three calls of relay in flight at once, each awaiting its own early.
  const relays = Promise.all([relay(1), relay(2), relay(3)]);
  releaseEarly();
  await relays;
  globalThis.marker = marker;
  Promise.resolve(7).then(onDone);
  setTimeout(onTimer, 10);
  await sleep(150);
  return afterClosing;
}

main().then(() => {
  console.log('done');
});
