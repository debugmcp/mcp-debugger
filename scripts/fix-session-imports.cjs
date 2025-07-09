const fs = require('fs');
const path = require('path');

const sessionTestFiles = [
  'tests/core/unit/session/session-manager-dap.test.ts',
  'tests/core/unit/session/session-manager-dry-run.test.ts',
  'tests/core/unit/session/session-manager-edge-cases.test.ts',
  'tests/core/unit/session/session-manager-error-recovery.test.ts',
  'tests/core/unit/session/session-manager-integration.test.ts',
  'tests/core/unit/session/session-manager-memory-leak.test.ts',
  'tests/core/unit/session/session-manager-multi-session.test.ts',
  'tests/core/unit/session/session-manager-paths.test.ts',
  'tests/core/unit/session/session-manager-state.test.ts',
  'tests/core/unit/session/session-manager-test-utils.ts',
  'tests/core/unit/session/session-manager-workflow.test.ts',
  'tests/core/unit/session/session-store.test.ts'
];

const importReplacements = [
  // Source imports need one more ../
  { from: /from '\.\.\/\.\.\/\.\.\/src\//g, to: "from '../../../../src/" },
  // Test utils imports need one more ../
  { from: /from '\.\.\/\.\.\/test-utils\//g, to: "from '../../../test-utils/" },
  // Mocks imports
  { from: /from '\.\.\/\.\.\/mocks\//g, to: "from '../../../test-utils/mocks/" },
  // Fixtures imports
  { from: /from '\.\.\/\.\.\/fixtures\//g, to: "from '../../../test-utils/fixtures/" },
  // Relative imports within session tests
  { from: /from '\.\/session-manager-test-utils'/g, to: "from './session-manager-test-utils'" }
];

sessionTestFiles.forEach(filePath => {
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
