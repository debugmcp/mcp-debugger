/**
 * Loaded for the first time by the line the stepper fixture steps into
 * (issue #1161): Node's loader returns through try...finally, the shape V8
 * loses a step-out on.
 */
const value = 1;
module.exports = { value };
