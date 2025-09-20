/**
 * Coverage Attribution Analysis for mcp-debugger
 * Automatically runs after npm run test:coverage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const summaryPath = path.join(__dirname, 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(summaryPath)) {
    // Silently exit if no coverage data (might be running in a different context)
    process.exit(0);
  }

  const coverage = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const overall = coverage.total ? coverage.total.lines.pct : 0;
  
  let totalUncovered = 0;
  let totalLines = 0;
  const files = [];
  
  for (const [filePath, data] of Object.entries(coverage)) {
    if (filePath === 'total') continue;
    
    const uncovered = data.lines.total - data.lines.covered;
    totalUncovered += uncovered;
    totalLines += data.lines.total;
    
    // Extract relative path for cleaner display
    let cleanPath = filePath.replace(process.cwd(), '').replace(/^[/\\]/, '');
    cleanPath = cleanPath.replace(/\\/g, '/');
    
    files.push({
      path: cleanPath,
      coverage: data.lines.pct,
      uncovered,
      total: data.lines.total
    });
  }
  
  // Calculate impact on overall coverage
  files.forEach(f => {
    f.impact = totalLines > 0 ? (f.uncovered / totalLines) * 100 : 0;
  });
  
  // Sort by uncovered lines (descending)
  files.sort((a, b) => b.uncovered - a.uncovered);
  
  // Print compact analysis
  console.log('\n' + '═'.repeat(70));
  console.log(' COVERAGE ANALYSIS - Files to focus on (sorted by impact):');
  console.log('═'.repeat(70));
  console.log(`Overall: ${overall.toFixed(1)}% | Focus on files with most uncovered lines`);
  console.log('─'.repeat(70));
  
  // Show top 10 files
  const topFiles = files.slice(0, 10);
  if (topFiles.length > 0) {
    console.log('Lines  Cov%  Impact  File');
    console.log('─'.repeat(70));
    topFiles.forEach(f => {
      // Shorten path if needed
      let displayPath = f.path;
      if (displayPath.length > 45) {
        displayPath = '...' + displayPath.slice(-42);
      }
      
      console.log(
        f.uncovered.toString().padStart(5) +
        f.coverage.toFixed(0).padStart(6) + '%' +
        ('+' + f.impact.toFixed(1) + '%').padStart(8) +
        '  ' + displayPath
      );
    });
    
    if (files.length > 10) {
      console.log(`... +${files.length - 10} more files`);
    }
  }
  
  console.log('─'.repeat(70));
  console.log('Run "npm run test:coverage:analyze" for detailed analysis');
  console.log('═'.repeat(70) + '\n');
  
} catch (error) {
  // Silently fail - don't disrupt the test flow
  console.log('\n[Coverage analysis unavailable]');
}
