#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Coverage threshold indicators
const getCoverageIndicator = (percentage) => {
  if (percentage >= 80) return '✅';
  if (percentage >= 50) return '🟢';
  if (percentage >= 30) return '🟡';
  return '🔴';
};

// Critical business logic components
const CRITICAL_COMPONENTS = {
  'src/session/session-manager.ts': 'SessionManager',
  'src/session/session-store.ts': 'SessionStore',
  'src/proxy/proxy-manager.ts': 'ProxyManager',
  'src/proxy/minimal-dap.ts': 'MinimalDapClient',
  'src/proxy/dap-proxy.ts': 'DAP Proxy',
  'src/dap-core/handlers.ts': 'DAP Handlers',
  'src/dap-core/state.ts': 'DAP State',
  'src/server.ts': 'Main Server',
  'src/implementations/process-launcher-impl.ts': 'Process Launcher',
  'src/implementations/process-manager-impl.ts': 'Process Manager',
  'src/implementations/network-manager-impl.ts': 'Network Manager',
  'src/implementations/file-system-impl.ts': 'File System'
};

// Helper to normalize paths for comparison
function normalizePath(filePath) {
  // Convert to relative path, use forward slashes, and lowercase
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/').toLowerCase();
}

// Parse detailed coverage data
function parseCoverageData() {
  const finalReportPath = path.join(process.cwd(), 'coverage', 'coverage-final.json'); // Primary source for detailed data
  const summaryReportPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json'); // Optional summary

  let detailedData = null; // Will hold content of coverage-final.json
  let summaryTotal = null; // Will hold the 'total' block

  try {
    if (fs.existsSync(finalReportPath)) {
      detailedData = JSON.parse(fs.readFileSync(finalReportPath, 'utf8'));
      console.log('Successfully read detailed coverage report from:', finalReportPath);
    } else {
      console.error('Primary detailed coverage report (coverage-final.json) not found at:', finalReportPath);
      throw new Error('Essential coverage data (coverage-final.json) could not be loaded. Run tests with coverage first.');
    }
  } catch (error) {
    console.error('Error reading or parsing detailed coverage report (coverage-final.json):', error.message);
    throw error; 
  }

  // Attempt to get 'total' from detailedData (coverage-final.json) if it exists
  if (detailedData && detailedData.total) {
    summaryTotal = detailedData.total;
    console.log('Extracted overall summary from top-level "total" key in coverage-final.json.');
  } else if (detailedData) {
    // If no top-level 'total', calculate it from all file entries in coverage-final.json
    console.log('No top-level "total" key in coverage-final.json. Calculating from file entries...');
    const calculatedTotal = {
      lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
      statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
      functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 0 }
    };
    let fileCount = 0;
    for (const filePath in detailedData) {
      if (filePath === 'total' || typeof detailedData[filePath] !== 'object') continue;
      
      const fileCoverage = detailedData[filePath];

      // Ensure each fileCoverage object has statements, functions, branches, lines summaries
      // Calculate them if they are missing (common if coverage-final.json is from V8 or a minimal Istanbul setup)
      if (!fileCoverage.statements && fileCoverage.statementMap && fileCoverage.s) {
        const totalStatements = Object.keys(fileCoverage.statementMap).length;
        const coveredStatements = Object.values(fileCoverage.s).filter(count => count > 0).length;
        fileCoverage.statements = {
          total: totalStatements,
          covered: coveredStatements,
          skipped: 0, // V8/minimal Istanbul might not provide skipped for statements directly
          pct: totalStatements > 0 ? parseFloat(((coveredStatements / totalStatements) * 100).toFixed(2)) : 100,
        };
      }
      if (!fileCoverage.functions && fileCoverage.fnMap && fileCoverage.f) {
        const totalFunctions = Object.keys(fileCoverage.fnMap).length;
        const coveredFunctions = Object.values(fileCoverage.f).filter(count => count > 0).length;
        fileCoverage.functions = {
          total: totalFunctions,
          covered: coveredFunctions,
          skipped: 0,
          pct: totalFunctions > 0 ? parseFloat(((coveredFunctions / totalFunctions) * 100).toFixed(2)) : 100,
        };
      }
      if (!fileCoverage.branches && fileCoverage.branchMap && fileCoverage.b) {
        const branchSummary = getBranchCoverage(fileCoverage); // Uses existing helper
        fileCoverage.branches = {
          total: branchSummary.total,
          covered: branchSummary.covered,
          skipped: 0, // getBranchCoverage doesn't provide skipped
          pct: branchSummary.percentage,
        };
      }
      // Istanbul 'json' reporter usually includes 'lines'. If not, use statements as a proxy.
      if (!fileCoverage.lines && fileCoverage.statements) {
        console.warn(`File ${filePath} missing 'lines' summary, using 'statements' as a proxy.`);
        fileCoverage.lines = { ...fileCoverage.statements }; // Proxy lines with statements
      }
      
      // Now, proceed if we have the necessary .lines (even if proxied)
      if (typeof detailedData[filePath] !== 'object' || !detailedData[filePath].lines) continue;

      fileCount++; // Count files that have at least a .lines summary (or proxy)
      
      ['lines', 'statements', 'functions', 'branches'].forEach(type => {
        if (fileCoverage[type]) {
          calculatedTotal[type].total += fileCoverage[type].total || 0;
          calculatedTotal[type].covered += fileCoverage[type].covered || 0;
          calculatedTotal[type].skipped += fileCoverage[type].skipped || 0;
        }
      });
    }

    if (fileCount > 0) {
      ['lines', 'statements', 'functions', 'branches'].forEach(type => {
        if (calculatedTotal[type].total > 0) {
          calculatedTotal[type].pct = parseFloat(((calculatedTotal[type].covered / calculatedTotal[type].total) * 100).toFixed(2));
        } else {
          calculatedTotal[type].pct = 100; 
        }
      });
      summaryTotal = calculatedTotal;
      console.log('Successfully calculated overall summary from file entries in coverage-final.json.');
    } else {
      console.warn('No file entries with usable summary data found in coverage-final.json to calculate total summary.');
    }
  }

  // Try to load coverage-summary.json if it exists, it might have a more "official" total.
  // This will override the calculated total if summary.json has a valid 'total' block.
  try {
    if (fs.existsSync(summaryReportPath)) {
      const summaryJson = JSON.parse(fs.readFileSync(summaryReportPath, 'utf8'));
      console.log('Successfully read summary coverage report from:', summaryReportPath);
      if (summaryJson && summaryJson.total) {
        summaryTotal = summaryJson.total; 
        console.log('Overriding with overall summary from coverage-summary.json.');
      } else {
        console.warn('coverage-summary.json was found but did not contain a "total" block.');
      }
    } else {
      console.warn('Optional summary coverage report (coverage-summary.json) not found at:', summaryReportPath);
    }
  } catch (error) {
    console.error('Error reading or parsing summary coverage report (coverage-summary.json):', error.message);
  }
  
  if (!detailedData) { 
     throw new Error('Essential detailed coverage data (coverage-final.json) could not be loaded.');
  }

  if (!summaryTotal) {
    console.error('CRITICAL: No "total" coverage summary could be extracted or calculated. Overall metrics will be zero.');
    summaryTotal = {
      lines: { pct: 0, covered: 0, total: 0, skipped: 0 },
      statements: { pct: 0, covered: 0, total: 0, skipped: 0 },
      branches: { pct: 0, covered: 0, total: 0, skipped: 0 },
      functions: { pct: 0, covered: 0, total: 0, skipped: 0 },
    };
  }
  
  return { detailed: detailedData, summaryTotal };
}

