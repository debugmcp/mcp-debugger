#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function displayCoverageReport() {
  try {
    // Read the coverage summary
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    if (!fs.existsSync(coveragePath)) {
      console.error('Coverage summary not found. Run tests with coverage first.');
      process.exit(1);
    }
    
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    
    // Overall summary
    const total = coverage.total;
    console.log('\n📊 COVERAGE SUMMARY\n');
    console.log('━'.repeat(50));
    console.log(`Overall Coverage: ${total.lines.pct}%`);
    console.log('━'.repeat(50));
    console.log(`Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
    console.log(`Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
    console.log(`Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
    console.log('━'.repeat(50));
    
    // Files below threshold
    console.log('\n📁 FILES BELOW 80% COVERAGE:\n');
    const lowCoverageFiles = [];
    
    Object.entries(coverage).forEach(([file, data]) => {
      if (file !== 'total' && data.lines.pct < 80) {
        lowCoverageFiles.push({
          file: file.replace(process.cwd() + path.sep, ''),
          coverage: data.lines.pct,
          uncovered: data.lines.total - data.lines.covered
        });
      }
    });
    
    lowCoverageFiles
      .sort((a, b) => a.coverage - b.coverage)
      .forEach(({ file, coverage, uncovered }) => {
        console.log(`${coverage.toFixed(1).padStart(5)}% | ${file} (${uncovered} uncovered lines)`);
      });
    
    // Well-covered files
    console.log('\n✅ WELL-COVERED FILES (80%+):\n');
    const wellCoveredFiles = [];
    
    Object.entries(coverage).forEach(([file, data]) => {
      if (file !== 'total' && data.lines.pct >= 80) {
        wellCoveredFiles.push({
          file: file.replace(process.cwd() + path.sep, ''),
          coverage: data.lines.pct
        });
      }
    });
    
    wellCoveredFiles
      .sort((a, b) => b.coverage - a.coverage)
      .forEach(({ file, coverage }) => {
        console.log(`${coverage.toFixed(1).padStart(5)}% | ${file}`);
      });
    
    // Summary stats
    const filesBelow80 = lowCoverageFiles.length;
    const filesAbove80 = wellCoveredFiles.length;
    const totalFiles = filesBelow80 + filesAbove80;
    
    console.log('\n📈 PROGRESS TO 80% GOAL:\n');
    console.log(`Files at 80%+: ${filesAbove80}/${totalFiles} (${((filesAbove80/totalFiles)*100).toFixed(1)}%)`);
    console.log(`Overall: ${total.lines.pct}% → 80% (${(80 - total.lines.pct).toFixed(1)}% to go)`);
    
    // Exit with error if below threshold
    if (total.lines.pct < 80) {
      console.log('\n❌ Coverage is below 80% threshold\n');
      process.exit(1);
    } else {
      console.log('\n✅ Coverage meets 80% threshold!\n');
    }
    
  } catch (error) {
    console.error('Error reading coverage data:', error.message);
    process.exit(1);
  }
}

displayCoverageReport();
