process.emitWarning('legacy config flag used', 'DeprecationWarning');
setImmediate(() => {
  console.log('FAIL suite/auth.spec.js: expected 200, got 401');
  process.exit(1);
});
