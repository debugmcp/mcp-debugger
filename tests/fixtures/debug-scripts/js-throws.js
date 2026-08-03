// Break-on-exception fixture (issue #220): throws an uncaught error.
// The throw happens in a timer callback: a top-level module throw is wrapped
// by the ESM loader (V8 predicts it "caught"), so js-debug's 'uncaught'
// filter only fires for exceptions thrown from a task context like this.
function boom() {
  throw new Error('js uncaught exception'); // Line 6: crash site
}

setTimeout(boom, 100); // Line 9