// Extract untested functions from file coverage
function getUntestedFunctions(fileCoverage) {
  const untested = [];
  if (!fileCoverage || !fileCoverage.fnMap || !fileCoverage.f) return untested;
  
  Object.entries(fileCoverage.fnMap).forEach(([id, fnData]) => {
    if (fileCoverage.f[id] === 0) {
      untested.push({
        name: fnData.name || `(anonymous_fn_${id})`, // More specific anonymous name
        line: fnData.decl.start.line,
        // loc: fnData.loc // Could include full location if needed later
      });
    }
  });
  return untested;
}

// Analyze branch coverage
function getBranchCoverage(fileCoverage) {
  let covered = 0;
  let total = 0;
  if (!fileCoverage || !fileCoverage.branchMap || !fileCoverage.b) return { covered, total, percentage: 100 };
  
  Object.entries(fileCoverage.b).forEach(([, branches]) => {
    branches.forEach(count => {
      total++;
      if (count > 0) covered++;
    });
  });
  return { covered, total, percentage: total > 0 ? parseFloat(((covered / total) * 100).toFixed(2)) : 100 };
}

// Extract untested branches from file coverage
function getUntestedBranches(fileCoverage) {
  const untested = [];
  if (!fileCoverage || !fileCoverage.branchMap || !fileCoverage.b) return untested;

  Object.entries(fileCoverage.branchMap).forEach(([branchId, branchData]) => {
    const branchCounts = fileCoverage.b[branchId] || [];
    branchCounts.forEach((count, index) => {
      if (count === 0) {
        untested.push({
          branchId: branchId,
          pathIndex: index,
          type: branchData.type || 'unknown',
          line: branchData.loc.start.line,
          // loc: branchData.locations[index] // Full location of the branch path
          description: `Branch path ${index} at line ${branchData.loc.start.line} (type: ${branchData.type || 'unknown'}) not taken.`
        });
      }
    });
  });
  return untested;
}

// Identify quick wins
function identifyQuickWins(coverageData) {
  const quickWins = [];
  if (!coverageData.detailed) {
    console.warn('Detailed coverage data not available for identifying quick wins.');
    return quickWins;
  }
  
  Object.entries(coverageData.detailed).forEach(([file, data]) => {
    if (file === 'total') return; // Skip 'total' if it exists in detailed report
    const relativePath = file.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
    const fileSummaryInDetailed = data; // data is the per-file summary from detailed report
    
    if (!fileSummaryInDetailed || !fileSummaryInDetailed.lines || fileSummaryInDetailed.lines.pct >= 80) return;
    
    const untestedFunctions = getUntestedFunctions(data);
    const functionCount = Object.keys(data.fnMap || {}).length;
    const untestedCount = untestedFunctions.length;
    
    if (untestedCount > 0 && untestedCount <= 3 && functionCount > 0) {
      const potentialGain = (untestedCount / functionCount) * 100;
      if (potentialGain >= 20) {
        quickWins.push({
          file: relativePath,
          currentCoverage: fileSummaryInDetailed.lines.pct,
          untestedFunctions: untestedFunctions.map(f => f.name),
          potentialGain: Math.round(potentialGain),
          estimatedTests: untestedCount
        });
      }
    }
  });
  return quickWins.sort((a, b) => b.potentialGain - a.potentialGain).slice(0, 5);
}

