/**
 * Temporary script to fix test imports after moving test utilities
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define replacements for test imports
const replacements = [
  // Fix test-utils paths to point to helpers subdirectory
  ['from \'../test-utils/', 'from \'../test-utils/helpers/'],
  ['from \'../../test-utils/', 'from \'../../test-utils/helpers/'],
  ['from \'../../../test-utils/', 'from \'../../../test-utils/helpers/'],
  
  // Fix mocks paths to point to test-utils/mocks
  ['from \'../mocks/', 'from \'../test-utils/mocks/'],
  ['from \'../../mocks/', 'from \'../../test-utils/mocks/'],
  
  // Fix specific imports
  ['from \'../../test-utils/mock-logger', 'from \'../../test-utils/helpers/mock-logger'],
  ['from \'../test-utils/mock-logger', 'from \'../test-utils/helpers/mock-logger'],
  
  // Fix test-utils imports that don't specify helpers
  ['from \'../../test-utils/test-dependencies', 'from \'../../test-utils/helpers/test-dependencies'],
  ['from \'../test-utils/test-dependencies', 'from \'../test-utils/helpers/test-dependencies'],
];

// Find all test files
const testFiles = glob.sync('tests/**/*.test.ts', { 
  ignore: ['**/node_modules/**', '**/dist/**'] 
});

// Also include test utility files that might import from each other
const utilFiles = glob.sync('tests/**/*.ts', { 
  ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'] 
});

const allFiles = [...testFiles, ...utilFiles];

console.log(`Found ${allFiles.length} files to check for import fixes`);

let totalReplacements = 0;

allFiles.forEach(file => {
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
        console.log(`  Fixed import in ${file}: ${search} -> ${replace}`);
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`✓ Updated ${file}`);
  }
});

console.log(`\nCompleted! Made ${totalReplacements} replacements across ${allFiles.length} files.`);
