const fs = require('fs');
const path = require('path');

// Read the test results
const resultsPath = path.join(__dirname, '../../test-results-refactor.json');
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Extract key information
const summary = {
  totalTests: results.numTotalTests || 0,
  passedTests: results.numPassedTests || 0,
  failedTests: results.numFailedTests || 0,
  skippedTests: results.numSkippedTests || 0,
  duration: results.duration || 0,
  startTime: results.startTime || null,
  success: results.success || false
};

// Find tests that failed related to proxy or process management
const failedTests = [];
const proxyRelatedFailures = [];
const processRelatedFailures = [];

if (results.testResults) {
  results.testResults.forEach(suite => {
    if (suite.assertionResults) {
      suite.assertionResults.forEach(test => {
        if (test.status === 'failed') {
          const testInfo = {
            file: suite.name,
            title: test.title,
            fullName: test.fullName,
            failureMessages: test.failureMessages || []
          };
          
          failedTests.push(testInfo);
          
          // Check if it's proxy or process related
          const fileName = suite.name.toLowerCase();
          const testName = test.fullName.toLowerCase();
          
          if (fileName.includes('proxy') || testName.includes('proxy')) {
            proxyRelatedFailures.push(testInfo);
          }
          
          if (fileName.includes('process') || testName.includes('process') || 
              testName.includes('spawn') || testName.includes('child')) {
            processRelatedFailures.push(testInfo);
          }
        }
      });
    }
  });
}

// Output analysis
console.log('=== Test Results Analysis ===\n');
console.log('Summary:');
console.log(`  Total Tests: ${summary.totalTests}`);
console.log(`  Passed: ${summary.passedTests}`);
console.log(`  Failed: ${summary.failedTests}`);
console.log(`  Skipped: ${summary.skippedTests}`);
console.log(`  Success: ${summary.success}`);
console.log(`  Duration: ${(summary.duration / 1000).toFixed(2)}s\n`);

console.log(`Proxy-related failures: ${proxyRelatedFailures.length}`);
proxyRelatedFailures.forEach((test, i) => {
  console.log(`  ${i + 1}. ${test.file}`);
  console.log(`     ${test.fullName}`);
  if (test.failureMessages.length > 0) {
    const firstError = test.failureMessages[0].split('\n')[0];
    console.log(`     Error: ${firstError}`);
  }
});

console.log(`\nProcess-related failures: ${processRelatedFailures.length}`);
processRelatedFailures.forEach((test, i) => {
  console.log(`  ${i + 1}. ${test.file}`);
  console.log(`     ${test.fullName}`);
  if (test.failureMessages.length > 0) {
    const firstError = test.failureMessages[0].split('\n')[0];
    console.log(`     Error: ${firstError}`);
  }
});

// Check for specific error patterns
console.log('\n=== Error Pattern Analysis ===');
const errorPatterns = {
  'Cannot find module': 0,
  'is not assignable to parameter': 0,
  'Property .* is missing': 0,
  'spawn': 0,
  'IProcessManager': 0,
  'IProxyProcessLauncher': 0
};

failedTests.forEach(test => {
  test.failureMessages.forEach(msg => {
    Object.keys(errorPatterns).forEach(pattern => {
      if (new RegExp(pattern, 'i').test(msg)) {
        errorPatterns[pattern]++;
      }
    });
  });
});

console.log('\nCommon error patterns:');
Object.entries(errorPatterns).forEach(([pattern, count]) => {
  if (count > 0) {
    console.log(`  "${pattern}": ${count} occurrences`);
  }
});

// Save a compact summary
const compactSummary = {
  summary,
  proxyRelatedFailures: proxyRelatedFailures.length,
  processRelatedFailures: processRelatedFailures.length,
  errorPatterns,
  topFailures: failedTests.slice(0, 10).map(t => ({
    file: t.file.replace(/.*[\\\/]/, ''),
    test: t.title,
    error: t.failureMessages[0]?.split('\n')[0] || 'No error message'
  }))
};

fs.writeFileSync(
  path.join(__dirname, '../../test-refactor-summary.json'),
  JSON.stringify(compactSummary, null, 2)
);

console.log('\n\nCompact summary saved to test-refactor-summary.json');
