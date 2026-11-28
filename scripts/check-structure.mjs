/**
 * Structure ratchet.
 *
 * A review on 2026-11-24 counted how this codebase's structure had moved over two months, and
 * every count had gone the wrong way while each change, read alone, looked careful: more
 * places that write session state, more members in the adapter contract, more of them
 * serving a single engine, more `if language is X` in the core. A fix that adds one more of
 * these is a cone beside a pothole. This script counts them, so a pull request that adds one
 * has to say so instead of slipping it in.
 *
 * The measures (each rule is spelled out where it is implemented below):
 *
 *   session-state writers       calls that set a session's state, and the raw writes
 *   direct session-state writes the subset that bypasses `_updateSessionState`, so skips its
 *                               PAUSED-needs-lastStop invariant and its state listeners
 *   AdapterPolicy members       the contract every adapter is written against
 *   one-adapter members         members exactly one engine's policy uses
 *   language branches           comparisons with, and `case`s on, a specific language
 *                               outside the policy files
 *
 * Everything is read from the TypeScript syntax tree, so reformatting code or editing a
 * comment, a string or a template literal never changes a count.
 *
 * Like the test-typing ratchet (`typecheck-tests-ratchet.mjs`), it fails in both directions:
 * a count that went up names the new items and says what to do instead; a count that went
 * down is progress, but fails until the baseline is re-recorded in the same pull request, so
 * the recorded numbers stay true and only ever move down.
 *
 * Modes:
 *   (default)  compare the tree with tests/structure-baseline.json.
 *   --update   rewrite the baseline from the tree.
 *   --list     print every counted item, then compare as usual.
 *
 * Exit codes: 0 clean, 1 ratchet failure, 2 the check could not be run.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { isMain } from './lib/is-main.mjs';

/** Recorded counts, relative to the repo root (beside the test-typing baseline). */
export const BASELINE_FILE = 'tests/structure-baseline.json';

const UPDATE_COMMAND = 'pnpm run structure:update';

/** Why a broken baseline blocks nothing: `--update` never reads it. */
const REPAIR_BASELINE = `Re-record it with: ${UPDATE_COMMAND}`;

/**
 * The core: the server's own sources and the shared package. The language packages
 * (`packages/adapter-*`, `packages/codelldb-common`) are each one engine's code, so a
 * branch on their own runtime there is the point of them, and none of them writes session
 * state.
 */
const SOURCE_ROOTS = ['src', 'packages/shared/src'];

/**
 * The policy files: one per engine, the language-to-policy map, and the module the three
 * LLDB policies share. They are where engine differences are meant to live, so a language
 * branch in them is not counted.
 */
const POLICY_FILE = /^packages\/shared\/src\/interfaces\/(adapter-policy-[^/]+|[^/]+-policy-shared)\.ts$/;

/**
 * The engines whose policies count as users of a contract member. The mock adapter's policy
 * is the test infrastructure's stand-in, not an engine: a member it shares with one engine
 * is still that engine's quirk.
 */
const ENGINE_POLICY_FILE = /^packages\/shared\/src\/interfaces\/adapter-policy-(?!mock\.ts$)[^/]+\.ts$/;

/** The one function that moves a session between states with its invariant and listeners. */
const STATE_GATE = '_updateSessionState';

/** Names a writer call goes by: the gate, and `updateState` (its context alias, the store). */
const WRITER_CALLS = new Set([STATE_GATE, 'updateState']);

/** Partial updates that `Object.assign` into a session: a `state` in them is a raw write. */
const PARTIAL_UPDATES = new Set(['update', 'updateSession']);

/** The session store's own setter, reached as `<…>.sessionStore.updateState(…)`: raw. */
const RAW_STORE = 'sessionStore';

/** How much of an item's source text to quote in a message. */
const SNIPPET_LENGTH = 100;

/**
 * The measures, in report order. `kind` is how the baseline records each: `files` maps a
 * repo-relative path to its count, `names` lists member names, `owners` maps a member to the
 * one policy that uses it.
 */
export const MEASURES = [
  {
    id: 'sessionStateWriters',
    label: 'session-state writers',
    kind: 'files',
    advice:
      'A new place that sets session state is one more path through the state machine that the ' +
      'others do not know about. Reach the state through an existing transition (or the event ' +
      'that already drives it); if a new transition is genuinely needed, say why in the pull ' +
      'request and re-record.'
  },
  {
    id: 'directStateWrites',
    label: 'direct session-state writes',
    kind: 'files',
    advice:
      `A direct write skips ${STATE_GATE}'s invariant (no PAUSED without lastStop) and its ` +
      `listeners, so waiters and subscribers never hear of the change. Call ${STATE_GATE} ` +
      '(ctx.updateState from a collaborator) instead.'
  },
  {
    id: 'policyMembers',
    label: 'AdapterPolicy members',
    kind: 'names',
    advice:
      'A new member widens the contract every adapter is written against. Express the behaviour ' +
      'through an existing member if one fits; otherwise say in the pull request why the ' +
      'contract must grow, and re-record.'
  },
  {
    id: 'oneAdapterMembers',
    label: 'AdapterPolicy members used by one adapter',
    kind: 'owners',
    advice:
      "A member that only one engine's policy uses is that engine's quirk entering the core's " +
      'contract. Express it through an existing member, or keep it inside the adapter; if the ' +
      'contract really must grow, say why in the pull request and re-record.'
  },
  {
    id: 'languageBranches',
    label: 'language branches outside the policy files',
    kind: 'files',
    advice:
      'A branch on one language outside the policy files puts engine knowledge in the core. ' +
      "Move the difference into that adapter's policy and keep the core language-blind; if the " +
      'branch must stay, say why in the pull request and re-record.'
  }
];

