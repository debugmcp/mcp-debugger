#!/usr/bin/env node
/**
 * Exit-code fixture for MCP debugger smoke tests.
 *
 * Prints one line and exits with status 7, so a test can tell "the program
 * ran to completion" from "the debugger reported its exit code" (issue #796:
 * the Docker image shipped without the JavaScript exit-code preload, and
 * sessions ended `stopped` with no exitCode at all).
 */
console.log('exit_code_test: exiting with status 7');
process.exitCode = 7;
