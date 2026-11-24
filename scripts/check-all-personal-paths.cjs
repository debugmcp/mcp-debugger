#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('path');
const { checkFile } = require('./check-personal-paths.cjs');

// File extensions to check
const extensions = [
  'md', 'ts', 'js', 'cjs', 'mjs', 'json', 'yml', 'yaml', 'txt', 
  'sh', 'cmd', 'bat', 'ps1', 'py', 'tsx', 'jsx', 'env', 'config'
];

// Include work in progress alongside indexed files. Git applies the same
// nested ignore rules used by git add, including each CodeLLDB package's payload.
function getAuditFiles() {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
    windowsHide: true
  });
  return paths.split('\0').filter(file => extensions.includes(path.extname(file).slice(1)));
}

// Self-test function to ensure this script doesn't match patterns
function selfTest() {
  const scriptPath = __filename;
  const findings = checkFile(scriptPath);
  if (findings) {
    console.error('❌ SELF-TEST FAILED: This script contains patterns that match personal information!');
    console.error('Found matches:', findings);
    return false;
  }
  return true;
}

// Main function
function main() {
  // Run self-test first
  if (!selfTest()) {
    console.error('Script failed self-test. Please fix the patterns.');
    process.exit(1);
  }

  console.log('🔍 Running full audit for personal information in all files...\n');
  
  const startTime = Date.now();
  const allFiles = getAuditFiles();
  
  console.log(`Found ${allFiles.length} file(s) to check...\n`);

  let foundPersonalInfo = false;
  const allFindings = [];
  let checkedCount = 0;

  allFiles.forEach(file => {
    checkedCount++;
    if (checkedCount % 100 === 0) {
      process.stdout.write(`\rChecking file ${checkedCount}/${allFiles.length}...`);
    }

    const findings = checkFile(file);
    if (findings) {
      foundPersonalInfo = true;
      allFindings.push({ file, findings });
    }
  });

  console.log('\n');

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  if (foundPersonalInfo) {
    console.error(`❌ Found personal information in ${allFindings.length} file(s):\n`);
    
    allFindings.forEach(({ file, findings }) => {
      console.error(`📄 ${file}`);
      findings.forEach(({ pattern, matches }) => {
        console.error(`   Pattern: ${pattern}`);
        console.error(`   Found: ${matches.join(', ')}`);
      });
      console.error('');
    });

    console.error('📝 Please replace with generic paths like:');
    console.error('   Generic path examples:');
    console.error('     - /path/to/project');
    console.error('     - C:\\path\\to\\project');
    console.error('     - ~/workspace/project');
    console.error('     - ./relative/path\n');
    
    console.log(`\n⏱️  Audit completed in ${duration} seconds`);
    process.exit(1);
  } else {
    console.log(`✅ No personal information found in any files`);
    console.log(`\n⏱️  Audit completed in ${duration} seconds`);
    process.exit(0);
  }
}

// Run the check
if (require.main === module) {
  main();
}
