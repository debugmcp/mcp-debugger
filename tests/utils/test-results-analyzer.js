import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyzes test results from JSON file
 */
class TestResultsAnalyzer {
  constructor(jsonFile = 'test-results.json') {
    this.jsonFile = path.join(process.cwd(), jsonFile);
  }

  async analyze(level = 'summary') {
    try {
      if (!fs.existsSync(this.jsonFile)) {
        console.error(`No test results found at ${this.jsonFile}`);
        console.error('Run "npm run test:json" first to generate test results.');
        process.exit(1);
      }

      const results = JSON.parse(fs.readFileSync(this.jsonFile, 'utf8'));
      
      switch (level) {
        case 'summary':
          this.showSummary(results);
          break;
        case 'failures':
          this.showFailures(results);
          break;
        case 'detailed':
          this.showDetailed(results);
          break;
        default:
          console.error(`Unknown level: ${level}`);
          console.error('Valid levels: summary, failures, detailed');
          process.exit(1);
      }
    } catch (error) {
      console.error('Error analyzing test results:', error.message);
      if (error instanceof SyntaxError) {
        console.error('The test results file appears to be malformed JSON.');
      }
      process.exit(1);
    }
  }

  showSummary(results) {
    const summary = {
      totalTests: results.numTotalTests || 0,
      passed: results.numPassedTests || 0,
      failed: results.numFailedTests || 0,
      skipped: results.numPendingTests || 0,
      testSuites: results.numTotalTestSuites || 0,
      passedSuites: results.numPassedTestSuites || 0,
      failedSuites: results.numFailedTestSuites || 0
    };

    console.log('TEST RESULTS ANALYSIS - SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Test Suites: ${summary.testSuites}`);
    console.log(`  ✓ Passed: ${summary.passedSuites}`);
    console.log(`  ✗ Failed: ${summary.failedSuites}`);
    console.log();
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`  ✓ Passed: ${summary.passed}`);
    console.log(`  ✗ Failed: ${summary.failed}`);
    console.log(`  ⊘ Skipped: ${summary.skipped}`);
    
    if (results.startTime && results.success !== undefined) {
      const duration = results.success ? 'Completed' : 'Failed';
      console.log(`\nStatus: ${duration}`);
    }

    // Coverage summary if available
    if (results.coverageMap) {
      console.log('\nCoverage Summary:');
      console.log('  (Run with --level=detailed for coverage breakdown)');
    }
  }

  showFailures(results) {
    const failures = [];
    
    if (!results.testResults || results.testResults.length === 0) {
      console.log('No test results to analyze.');
      return;
    }

    results.testResults.forEach(testFile => {
      const failedTests = testFile.assertionResults?.filter(test => test.status === 'failed') || [];
      if (failedTests.length > 0) {
        failures.push({
          file: testFile.name,
          tests: failedTests
        });
      }
    });

    if (failures.length === 0) {
      console.log('✅ No test failures found!');
      return;
    }

    console.log('TEST RESULTS ANALYSIS - FAILURES');
    console.log('═'.repeat(60));
    
    failures.forEach(({ file, tests }) => {
      const relativePath = path.relative(process.cwd(), file);
      console.log(`\n📁 ${relativePath}`);
      console.log('─'.repeat(60));
      
      tests.forEach((test, index) => {
        console.log(`\n${index + 1}. ${test.title || test.fullName}`);
        console.log(`   Status: ${test.status}`);
        console.log(`   Duration: ${test.duration || 0}ms`);
        
        if (test.failureMessages && test.failureMessages.length > 0) {
          console.log('\n   Error Details:');
          test.failureMessages.forEach(message => {
            // Extract the most relevant error information
            const lines = message.split('\n');
            let inStackTrace = false;
            
            lines.forEach(line => {
              if (line.includes('at ') || line.includes('node_modules')) {
                inStackTrace = true;
              }
              
              if (!inStackTrace && line.trim()) {
                console.log(`   ${line}`);
              }
            });
          });
        }
      });
    });

    console.log('\n' + '═'.repeat(60));
    console.log(`Total Failed Tests: ${results.numFailedTests || 0}`);
  }

