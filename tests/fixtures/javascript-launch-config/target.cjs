// Sentinels only: never print the target's complete environment.
console.log('LAUNCH_CONFIG ' + JSON.stringify({
  value: process.env.MCP_LAUNCH_CONFIG_VALUE,
  removed: Object.hasOwn(process.env, 'MCP_LAUNCH_CONFIG_REMOVE'),
  fileOnly: process.env.MCP_LAUNCH_CONFIG_FILE_ONLY,
  nodeEnv: process.env.NODE_ENV,
  stackLimit: Error.stackTraceLimit
}));
if (process.argv.includes('--exit')) {
  process.exitCode = 7;
} else {
  setInterval(() => {}, 100);
}