/** A check that cannot be run: reported with exit code 2, never as a ratchet failure. */
export class StructureError extends Error {}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Is this repo-relative, forward-slash path a source file the measures read?
 *
 * Only hand-written TypeScript: `.d.ts` and compiled `.js` can sit beside the sources in a
 * working tree (see .gitignore), and would count every item twice. Test files and anything
 * under `dist/` or `node_modules/` are not shipped source.
 *
 * @param {string} file
 * @returns {boolean}
 */
export function isSourcePath(file) {
  if (!SOURCE_ROOTS.some(root => file.startsWith(`${root}/`))) return false;
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) return false;
  if (/\.(test|spec)\.ts$/.test(file)) return false;
  return !file.split('/').some(part => ['node_modules', 'dist', 'tests', '__tests__'].includes(part));
}

/** Is this a policy file, where language branches are the point? */
export function isPolicyFile(file) {
  return POLICY_FILE.test(file);
}

/**
 * Read every source file under the source roots.
 *
 * @param {string} root repo root
 * @returns {{ path: string, text: string }[]} sorted by path
 */
export function collectSources(root) {
  const files = [];
  const walk = relative => {
    const absolute = path.join(root, relative);
    let entries;
    try {
      entries = fs.readdirSync(absolute, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(child);
      } else if (entry.isFile() && isSourcePath(child)) {
        files.push({ path: child, text: fs.readFileSync(path.join(root, child), 'utf-8') });
      }
    }
  };
  for (const sourceRoot of SOURCE_ROOTS) walk(sourceRoot);
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Syntax helpers
// ---------------------------------------------------------------------------

let typescript;

/** The TypeScript compiler API, resolved from the repo's own devDependency. */
function ts() {
  if (!typescript) {
    try {
      typescript = createRequire(import.meta.url)('typescript');
    } catch (error) {
      throw new StructureError(`Cannot load typescript -- run 'pnpm install' first.\n${describe(error)}`);
    }
  }
  return typescript;
}

function parse(file) {
  const t = ts();
  return t.createSourceFile(file.path, file.text, t.ScriptTarget.Latest, true, t.ScriptKind.TS);
}

/** Strip the wrappers that do not change what an expression evaluates to. */
function unwrap(node) {
  const t = ts();
  while (
    t.isParenthesizedExpression(node) || t.isAsExpression(node) || t.isSatisfiesExpression(node) ||
    t.isNonNullExpression(node) || t.isTypeAssertionExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/** A property or member name as written, or undefined for a computed one. */
function nameOf(name) {
  const t = ts();
  if (!name) return undefined;
  if (t.isIdentifier(name) || t.isPrivateIdentifier(name)) return name.text;
  if (t.isStringLiteral(name) || t.isNoSubstitutionTemplateLiteral(name) || t.isNumericLiteral(name)) return name.text;
  return undefined;
}

/** The name a call goes by: `f(…)` → f, `a.b.f(…)` → f. */
function calleeName(call) {
  const t = ts();
  const callee = unwrap(call.expression);
  if (t.isIdentifier(callee)) return callee.text;
  if (t.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

/** The name a function-like node is known by: its own, or the binding it is assigned to. */
function functionName(node) {
  const t = ts();
  if (node.name && nameOf(node.name)) return nameOf(node.name);
  const parent = node.parent;
  if (parent && (t.isPropertyAssignment(parent) || t.isVariableDeclaration(parent) || t.isPropertyDeclaration(parent))) {
    return nameOf(parent.name);
  }
  return undefined;
}

/** Every function-like ancestor's name, innermost first. */
function enclosingFunctionNames(node) {
  const t = ts();
  const names = [];
  for (let current = node.parent; current; current = current.parent) {
    if (t.isFunctionLike(current)) {
      const name = functionName(current);
      if (name) names.push(name);
    }
  }
  return names;
}

/** `Class.method`, `function`, or `(top level)`: where an item sits, for a message. */
function whereIs(node) {
  const t = ts();
  let fn;
  let cls;
  for (let current = node.parent; current; current = current.parent) {
    if (!fn && t.isFunctionLike(current) && functionName(current)) fn = functionName(current);
    if (t.isClassLike(current) && current.name) {
      cls = current.name.text;
      break;
    }
  }
  if (cls) return fn ? `${cls}.${fn}` : cls;
  return fn ?? '(top level)';
}

/**
 * A located item: what the gate prints when a count goes up. `group` is the key the
 * baseline counts it under inside its file: the enclosing function, unless `extra`
 * narrows it.
 */
function item(sourceFile, node, extra = {}) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const text = node.getText(sourceFile).replace(/\s+/g, ' ');
  const where = whereIs(node);
  return {
    file: sourceFile.fileName,
    line: line + 1,
    where,
    group: where,
    text: text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 3)}...` : text,
    ...extra
  };
}

/** Does this expression mention a `SessionState.<MEMBER>` anywhere inside it? */
function namesSessionState(node) {
  const t = ts();
  let found = false;
  const visit = child => {
    if (found) return;
    if (t.isPropertyAccessExpression(child) && t.isIdentifier(child.expression) && child.expression.text === 'SessionState') {
      found = true;
      return;
    }
    child.forEachChild(visit);
  };
  visit(node);
  return found;
}

// ---------------------------------------------------------------------------
// Measure 1 and 2: session-state writers, and the direct writes among them
// ---------------------------------------------------------------------------

/**
 * Every place in the core that writes a session's state.
 *
 * A writer is any one of:
 *   - a call to `_updateSessionState(…)` or `updateState(…)` — the gate, the operations
 *     context's alias for it, and the session store's raw setter;
 *   - an assignment to a `state` property whose receiver is not `this` (another object's
 *     state: `session.state = …`) or whose value names a `SessionState` member;
 *   - an object literal with a `state` property passed to `update(…)` or `updateSession(…)`,
 *     the partial updates that `Object.assign` into the session.
 *
 * Excluded: anything inside a function, method or property named `_updateSessionState` or
 * `updateState`. Those are the writer's own implementation (the gate's call to the store, the
 * alias that forwards to the gate, the store's own assignment), not one more writer.
 *
 * A writer is direct when it does not go through the gate: the assignments, the partial
 * updates, and calls to the store's setter (`sessionStore.updateState(…)`).
 *
 * @param {{ path: string, text: string }[]} sources
 * @returns {{ writers: object[], direct: object[] }}
 */
export function findStateWriters(sources) {
  const t = ts();
  const writers = [];
  let gateDefined = false;

  for (const source of sources) {
    const sf = parse(source);
    const visit = node => {
      if (t.isMethodDeclaration(node) && nameOf(node.name) === STATE_GATE && node.body) gateDefined = true;

      const insideWriter = () => enclosingFunctionNames(node).some(name => WRITER_CALLS.has(name));

      if (t.isCallExpression(node)) {
        const callee = calleeName(node);
        if (WRITER_CALLS.has(callee) && !insideWriter()) {
          const receiver = t.isPropertyAccessExpression(unwrap(node.expression))
            ? unwrap(unwrap(node.expression).expression)
            : undefined;
          const raw = callee === 'updateState' && receiver !== undefined &&
            ((t.isPropertyAccessExpression(receiver) && receiver.name.text === RAW_STORE) ||
              (t.isIdentifier(receiver) && receiver.text === RAW_STORE));
          writers.push(item(sf, node, { direct: raw, form: raw ? 'store setter' : 'call' }));
        } else if (PARTIAL_UPDATES.has(callee) && !insideWriter()) {
          const carriesState = node.arguments.some(argument => {
            const value = unwrap(argument);
            return t.isObjectLiteralExpression(value) && value.properties.some(property =>
              (t.isPropertyAssignment(property) || t.isShorthandPropertyAssignment(property)) &&
              nameOf(property.name) === 'state');
          });
          if (carriesState) writers.push(item(sf, node, { direct: true, form: 'partial update' }));
        }
      }

      if (
        t.isBinaryExpression(node) &&
        node.operatorToken.kind === t.SyntaxKind.EqualsToken &&
        t.isPropertyAccessExpression(unwrap(node.left)) &&
        unwrap(node.left).name.text === 'state' &&
        !insideWriter()
      ) {
        const receiver = unwrap(unwrap(node.left).expression);
        if (receiver.kind !== t.SyntaxKind.ThisKeyword || namesSessionState(node.right)) {
          writers.push(item(sf, node, { direct: true, form: 'assignment' }));
        }
      }

      node.forEachChild(visit);
    };
    visit(sf);
  }

  if (!gateDefined) {
    throw new StructureError(
      `No method named ${STATE_GATE} was found under ${SOURCE_ROOTS.join(' and ')}. The ` +
      `session-state rule counts calls to it, so a rename would make every writer invisible. ` +
      `Update the rule in scripts/check-structure.mjs to the new name.`
    );
  }
  return { writers, direct: writers.filter(writer => writer.direct) };
}

// ---------------------------------------------------------------------------
// Measures 3 and 4: the AdapterPolicy contract, and who uses each member
// ---------------------------------------------------------------------------

/** Index the shared package's top-level declarations, for resolving names. */
function indexShared(parsed) {
  const t = ts();
  const types = new Map();
  const values = new Map();
  const add = (map, name, entry) => {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(entry);
  };
  for (const sf of parsed) {
    if (!sf.fileName.startsWith('packages/shared/src/')) continue;
    for (const statement of sf.statements) {
      if (t.isInterfaceDeclaration(statement) || t.isTypeAliasDeclaration(statement)) {
        add(types, statement.name.text, statement);
      } else if (t.isFunctionDeclaration(statement) && statement.name) {
        add(values, statement.name.text, statement);
      } else if (t.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (t.isIdentifier(declaration.name) && declaration.initializer) {
            add(values, declaration.name.text, declaration.initializer);
          }
        }
      }
    }
  }
  return { types, values };
}

/** The one declaration a name resolves to, preferring the file it is used in. */
function resolveOne(map, name, fromFile, what) {
  const candidates = map.get(name) ?? [];
  const local = candidates.filter(node => node.getSourceFile().fileName === fromFile);
  if (local.length === 1) return local[0];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new StructureError(`${what}: '${name}' is declared ${candidates.length} times in packages/shared/src.`);
  }
  return undefined;
}

/** Members of an interface or type-literal declaration, or undefined if it is neither. */
function objectTypeMembers(node, index, fromFile) {
  const t = ts();
  if (t.isTypeLiteralNode(node)) return [...node.members];
  if (t.isTypeReferenceNode(node) && t.isIdentifier(node.typeName) && !node.typeArguments) {
    const declarations = index.types.get(node.typeName.text);
    if (!declarations) return undefined;
    const members = [];
    for (const declaration of declarations) {
      if (t.isInterfaceDeclaration(declaration)) {
        if (declaration.heritageClauses?.length) return undefined;
        members.push(...declaration.members);
      } else if (t.isTypeAliasDeclaration(declaration)) {
        const inner = objectTypeMembers(declaration.type, index, fromFile);
        if (!inner) return undefined;
        members.push(...inner);
      }
    }
    return members;
  }
  return undefined;
}

/**
 * The contract: the members of `interface AdapterPolicy`, plus the members of each object
 * its descriptor getters return.
 *
 * A descriptor getter is a member that takes no parameters and returns an object type
 * every member of which is optional (`getInitializationBehavior()`, `getDapClientBehavior()`,
 * …). Each of those optional members is a switch an adapter sets or leaves out on its own,
 * exactly like an optional member of the interface, so each is a member of the contract,
 * named `getter().member`. A returned object with a required member is a value with a shape
 * (`getDapAdapterConfiguration(): { type }`), not a set of switches, and counts once, as the
 * method. Members of members (`exceptionFilters.uncaught`) are the shape of one switch's
 * value and are not counted again.
 *
 * @returns {{ members: string[], getters: Set<string> }}
 */
function contractMembers(parsed, index) {
  const t = ts();
  const declarations = index.types.get('AdapterPolicy') ?? [];
  const contract = declarations.filter(node => t.isInterfaceDeclaration(node));
  if (contract.length !== 1) {
    throw new StructureError(
      `Expected one 'interface AdapterPolicy' in packages/shared/src, found ${contract.length}.`
    );
  }
  const [decl] = contract;
  if (decl.members.length === 0) {
    throw new StructureError('interface AdapterPolicy has no members: the count would record an empty contract.');
  }
  if (decl.heritageClauses?.length) {
    throw new StructureError(
      'interface AdapterPolicy now extends another type; the member count cannot see inherited ' +
      'members. Teach scripts/check-structure.mjs to follow the heritage clause.'
    );
  }
  const fromFile = decl.getSourceFile().fileName;

  const members = [];
  const getters = new Set();
  for (const member of decl.members) {
    const name = nameOf(member.name);
    if (!name) {
      throw new StructureError(`interface AdapterPolicy has a member without a plain name: ${member.getText()}`);
    }
    members.push(name);

    let parameters;
    let returnType;
    if (t.isMethodSignature(member)) {
      parameters = member.parameters;
      returnType = member.type;
    } else if (t.isPropertySignature(member) && member.type && t.isFunctionTypeNode(member.type)) {
      parameters = member.type.parameters;
      returnType = member.type.type;
    }
    if (!parameters || parameters.length > 0 || !returnType) continue;

    const returned = objectTypeMembers(returnType, index, fromFile);
    if (!returned || returned.length === 0) continue;
    const switches = returned.every(field => (t.isPropertySignature(field) || t.isMethodSignature(field)) &&
      field.questionToken && nameOf(field.name));
    if (!switches) continue;

    getters.add(name);
    for (const field of returned) members.push(`${name}().${nameOf(field.name)}`);
  }
  return { members, getters };
}

/**
 * A value that says "not used": a property set to `undefined`, `null` or `false`. For almost
 * every switch the core reads `false` exactly as it reads a missing member, and policies spell
 * the default out all the time (`mirrorBreakpointsToChild: false`), so it is not a use.
 *
 * Known exceptions, where the core reads an explicit `false` differently: `supportsLogPoints`
 * and `supportsFunctionBreakpoints` (false refuses, absent means unknown) and
 * `getInitializationBehavior().defaultStopOnEntry` (false overrides the launch default). Each
 * has two or more users either way today, so no count depends on it; a new member like them
 * would be counted as unused by the engines that set it to `false`.
 */
function isNoUse(value) {
  const t = ts();
  const node = unwrap(value);
  return node.kind === t.SyntaxKind.FalseKeyword || node.kind === t.SyntaxKind.NullKeyword ||
    (t.isIdentifier(node) && node.text === 'undefined');
}

/**
 * The property names an expression's object value sets to something other than a no-use,
 * following spreads, conditionals, local constants and calls to functions declared in the
 * shared package.
 */
function objectKeys(expression, context, seen = new Set()) {
  const t = ts();
  const node = unwrap(expression);
  const keys = new Set();

  if (t.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (t.isSpreadAssignment(property)) {
        for (const key of objectKeys(property.expression, context, seen)) keys.add(key);
        continue;
      }
      const name = nameOf(property.name);
      if (!name) throw new StructureError(`${context.what}: a computed property name cannot be counted: ${property.getText()}`);
      if (t.isPropertyAssignment(property) && isNoUse(property.initializer)) continue;
      keys.add(name);
    }
    return keys;
  }
  if (t.isConditionalExpression(node)) {
    for (const key of objectKeys(node.whenTrue, context, seen)) keys.add(key);
    for (const key of objectKeys(node.whenFalse, context, seen)) keys.add(key);
    return keys;
  }
  if (t.isCallExpression(node) && t.isIdentifier(unwrap(node.expression))) {
    const target = resolveOne(context.index.values, unwrap(node.expression).text, node.getSourceFile().fileName, context.what);
    if (target) return returnedKeys(target, context, seen);
  }
  if (t.isIdentifier(node)) {
    const local = context.locals?.get(node.text);
    if (local) return objectKeys(local, context, seen);
    const target = resolveOne(context.index.values, node.text, node.getSourceFile().fileName, context.what);
    if (target && t.isObjectLiteralExpression(unwrap(target))) return objectKeys(target, context, seen);
  }
  throw new StructureError(
    `${context.what}: cannot tell which members '${node.getText().slice(0, 80)}' sets. Return an ` +
    'object literal, or call a function declared in packages/shared/src that returns one.'
  );
}

/** The keys of every object a function returns. */
function returnedKeys(fn, context, seen) {
  const t = ts();
  const target = unwrap(fn);
  if (!t.isFunctionLike(target) || !target.body) {
    if (t.isIdentifier(target)) {
      const resolved = resolveOne(context.index.values, target.text, target.getSourceFile().fileName, context.what);
      if (resolved) return returnedKeys(resolved, context, seen);
    }
    throw new StructureError(`${context.what}: '${target.getText().slice(0, 80)}' is not a function the count can read.`);
  }
  if (seen.has(target)) return new Set();
  seen.add(target);

  if (!t.isBlock(target.body)) return objectKeys(target.body, context, seen);

  const keys = new Set();
  const locals = new Map();
  const inner = { ...context, locals };
  const visit = node => {
    if (t.isVariableDeclaration(node) && t.isIdentifier(node.name) && node.initializer) {
      locals.set(node.name.text, node.initializer);
    }
    if (t.isReturnStatement(node)) {
      if (node.expression) for (const key of objectKeys(node.expression, inner, seen)) keys.add(key);
      return;
    }
    if (t.isFunctionLike(node)) return;
    node.forEachChild(visit);
  };
  target.body.forEachChild(visit);
  return keys;
}

/** The engine policies: each `AdapterPolicy`-typed object literal in an engine's policy file. */
function enginePolicies(parsed, index, getters) {
  const t = ts();
  const policies = [];
  for (const sf of parsed) {
    if (!ENGINE_POLICY_FILE.test(sf.fileName)) continue;
    for (const statement of sf.statements) {
      if (!t.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        let value = declaration.initializer;
        let typed = declaration.type?.getText(sf) === 'AdapterPolicy';
        while (value && (t.isSatisfiesExpression(value) || t.isAsExpression(value) || t.isParenthesizedExpression(value))) {
          if (!t.isParenthesizedExpression(value) && value.type.getText(sf) === 'AdapterPolicy') typed = true;
          value = value.expression;
        }
        if (!typed) continue;
        const binding = declaration.name.getText(sf);
        const what = `${sf.fileName}: ${binding}`;
        if (!value || !t.isObjectLiteralExpression(value)) {
          throw new StructureError(`${what} is not an object literal, so the count cannot see which members it uses.`);
        }

        const context = { index, what };
        const used = new Set();
        let policyName;
        const visitProperty = property => {
          if (t.isSpreadAssignment(property)) {
            for (const key of objectKeys(property.expression, context)) used.add(key);
            return;
          }
          const name = nameOf(property.name);
          if (!name) throw new StructureError(`${what}: a computed member name cannot be counted: ${property.getText(sf)}`);
          if (name === 'name' && t.isPropertyAssignment(property) && t.isStringLiteral(unwrap(property.initializer))) {
            policyName = unwrap(property.initializer).text;
          }
          if (t.isPropertyAssignment(property) && isNoUse(property.initializer)) return;
          used.add(name);
          if (!getters.has(name)) return;
          const implementation = t.isMethodDeclaration(property)
            ? property
            : t.isPropertyAssignment(property)
              ? property.initializer
              : undefined;
          if (!implementation) {
            throw new StructureError(`${what}: cannot read ${name}'s implementation (${property.getText(sf).slice(0, 60)}).`);
          }
          for (const key of returnedKeys(implementation, { index, what: `${what}.${name}` }, new Set())) {
            used.add(`${name}().${key}`);
          }
        };
        for (const property of value.properties) visitProperty(property);
        policies.push({ binding, name: policyName ?? binding, file: sf.fileName, used });
      }
    }
  }
  return policies;
}

