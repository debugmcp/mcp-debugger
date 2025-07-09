const fs = require('fs');
const path = require('path');

// Core integration tests
const coreIntegrationTests = [
  'tests/core/integration/container-paths.test.ts',
  'tests/core/integration/path-resolution.test.ts',
  'tests/core/integration/proxy-startup.test.ts'
];

// Python integration tests
const pythonIntegrationTests = [
  'tests/adapters/python/integration/python_debug_workflow.test.ts',
  'tests/adapters/python/integration/python-discovery.test.ts',
  'tests/adapters/python/integration/python-discovery.failure.test.ts',
  'tests/adapters/python/integration/python-discovery.success.test.ts',
  'tests/adapters/python/integration/python-real-discovery.test.ts'
];

const coreImportReplacements = [
  // Source imports need one more ../
  { from: /from '\.\.\/\.\.\/src\//g, to: "from '../../../src/" },
  // Test utils imports
  { from: /from '\.\.\/test-utils\//g, to: "from '../../test-utils/" },
  { from: /from '\.\.\/\.\.\/test-utils\//g, to: "from '../../test-utils/" },
  // Mocks imports
  { from: /from '\.\.\/mocks\//g, to: "from '../../test-utils/mocks/" },
  { from: /from '\.\.\/\.\.\/mocks\//g, to: "from '../../test-utils/mocks/" },
  // Fixtures imports
  { from: /from '\.\.\/fixtures\//g, to: "from '../../test-utils/fixtures/" },
  { from: /from '\.\.\/\.\.\/fixtures\//g, to: "from '../../test-utils/fixtures/" }
];

const pythonImportReplacements = [
  // Source imports from python integration test location
  { from: /from '\.\.\/\.\.\/src\//g, to: "from '../../../src/" },
  // Test utils imports
  { from: /from '\.\.\/test-utils\//g, to: "from '../../test-utils/" },
  { from: /from '\.\.\/\.\.\/test-utils\//g, to: "from '../../test-utils/" },
  // Mocks imports
  { from: /from '\.\.\/mocks\//g, to: "from '../../test-utils/mocks/" },
  { from: /from '\.\.\/\.\.\/mocks\//g, to: "from '../../test-utils/mocks/" },
  // Fixtures imports
  { from: /from '\.\.\/fixtures\//g, to: "from '../../test-utils/fixtures/" },
  { from: /from '\.\.\/\.\.\/fixtures\//g, to: "from '../../test-utils/fixtures/" }
];

// Process core integration tests
console.log('Processing core integration tests...');
coreIntegrationTests.forEach(filePath => {
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

// Process Python integration tests
console.log('\nProcessing Python integration tests...');
pythonIntegrationTests.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Add @requires-python tag if not present
    if (!content.includes('@requires-python')) {
      // Find the first describe block
      const describePattern = /describe\s*\(\s*['"`]([^'"`]+)['"`]/;
      const match = content.match(describePattern);
      if (match) {
        const testName = match[1];
        const originalDescribe = match[0];
        const newDescribe = `describe('${testName}', { tag: '@requires-python' }`;
        content = content.replace(originalDescribe, newDescribe);
        modified = true;
        console.log(`✅ Added @requires-python tag to ${path.basename(filePath)}`);
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
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated imports in ${path.basename(filePath)}`);
    } else {
      console.log(`ℹ️  No changes needed in ${path.basename(filePath)}`);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log('\nIntegration test import fixes complete!');
