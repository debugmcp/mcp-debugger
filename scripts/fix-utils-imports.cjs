const fs = require('fs');
const path = require('path');

// Core utils tests
const coreUtilsTestFiles = [
  'tests/core/unit/utils/logger.test.ts',
  'tests/core/unit/utils/path-translator.test.ts'
];

// Python utils test
const pythonUtilsTestFile = 'tests/adapters/python/unit/python-utils.test.ts';

const coreImportReplacements = [
  // Source imports need one more ../
  { from: /from '\.\.\/\.\.\/src\//g, to: "from '../../../../src/" },
  // Test utils imports need one more ../
  { from: /from '\.\.\/test-utils\//g, to: "from '../../../test-utils/" },
  // Direct test-utils path
  { from: /from '\.\.\/\.\.\/test-utils\//g, to: "from '../../../test-utils/" }
];

const pythonImportReplacements = [
  // Source imports from python unit test location
  { from: /from '\.\.\/\.\.\/\.\.\/src\//g, to: "from '../../../../src/" },
  // Test utils imports
  { from: /from '\.\.\/\.\.\/test-utils\//g, to: "from '../../../test-utils/" }
];

// Process core utils tests
coreUtilsTestFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    coreImportReplacements.forEach(({ from, to }) => {
      const newContent = content.replace(from, to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated imports in ${path.basename(filePath)}`);
    } else {
      console.log(`ℹ️  No changes needed in ${path.basename(filePath)}`);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

// Process python utils test
if (fs.existsSync(pythonUtilsTestFile)) {
  let content = fs.readFileSync(pythonUtilsTestFile, 'utf8');
  let modified = false;

  // Add @requires-python tag if not present
  if (!content.includes('@requires-python')) {
    const describeMatch = content.match(/describe\(['"]python-utils['"]/);
    if (describeMatch) {
      content = content.replace(
        "describe('python-utils'",
        "describe('python-utils', { tag: '@requires-python' }"
      );
      modified = true;
      console.log('✅ Added @requires-python tag to python-utils.test.ts');
    }
  }

  // Fix imports
  pythonImportReplacements.forEach(({ from, to }) => {
    const newContent = content.replace(from, to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(pythonUtilsTestFile, content);
    console.log(`✅ Updated imports in ${path.basename(pythonUtilsTestFile)}`);
  } else {
    console.log(`ℹ️  No changes needed in ${path.basename(pythonUtilsTestFile)}`);
  }
} else {
  console.log(`⚠️  File not found: ${pythonUtilsTestFile}`);
}