/**
 * The contract's members, and each member's users among the engine policies.
 *
 * A policy uses a member when its object sets it (or, for a descriptor getter's switch, the
 * object the getter returns sets it) to anything but `undefined`, `null` or `false`.
 *
 * @param {{ path: string, text: string }[]} sources
 */
export function measurePolicyContract(sources) {
  const parsed = sources.filter(source => source.path.startsWith('packages/shared/src/')).map(parse);
  const index = indexShared(parsed);
  const { members, getters } = contractMembers(parsed, index);
  const policies = enginePolicies(parsed, index, getters);
  if (policies.length === 0) {
    throw new StructureError(
      'No engine policy was found (an AdapterPolicy-typed object literal in ' +
      'packages/shared/src/interfaces/adapter-policy-<engine>.ts).'
    );
  }

  const usersOf = new Map(members.map(member => [member, []]));
  const unknown = [];
  for (const policy of policies) {
    for (const key of policy.used) {
      if (usersOf.has(key)) usersOf.get(key).push(policy.name);
      else unknown.push(`${policy.name}: ${key}`);
    }
  }
  const oneAdapter = members
    .filter(member => usersOf.get(member).length === 1)
    .map(member => ({ member, policy: usersOf.get(member)[0] }));
  const unused = members.filter(member => usersOf.get(member).length === 0);

  return { members, getters: [...getters], policies, usersOf, oneAdapter, unused, unknown };
}

