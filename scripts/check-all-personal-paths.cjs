#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { personalPatterns } = require('./check-personal-paths.cjs');

// File extensions to check
const extensions = [
  'md', 'ts', 'js', 'cjs', 'mjs', 'json', 'yml', 'yaml', 'txt', 
  'sh', 'cmd', 'bat', 'ps1', 'py', 'tsx', 'jsx', 'env', 'config'
];

// Directories to exclude
const excludeDirs = ['node_modules', 'dist', 'coverage', '.git', 'build', '.husky', 'logs', 'sessions'];

// Binary file extensions to skip
const binaryExtensions = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z',
  'exe', 'dll', 'so', 'dylib',
  'mp3', 'mp4', 'avi', 'mov', 'wav',
  'ttf', 'otf', 'woff', 'woff2', 'eot'
];

// Check if file is binary based on extension
function isBinaryFile(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return binaryExtensions.includes(ext);
}

// Recursively get all files in a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      
      // Skip excluded directories
      if (excludeDirs.includes(file)) {
        return;
      }

      if (fs.statSync(filePath).isDirectory()) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      } else {
        // Check if file has a valid extension and is not binary
        const ext = path.extname(file).slice(1);
        if (extensions.includes(ext) && !isBinaryFile(file)) {
          arrayOfFiles.push(filePath);
        }
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
  }

  return arrayOfFiles;
}

// Check file for personal information
function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = [];

    personalPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({
          pattern: pattern.source,
          matches: [...new Set(matches)]
        });
      }
    });

    return findings.length > 0 ? findings : null;
  } catch (error) {
    // Skip files that can't be read as UTF-8
    return null;
  }
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
  const allFiles = getAllFiles('.');
  
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
