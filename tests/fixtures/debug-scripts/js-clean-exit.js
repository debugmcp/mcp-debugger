// Clean-exit fixture (issue #247): does a little work and exits with code 0.
// Mirrors js-throws.js's shape (work in a timer callback) so the js-debug
// child session has time to adopt the process before it finishes.
function done() {
  console.log('clean exit fixture done'); // Line 5
}

setTimeout(done, 100); // Line 8 — node exits 0 once the timer fires
