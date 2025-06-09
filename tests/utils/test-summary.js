import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs tests and displays a clean summary
 */
async function testSummary() {
  const jsonFile = path.join(process.cwd(), 'test-results.json');
  
  console.log('Running tests...\n');
  
  // Run tests with JSON reporter
  // Use separate arguments to avoid path issues with spaces
  const vitestArgs = ['vitest', 'run', '--reporter=json', '--outputFile', jsonFile];
  const testProcess = spawn('npx', vitestArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    cwd: process.cwd()
  });
  
  // Capture output but don't display it
  testProcess.stdout.on('data', () => {});
  testProcess.stderr.on('data', () => {});
  
  const startTime = Date.now();
  
  await new Promise((resolve) => {
    testProcess.on('close', resolve);
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Read and parse results
  try {
    if (!fs.existsSync(jsonFile)) {
      console.error('No test results found. Test run may have failed to start.');
      process.exit(1);
    }
    
    const results = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    
    if (!results.testResults || results.testResults.length === 0) {
      console.log('No test results to analyze.');
      return;
    }
    
    // Calculate summary stats
    const summary = {
      totalTests: results.numTotalTests || 0,
      passed: results.numPassedTests || 0,
      failed: results.numFailedTests || 0,
      skipped: results.numPendingTests || 0,
      duration: duration,
      testSuites: results.numTotalTestSuites || 0,
      passedSuites: results.numPassedTestSuites || 0,
      failedSuites: results.numFailedTestSuites || 0
    };
    
    // Display summary
    console.log('TEST SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Test Suites: ${summary.passedSuites} passed, ${summary.failedSuites} failed, ${summary.testSuites} total`);
    console.log(`Tests:       ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.totalTests} total`);
    console.log(`Duration:    ${summary.duration}s`);
    console.log('═'.repeat(50));
    
    // If there are failures, list them
    if (summary.failed > 0) {
      console.log('\nFAILED TESTS:');
      console.log('─'.repeat(50));
      
      results.testResults.forEach(testFile => {
        const failures = testFile.assertionResults?.filter(test => test.status === 'failed') || [];
        
        if (failures.length > 0) {
          const relativePath = path.relative(process.cwd(), testFile.name);
          console.log(`\n${relativePath}:`);
          
          failures.forEach(failure => {
            console.log(`  ❌ ${failure.title || failure.fullName}`);
            
            // Show first error line only
            if (failure.failureMessages && failure.failureMessages.length > 0) {
              const firstError = failure.failureMessages[0];
              const errorLines = firstError.split('\n');
              const errorSummary = errorLines.find(line => 
                line.includes('Expected') || 
                line.includes('Received') || 
                line.includes('Error:') ||
                line.includes('AssertionError')
              );
              
              if (errorSummary) {
                console.log(`     ${errorSummary.trim()}`);
              }
            }
          });
        }
      });
      
      console.log('\n' + '─'.repeat(50));
      console.log('Run "npm run test:failures" for detailed error information');
    }
    
    // Exit code based on test results
    const exitCode = summary.failed > 0 ? 1 : 0;
    
    // Clean up
    fs.unlinkSync(jsonFile);
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('Error reading test results:', error.message);
    
    // If JSON file exists but is malformed, try to show raw content
    if (fs.existsSync(jsonFile)) {
      console.error('\nRaw test output:');
      console.error(fs.readFileSync(jsonFile, 'utf8').substring(0, 500) + '...');
      fs.unlinkSync(jsonFile);
    }
    
    process.exit(1);
  }
}

// Run the script
testSummary().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