  showDetailed(results) {
    console.log('TEST RESULTS ANALYSIS - DETAILED');
    console.log('═'.repeat(60));

    // Show summary first
    this.showSummary(results);
    
    console.log('\n' + '─'.repeat(60));
    console.log('TEST BREAKDOWN BY FILE:');
    console.log('─'.repeat(60));

    if (!results.testResults || results.testResults.length === 0) {
      console.log('No test results available.');
      return;
    }

    // Group tests by directory
    const testsByDir = {};
    
    results.testResults.forEach(testFile => {
      const relativePath = path.relative(process.cwd(), testFile.name);
      const dir = path.dirname(relativePath);
      
      if (!testsByDir[dir]) {
        testsByDir[dir] = [];
      }
      
      testsByDir[dir].push({
        file: path.basename(testFile.name),
        path: relativePath,
        tests: testFile.assertionResults || [],
        duration: testFile.endTime - testFile.startTime || 0
      });
    });

    // Display hierarchically
    Object.keys(testsByDir).sort().forEach(dir => {
      console.log(`\n📁 ${dir}/`);
      
      testsByDir[dir].forEach(({ file, path, tests, duration }) => {
        const passed = tests.filter(t => t.status === 'passed').length;
        const failed = tests.filter(t => t.status === 'failed').length;
        const skipped = tests.filter(t => t.status === 'pending').length;
        
        const status = failed > 0 ? '✗' : '✓';
        const statusColor = failed > 0 ? '❌' : '✅';
        
        console.log(`  ${statusColor} ${file} (${duration}ms)`);
        console.log(`     Tests: ${passed} passed, ${failed} failed, ${skipped} skipped`);
        
        // Show failed test names
        if (failed > 0) {
          tests.filter(t => t.status === 'failed').forEach(test => {
            console.log(`     ✗ ${test.title}`);
          });
        }
      });
    });

    // Performance metrics
    console.log('\n' + '─'.repeat(60));
    console.log('PERFORMANCE METRICS:');
    console.log('─'.repeat(60));
    
    const slowTests = [];
    results.testResults.forEach(testFile => {
      if (testFile.assertionResults) {
        testFile.assertionResults.forEach(test => {
          if (test.duration > 1000) { // Tests taking more than 1 second
            slowTests.push({
              file: path.relative(process.cwd(), testFile.name),
              test: test.title,
              duration: test.duration
            });
          }
        });
      }
    });

    if (slowTests.length > 0) {
      console.log('\nSlow Tests (>1s):');
      slowTests.sort((a, b) => b.duration - a.duration).slice(0, 10).forEach(({ file, test, duration }) => {
        console.log(`  ${(duration / 1000).toFixed(2)}s - ${test} (${file})`);
      });
    } else {
      console.log('\nAll tests completed in under 1 second.');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let level = 'summary';
let jsonFile = 'test-results.json';

args.forEach(arg => {
  if (arg.startsWith('--level=')) {
    level = arg.split('=')[1];
  } else if (arg.startsWith('--file=')) {
    jsonFile = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log('Test Results Analyzer');
    console.log('Usage: node test-results-analyzer.js [options]');
    console.log();
    console.log('Options:');
    console.log('  --level=<level>   Analysis level: summary, failures, detailed (default: summary)');
    console.log('  --file=<file>     JSON results file (default: test-results.json)');
    console.log('  --help, -h        Show this help message');
    console.log();
    console.log('Examples:');
    console.log('  node test-results-analyzer.js --level=summary');
    console.log('  node test-results-analyzer.js --level=failures');
    console.log('  node test-results-analyzer.js --level=detailed --file=custom-results.json');
    process.exit(0);
  }
});

// Run the analyzer
const analyzer = new TestResultsAnalyzer(jsonFile);
analyzer.analyze(level).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