// ---------------------------------------------------------------------------
// Measure 5: language branches outside the policy files
// ---------------------------------------------------------------------------

/** The language ids: `DebugLanguage`'s values and every engine policy's `name`. */
function languageIds(sources, policies) {
  const t = ts();
  const ids = new Set(policies.map(policy => policy.name));
  const enumMembers = new Set();
  let found = false;
  for (const source of sources) {
    if (!source.path.startsWith('packages/shared/src/')) continue;
    if (!source.text.includes('DebugLanguage')) continue;
    const sf = parse(source);
    for (const statement of sf.statements) {
      if (t.isEnumDeclaration(statement) && statement.name.text === 'DebugLanguage') {
        found = true;
        for (const member of statement.members) {
          enumMembers.add(nameOf(member.name));
          if (member.initializer && t.isStringLiteral(member.initializer)) ids.add(member.initializer.text);
        }
      }
    }
  }
  if (!found) throw new StructureError("No 'enum DebugLanguage' was found in packages/shared/src.");
  return { ids, enumMembers };
}

/**
 * Every place outside the policy files where the core branches on one specific language.
 *
 * A branch is an equality comparison (`===`, `!==`, `==`, `!=`) with a language id on
 * either side, or a `case` labelled with one. A language id is a string literal equal to a
 * `DebugLanguage` value or an engine policy's `name` (`'python'`, `'js-debug'`, …), or a
 * `DebugLanguage.<MEMBER>`. Each comparison or case is one item.
 *
 * @param {{ path: string, text: string }[]} sources
 * @param {{ name: string }[]} policies
 */
