/* eslint-disable */
/**
 * Stdio silencer and stdout mirror for MCP stdio mode (container-only).
 * - Silences all console methods to prevent non-JSON stdout contamination
 * - Mirrors process stdout to /app/logs/stdout-raw.log (diagnostics only)
 * - Mirrors process stdin to /app/logs/stdin-raw.log (diagnostics only)
 * - Does NOT alter or gate protocol output (avoids interfering with SDK framing)
 * - Does nothing when not in stdio mode
 */
(function main() {
  try {
    const fs = require('fs');
    const path = require('path');

    const stripQuotes = (value) => typeof value === 'string'
      ? value.toLowerCase().replace(/^["']|["']$/g, '')
      : '';
    const matchesKeyword = (arg, keyword) => {
      const normalized = stripQuotes(arg);
      if (!normalized) {
        return false;
      }
      if (normalized === keyword) {
        return true;
      }
      if (normalized.endsWith('=' + keyword) || normalized.endsWith(':' + keyword)) {
        return true;
      }
      if (normalized.startsWith('--transport') && normalized.includes('=' + keyword)) {
        return true;
      }
      return false;
    };

    const argvValues = Array.isArray(process.argv) ? process.argv : [];
    const shouldSilence = argvValues.some(arg => matchesKeyword(arg, 'stdio')) ||
                          argvValues.some(arg => matchesKeyword(arg, 'sse')) ||
                          process.env.CONSOLE_OUTPUT_SILENCED === '1';

    if (!shouldSilence) {
      return;
    }

    // Silence console methods to avoid any non-protocol output on stdout/stderr
    const noop = () => {};
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;

    // Suppress process warnings as an extra precaution
    try {
      process.removeAllListeners('warning');
    } catch (_) {}
    process.on('warning', noop);

    // Prepare logs directory
    const logsDir = '/app/logs';
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (_) {}

    // Mirror stdin raw for diagnostics (what the server receives)
    try {
      const stdinLogPath = path.join(logsDir, 'stdin-raw.log');
      const stdinLogStream = fs.createWriteStream(stdinLogPath, { flags: 'a' });
      if (process.stdin && typeof process.stdin.on === 'function') {
        process.stdin.on('data', (chunk) => {
          try {
            stdinLogStream.write(chunk);
          } catch (_) {}
        });
      }
    } catch (_) {}

    // Mirror stdout to a file for diagnostics (non-invasive: do not modify content or gating)
    try {
      const stdoutLogPath = path.join(logsDir, 'stdout-raw.log');
      const stdoutLogStream = fs.createWriteStream(stdoutLogPath, { flags: 'a' });

      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = function(chunk, encoding, callback) {
        try {
          // Write exactly what would be sent to client without any modification
          stdoutLogStream.write(chunk);
        } catch (_) {}
        return origWrite(chunk, encoding, callback);
      };
    } catch (err) {
      try {
        fs.appendFileSync(path.join(logsDir, 'stdio-silencer-error.log'),
          `Failed to setup stdout mirror: ${err.message}\n`);
      } catch (_) {}
    }
  } catch (e) {
    // Never throw from preloader
  }
})();
