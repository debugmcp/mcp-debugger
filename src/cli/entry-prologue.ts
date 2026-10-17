/**
 * The first module either entry evaluates (issue #732): `src/index.ts` and the
 * bundled CLI's `cli-entry.ts` both import it before anything else. ESM
 * evaluates imports in source order, dependencies first, so with this as the
 * first import nothing else in the process runs ahead of it. It has no imports
 * of its own, by design.
 *
 * Console output is always silenced: in stdio mode stdout IS the MCP protocol
 * stream, and the IPC channel to the proxy workers is fd-based, so one stray
 * `console.log` corrupts a session. Commands that print on purpose
 * (`--version`, `--help`, `doctor`) write to `process.stdout` directly.
 */
process.env.CONSOLE_OUTPUT_SILENCED = '1';

const noop = (): void => {};
console.log = noop;
console.error = noop;
console.warn = noop;
console.info = noop;
console.debug = noop;
console.trace = noop;
console.dir = noop;
console.table = noop;
console.group = noop;
console.groupEnd = noop;
console.time = noop;
console.timeEnd = noop;
console.assert = noop;

// Suppress process warnings
process.removeAllListeners('warning');
process.on('warning', noop);

// Clean argv before any code processes it - strip quotes from all arguments
process.argv = process.argv.map(arg =>
  typeof arg === 'string' ? arg.replace(/^["'](.*)["']$/, '$1') : arg
);

export {};
