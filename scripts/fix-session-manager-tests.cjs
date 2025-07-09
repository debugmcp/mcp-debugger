#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all session manager test files
const testFiles = glob.sync('tests/core/unit/session/session-manager-*.test.ts');

console.log(`Found ${testFiles.length} session manager test files to update`);

testFiles.forEach(filePath => {
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix 1: Update session creation calls to include pythonPath
  // Match patterns like: createSession({ language: DebugLanguage.MOCK })
  const createSessionPattern = /await\s+sessionManager\.createSession\(\s*{\s*language:\s*DebugLanguage\.(MOCK|PYTHON)\s*}\s*\)/g;
  if (createSessionPattern.test(content)) {
    content = content.replace(createSessionPattern, (match, language) => {
      return `await sessionManager.createSession({ 
        language: DebugLanguage.${language},
        pythonPath: 'python'
      })`;
    });
    modified = true;
  }
  
  // Fix 2: Also fix patterns with name parameter
  const createSessionWithNamePattern = /await\s+sessionManager\.createSession\(\s*{\s*language:\s*DebugLanguage\.(MOCK|PYTHON),\s*name:\s*['"`]([^'"`]+)['"`]\s*}\s*\)/g;
  if (createSessionWithNamePattern.test(content)) {
    content = content.replace(createSessionWithNamePattern, (match, language, name) => {
      return `await sessionManager.createSession({ 
        language: DebugLanguage.${language},
        name: '${name}',
        pythonPath: 'python'
      })`;
    });
    modified = true;
  }
  
  // Fix 3: Fix multi-line createSession patterns
  const multilineCreatePattern = /await\s+sessionManager\.createSession\(\s*{\s*\n\s*language:\s*DebugLanguage\.(MOCK|PYTHON)\s*\n\s*}\s*\)/g;
  if (multilineCreatePattern.test(content)) {
    content = content.replace(multilineCreatePattern, (match, language) => {
      return `await sessionManager.createSession({ 
        language: DebugLanguage.${language},
        pythonPath: 'python' 
      })`;
    });
    modified = true;
  }
  
  // Fix 4: Fix patterns that might have trailing commas
  const createSessionTrailingCommaPattern = /await\s+sessionManager\.createSession\(\s*{\s*language:\s*DebugLanguage\.(MOCK|PYTHON),?\s*}\s*\)/g;
  if (createSessionTrailingCommaPattern.test(content)) {
    content = content.replace(createSessionTrailingCommaPattern, (match, language) => {
      return `await sessionManager.createSession({ 
        language: DebugLanguage.${language},
        pythonPath: 'python'
      })`;
    });
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated ${filePath}`);
  } else {
    console.log(`  No changes needed in ${filePath}`);
  }
});

console.log('Done!');
