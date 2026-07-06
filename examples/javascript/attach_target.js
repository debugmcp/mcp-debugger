/**
 * Long-running attach target for the JavaScript attach smoke test (issue #124).
 *
 * Started as: node --inspect=127.0.0.1:<port> attach_target.js
 * Ticks forever until killed so a debugger can attach at any time.
 */
let counter = 0;
const message = 'tick';

function tick() {
  counter += 1;
  if (counter % 10 === 0) {
    console.log(`${message} ${counter}`);
  }
}

setInterval(tick, 100);
console.log('attach target started');
