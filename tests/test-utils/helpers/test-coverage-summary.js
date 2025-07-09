import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs tests with coverage and displays a minimal summary
 */
async function testCoverageSummary() {
  const jsonFile = path.join(process.cwd(), 'test-results.json');
  const coverageSummaryFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  
  console.log('Running tests with coverage...\n');
  
  // Run tests with coverage and JSON reporter
  // Use separate arguments to avoid path issues with spaces
  const vitestArgs = ['vitest', 'run', '--coverage', '--reporter=dot', '--outputFile', jsonFile];
  const testProcess = spawn('npx', vitestArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    cwd: process.cwd()
  });
  
  // Capture output but don't display verbose logs
  let dots = '';
  testProcess.stdout.on('data', (data) => {
    const output = data.toString();
    // Extract only the dots/progress indicators
    const progressMatch = output.match(/[·.xX!*]+/g);
    if (progressMatch) {
      dots += progressMatch.join('');
      process.stdout.write(progressMatch.join(''));
    }
  });
  
  testProcess.stderr.on('data', () => {});
  
  const startTime = Date.now();
  
  await new Promise((resolve) => {
    testProcess.on('close', resolve);
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Read and parse results
  try {
    // Parse test results
    let testSummary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    
    if (fs.existsSync(jsonFile)) {
      const results = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      testSummary = {
        totalTests: results.numTotalTests || 0,
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        skipped: results.numPendingTests || 0
      };
    }
    
    // Parse coverage results
    let coverageSummary = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    };
    
    if (fs.existsSync(coverageSummaryFile)) {
      const coverage = JSON.parse(fs.readFileSync(coverageSummaryFile, 'utf8'));
      if (coverage.total) {
        coverageSummary = {
          statements: coverage.total.statements.pct || 0,
          branches: coverage.total.branches.pct || 0,
          functions: coverage.total.functions.pct || 0,
          lines: coverage.total.lines.pct || 0
        };
      }
    }
    
    // Display minimal summary
    console.log('\n');
    console.log('─'.repeat(70));
    console.log(`Test Files  ${testSummary.failed > 0 ? testSummary.failed + ' failed |' : ''} ${testSummary.passed} passed`);
    console.log(`     Tests  ${testSummary.failed > 0 ? testSummary.failed + ' failed |' : ''} ${testSummary.passed} passed${testSummary.skipped > 0 ? ' | ' + testSummary.skipped + ' skipped' : ''}`);
    console.log(`  Duration  ${duration}s`);
    console.log(`  Coverage  ${coverageSummary.statements.toFixed(2)}% stmts | ${coverageSummary.branches.toFixed(1)}% branch | ${coverageSummary.functions.toFixed(2)}% funcs | ${coverageSummary.lines.toFixed(1)}% lines`);
    console.log('─'.repeat(70));
    
    // Exit code based on test results
    const exitCode = testSummary.failed > 0 ? 1 : 0;
    
    // Clean up
    if (fs.existsSync(jsonFile)) {
      fs.unlinkSync(jsonFile);
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('Error reading results:', error.message);
    
    // Try to provide basic info even on error
    console.log('\n');
    console.log('─'.repeat(70));
    console.log('Test run completed with errors. Check logs for details.');
    console.log(`Duration: ${duration}s`);
    console.log('─'.repeat(70));
    
    // Clean up
    if (fs.existsSync(jsonFile)) {
      fs.unlinkSync(jsonFile);
    }
    
    process.exit(1);
  }
}

// Run the script
testCoverageSummary().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
