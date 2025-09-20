/**
 * Detailed Coverage Attribution Analysis for mcp-debugger
 * Run manually with: npm run test:coverage:analyze
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const summaryPath = path.join(__dirname, 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(summaryPath)) {
    console.log('No coverage data found. Run: npm run test:coverage');
    process.exit(1);
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
  
  console.log('\nMCP-DEBUGGER DETAILED COVERAGE ANALYSIS');
  console.log('═'.repeat(80));
  console.log(`Overall Coverage: ${overall.toFixed(1)}%`);
  console.log(`Total Lines: ${totalLines.toLocaleString()}`);
  console.log(`Uncovered Lines: ${totalUncovered.toLocaleString()}`);
  console.log('═'.repeat(80));
  console.log('\nFiles sorted by number of uncovered lines (highest impact first):\n');
  console.log('Uncovered  Coverage  Impact  File');
  console.log('─'.repeat(80));
  
  // Show all files with uncovered lines
  files.forEach(f => {
    if (f.uncovered > 0) {
      console.log(
        f.uncovered.toString().padStart(9) +
        f.coverage.toFixed(1).padStart(9) + '%' +
        ('+' + f.impact.toFixed(1) + '%').padStart(8) +
        '  ' + f.path
      );
    }
  });
  
  console.log('\n' + '─'.repeat(80));
  console.log('Impact: Percentage points overall coverage would increase if file reaches 100%');
  
  // Summary insights
  console.log('\n' + '═'.repeat(80));
  console.log('INSIGHTS:');
  console.log('─'.repeat(80));
  
  const top5 = files.slice(0, 5);
  const top5Impact = top5.reduce((sum, f) => sum + f.impact, 0);
  console.log(`• Top 5 files contain ${top5.reduce((sum, f) => sum + f.uncovered, 0)} uncovered lines`);
  console.log(`• Fixing top 5 files would improve coverage by ${top5Impact.toFixed(1)} percentage points`);
  console.log(`• This would bring overall coverage from ${overall.toFixed(1)}% to ${(overall + top5Impact).toFixed(1)}%`);
  
  if (files[0] && files[0].uncovered > 50) {
    console.log(`\n• Priority: Focus on ${files[0].path.split('/').pop()}`);
    console.log(`  ${files[0].uncovered} uncovered lines, currently ${files[0].coverage.toFixed(1)}% covered`);
  }
  
  console.log('═'.repeat(80) + '\n');
  
} catch (error) {
  console.error('Error:', error.message);
}