export function findLanguageBranches(sources, policies) {
  const t = ts();
  const { ids, enumMembers } = languageIds(sources, policies);
  const languageOf = expression => {
    const node = unwrap(expression);
    if ((t.isStringLiteral(node) || t.isNoSubstitutionTemplateLiteral(node)) && ids.has(node.text)) {
      return { language: node.text, spelling: 'string' };
    }
    if (
      t.isPropertyAccessExpression(node) && t.isIdentifier(node.expression) &&
      node.expression.text === 'DebugLanguage' && enumMembers.has(node.name.text)
    ) {
      return { language: `DebugLanguage.${node.name.text}`, spelling: 'enum' };
    }
    return undefined;
  };
  const equality = new Set([
    t.SyntaxKind.EqualsEqualsEqualsToken, t.SyntaxKind.ExclamationEqualsEqualsToken,
    t.SyntaxKind.EqualsEqualsToken, t.SyntaxKind.ExclamationEqualsToken
  ]);

  const branches = [];
  // Counted per function and language, so a failure can point at the one that is new.
  const branch = (entry) => branches.push({ ...entry, group: `${entry.where} [${entry.language}]` });
  for (const source of sources) {
    if (isPolicyFile(source.path)) continue;
    const sf = parse(source);
    const visit = node => {
      if (t.isBinaryExpression(node) && equality.has(node.operatorToken.kind)) {
        const found = languageOf(node.left) ?? languageOf(node.right);
        if (found) branch(item(sf, node, { ...found, form: 'comparison' }));
      } else if (t.isCaseClause(node)) {
        const found = languageOf(node.expression);
        if (found) branch(item(sf, node.expression, { ...found, form: 'case', text: `case ${node.expression.getText(sf)}:` }));
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return branches;
}

// ---------------------------------------------------------------------------
// All measures, baseline and comparison
// ---------------------------------------------------------------------------

/**
 * Count everything.
 *
 * @param {{ path: string, text: string }[]} sources repo-relative, forward-slash paths
 */
export function measure(sources) {
  const { writers, direct } = findStateWriters(sources);
  const contract = measurePolicyContract(sources);
  const branches = findLanguageBranches(sources, contract.policies);
  return {
    items: {
      sessionStateWriters: writers,
      directStateWrites: direct,
      policyMembers: contract.members.map(member => ({ member, users: contract.usersOf.get(member) })),
      oneAdapterMembers: contract.oneAdapter,
      languageBranches: branches
    },
    contract
  };
}

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Count of items per file and, within it, per enclosing function; keys sorted. The gate
 * compares files; the functions only tell a failure which items in a file are new.
 */
function perFile(items) {
  const counts = {};
  for (const entry of [...items].sort((a, b) => byKey(a.file, b.file) || byKey(a.group, b.group))) {
    counts[entry.file] ??= {};
    counts[entry.file][entry.group] = (counts[entry.file][entry.group] ?? 0) + 1;
  }
  return counts;
}

/** A file's total in a per-file record. */
function fileTotal(record, file) {
  return Object.values(record[file] ?? {}).reduce((sum, count) => sum + count, 0);
}

/**
 * The baseline a measurement records: per-file (and per-function) counts for located
 * items, sorted member names, and member → policy for the one-adapter members. No line
 * numbers, so moving code within a function never touches it.
 */
export function toBaseline(measurement) {
  const { items } = measurement;
  const owners = {};
  for (const { member, policy } of [...items.oneAdapterMembers].sort((a, b) => (a.member < b.member ? -1 : 1))) {
    owners[member] = policy;
  }
  return {
    sessionStateWriters: perFile(items.sessionStateWriters),
    directStateWrites: perFile(items.directStateWrites),
    policyMembers: items.policyMembers.map(entry => entry.member).sort(),
    oneAdapterMembers: owners,
    languageBranches: perFile(items.languageBranches)
  };
}

/** Coarse type name for an error message. */
function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/**
 * Parse and validate a baseline file's text.
 *
 * @param {string} text
 * @returns {object} the baseline
 * @throws {StructureError} for anything but a well-formed baseline
 */
export function parseBaseline(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new StructureError(`${BASELINE_FILE} is not valid JSON. ${REPAIR_BASELINE}\n${describe(error)}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new StructureError(`${BASELINE_FILE} must be a JSON object, got ${kindOf(parsed)}. ${REPAIR_BASELINE}`);
  }
  const expected = MEASURES.map(m => m.id);
  const extra = Object.keys(parsed).filter(key => !expected.includes(key));
  const missing = expected.filter(key => !(key in parsed));
  if (extra.length > 0 || missing.length > 0) {
    throw new StructureError(
      `${BASELINE_FILE} must record exactly ${expected.join(', ')}` +
      `${missing.length ? `; missing ${missing.join(', ')}` : ''}` +
      `${extra.length ? `; unknown ${extra.join(', ')}` : ''}. ${REPAIR_BASELINE}`
    );
  }
  for (const m of MEASURES) {
    const value = parsed[m.id];
    const bad = detail => {
      throw new StructureError(`${BASELINE_FILE} has a bad '${m.id}': ${detail}. ${REPAIR_BASELINE}`);
    };
    if (m.kind === 'names') {
      if (!Array.isArray(value)) bad(`expected an array of member names, got ${kindOf(value)}`);
      for (const name of value) if (typeof name !== 'string' || name === '') bad(`expected member names, got ${JSON.stringify(name)}`);
      if (new Set(value).size !== value.length) bad('a member is listed twice');
      continue;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) bad(`expected an object, got ${kindOf(value)}`);
    for (const [key, entry] of Object.entries(value)) {
      if (m.kind === 'owners') {
        if (typeof entry !== 'string' || entry === '') bad(`'${key}' should name one policy, got ${JSON.stringify(entry)}`);
        continue;
      }
      if (!isSourcePath(key)) bad(`'${key}' is not a source file the count reads (${SOURCE_ROOTS.join(', ')}; *.ts)`);
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length === 0) {
        bad(`'${key}' should map functions to counts, got ${JSON.stringify(entry)}`);
      }
      for (const [where, count] of Object.entries(entry)) {
        if (!Number.isInteger(count) || count < 1) {
          bad(`'${key}', '${where}': should be a positive integer, got ${JSON.stringify(count)}`);
        }
      }
    }
  }
  return parsed;
}

/** Total a baseline entry records. */
function totalOf(kind, value) {
  if (kind === 'files') return Object.keys(value).reduce((sum, file) => sum + fileTotal(value, file), 0);
  if (kind === 'names') return value.length;
  return Object.keys(value).length;
}

/**
 * Compare one measure of the tree with its baseline entry.
 *
 * `regressed` lists what the tree has more of: files whose count went up, member names the
 * baseline does not record, one-adapter members that are new or changed owner. `improved`
 * lists what it has less of. Either fails the gate; `regressed` is reported first.
 */
export function compareMeasure(kind, current, recorded) {
  const regressed = [];
  const improved = [];
  if (kind === 'files') {
    for (const file of new Set([...Object.keys(current), ...Object.keys(recorded)])) {
      const now = fileTotal(current, file);
      const then = fileTotal(recorded, file);
      if (now > then) regressed.push(file);
      else if (now < then) improved.push(file);
    }
  } else if (kind === 'names') {
    const then = new Set(recorded);
    const now = new Set(current);
    for (const name of now) if (!then.has(name)) regressed.push(name);
    for (const name of then) if (!now.has(name)) improved.push(name);
  } else {
    for (const [member, policy] of Object.entries(current)) {
      if (recorded[member] !== policy) regressed.push(member);
    }
    for (const member of Object.keys(recorded)) {
      if (!(member in current)) improved.push(member);
    }
  }
  return { regressed: regressed.sort(), improved: improved.sort() };
}

/** One success line per measure. */
function summaryLine(m, measurement) {
  const items = measurement.items[m.id];
  if (m.id === 'oneAdapterMembers') {
    const split = {};
    for (const { policy } of items) split[policy] = (split[policy] ?? 0) + 1;
    const parts = Object.entries(split).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return `structure: ${m.label}: ${items.length} (${parts.map(([policy, count]) => `${policy} ${count}`).join(', ')})`;
  }
  return `structure: ${m.label}: ${items.length}`;
}

function locate(entry) {
  return `${entry.file}:${entry.line}  ${entry.where}  ${entry.text}`;
}

/** Every item of every measure, for `--list`. */
function listing(measurement) {
  const lines = [];
  for (const m of MEASURES) {
    const items = measurement.items[m.id];
    lines.push(`${m.label} (${items.length}):`);
    for (const entry of items) {
      if (m.id === 'policyMembers') lines.push(`  ${entry.member}  [${entry.users.join(', ') || 'no engine'}]`);
      else if (m.id === 'oneAdapterMembers') lines.push(`  ${entry.member}  [${entry.policy}]`);
      else lines.push(`  ${locate(entry)}`);
    }
  }
  return lines;
}

/**
 * What the gate prints about a measure that gained items. When the total did not grow, the
 * change may be a move or a rename, and the headline says so rather than calling it new.
 */
function regressionReport(m, measurement, recorded, regressed) {
  const items = measurement.items[m.id];
  const lines = [];
  const before = totalOf(m.kind, recorded);
  const what = m.kind === 'files' ? `${regressed.length} file(s) gained items` : `${regressed.length} new`;
  const moved = items.length <= before ? ' The total did not grow: if this only moved or renamed an item, re-record.' : '';
  lines.push(`structure: ${m.label}: ${before} recorded, ${items.length} now; ${what}.${moved}`);
  if (m.kind === 'files') {
    for (const file of regressed) {
      const inFile = items.filter(entry => entry.file === file);
      lines.push(`  ${file}: ${fileTotal(recorded, file)} -> ${inFile.length}`);
      // The functions whose count grew hold the new items. If none grew (a rename inside
      // the file), every item is shown.
      const then = recorded[file] ?? {};
      const groups = [...new Set(inFile.map(entry => entry.group))];
      const grown = groups.filter(group => inFile.filter(entry => entry.group === group).length > (then[group] ?? 0));
      for (const where of grown.length > 0 ? grown : groups) {
        const inGroup = inFile.filter(entry => entry.group === where);
        lines.push(`    ${where}: ${then[where] ?? 0} -> ${inGroup.length}`);
        for (const entry of inGroup) lines.push(`      ${entry.file}:${entry.line}  ${entry.text}`);
      }
      const rest = grown.length > 0 ? inFile.filter(entry => !grown.includes(entry.group)).length : 0;
      if (rest > 0) lines.push(`    (${rest} more in this file, already recorded: --list shows them)`);
    }
  } else if (m.kind === 'names') {
    for (const name of regressed) {
      const entry = items.find(candidate => candidate.member === name);
      lines.push(`  new member: ${name}  (used by: ${entry?.users.join(', ') || 'no engine'})`);
    }
  } else {
    for (const name of regressed) {
      const entry = items.find(candidate => candidate.member === name);
      const was = recorded[name];
      lines.push(`  ${name}: used only by ${entry.policy}${was ? ` (recorded as ${was}'s)` : ''}`);
    }
  }
  lines.push(`  ${m.advice}`);
  return lines;
}

/** What the gate prints about a measure that lost items. */
function improvementReport(m, measurement, recorded, improved) {
  const items = measurement.items[m.id];
  const lines = [];
  const what = m.kind === 'files' ? `${improved.length} file(s) lost items` : `${improved.length} gone`;
  lines.push(`structure: ${m.label}: ${totalOf(m.kind, recorded)} recorded, ${items.length} now; ${what}.`);
  if (m.kind === 'files') {
    for (const file of improved) {
      lines.push(`  ${file}: ${fileTotal(recorded, file)} -> ${items.filter(entry => entry.file === file).length}`);
    }
  } else {
    for (const name of improved) lines.push(`  no longer counted: ${name}`);
  }
  return lines;
}

/**
 * Run the gate (or `--update`) on a repo root. Never exits the process: the caller prints
 * the output and exits with `code`.
 *
 * @param {string} root
 * @param {string[]} argv
 * @returns {{ code: 0 | 1 | 2, stdout: string, stderr: string }}
 */
export function run(root, argv) {
  const out = [];
  const err = [];
  const done = code => ({ code, stdout: out.length ? `${out.join('\n')}\n` : '', stderr: err.length ? `${err.join('\n')}\n` : '' });

  // pnpm forwards the `--` separator itself (`pnpm run structure:check -- --list`).
  const known = ['--', '--update', '--list'];
  const unknown = argv.filter(arg => !known.includes(arg));
  if (unknown.length > 0) {
    err.push(`structure: Unknown argument(s): ${unknown.join(' ')}. Usage: node scripts/check-structure.mjs [--update | --list]`);
    return done(2);
  }
  const update = argv.includes('--update');
  const list = argv.includes('--list');

  let measurement;
  try {
    measurement = measure(collectSources(root));
  } catch (error) {
    if (error instanceof StructureError) {
      err.push(`structure: ${error.message}`);
      return done(2);
    }
    throw error;
  }

  if (list) out.push(...listing(measurement), '');

  const current = toBaseline(measurement);

  if (update) {
    fs.writeFileSync(path.join(root, BASELINE_FILE), `${JSON.stringify(current, null, 2)}\n`);
    for (const m of MEASURES) out.push(summaryLine(m, measurement));
    out.push(`structure: baseline recorded in ${BASELINE_FILE}.`);
    return done(0);
  }

  const file = path.join(root, BASELINE_FILE);
  if (!fs.existsSync(file)) {
    err.push(`structure: Missing ${BASELINE_FILE}. Record it with: ${UPDATE_COMMAND}`);
    return done(2);
  }
  let baseline;
  try {
    baseline = parseBaseline(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    if (error instanceof StructureError) {
      err.push(`structure: ${error.message}`);
      return done(2);
    }
    throw error;
  }

  const regressions = [];
  const improvements = [];
  for (const m of MEASURES) {
    const { regressed, improved } = compareMeasure(m.kind, current[m.id], baseline[m.id]);
    if (regressed.length > 0) regressions.push(regressionReport(m, measurement, baseline[m.id], regressed));
    if (improved.length > 0) improvements.push(improvementReport(m, measurement, baseline[m.id], improved));
  }

  if (regressions.length > 0) {
    err.push('');
    for (const report of regressions) err.push(...report, '');
    for (const report of improvements) err.push(...report, '');
    err.push(
      `Each new item above is one more piece of structural debt; the note under each measure says\n` +
      `what to do instead. Re-record only when an item is unavoidable, or the change only moved or\n` +
      `renamed one: say why in the pull request, and commit the new baseline in it:\n` +
      `  ${UPDATE_COMMAND}`
    );
    return done(1);
  }

  if (improvements.length > 0) {
    err.push('');
    for (const report of improvements) err.push(...report, '');
    err.push(
      `That is progress, but ${BASELINE_FILE} is now stale. Re-record it and commit it in this\n` +
      `pull request, so the recorded numbers stay true:\n` +
      `  ${UPDATE_COMMAND}`
    );
    return done(1);
  }

  for (const m of MEASURES) out.push(summaryLine(m, measurement));
  return done(0);
}

/** Human-readable form of a thrown value. */
function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

if (isMain(import.meta.url)) {
  let result;
  try {
    result = run(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), process.argv.slice(2));
  } catch (error) {
    // A crash is a check that could not run, never a ratchet failure (exit 1).
    result = { code: 2, stdout: '', stderr: `structure: the check crashed.\n${error instanceof Error ? error.stack : String(error)}\n` };
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}
