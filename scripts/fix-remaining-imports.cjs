/**
 * Fix remaining import issues after the first round of fixes
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define more specific replacements
const replacements = [
  // Fix double helpers
  ['from \'../test-utils/helpers/helpers/', 'from \'../test-utils/helpers/'],
  ['from \'../../test-utils/helpers/helpers/', 'from \'../../test-utils/helpers/'],
  ['from \'../../../test-utils/helpers/helpers/', 'from \'../../../test-utils/helpers/'],
  
  // Fix helpers/mocks -> mocks
  ['from \'../test-utils/helpers/mocks/', 'from \'../test-utils/mocks/'],
  ['from \'../../test-utils/helpers/mocks/', 'from \'../../test-utils/mocks/'],
  ['from \'../../../test-utils/helpers/mocks/', 'from \'../../../test-utils/mocks/'],
  
  // Fix old utils paths in proxy tests
  ['from \'../../utils/test-utils.js\'', 'from \'../../test-utils/helpers/test-utils.js\''],
  
  // Fix session-manager-test-utils imports
  ['from \'../../test-utils/helpers/mocks/mock-proxy-manager.js\'', 'from \'../../test-utils/mocks/mock-proxy-manager.js\''],
  
  // Fix mock-path-utils without .js extension
  ['from \'../../test-utils/helpers/mocks/mock-path-utils\'', 'from \'../../test-utils/mocks/mock-path-utils.js\''],
];

// Find all TypeScript files in tests directory
const testFiles = glob.sync('tests/**/*.ts', { 
  ignore: ['**/node_modules/**', '**/dist/**'] 
});

console.log(`Found ${testFiles.length} files to check for import fixes`);

let totalReplacements = 0;
let filesFixed = 0;

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  replacements.forEach(([search, replace]) => {
    if (content.includes(search)) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const newContent = content.replace(regex, replace);
      if (newContent !== content) {
        content = newContent;
        modified = true;
        totalReplacements++;
        console.log(`  Fixed in ${file}: ${search} -> ${replace}`);
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    filesFixed++;
    console.log(`✓ Updated ${file}`);
  }
});

console.log(`\nCompleted! Made ${totalReplacements} replacements in ${filesFixed} files.`);

// Also check for any remaining broken patterns
console.log('\nChecking for potentially remaining issues...');
testFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for patterns that might still be broken
  if (content.includes('helpers/helpers/')) {
    console.warn(`⚠️  ${file} still contains 'helpers/helpers/'`);
  }
  if (content.includes('helpers/mocks/')) {
    console.warn(`⚠️  ${file} still contains 'helpers/mocks/'`);
  }
  if (content.includes('from \'../../utils/')) {
    console.warn(`⚠️  ${file} still contains old utils path`);
  }
});