// Categorize by test type
function categorizeByTestType(coverageData) {
  const testTypes = {
    unit: { files: 0, coverage: 0 },
    integration: { files: 0, coverage: 0 },
    e2e: { files: 0, coverage: 0 },
    untested: { files: 0, coverage: 0 }
  };
  
  const dataToCategorize = coverageData.detailed || coverageData.summary;
  if (!dataToCategorize || typeof dataToCategorize !== 'object') {
      console.warn('No data available for categorizing by test type.');
      return testTypes;
  }
  if (!coverageData.detailed) {
    console.warn('Detailed coverage data not available for categorizing by test type. Using summary data if available (less accurate).');
  }
  
  Object.entries(dataToCategorize).forEach(([file, data]) => {
    if (file === 'total') return;
    const relativePath = file.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
    if (relativePath.includes('tests/')) return;
    
    if (data && data.lines && typeof data.lines.pct === 'number') {
      if (data.lines.pct === 0) {
        testTypes.untested.files++;
      } else if (relativePath.includes('utils/') || relativePath.includes('implementations/')) {
        testTypes.unit.files++;
        testTypes.unit.coverage += data.lines.pct;
      } else if (relativePath.includes('session/') || relativePath.includes('proxy/')) {
        testTypes.integration.files++;
        testTypes.integration.coverage += data.lines.pct;
      } else {
        testTypes.e2e.files++;
        testTypes.e2e.coverage += data.lines.pct;
      }
    }
  });
  
  Object.keys(testTypes).forEach(type => {
    if (testTypes[type].files > 0 && type !== 'untested') {
      testTypes[type].coverage = Math.round(testTypes[type].coverage / testTypes[type].files);
    }
  });
  return testTypes;
}

// Analyze critical components
function analyzeCriticalComponents(coverageData) {
  const analysis = {};
  if (!coverageData.detailed) {
    console.warn('Detailed coverage data not available for analyzing critical components.');
    Object.entries(CRITICAL_COMPONENTS).forEach(([filePath, componentName]) => {
      analysis[componentName] = { status: 'NO_DETAILED_DATA', coverage: 0, file: filePath, isCritical: true, indicator: '❓' };
    });
    return analysis;
  }
  
  const normalizedDetailedData = {};
  if (coverageData.detailed) {
    Object.entries(coverageData.detailed).forEach(([absPath, data]) => {
      if (absPath === 'total') return; // Skip the total block if it's at the top level
      normalizedDetailedData[normalizePath(absPath)] = data;
    });
  }

  Object.entries(CRITICAL_COMPONENTS).forEach(([relativeCritPath, componentName]) => {
    const normalizedCritPath = normalizePath(path.join(process.cwd(), relativeCritPath)); // Normalize the critical component path
    const fileData = normalizedDetailedData[normalizedCritPath];
    
    if (!fileData || !fileData.lines) {
      analysis[componentName] = {
        status: 'NOT_FOUND',
        coverage: 0,
        file: relativeCritPath, // Corrected: Use relativeCritPath
        isCritical: true,
        indicator: '❓'
      };
      return;
    }
    
    const untestedFunctions = getUntestedFunctions(fileData);
    const branchCoverageDetails = getBranchCoverage(fileData); // This returns { covered, total, percentage }
    const untestedBranches = getUntestedBranches(fileData);
    
    analysis[componentName] = {
      file: relativeCritPath, // Use the original relative path for display
      coverage: fileData.lines.pct, // This might be statement.pct if lines was proxied
      statements: fileData.statements.pct,
      branches: branchCoverageDetails.percentage,
      functions: fileData.functions.pct,
      untestedFunctionsDetail: untestedFunctions, // Keep detailed info
      untestedBranchesDetail: untestedBranches,   // Keep detailed info
      isCritical: true,
      indicator: getCoverageIndicator(fileData.lines.pct)
    };
  });
  return analysis;
}

