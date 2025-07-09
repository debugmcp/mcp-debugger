const fs = require('fs');
const path = require('path');

const pythonAdapterTestFile = 'tests/adapters/python/unit/python-adapter.test.ts';

const importReplacements = [
  // Source imports from python unit test location
  { from: /from '\.\.\/\.\.\/\.\.\/\.\.\/src\//g, to: "from '../../../../src/" },
  // Test utils imports
  { from: /from '\.\.\/\.\.\/\.\.\/test-utils\//g, to: "from '../../../test-utils/" },
  // Mocks imports
  { from: /from '\.\.\/\.\.\/\.\.\/mocks\//g, to: "from '../../../test-utils/mocks/" },
  // Fixtures imports
  { from: /from '\.\.\/\.\.\/\.\.\/fixtures\//g, to: "from '../../../test-utils/fixtures/" }
];

if (fs.existsSync(pythonAdapterTestFile)) {
  let content = fs.readFileSync(pythonAdapterTestFile, 'utf8');
  let modified = false;

  // Add @requires-python tag if not present
  if (!content.includes('@requires-python')) {
    const describeMatch = content.match(/describe\(['"]PythonDebugAdapter['"]/);
    if (describeMatch) {
      content = content.replace(
        "describe('PythonDebugAdapter'",
        "describe('PythonDebugAdapter', { tag: '@requires-python' }"
      );
      modified = true;
      console.log('✅ Added @requires-python tag to python-adapter.test.ts');
    }
  }

  // Fix imports
  importReplacements.forEach(({ from, to }) => {
    const newContent = content.replace(from, to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(pythonAdapterTestFile, content);
    console.log(`✅ Updated imports in ${path.basename(pythonAdapterTestFile)}`);
  } else {
    console.log(`ℹ️  No changes needed in ${path.basename(pythonAdapterTestFile)}`);
  }
} else {
  console.log(`⚠️  File not found: ${pythonAdapterTestFile}`);
}
