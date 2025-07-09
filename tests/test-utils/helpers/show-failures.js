import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs tests with JSON output and displays only failures
 */
async function showFailures() {
  const jsonFile = path.join(process.cwd(), 'test-results.json');
  
  console.log('Running tests to check for failures...\n');
  
  // Run tests with JSON reporter
  // Use separate arguments to avoid path issues with spaces
  const testProcess = spawn('npx', ['vitest', 'run', '--reporter=json', '--outputFile', jsonFile], {
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    testProcess.on('close', resolve);
  });
  
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
    
    let hasFailures = false;
    
    // Process each test file
    results.testResults.forEach(testFile => {
      const failures = testFile.assertionResults?.filter(test => test.status === 'failed') || [];
      
      if (failures.length > 0) {
        hasFailures = true;
        console.log(`\n❌ FAILURES in ${path.relative(process.cwd(), testFile.name)}:`);
        console.log('─'.repeat(80));
        
        failures.forEach((failure, index) => {
          console.log(`\n${index + 1}. ${failure.fullName || failure.title}`);
          
          if (failure.failureMessages && failure.failureMessages.length > 0) {
            failure.failureMessages.forEach(message => {
              // Clean up the error message
              const lines = message.split('\n');
              const relevantLines = lines.filter(line => 
                !line.includes('node_modules') && 
                !line.includes('at async') &&
                line.trim().length > 0
              );
              console.log('\n' + relevantLines.join('\n'));
            });
          }
        });
      }
    });
    
    if (!hasFailures) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n' + '─'.repeat(80));
      console.log(`Total failures: ${results.numFailedTests || 0}`);
    }
    
    // Clean up
    fs.unlinkSync(jsonFile);
    
  } catch (error) {
    console.error('Error reading test results:', error.message);
    console.error('Make sure tests completed successfully.');
    process.exit(1);
  }
}

// Run the script
showFailures().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