// Generate markdown report
function generateMarkdownReport(analysis) {
  const { summaryTotal, priorityFiles, criticalComponents, quickWins, testTypes, detailedData } = analysis;

  // summaryTotal is now the definitive source for overall metrics
  const overallSummary = summaryTotal || { lines:{pct:0}, statements:{pct:0}, branches:{pct:0}, functions:{pct:0} }; 
  const overallLinesPct = overallSummary.lines?.pct || 0;
  const overallStatementsPct = overallSummary.statements?.pct || 0;
  const overallBranchesPct = overallSummary.branches?.pct || 0;
  const overallFunctionsPct = overallSummary.functions?.pct || 0;
  
  let markdown = '# Test Coverage Analysis Report\n\n';
  markdown += `Generated: ${new Date().toLocaleString()}\n\n`;

  markdown += '## Coverage Summary\n\n';
  markdown += `- **Overall**: ${getCoverageIndicator(overallLinesPct)} ${overallLinesPct.toFixed(1)}%\n`;
  markdown += `- **Statements**: ${overallStatementsPct.toFixed(1)}% (${overallSummary.statements?.covered || 0}/${overallSummary.statements?.total || 0})\n`;
  markdown += `- **Branches**: ${overallBranchesPct.toFixed(1)}% (${overallSummary.branches?.covered || 0}/${overallSummary.branches?.total || 0})\n`;
  markdown += `- **Functions**: ${overallFunctionsPct.toFixed(1)}% (${overallSummary.functions?.covered || 0}/${overallSummary.functions?.total || 0})\n`;
  markdown += `- **Lines**: ${overallLinesPct.toFixed(1)}% (${overallSummary.lines?.covered || 0}/${overallSummary.lines?.total || 0})\n\n`;

  markdown += '## Priority Files (Lowest Coverage)\n\n';
  if (detailedData && priorityFiles && priorityFiles.length > 0) {
    priorityFiles.slice(0, 10).forEach((file, index) => {
      const indicator = getCoverageIndicator(file.coverage);
      const critical = file.isCritical ? ' **(CRITICAL)**' : '';
      markdown += `${index + 1}. ${indicator} \`${file.path}\` - ${file.coverage.toFixed(1)}%${critical}\n`;
      if (file.uncoveredLines > 0) {
        markdown += `   - ${file.uncoveredLines} uncovered lines\n`;
      }
    });
  } else {
    markdown += 'Detailed coverage data not available or no priority files identified.\n';
  }
  markdown += '\n';
  
  markdown += '## Critical Components Analysis\n\n';
  if (Object.keys(criticalComponents).length > 0) {
    const criticalBelow50 = Object.entries(criticalComponents)
      .filter(([, data]) => data.status !== 'NO_DETAILED_DATA' && data.coverage < 50 && data.status !== 'NOT_FOUND')
      .sort(([, a], [, b]) => a.coverage - b.coverage);
    
    if (criticalBelow50.length > 0) {
      markdown += '### ⚠️ Critical Components Below 50%\n\n';
      criticalBelow50.forEach(([name, data]) => {
        markdown += `#### ${name} ${data.indicator}\n`;
        markdown += `- **File**: \`${data.file}\`\n`;
        markdown += `- **Line Coverage**: ${data.coverage.toFixed(1)}% (Note: may be proxied by statement coverage)\n`;
        markdown += `- **Statements**: ${data.statements.toFixed(1)}%\n`;
        markdown += `- **Functions**: ${data.functions.toFixed(1)}%\n`;
        markdown += `- **Branches**: ${Math.round(data.branches || 0)}%\n`;
        if (data.untestedFunctionsDetail && data.untestedFunctionsDetail.length > 0) {
          markdown += `  - **Untested Functions**:\n`;
          data.untestedFunctionsDetail.forEach(fn => {
            markdown += `    - \`${fn.name}\` (line ${fn.line})\n`;
          });
        }
        if (data.untestedBranchesDetail && data.untestedBranchesDetail.length > 0) {
          markdown += `  - **Untested Branches**:\n`;
          data.untestedBranchesDetail.slice(0, 5).forEach(br => { // Limit to avoid overly long reports initially
            markdown += `    - Line ${br.line} (type: ${br.type}, path ${br.pathIndex})\n`;
          });
          if (data.untestedBranchesDetail.length > 5) {
            markdown += `    - ... and ${data.untestedBranchesDetail.length - 5} more branches.\n`;
          }
        }
        markdown += '\n';
      });
    } else if (!detailedData) {
       markdown += 'Detailed coverage data not available for critical components analysis.\n';
    } else {
      markdown += 'No critical components found below 50% coverage based on available detailed data.\n';
    }
  } else {
     markdown += 'Critical components analysis not performed or no data available.\n';
  }
  markdown += '\n';
  
  markdown += '## 🎯 Quick Wins\n\n';
  if (detailedData && quickWins && quickWins.length > 0) {
    markdown += 'Files where adding just a few tests could significantly boost coverage:\n\n';
    quickWins.forEach((win, index) => {
      markdown += `${index + 1}. **${win.file}**\n`;
      markdown += `   - Current: ${win.currentCoverage.toFixed(1)}% → Potential: ${(win.currentCoverage + win.potentialGain).toFixed(1)}%\n`;
      markdown += `   - Add ${win.estimatedTests} test(s) for: ${win.untestedFunctions.join(', ')}\n\n`;
    });
  } else if (detailedData) {
    markdown += 'No quick wins identified from available detailed data.\n\n';
  } else {
    markdown += 'Detailed coverage data not available to identify quick wins.\n\n';
  }
  
  markdown += '## Test Type Coverage Insights\n\n';
  if (Object.values(testTypes).some(t => t.files > 0)) {
    markdown += '| Test Type | Files | Avg Coverage |\n';
    markdown += '|-----------|-------|-------------|\n';
    Object.entries(testTypes).forEach(([type, data]) => {
      if (type !== 'untested') {
        markdown += `| ${type.charAt(0).toUpperCase() + type.slice(1)} | ${data.files} | ${data.coverage}% |\n`;
      }
    });
    if (testTypes.untested.files > 0) {
      markdown += `| **Untested** | ${testTypes.untested.files} | 0% |\n`;
    }
  } else {
    markdown += 'Coverage data not available for test type breakdown.\n';
  }
  markdown += '\n';
  
  markdown += '## Key Findings\n\n';
  if (detailedData && Object.keys(criticalComponents).length > 0) {
    const allCriticalCovered = Object.values(criticalComponents).every(c => c.status === 'NO_DETAILED_DATA' || c.coverage >= 80);
    const criticalNeedWork = Object.entries(criticalComponents)
      .filter(([, data]) => data.status !== 'NO_DETAILED_DATA' && data.coverage < 80 && data.status !== 'NOT_FOUND');
    
    if (allCriticalCovered && !criticalNeedWork.some(c => c[1].status === 'NOT_FOUND')) {
      markdown += '✅ **All critical components have good coverage (80%+) or detailed data was unavailable.**\n\n';
    } else if (criticalNeedWork.length > 0) {
      markdown += `⚠️ **${criticalNeedWork.length} critical components need more tests**\n\n`;
      criticalNeedWork.forEach(([name, data]) => {
        markdown += `- **${name}**: ${data.coverage.toFixed(1)}% coverage`;
        if (data.branches < 50) {
          markdown += ` (branch coverage critically low at ${Math.round(data.branches || 0)}%)`;
        }
        markdown += '\n';
      });
      markdown += '\n';
    } else {
       markdown += 'Could not determine status of critical components due to missing detailed data or all components being marked as NOT_FOUND.\n\n';
    }
  } else {
    markdown += 'Detailed coverage data not available for key findings on critical components.\n\n';
  }
  
  const gap = 80 - overallLinesPct;
  if (gap > 0) {
    markdown += `📈 **Progress to 80% overall goal**: ${gap.toFixed(1)}% to go\n\n`;
  } else if (overallLinesPct > 0) { // Only show if we have some coverage
    markdown += `🎉 **Overall coverage goal of 80% met or exceeded!** (${overallLinesPct.toFixed(1)}%)\n\n`;
  } else {
    markdown += `No overall coverage data to assess 80% goal.\n\n`;
  }
  
  return markdown;
}

