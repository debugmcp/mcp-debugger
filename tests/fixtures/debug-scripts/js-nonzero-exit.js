// Fixture for issue #1254: writes two lines to stderr and exits with code 3.
process.stderr.write('runner error: no test files found\n');
process.stderr.write('exiting with code 3\n');
process.exit(3);
