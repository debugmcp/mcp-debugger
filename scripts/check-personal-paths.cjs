#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Generic patterns to detect personal information without containing it
const personalPatterns = [
  // Windows user paths (C:\Users\<username>\...) excluding generic test users
  /[Cc]:[\\\/]Users[\\\/](?!test[\\\/]|user[\\\/]|example[\\\/])[a-zA-Z0-9._-]+[\\\/]/g,
  
  // Unix/Mac home directories excluding generic test users
  /\/(?:Users|home)\/(?!test\/|user\/|example\/|runner\/|ubuntu\/)[a-zA-Z0-9._-]+\//g,
  
  // Cloud storage paths (common cloud services followed by personal folders)
  /[\\\/](?:Dropbox|OneDrive|Google\s*Drive|iCloud|Box|pCloud)[\\\/][^\\\/]+[\\\/]/gi,
  
  // Dated project folders (6 digits followed by uppercase words)
  /[\\\/]\d{6}\s+[A-Z]+[\\\/]/g,
  
  // Personal email addresses (excluding common project/company emails)
  // This pattern is intentionally removed as it's causing false positives
  // Email detection should be done with a whitelist approach instead
  
  // Common personal folder patterns
  /[\\\/](?:Documents|Desktop|Downloads|Pictures|Videos)[\\\/][^\\\/]+[\\\/]/gi,
  
  // Personal project patterns (My + something)
  /[\\\/]My\s+[A-Za-z0-9]+[\\\/]/gi
];

// File extensions to check
const extensions = [
  'md', 'ts', 'js', 'cjs', 'mjs', 'json', 'yml', 'yaml', 'txt', 
  'sh', 'cmd', 'bat', 'ps1', 'py', 'tsx', 'jsx', 'env', 'config'
];

// Directories to exclude
const excludeDirs = ['node_modules', 'dist', 'coverage', '.git', 'build', '.husky', 'logs', 'sessions', 'vendor'];

// Binary file extensions to skip
const binaryExtensions = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z',
  'exe', 'dll', 'so', 'dylib',
  'mp3', 'mp4', 'avi', 'mov', 'wav',
  'ttf', 'otf', 'woff', 'woff2', 'eot'
];

// Get staged files
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    return output
      .split('\n')
      .filter(file => file && !isBinaryFile(file))
      .filter(file => {
        const ext = path.extname(file).slice(1);
        return extensions.includes(ext);
      })
      .filter(file => {
        const segments = file.split(path.sep);
        return !segments.some(segment => excludeDirs.includes(segment));
      });
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    process.exit(1);
  }
}

// Check if file is binary based on extension
function isBinaryFile(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return binaryExtensions.includes(ext);
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

// Self-test function to ensure this script doesn't match its own patterns
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

  console.log('🔍 Checking staged files for personal information...\n');
  
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('✅ No files to check');
    process.exit(0);
  }

  console.log(`Checking ${stagedFiles.length} file(s)...\n`);

  let foundPersonalInfo = false;
  const allFindings = [];

  stagedFiles.forEach(file => {
    const findings = checkFile(file);
    if (findings) {
      foundPersonalInfo = true;
      allFindings.push({ file, findings });
    }
  });

  if (foundPersonalInfo) {
    console.error('❌ ERROR: Personal information found in staged files!\n');
    
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
    console.error('💡 To bypass this check in emergencies, use: git commit --no-verify\n');
    
    process.exit(1);
  } else {
    console.log('✅ No personal information found in staged files');
    process.exit(0);
  }
}

// Run the check
if (require.main === module) {
  main();
}

module.exports = { checkFile, personalPatterns };