function generateCoverageDistributionChartText(priorityFiles, barLength = 20) {
  if (!priorityFiles || priorityFiles.length === 0) return 'No file data for distribution chart.\n';

  const bands = {
    '0-20%': { count: 0, files: [], indicator: '🔴' },
    '21-40%': { count: 0, files: [], indicator: '🟡' },
    '41-60%': { count: 0, files: [], indicator: '🟡' },
    '61-80%': { count: 0, files: [], indicator: '🟢' },
    '81-100%': { count: 0, files: [], indicator: '✅' },
  };

  priorityFiles.forEach(file => {
    const pct = file.coverage; // Using the primary coverage metric (lines or proxied statements)
    if (pct <= 20) bands['0-20%'].count++;
    else if (pct <= 40) bands['21-40%'].count++;
    else if (pct <= 60) bands['41-60%'].count++;
    else if (pct <= 80) bands['61-80%'].count++;
    else bands['81-100%'].count++;
  });

  let chartText = 'Coverage Distribution:\n';
  const maxCount = Math.max(...Object.values(bands).map(b => b.count));
  if (maxCount === 0) return 'No files with coverage data to distribute.\n';

  for (const [range, data] of Object.entries(bands)) {
    const barCount = Math.round((data.count / maxCount) * barLength) || (data.count > 0 ? 1 : 0);
    const bar = '█'.repeat(barCount);
    chartText += `${range.padEnd(8)}: ${bar.padEnd(barLength)} ${data.count} files ${data.indicator}\n`;
  }
  return chartText + '\n';
}


