const fs = require('fs');
const path = require('path');

const serverTestFiles = [
  'tests/core/unit/server/server.test.ts',
  'tests/core/unit/server/dynamic-tool-documentation.test.ts'
];

const importReplacements = [
  // Source imports need one more ../
  { from: /from '\.\.\/\.\.\/src\//g, to: "from '../../../../src/" },
  // Test utils imports need one more ../
  { from: /from '\.\.\/test-utils\//g, to: "from '../../../test-utils/" },
  // Mocks imports
  { from: /from '\.\.\/mocks\//g, to: "from '../../../test-utils/mocks/" },
  // Direct mocks path
  { from: /from '\.\.\/\.\.\/mocks\//g, to: "from '../../../test-utils/mocks/" },
  // Test dependencies
  { from: /from '\.\.\/\.\.\/test-utils\//g, to: "from '../../../test-utils/" }
];

serverTestFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    importReplacements.forEach(({ from, to }) => {
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