function generateDetailedMarkdownReport(analysis) {
  const { summaryTotal, priorityFiles, criticalComponents, quickWins, detailedData } = analysis;
  const overallLinesPct = summaryTotal?.lines?.pct || 0;
  const targetCoverage = 80;
  const gapToTarget = Math.max(0, targetCoverage - overallLinesPct).toFixed(1);

  let markdown = `# Coverage Analysis Report (Detailed)\n\n`;
  markdown += `Generated: ${new Date(analysis.timestamp).toLocaleString()}\n`;
  markdown += `Current Overall Coverage (Lines): **${overallLinesPct.toFixed(1)}%** ${getCoverageIndicator(overallLinesPct)}\n`;
  markdown += `Target Coverage: **${targetCoverage}%**\n`;
  markdown += `Gap to Target: **${gapToTarget}%**\n\n`;

  markdown += `## Executive Summary\n`;
  const filesNeedingTests = priorityFiles.filter(f => f.coverage < targetCoverage).length;
  const criticalPathsAttention = Object.values(criticalComponents).filter(c => c.coverage < 30 && c.status !== 'NOT_FOUND' && c.status !== 'NO_DETAILED_DATA').length;
  markdown += `- **${filesNeedingTests}** files need tests to reach ${targetCoverage}% coverage.\n`;
  markdown += `- **${quickWins.length}** quick wins identified (high gain for low effort).\n`;
  markdown += `- **${criticalPathsAttention}** critical path components require immediate attention (coverage < 30%).\n\n`;
  
  markdown += generateCoverageDistributionChartText(priorityFiles);

  // Priority 1: Critical Business Logic (0-30%)
  markdown += `## Priority 1: Critical Business Logic (Coverage 0-30%)\n\n`;
  const prio1Files = priorityFiles.filter(f => f.isCritical && f.coverage < 30);
  if (prio1Files.length > 0) {
    prio1Files.forEach((file, index) => {
      markdown += `### ${index + 1}. \`${file.path}\` ${getCoverageIndicator(file.coverage)}\n`;
      markdown += `- **Current Coverage (Lines/Proxy)**: ${file.coverage.toFixed(1)}%\n`;
      markdown += `- Statements: ${file.statementsPct.toFixed(1)}%, Functions: ${file.functionsPct.toFixed(1)}%, Branches: ${file.branchesPct.toFixed(1)}%\n`;
      markdown += `- Impact: Core debugging functionality (Assumed - requires manual review)\n`;
      markdown += `- **Untested Methods**:\n`;
      if (file.untestedFunctionsDetail && file.untestedFunctionsDetail.length > 0) {
        file.untestedFunctionsDetail.forEach(fn => {
          markdown += `  - \`${fn.name}\` (line ${fn.line})\n`;
        });
      } else {
        markdown += `  - None or all covered.\n`;
      }
      markdown += `- **Untested Branches** (Top 5):\n`;
      if (file.untestedBranchesDetail && file.untestedBranchesDetail.length > 0) {
        file.untestedBranchesDetail.slice(0,5).forEach(br => {
          markdown += `  - Line ${br.line} (type: ${br.type}, path ${br.pathIndex}): ${br.description}\n`;
        });
        if (file.untestedBranchesDetail.length > 5) markdown += `  - ... and ${file.untestedBranchesDetail.length - 5} more.\n`;
      } else {
        markdown += `  - None or all covered.\n`;
      }
      markdown += `- **Test File Location (Suggested)**: \`tests/unit/${file.path.replace('src/', '')}\` (adjust path as needed, e.g. .test.ts)\n`;
      markdown += `- **Mocks Required**: (To be determined based on dependencies)\n`;
      markdown += `- **Estimated Effort**: ~${(file.untestedFunctionsDetail?.length || 0) + (file.untestedBranchesDetail?.length || 0)} tests (rough estimate)\n\n`;
    });
  } else {
    markdown += "No critical files found with coverage below 30%.\n\n";
  }

  // Priority 2: Quick Wins (70-90%)
  markdown += `## Priority 2: Quick Wins (Coverage 70-90%)\n\n`;
  if (quickWins.length > 0) {
    quickWins.forEach((win, index) => {
      markdown += `### ${index + 1}. \`${win.file}\` ${getCoverageIndicator(win.currentCoverage)}\n`;
      markdown += `- Current Coverage: ${win.currentCoverage.toFixed(1)}%\n`;
      markdown += `- Potential Gain: ~${win.potentialGain}%\n`;
      markdown += `- Untested Functions: ${win.untestedFunctions.join(', ')}\n`;
      markdown += `- Estimated Tests: ${win.estimatedTests}\n\n`;
    });
  } else {
    markdown += "No quick wins identified (files between 70-90% coverage needing few tests for high gain).\n\n";
  }

  // Priority 3: Medium Coverage (30-70%)
  markdown += `## Priority 3: Medium Coverage (Coverage 30-70%)\n\n`;
  const prio3Files = priorityFiles.filter(f => f.coverage >= 30 && f.coverage < 70).sort((a,b) => a.coverage - b.coverage);
  if (prio3Files.length > 0) {
    prio3Files.forEach((file, index) => {
      markdown += `### ${index + 1}. \`${file.path}\` ${getCoverageIndicator(file.coverage)}\n`;
      markdown += `- **Current Coverage (Lines/Proxy)**: ${file.coverage.toFixed(1)}%\n`;
      markdown += `- Statements: ${file.statementsPct.toFixed(1)}%, Functions: ${file.functionsPct.toFixed(1)}%, Branches: ${file.branchesPct.toFixed(1)}%\n`;
      if (file.untestedFunctionsDetail && file.untestedFunctionsDetail.length > 0) {
         markdown += `- Untested Functions: ${file.untestedFunctionsDetail.map(f => `\`${f.name}\` (l${f.line})`).join(', ')}\n`;
      }
      if (file.untestedBranchesDetail && file.untestedBranchesDetail.length > 0) {
         markdown += `- Untested Branches: ${file.untestedBranchesDetail.length} paths (see coverage-analysis-details.json for specifics)\n`;
      }
      markdown += '\n';
    });
  } else {
    markdown += "No files found in the 30-70% coverage range.\n\n";
  }
  
  markdown += `## Architecture Recommendations\n\n`;
  markdown += `This section requires manual review and domain expertise. Consider:\n`;
  markdown += `- Components that are hard to test and may need refactoring for better testability.\n`;
  markdown += `- Identifying and resolving circular dependencies that complicate testing.\n`;
  markdown += `- Extracting interfaces for complex dependencies to facilitate mocking.\n\n`;

  return markdown;
}

function generateTestWritingTasksJson(analysis) {
  // Placeholder - to be implemented
  const tasks = [];
  const { priorityFiles, quickWins, criticalComponents, summaryTotal } = analysis;
  const targetCoverage = 80;

  // Process Prio 1: Critical < 30%
  priorityFiles.filter(f => f.isCritical && f.coverage < 30).forEach(file => {
    tasks.push({
      priority: 1,
      file: file.path,
      currentCoverage: parseFloat(file.coverage.toFixed(2)),
      targetCoverage: targetCoverage,
      testsNeeded: (file.untestedFunctionsDetail || []).map(fn => ({
        method: fn.name,
        scenarios: ["happy path", "error cases", "edge cases"], // Generic
        mockRequirements: ["To be determined"]
      })).concat((file.untestedBranchesDetail || []).map(br => ({
        branch: `Line ${br.line} (type: ${br.type}, path ${br.pathIndex})`,
        scenarios: [`Test branch path ${br.pathIndex}`],
        mockRequirements: ["To be determined"]
      }))),
      estimatedTests: (file.untestedFunctionsDetail?.length || 0) + (file.untestedBranchesDetail?.length || 0),
      complexity: "high"
    });
  });

  // Process Prio 2: Quick Wins
  quickWins.forEach(win => {
     const fileData = priorityFiles.find(f => f.path === win.file);
     tasks.push({
      priority: 2,
      file: win.file,
      currentCoverage: parseFloat(win.currentCoverage.toFixed(2)),
      targetCoverage: targetCoverage, // Or 100% for quick wins
      testsNeeded: (fileData?.untestedFunctionsDetail || []).map(fn => ({
        method: fn.name,
        scenarios: ["cover untested function"],
        mockRequirements: ["Likely minimal"]
      })),
      estimatedTests: win.estimatedTests,
      complexity: "low"
    });
  });
  
  // Process Prio 3: Medium Coverage (30-70%)
  priorityFiles.filter(f => f.coverage >= 30 && f.coverage < 70).forEach(file => {
    tasks.push({
      priority: 3,
      file: file.path,
      currentCoverage: parseFloat(file.coverage.toFixed(2)),
      targetCoverage: targetCoverage,
      testsNeeded: (file.untestedFunctionsDetail || []).map(fn => ({
        method: fn.name,
        scenarios: ["happy path", "error cases"],
        mockRequirements: ["To be determined"]
      })).concat((file.untestedBranchesDetail || []).map(br => ({
        branch: `Line ${br.line} (type: ${br.type}, path ${br.pathIndex})`,
        scenarios: [`Test branch path ${br.pathIndex}`],
        mockRequirements: ["To be determined"]
      }))),
      estimatedTests: (file.untestedFunctionsDetail?.length || 0) + (file.untestedBranchesDetail?.length || 0),
      complexity: "medium"
    });
  });


  return {
    tasks: tasks.sort((a,b) => a.priority - b.priority || a.currentCoverage - b.currentCoverage), // Sort by priority then coverage
    summary: {
      totalFiles: priorityFiles.length,
      filesNeedingTests: priorityFiles.filter(f => f.coverage < targetCoverage).length,
      estimatedTotalTests: tasks.reduce((sum, task) => sum + (task.estimatedTests || 0), 0),
      quickWins: quickWins.length
    }
  };
}

function generateExecutiveSummaryMarkdown(analysis) {
  const { summaryTotal, priorityFiles, criticalComponents, quickWins } = analysis;
  const overallLinesPct = summaryTotal?.lines?.pct || 0;
  const targetCoverage = 80;
  const gapToTarget = Math.max(0, targetCoverage - overallLinesPct).toFixed(1);
  
  let markdown = `# Coverage Summary (Executive)\n\n`;
  markdown += `Generated: ${new Date(analysis.timestamp).toLocaleString()}\n`;
  markdown += `Current Overall Coverage (Lines): **${overallLinesPct.toFixed(1)}%** ${getCoverageIndicator(overallLinesPct)}\n`;
  markdown += `Target Coverage: **${targetCoverage}%** | Gap: **${gapToTarget}%**\n\n`;

  const filesNeedingTests = priorityFiles.filter(f => f.coverage < targetCoverage).length;
  const criticalPathsAttention = Object.values(criticalComponents).filter(c => c.coverage < 30 && c.status !== 'NOT_FOUND' && c.status !== 'NO_DETAILED_DATA').length;
  markdown += `- **${filesNeedingTests}** files need tests to reach ${targetCoverage}% coverage.\n`;
  markdown += `- **${quickWins.length}** quick wins identified.\n`;
  markdown += `- **${criticalPathsAttention}** critical path components require immediate attention (coverage < 30%).\n\n`;
  markdown += `See COVERAGE_ANALYSIS_DETAILED.md for the full report and TEST_WRITING_TASKS.json for a machine-readable task list.\n`;
  return markdown;
}


// Main analysis function
async function analyzeTestCoverage() {
  try {
    console.log('Analyzing test coverage...\n');
    
    const coverageData = parseCoverageData(); // Returns { detailed, summaryTotal }
    
    const priorityFiles = [];
    if (coverageData.detailed) {
      Object.entries(coverageData.detailed).forEach(([absPath, data]) => {
        if (absPath === 'total' || typeof data !== 'object') return; 
        
        const relativePath = normalizePath(absPath);
        const isCritical = Object.keys(CRITICAL_COMPONENTS).some(criticalKey => 
            normalizePath(path.join(process.cwd(), criticalKey)) === relativePath
        );
        
        // Ensure data has summary statistics (it should have been populated in parseCoverageData)
        if (data && data.lines && data.statements && data.functions && data.branches) {
          const untestedFunctions = getUntestedFunctions(data);
          const untestedBranches = getUntestedBranches(data);
          
          priorityFiles.push({
            path: relativePath,
            coverage: data.lines.pct || 0, // lines.pct might be a proxy from statements.pct
            statementsPct: data.statements.pct || 0,
            functionsPct: data.functions.pct || 0,
            branchesPct: data.branches.pct || 0,
            isCritical,
            uncoveredLines: (data.lines.total || 0) - (data.lines.covered || 0), // Based on lines (or proxied statements)
            untestedFunctionsDetail: untestedFunctions,
            untestedBranchesDetail: untestedBranches,
            // Store the full file data for later use if needed for recommendations
            fullCoverageData: data 
          });
        } else {
          // Fallback if a file entry is malformed or missing calculated summaries
           priorityFiles.push({
            path: relativePath,
            coverage: 0,
            statementsPct: 0,
            functionsPct: 0,
            branchesPct: 0,
            isCritical,
            uncoveredLines: data.lines?.total || Object.keys(data.statementMap || {}).length || 0, // Best guess for total lines/statements
            untestedFunctionsDetail: getUntestedFunctions(data),
            untestedBranchesDetail: getUntestedBranches(data),
            fullCoverageData: data
          });
          console.warn(`File ${relativePath} was missing pre-calculated summary stats for priority listing.`);
        }
      });
      priorityFiles.sort((a, b) => a.coverage - b.coverage);
    } else {
      console.warn("Detailed coverage data not available, skipping priority file analysis.");
    }
    
    const criticalComponents = analyzeCriticalComponents(coverageData);
    const quickWins = identifyQuickWins(coverageData);
    const testTypes = categorizeByTestType(coverageData);
    
    const analysis = {
      timestamp: new Date().toISOString(),
      summaryTotal: coverageData.summaryTotal, // Now holds the definitive 'total' block
      priorityFiles,
      criticalComponents,
      quickWins,
      testTypes,
      detailedData: coverageData.detailed // This is the full content of coverage-final.json
    };
    
    fs.writeFileSync('coverage-analysis-details.json', JSON.stringify(analysis, null, 2));
    console.log('✅ Detailed coverage analysis saved to coverage-analysis-details.json');
    
    // Generate the new detailed markdown report
    const detailedMarkdown = generateDetailedMarkdownReport(analysis); // New function to be created
    fs.writeFileSync('COVERAGE_ANALYSIS_DETAILED.md', detailedMarkdown);
    console.log('✅ Detailed coverage analysis report saved to COVERAGE_ANALYSIS_DETAILED.md');

    // Generate TEST_WRITING_TASKS.json
    const testWritingTasks = generateTestWritingTasksJson(analysis); // New function to be created
    fs.writeFileSync('TEST_WRITING_TASKS.json', JSON.stringify(testWritingTasks, null, 2));
    console.log('✅ Test writing tasks saved to TEST_WRITING_TASKS.json');
    
    // Update COVERAGE_SUMMARY.md with just the executive summary part
    const executiveSummaryMarkdown = generateExecutiveSummaryMarkdown(analysis); // New function
    fs.writeFileSync('COVERAGE_SUMMARY.md', executiveSummaryMarkdown);
    console.log('✅ Executive summary updated in COVERAGE_SUMMARY.md');

    console.log('\n📊 Key Coverage Metrics:');
    const overallLinesPctOutput = analysis.summaryTotal?.lines?.pct || 0;
    console.log(`Overall Coverage: ${getCoverageIndicator(overallLinesPctOutput)} ${overallLinesPctOutput.toFixed(1)}%`);
    
    if (analysis.detailedData) { // Check if detailedData (from coverage-final.json) is available
      const criticalBelow50Count = Object.values(criticalComponents).filter(c => c.status !== 'NO_DETAILED_DATA' && c.coverage < 50 && c.status !== 'NOT_FOUND').length;
      console.log(`Critical Components Below 50%: ${criticalBelow50Count}`);
      console.log(`Quick Win Opportunities: ${quickWins.length}`);
    } else {
      console.log('Critical Components Below 50%: Detailed data not available.');
      console.log('Quick Win Opportunities: Detailed data not available.');
    }
    
  } catch (error) {
    console.error('Error analyzing coverage:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  analyzeTestCoverage();
}

module.exports = { analyzeTestCoverage };
