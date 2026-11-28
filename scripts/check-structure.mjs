/**
 * Structure ratchet.
 *
 * A review on 2026-11-24 counted how this codebase's structure had moved over two months, and
 * every count had gone the wrong way while each change, read alone, looked careful: more
 * places that write session state, more members in the adapter contract, more of them
 * serving a single engine, more `if language is X` in the core. This script counts them, so a
 * pull request that adds one has to say so instead of slipping it in.
 *
 * It asks rather than pattern-matches:
 *
 *   - The static measures come from the TypeScript checker, over the program
 *     `tsconfig.typecheck.json` already type-checks: a write is a write to the session's own
 *     `state` property symbol, a call to the gate is a call whose resolved signature is the
 *     gate's, a language branch is one whose operand is typed as a language.
 *   - Which engine uses which contract member is read from the engines' real policy objects,
 *     loaded from source (esbuild, in memory) through the policy registry, with the
 *     descriptor getters called.
 *
 * Measures (each rule is spelled out where it is implemented):
 *
 *   session-state writers        places that decide a session's next state
 *   direct session-state writes  the subset that bypasses `_updateSessionState`
 *   AdapterPolicy members        the contract every adapter is written against
 *   one-adapter members          members exactly one engine's policy uses
 *   language branches            branches on a specific language outside the policy files
 *
 * A check reports one of four things per measure, and only the first is called debt:
 *   growth     the count went up: exit 1, names the new items. `--update` refuses it; it is
 *              recorded only with `--update --accept-growth "<reason>"`, which writes each
 *              accepted item and the reason into the baseline, so the diff shows both.
 *   reduction  the count went down: exit 1 until `--update` re-records it (progress).
 *   change     same count, different items (a move or a rename): passes, with a notice;
 *              `--update` re-records it.
 *   (exit 2)   the analysis could not be done: a source that does not parse or type-check,
 *              a policy that could not be loaded, an anchor type that could not be resolved.
 *
 * Modes:
 *   (default)                      compare the tree with tests/structure-baseline.json
 *   --update [--accept-growth why] re-record reductions and changes; growth only with a reason
 *   --init                         write a first baseline (refused when one exists)
 *   --list                         print every counted item, then compare as usual
 *
 * Exit codes: 0 clean (notices allowed), 1 growth or reduction, 2 the check could not be run.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { isMain } from './lib/is-main.mjs';

/** Recorded counts and items, relative to the repo root (beside the test-typing baseline). */
export const BASELINE_FILE = 'tests/structure-baseline.json';

/** The program the analysis reads: the one `npm run typecheck` already checks. */
export const CONFIG_FILE = 'tsconfig.typecheck.json';

const UPDATE_COMMAND = 'pnpm run structure:update';
const ACCEPT_COMMAND = `${UPDATE_COMMAND} -- --accept-growth "<why the structure must grow>"`;
const RESTORE_BASELINE =
  `--update needs the recorded counts to know what grew, so it cannot repair a broken baseline. ` +
  `Restore it and re-run: git checkout origin/main -- ${BASELINE_FILE}`;

/** The core: the server's own sources and the shared package. */
const SOURCE_ROOTS = ['src', 'packages/shared/src'];

/**
 * The policy files: one per engine, the language-to-policy registry, and the module the three
 * LLDB policies share. Engine differences are meant to live there, so a language branch in
 * them is not counted.
 */
const POLICY_FILE = /^packages\/shared\/src\/interfaces\/(adapter-policy-[^/]+|[^/]+-policy-shared)\.ts$/;

/** Where the anchors are exported from. Each is resolved through the checker, never by text. */
const SHARED_INDEX = 'packages/shared/src/index.ts';
const SESSION_STORE = 'src/session/session-store.ts';
const SESSION_CORE = 'src/session/session-manager-core.ts';

/** The one method that moves a session between states with its invariant and listeners. */
const GATE = '_updateSessionState';

/**
 * The mock adapter's language. Its policy is the test infrastructure's stand-in, not an
 * engine: a member it shares with one engine is still that engine's quirk.
 */
const TEST_DOUBLE_LANGUAGE = 'mock';

/** Longest source text an item quotes. */
const SNIPPET_LENGTH = 160;

export const MEASURES = [
  {
    id: 'sessionStateWriters',
    label: 'session-state writers',
    advice:
      'A new place that decides a session\'s state is one more path through the state machine that ' +
      'the others do not know about. Reach the state through an existing transition, or the event ' +
      'that already drives it.'
  },
  {
    id: 'directStateWrites',
    label: 'direct session-state writes',
    advice:
      `A direct write skips ${GATE}'s invariant (no PAUSED without lastStop) and its listeners, so ` +
      `waiters and subscribers never hear of the change. Call ${GATE} (ctx.updateState from a ` +
      'collaborator) instead.'
  },
  {
    id: 'policyMembers',
    label: 'AdapterPolicy members',
    advice:
      'A new member widens the contract every adapter is written against. Express the behaviour ' +
      'through an existing member if one fits.'
  },
  {
    id: 'oneAdapterMembers',
    label: 'AdapterPolicy members used by one adapter',
    advice:
      "A member that only one engine's policy uses is that engine's quirk entering the core's " +
      'contract. Express it through an existing member, or keep it inside the adapter.'
  },
  {
    id: 'languageBranches',
    label: 'language branches outside the policy files',
    advice:
      'A branch on one language outside the policy files puts engine knowledge in the core. Move ' +
      "the difference into that adapter's policy and keep the core language-blind."
  }
];

/** A check that cannot be run: reported with exit code 2, never as a ratchet result. */
export class StructureError extends Error {}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/**
 * Is this repo-relative, forward-slash path a core source the measures read? Hand-written
 * TypeScript under the source roots; tests and generated files are not shipped source.
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

// ---------------------------------------------------------------------------
// The program
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
let typescript;

/** The TypeScript compiler API, from the repo's own devDependency. */
function tsApi() {
  if (!typescript) {
    try {
      typescript = require('typescript');
    } catch (error) {
      throw new StructureError(`Cannot load typescript -- run 'pnpm install' first.\n${describe(error)}`);
    }
  }
  return typescript;
}

/**
 * Parsed lib files, shared between programs in one process (the unit tests build many). A
 * parsed and bound lib file does not depend on the program that loaded it, which is how the
 * language service's document registry shares them too.
 */
const libCache = new Map();

function formatDiagnostics(ts, diagnostics, root, limit = 10) {
  const lines = diagnostics.slice(0, limit).map(d => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    if (!d.file || d.start === undefined) return `  ${text}`;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    return `  ${relative(root, d.file.fileName)}:${line + 1}  ${text}`;
  });
  if (diagnostics.length > limit) lines.push(`  ... and ${diagnostics.length - limit} more`);
  return lines.join('\n');
}

function relative(root, fileName) {
  return path.relative(root, fileName).split(path.sep).join('/').replace(/\\/g, '/');
}

/**
 * The checker's program over `tsconfig.typecheck.json`, refused when the files the analysis
 * reads do not parse or do not type-check: every rule below reads types, and on a program tsc
 * rejects they would be guesses.
 */
function createAnalysisProgram(root) {
  const ts = tsApi();
  const configPath = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(configPath)) throw new StructureError(`Missing ${CONFIG_FILE}: the analysis reads that program.`);

  const configErrors = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: diagnostic => configErrors.push(diagnostic)
  });
  if (!parsed || configErrors.length > 0 || parsed.errors.length > 0) {
    throw new StructureError(`${CONFIG_FILE} could not be read:\n${formatDiagnostics(ts, [...configErrors, ...(parsed?.errors ?? [])], root)}`);
  }

  const host = ts.createCompilerHost(parsed.options, true);
  const libDir = path.dirname(require.resolve('typescript')).split(path.sep).join('/');
  const readSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const normalized = fileName.split(path.sep).join('/');
    if (!normalized.startsWith(`${libDir}/`)) return readSourceFile(fileName, languageVersion, onError, shouldCreate);
    const key = `${normalized}|${JSON.stringify(languageVersion)}`;
    if (!libCache.has(key)) libCache.set(key, readSourceFile(fileName, languageVersion, onError, shouldCreate));
    return libCache.get(key);
  };

  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, host });
  const files = new Map();
  for (const sf of program.getSourceFiles()) files.set(relative(root, sf.fileName), sf);
  const scope = [...files.entries()].filter(([file]) => isSourcePath(file)).map(([, sf]) => sf);

  const syntax = scope.flatMap(sf => program.getSyntacticDiagnostics(sf));
  if (syntax.length > 0) {
    throw new StructureError(`A source does not parse, so nothing in it can be counted:\n${formatDiagnostics(ts, syntax, root)}`);
  }
  const semantic = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...scope.flatMap(sf => program.getSemanticDiagnostics(sf))
  ];
  if (semantic.length > 0) {
    throw new StructureError(
      `The analysis reads the type checker, and it reports errors in the files the analysis reads. ` +
      `Fix them first (pnpm run typecheck):\n${formatDiagnostics(ts, semantic, root)}`
    );
  }
  return { ts, program, checker: program.getTypeChecker(), root, files, scope };
}

// ---------------------------------------------------------------------------
// Anchors: the types and declarations the rules are about
// ---------------------------------------------------------------------------

function moduleExport(an, file, name, why) {
  const { ts, checker } = an;
  const sf = an.files.get(file);
  const moduleSymbol = sf && checker.getSymbolAtLocation(sf);
  const found = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.name === name);
  if (!found) {
    throw new StructureError(
      `${file} does not export '${name}', which ${why}. If it moved or was renamed, update the ` +
      'anchor in scripts/check-structure.mjs.'
    );
  }
  return found.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(found) : found;
}

function findAnchors(an) {
  const { ts, checker } = an;

  const managed = moduleExport(an, SESSION_STORE, 'ManagedSession', 'the session-state rules read');
  const stateProperty = checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(managed), 'state');
  if (!stateProperty?.declarations?.length) throw new StructureError("ManagedSession has no 'state' property to follow.");

  const sessionStateEnum = checker.getDeclaredTypeOfSymbol(moduleExport(an, SHARED_INDEX, 'SessionState', 'the gate takes'));
  const languageSymbol = moduleExport(an, SHARED_INDEX, 'DebugLanguage', 'the language rules read');
  const languageEnum = checker.getDeclaredTypeOfSymbol(languageSymbol);
  const policySymbol = moduleExport(an, SHARED_INDEX, 'AdapterPolicy', 'the contract measures read');
  const registrySymbol = moduleExport(an, SHARED_INDEX, 'getPolicyForLanguage', 'the engines are loaded through');

  const core = moduleExport(an, SESSION_CORE, 'SessionManagerCore', 'declares the state gate');
  const gateSymbol = checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(core), GATE);
  const gate = gateSymbol?.declarations?.find(decl => ts.isMethodDeclaration(decl) && decl.body);
  if (!gate) {
    throw new StructureError(`SessionManagerCore has no method ${GATE}; the writer rules count calls to it.`);
  }
  const sessionStateMembers = new Set(sessionStateEnum.isUnion() ? sessionStateEnum.types : [sessionStateEnum]);
  const gateStateIndex = gate.parameters.findIndex(param => sessionStateMembers.has(checker.getTypeAtLocation(param)) ||
    checker.getTypeAtLocation(param) === sessionStateEnum);
  if (gateStateIndex < 0) throw new StructureError(`${GATE} has no parameter typed SessionState.`);

  const policyType = checker.getDeclaredTypeOfSymbol(policySymbol);
  const nameProperty = checker.getPropertyOfType(policyType, 'name');
  const languageMembers = languageEnum.isUnion() ? languageEnum.types : [languageEnum];

  return {
    stateDecls: new Set(stateProperty.declarations),
    sessionStateEnum,
    sessionStateMembers,
    gate,
    gateStateIndex,
    policyType,
    policyNameDecls: new Set(nameProperty?.declarations ?? []),
    languageEnum,
    languageMembers: new Set(languageMembers),
    languageValues: languageMembers.map(member => member.value).filter(value => typeof value === 'string'),
    registryFile: registrySymbol.valueDeclaration?.getSourceFile().fileName,
    languageFile: languageSymbol.valueDeclaration?.getSourceFile().fileName
  };
}

// ---------------------------------------------------------------------------
// Shared syntax helpers
// ---------------------------------------------------------------------------

function unwrap(ts, node) {
  while (
    node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function nameText(ts, name) {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

/** The name a function-like node goes by: its own, or the binding it is assigned to. */
function functionName(ts, node) {
  const own = nameText(ts, node.name);
  if (own) return own;
  const parent = node.parent;
  if (parent && (ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent))) {
    return nameText(ts, parent.name);
  }
  return undefined;
}

/** `Class.method`, `function`, or `(top level)`. */
function whereIs(ts, node) {
  let fn;
  for (let current = node.parent; current; current = current.parent) {
    if (!fn && ts.isFunctionLike(current) && functionName(ts, current)) fn = functionName(ts, current);
    if (ts.isClassLike(current) && current.name) return fn ? `${current.name.text}.${fn}` : current.name.text;
  }
  return fn ?? '(top level)';
}

function innermostFunction(ts, node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current) && current.body) return current;
  }
  return undefined;
}

let printer;

/** A node's source, comments dropped and whitespace collapsed: the same for any formatting. */
function printed(ts, node) {
  printer ??= ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const text = printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).replace(/\s+/g, ' ').trim();
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 3)}...` : text;
}

/** A located item: what the gate prints, keyed without file or line so a move never changes it. */
function item(an, node, extra = {}, textNode = node) {
  const { ts } = an;
  const sf = node.getSourceFile();
  const where = whereIs(ts, node);
  const text = extra.text ?? printed(ts, textNode);
  return {
    file: relative(an.root, sf.fileName),
    line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    where,
    ...extra,
    text,
    key: `${where} :: ${text}`
  };
}

function isAssignmentOperator(ts, kind) {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

/** Is this expression on the receiving side of an assignment (directly or in a pattern)? */
function isAssignmentTarget(ts, node) {
  let child = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isParenthesizedExpression(parent) || ts.isArrayLiteralExpression(parent) || ts.isSpreadElement(parent) ||
      ts.isSpreadAssignment(parent) || ts.isShorthandPropertyAssignment(parent)) continue;
    if (ts.isPropertyAssignment(parent) && parent.initializer === child) continue;
    if (ts.isObjectLiteralExpression(parent)) continue;
    if (ts.isBinaryExpression(parent)) return isAssignmentOperator(ts, parent.operatorToken.kind) && parent.left === child;
    if (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) return parent.initializer === child;
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Measures 1 and 2: session-state writers, and the direct ones among them
// ---------------------------------------------------------------------------

/**
 * Every place that decides a session's next state.
 *
 * A write site is any of:
 *   - a call whose resolved signature is the gate (`_updateSessionState`) or a setter (below),
 *     however the callee was reached: `this.ctx.updateState`, a destructured alias, a `Pick<>`;
 *   - a write to the `state` property symbol `ManagedSession` carries (declared on
 *     `DebugSessionInfo`): an assignment, an element access `session['state']`, a destructuring
 *     target; a `state` on any other type is a different symbol and is never counted;
 *   - an object literal that sets `state` where the literal is typed as a partial session (the
 *     property is optional there, as in `Partial<ManagedSession>`): it is merged into an existing
 *     session. A literal where `state` is required constructs a session or a snapshot, and is
 *     not a write;
 *   - an `Object.assign` whose target is a session and whose source literal sets `state`.
 *
 * A site that passes its own function's parameter straight through is not a decision: it makes
 * that function a setter, and the setter's callers are the write sites. That is how the
 * plumbing drops out without naming it: the store's `session.state = newState`, the gate's call
 * to the store, the operations context's `updateState: (s, n) => this._updateSessionState(s, n)`.
 * A setter implementing an interface member (the context's `updateState`) is reached through
 * calls to that member.
 *
 * A site is direct when it does not go through the gate: a raw write, or a call to a setter
 * that ends in one (the store's `updateState`).
 */
function findStateWriters(an, anchors) {
  const { ts, checker } = an;
  const writerDecls = new Map([[anchors.gate, { index: anchors.gateStateIndex, gated: true }]]);

  const refersToState = expression => {
    const node = unwrap(ts, expression);
    let symbol;
    if (ts.isPropertyAccessExpression(node)) symbol = checker.getSymbolAtLocation(node.name);
    else if (ts.isElementAccessExpression(node)) symbol = checker.getSymbolAtLocation(node.argumentExpression);
    else return false;
    return Boolean(symbol?.declarations?.some(decl => anchors.stateDecls.has(decl)));
  };

  const stateTargetsIn = (pattern, found = []) => {
    const node = unwrap(ts, pattern);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (refersToState(node)) found.push(node);
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) stateTargetsIn(property.initializer, found);
        else if (ts.isSpreadAssignment(property)) stateTargetsIn(property.expression, found);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) stateTargetsIn(ts.isSpreadElement(element) ? element.expression : element, found);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      stateTargetsIn(node.left, found);
    }
    return found;
  };

  const literalStateProperty = literal => literal.properties.find(property =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && nameText(ts, property.name) === 'state');

  const valueOf = property => ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;

  /** Literals (this one and those spread into it) that set `state`. */
  const stateLiterals = (expression, found = []) => {
    const node = unwrap(ts, expression);
    if (!ts.isObjectLiteralExpression(node)) return found;
    const property = literalStateProperty(node);
    if (property) found.push({ literal: node, property });
    for (const spread of node.properties.filter(p => ts.isSpreadAssignment(p))) stateLiterals(spread.expression, found);
    return found;
  };

  const isObjectAssign = (call, declaration) =>
    declaration && ts.isMethodSignature(declaration) && nameText(ts, declaration.name) === 'assign' &&
    ts.isInterfaceDeclaration(declaration.parent) && declaration.parent.name.text === 'ObjectConstructor';

  const hasSessionState = expression => {
    const type = checker.getTypeAtLocation(expression);
    const property = checker.getPropertyOfType(checker.getApparentType(type), 'state');
    return Boolean(property?.declarations?.some(decl => anchors.stateDecls.has(decl)));
  };

  /** The call (or property) a partial-update literal belongs to, for its message. */
  const ownerOf = literal => {
    for (let current = literal; current.parent; current = current.parent) {
      if (ts.isCallExpression(current.parent) && current.parent.arguments.includes(current)) return current.parent;
      if (!(ts.isObjectLiteralExpression(current.parent) || ts.isSpreadAssignment(current.parent) ||
        ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent) ||
        ts.isSatisfiesExpression(current.parent) || ts.isPropertyAssignment(current.parent))) break;
    }
    return literal;
  };

  const collect = () => {
    const sites = [];
    const add = (node, kind, gated, value, textNode = node) => sites.push({ node, kind, gated, value, textNode });
    for (const sf of an.scope) {
      const visit = node => {
        if (ts.isCallExpression(node)) {
          const declaration = checker.getResolvedSignature(node)?.declaration;
          const writer = declaration && writerDecls.get(declaration);
          if (writer) {
            add(node, 'call', writer.gated, node.arguments[writer.index]);
            sites[sites.length - 1].callee = declaration;
          }
          else if (isObjectAssign(node, declaration) && node.arguments.length > 1 && hasSessionState(node.arguments[0])) {
            for (const source of node.arguments.slice(1)) {
              for (const { property } of stateLiterals(source)) add(node, 'Object.assign', false, valueOf(property));
            }
          }
        } else if (ts.isBinaryExpression(node) && isAssignmentOperator(ts, node.operatorToken.kind)) {
          const left = unwrap(ts, node.left);
          if (ts.isPropertyAccessExpression(left) || ts.isElementAccessExpression(left)) {
            if (refersToState(left)) {
              add(node, 'assignment', false, node.operatorToken.kind === ts.SyntaxKind.EqualsToken ? node.right : undefined);
            }
          } else if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            for (const target of stateTargetsIn(left)) add(target, 'destructuring', false, undefined, node);
          }
        } else if (ts.isObjectLiteralExpression(node) && !isAssignmentTarget(ts, node)) {
          const property = literalStateProperty(node);
          if (property) {
            const contextual = checker.getContextualType(node);
            const target = contextual && checker.getPropertyOfType(contextual, 'state');
            if (target && target.flags & ts.SymbolFlags.Optional &&
              target.declarations?.some(decl => anchors.stateDecls.has(decl))) {
              add(node, 'partial update', false, valueOf(property), ownerOf(node));
            }
          }
        }
        node.forEachChild(visit);
      };
      visit(sf);
    }
    return sites;
  };

  /** The function and parameter position a site passes straight through, if any. */
  const forwarded = site => {
    const value = unwrap(ts, site.value);
    if (!value || !ts.isIdentifier(value)) return undefined;
    const symbol = ts.isShorthandPropertyAssignment(value.parent) && value.parent.name === value
      ? checker.getShorthandAssignmentValueSymbol(value.parent)
      : checker.getSymbolAtLocation(value);
    const declaration = symbol?.valueDeclaration;
    const fn = innermostFunction(ts, site.node);
    if (!declaration || !ts.isParameter(declaration) || declaration.parent !== fn) return undefined;
    return { fn, index: fn.parameters.indexOf(declaration) };
  };

  /** The interface members a function implements, so calls through them reach it. */
  const implemented = fn => {
    const found = [];
    const expand = declarations => {
      for (const declaration of declarations ?? []) {
        found.push(declaration);
        if (ts.isPropertySignature(declaration) && declaration.type && ts.isFunctionTypeNode(declaration.type)) found.push(declaration.type);
      }
    };
    const holder = ts.isMethodDeclaration(fn) ? fn : fn.parent;
    const name = nameText(ts, holder.name);
    if (name && (ts.isPropertyAssignment(holder) || ts.isMethodDeclaration(holder)) && ts.isObjectLiteralExpression(holder.parent)) {
      const contextual = checker.getContextualType(holder.parent);
      expand(contextual && checker.getPropertyOfType(contextual, name)?.declarations);
    } else if (name && ts.isMethodDeclaration(fn) && ts.isClassLike(fn.parent)) {
      for (const clause of fn.parent.heritageClauses ?? []) {
        for (const heritage of clause.types) {
          expand(checker.getPropertyOfType(checker.getTypeAtLocation(heritage), name)?.declarations);
        }
      }
    }
    return found.filter(declaration => declaration !== fn);
  };

  let sites;
  for (let changed = true; changed;) {
    changed = false;
    sites = collect();
    for (const site of sites) {
      const pass = forwarded(site);
      if (!pass) continue;
      site.forwarding = pass.fn === anchors.gate ? 'gate' : [pass.fn, ...implemented(pass.fn)];
      if (pass.fn === anchors.gate) continue;
      for (const declaration of site.forwarding) {
        if (!writerDecls.has(declaration)) {
          writerDecls.set(declaration, { index: pass.index, gated: site.gated });
          changed = true;
        }
      }
    }
  }

  // A setter stands in for its callers only if it has some: a forwarding site whose function
  // no call in the core reaches (`states.forEach(s => this._updateSessionState(session, s))`,
  // a `.then(state => ...)`, a helper nothing calls yet) is counted where it is. An
  // implementation of an interface member (the operations context's `updateState`) is the
  // entry itself, called or not.
  const called = new Set(sites.filter(site => site.callee).map(site => site.callee));
  for (const site of sites) {
    if (!Array.isArray(site.forwarding)) continue;
    const [fn, ...implementedMembers] = site.forwarding;
    if (implementedMembers.length === 0 && !called.has(fn)) site.forwarding = undefined;
  }

  const writers = sites.filter(site => !site.forwarding)
    .map(site => item(an, site.node, { direct: !site.gated, form: site.kind }, site.textNode));
  return { writers, direct: writers.filter(writer => writer.direct) };
}

// ---------------------------------------------------------------------------
// Measures 3 and 4: the contract, and which engine uses which member
// ---------------------------------------------------------------------------

function isBooleanType(ts, type) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.length > 0 && parts.every(part => part.flags & ts.TypeFlags.BooleanLike);
}

function isRecordType(ts, checker, type) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.every(part => (part.flags & ts.TypeFlags.Object || part.flags & ts.TypeFlags.Intersection) &&
    part.getCallSignatures().length === 0 && part.getConstructSignatures().length === 0 &&
    !checker.getIndexInfoOfType(part, ts.IndexKind.Number));
}

/**
 * The contract: every property of the `AdapterPolicy` type (inherited ones included), plus
 * every optional property of the object a descriptor getter returns, named `getter().field`.
 * A descriptor getter is a member callable with no arguments that returns an object. Its
 * optional properties are switches each engine sets or leaves out on its own, exactly like an
 * optional member of the interface; its required properties are the value every implementer
 * must give, counted once as the getter. Properties of a switch's value
 * (`exceptionFilters.uncaught`) are that value's shape, not further switches.
 */
function contractMembers(an, anchors) {
  const { ts, checker } = an;
  const properties = checker.getPropertiesOfType(anchors.policyType);
  if (properties.length === 0) throw new StructureError('The AdapterPolicy type has no members.');
  const members = [];
  /** Every field (optional or not) of each descriptor's returned type, for the outside-keys report. */
  members.descriptorFields = new Map();
  for (const property of properties) {
    const type = checker.getNonNullableType(checker.getTypeOfSymbol(property));
    members.push({ key: property.name, name: property.name, decls: property.declarations ?? [], boolean: isBooleanType(ts, type) });
    const signatures = type.getCallSignatures();
    if (signatures.length !== 1) continue;
    const [signature] = signatures;
    if (signature.parameters.some(param => !param.valueDeclaration || !checker.isOptionalParameter(param.valueDeclaration))) continue;
    const returned = checker.getNonNullableType(signature.getReturnType());
    if (!isRecordType(ts, checker, returned)) continue;
    members.descriptorFields.set(property.name, new Set(checker.getPropertiesOfType(returned).map(field => field.name)));
    for (const field of checker.getPropertiesOfType(returned)) {
      if (!(field.flags & ts.SymbolFlags.Optional)) continue;
      members.push({
        key: `${property.name}().${field.name}`,
        getter: property.name,
        field: field.name,
        decls: field.declarations ?? [],
        boolean: isBooleanType(ts, checker.getNonNullableType(checker.getTypeOfSymbol(field)))
      });
    }
  }
  return members;
}

/**
 * How the code reads each member, which decides what an explicit `false` means.
 *
 * A read is a *truth test* when only the value's truthiness can matter: an `if`/`while`/`?:`
 * condition, an operand of `!`, a comparison with `true`, or an operand of `&&`/`||` that is
 * itself in a truth test. For a boolean member whose every read is a truth test, `false`
 * behaves exactly as leaving the member out, so setting it `false` is not a use. Any other
 * read (`=== false`, `typeof … === 'boolean'`, `??`, passing the value on, destructuring) can
 * tell `false` from absent, and so can a member nothing reads: there `false` counts as a use.
 */
function classifyReads(an, members) {
  const { ts, checker } = an;
  const byDecl = new Map();
  for (const member of members) for (const decl of member.decls) byDecl.set(decl, member);
  const names = new Set(members.map(member => member.field ?? member.name));
  const reads = new Map(members.map(member => [member.key, { reads: 0, valueReads: 0 }]));

  // A read through a policy constant (`JsDebugAdapterPolicy.matchesAdapter`, whose type
  // `satisfies` keeps literal) resolves to the policy literal's own property. Its contextual
  // type is the contract, so the contract member is one lookup away.
  const viaLiteral = new Map();
  const memberOfDeclaration = decl => {
    if (byDecl.has(decl)) return byDecl.get(decl);
    if (viaLiteral.has(decl)) return viaLiteral.get(decl);
    let member;
    if ((ts.isPropertyAssignment(decl) || ts.isShorthandPropertyAssignment(decl) || ts.isMethodDeclaration(decl)) &&
      ts.isObjectLiteralExpression(decl.parent)) {
      const contextual = checker.getContextualType(decl.parent);
      const name = nameText(ts, decl.name);
      const property = contextual && name && checker.getPropertyOfType(contextual, name);
      member = property?.declarations?.map(d => byDecl.get(d)).find(Boolean);
    }
    viaLiteral.set(decl, member);
    return member;
  };
  const memberOf = symbol => symbol?.declarations?.map(memberOfDeclaration).find(Boolean);

  const truthTest = node => {
    let current = node;
    while (current.parent && (ts.isParenthesizedExpression(current.parent) || ts.isNonNullExpression(current.parent))) current = current.parent;
    const parent = current.parent;
    if (!parent) return false;
    if ((ts.isIfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) && parent.expression === current) return true;
    if (ts.isForStatement(parent) && parent.condition === current) return true;
    if (ts.isConditionalExpression(parent) && parent.condition === current) return true;
    if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken) return true;
    if (ts.isBinaryExpression(parent)) {
      const kind = parent.operatorToken.kind;
      if (kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken) return truthTest(parent);
      if (kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        const other = parent.left === current ? parent.right : parent.left;
        return unwrap(ts, other).kind === ts.SyntaxKind.TrueKeyword;
      }
    }
    return false;
  };

  const record = (member, node, valueRead) => {
    const entry = reads.get(member.key);
    entry.reads += 1;
    if (valueRead || !truthTest(node)) entry.valueReads += 1;
  };

  for (const sf of an.scope) {
    const visit = node => {
      if (ts.isPropertyAccessExpression(node) && names.has(node.name.text) && !isAssignmentTarget(ts, node)) {
        const member = memberOf(checker.getSymbolAtLocation(node.name));
        if (member) record(member, node, false);
      } else if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) &&
        names.has(node.argumentExpression.text) && !isAssignmentTarget(ts, node)) {
        const member = memberOf(checker.getSymbolAtLocation(node.argumentExpression));
        if (member) record(member, node, false);
      } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const name = nameText(ts, node.propertyName ?? node.name);
        if (name && names.has(name)) {
          const member = memberOf(checker.getPropertyOfType(checker.getTypeAtLocation(node.parent), name));
          if (member) record(member, node, true);
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return reads;
}

/** Load the policy registry from source and evaluate it: the real objects the engines export. */
async function loadEnginePolicies(an, anchors) {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch (error) {
    throw new StructureError(`Cannot load esbuild -- run 'pnpm install' first.\n${describe(error)}`);
  }
  if (!anchors.registryFile || !anchors.languageFile) throw new StructureError('Cannot locate the policy registry or DebugLanguage source.');
  const specifier = file => JSON.stringify(file.split(path.sep).join('/'));
  let code;
  try {
    const result = esbuild.buildSync({
      stdin: {
        contents:
          `export { getPolicyForLanguage } from ${specifier(anchors.registryFile)};\n` +
          `export { DebugLanguage } from ${specifier(anchors.languageFile)};\n`,
        resolveDir: an.root,
        loader: 'ts',
        sourcefile: 'structure-policies.ts'
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      write: false,
      logLevel: 'silent',
      tsconfig: path.join(an.root, CONFIG_FILE)
    });
    code = result.outputFiles[0].text;
  } catch (error) {
    throw new StructureError(`The policies could not be bundled from source:\n${describe(error)}`);
  }

  let registry;
  try {
    registry = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  } catch (error) {
    throw new StructureError(`The policies could not be loaded:\n${describe(error)}`);
  }

  const fallback = registry.getPolicyForLanguage('\u0000structure-guard:no-such-language');
  const engines = [];
  const seen = new Set();
  for (const language of Object.values(registry.DebugLanguage)) {
    if (typeof language !== 'string' || language === TEST_DOUBLE_LANGUAGE) continue;
    const policy = registry.getPolicyForLanguage(language);
    if (!policy || policy === fallback) {
      throw new StructureError(`The registry answers '${language}' with the fallback policy: that engine has no policy to count.`);
    }
    if (seen.has(policy)) continue;
    seen.add(policy);
    engines.push({ name: typeof policy.name === 'string' ? policy.name : language, language, policy });
  }
  if (engines.length === 0) throw new StructureError('The registry returned no engine policies.');
  return engines;
}

/**
 * The platforms a descriptor getter is evaluated on. A getter may answer from the host
 * (`stopsOnUncaughtWithoutFilter: process.platform !== 'win32'`), and the recorded baseline
 * must not depend on which machine recorded it, so each getter is called once per platform
 * with `process.platform` set to it, and a member set on any of them is used.
 */
const PLATFORMS = ['darwin', 'linux', 'win32'];

function onPlatform(platform, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { ...descriptor, value: platform });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
  }
}

/**
 * Who uses each member. An engine uses a member when its policy object (after every spread
 * and helper has been applied, because this is the object itself) has it set to a value other
 * than `undefined`; for a descriptor switch, when the object its getter returns does, on any
 * platform. `false` is a use except where every read of a boolean member is a truth test
 * (`classifyReads`).
 */
function memberUsage(members, reads, engines) {
  const usersOf = new Map(members.map(member => [member.key, []]));
  const ownKeys = new Map();
  const getters = [...new Set(members.filter(member => member.getter).map(member => member.getter))];
  for (const engine of engines) {
    const results = new Map(getters.map(getter => [getter, []]));
    for (const platform of PLATFORMS) {
      onPlatform(platform, () => {
        for (const getter of getters) {
          const fn = engine.policy[getter];
          if (typeof fn !== 'function') continue;
          try {
            results.get(getter).push(fn.call(engine.policy));
          } catch (error) {
            throw new StructureError(`${engine.name}'s ${getter}() threw when called with no arguments on ${platform}: ${describe(error)}`);
          }
        }
      });
    }
    const isUse = (member, value) => {
      if (value === undefined) return false;
      const stat = reads.get(member.key);
      const falseIsAbsent = member.boolean && stat.reads > 0 && stat.valueReads === 0;
      return !(value === false && falseIsAbsent);
    };
    for (const member of members) {
      const values = member.getter
        ? results.get(member.getter).map(result => (result !== null && typeof result === 'object' ? result[member.field] : undefined))
        : [engine.policy[member.name]];
      if (values.some(value => isUse(member, value))) usersOf.get(member.key).push(engine.name);
    }
    // Keys the engine sets that the contract does not declare: on the policy, or in what a
    // descriptor getter returns.
    const topLevel = new Set(members.filter(member => !member.getter).map(member => member.name));
    const extra = Object.keys(engine.policy).filter(key => !topLevel.has(key));
    for (const [getter, list] of results) {
      const fields = members.descriptorFields.get(getter) ?? new Set();
      for (const result of list) {
        if (result !== null && typeof result === 'object') extra.push(...Object.keys(result).filter(key => !fields.has(key)).map(key => `${getter}().${key}`));
      }
    }
    ownKeys.set(engine.name, [...new Set(extra)]);
  }
  const outside = [...ownKeys].flatMap(([engine, keys]) => keys.map(key => `${engine}: ${key}`));
  return { usersOf, outside };
}

// ---------------------------------------------------------------------------
// Measure 5: language branches outside the policy files
// ---------------------------------------------------------------------------

/**
 * Every place outside the policy files where the core branches on one specific language.
 *
 * A branch is one of:
 *   - an equality comparison (`===`, `!==`, `==`, `!=`) of a language-valued operand with a
 *     specific language, or of anything with a `DebugLanguage.<MEMBER>`;
 *   - a `case` labelled with a specific language under a language-valued `switch`, or labelled
 *     `DebugLanguage.<MEMBER>`;
 *   - a membership test (`.includes`, `.has`, `.indexOf`) on a literal list that names specific
 *     languages, with a language-valued argument (or a list of `DebugLanguage` members);
 *   - an `in` test or an index (`table[language]`) on a table whose keys are languages, with a
 *     language-valued key.
 *
 * A specific language is an expression whose type is one `DebugLanguage` member or one string
 * literal equal to a language id (a `DebugLanguage` value or an engine policy's `name`), so
 * `const engine = 'python'` counts as one. An operand is language-valued when its type is
 * `DebugLanguage` (or a union of language literals), and, where the type was lost on the way:
 * through a cast, through a `const` holding one, through a `string` parameter that some call
 * in the core passes one, or as an `AdapterPolicy`'s `name`. A string that is never a
 * language (`flavour === 'java'`) is not counted.
 */
function findLanguageBranches(an, anchors, languageIds) {
  const { ts, checker } = an;

  const callsByDecl = new Map();
  for (const sf of an.scope) {
    const visit = node => {
      if (ts.isCallExpression(node)) {
        const declaration = checker.getResolvedSignature(node)?.declaration;
        if (declaration) {
          if (!callsByDecl.has(declaration)) callsByDecl.set(declaration, []);
          callsByDecl.get(declaration).push(node);
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }

  const isLanguageMember = type => type.flags & ts.TypeFlags.EnumLiteral && anchors.languageMembers.has(type);
  const specific = expression => {
    const type = checker.getTypeAtLocation(expression);
    if (type.isUnion()) return undefined;
    if (isLanguageMember(type)) return { language: String(type.value), spelling: 'enum' };
    if (type.flags & ts.TypeFlags.StringLiteral && languageIds.has(type.value)) return { language: type.value, spelling: 'string' };
    return undefined;
  };
  const typedAsLanguage = type => {
    const parts = (type.isUnion() ? type.types : [type]).filter(part => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
    if (parts.length === 0) return false;
    if (parts.every(isLanguageMember)) return true;
    return parts.length >= 2 && parts.every(part => part.flags & ts.TypeFlags.StringLiteral && languageIds.has(part.value));
  };

  const memo = new Map();
  const languageValued = (expression, visiting = new Set()) => {
    if (!expression) return undefined;
    if (memo.has(expression)) return memo.get(expression);
    if (visiting.has(expression)) return undefined;
    visiting.add(expression);
    let via;
    if (typedAsLanguage(checker.getTypeAtLocation(expression))) via = 'typed';
    const node = unwrap(ts, expression);
    if (!via && node !== expression && languageValued(node, visiting)) via = 'cast';
    if (!via && ts.isPropertyAccessExpression(node) &&
      checker.getSymbolAtLocation(node.name)?.declarations?.some(decl => anchors.policyNameDecls.has(decl))) via = 'policy name';
    if (!via && ts.isIdentifier(node)) {
      const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
        ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const && languageValued(declaration.initializer, visiting)) {
        via = 'const';
      } else if (declaration && ts.isParameter(declaration) && declaration.parent.body) {
        // `some`, not `every`: a second caller passing a plain string must not make the
        // branch disappear and read as progress.
        const index = declaration.parent.parameters.indexOf(declaration);
        const calls = callsByDecl.get(declaration.parent) ?? [];
        if (calls.some(call => call.arguments[index] && languageValued(call.arguments[index], visiting))) {
          via = 'string parameter';
        }
      }
    }
    visiting.delete(expression);
    memo.set(expression, via);
    return via;
  };

  const constInitializer = node => {
    if (!ts.isIdentifier(node)) return undefined;
    const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
    return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
      ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const ? declaration.initializer : undefined;
  };
  /** The specific languages a literal list names, following a `const` and `new Set([...])`. */
  const listed = expression => {
    let node = unwrap(ts, expression);
    node = unwrap(ts, constInitializer(node) ?? node);
    if (ts.isNewExpression(node) && node.arguments?.length) node = unwrap(ts, node.arguments[0]);
    if (!ts.isArrayLiteralExpression(node)) return [];
    return node.elements.map(element => specific(element)).filter(Boolean);
  };
  /** Does this table have languages as keys? */
  const keyedByLanguage = expression => {
    let node = unwrap(ts, expression);
    node = unwrap(ts, constInitializer(node) ?? node);
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.some(property => {
        const name = property.name;
        if (name && ts.isComputedPropertyName(name)) return Boolean(specific(name.expression));
        const text = nameText(ts, name);
        return text !== undefined && languageIds.has(text);
      });
    }
    return checker.getPropertiesOfType(checker.getApparentType(checker.getTypeAtLocation(expression)))
      .some(property => languageIds.has(property.name));
  };

  const branches = [];
  const add = (node, found, form, textOverride) =>
    branches.push(item(an, node, { language: found.language, spelling: found.spelling, form, via: found.via, ...(textOverride ? { text: textOverride } : {}) }));

  const equality = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken
  ]);
  const branchOn = (candidate, other) => {
    const found = specific(candidate);
    if (!found) return undefined;
    if (found.spelling === 'enum') return { ...found, via: 'enum member' };
    const via = languageValued(other);
    return via ? { ...found, via } : undefined;
  };

  for (const sf of an.scope) {
    if (isPolicyFile(relative(an.root, sf.fileName))) continue;
    const visit = node => {
      if (ts.isBinaryExpression(node) && equality.has(node.operatorToken.kind)) {
        const found = branchOn(node.right, node.left) ?? branchOn(node.left, node.right);
        if (found) add(node, found, 'comparison');
      } else if (ts.isCaseClause(node)) {
        const found = branchOn(node.expression, node.parent.parent.expression);
        if (found) add(node.expression, found, 'case', `case ${printed(ts, node.expression)}:`);
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ['includes', 'has', 'indexOf'].includes(node.expression.name.text) && node.arguments.length > 0) {
        const names = listed(node.expression.expression);
        if (names.length > 0) {
          const via = names.some(found => found.spelling === 'enum') ? 'enum member' : languageValued(node.arguments[0]);
          if (via) add(node, { language: names.map(found => found.language).join(','), spelling: names[0].spelling, via }, 'membership');
        }
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
        const key = specific(node.left) ?? (languageValued(node.left) ? { language: '(language)', spelling: 'typed' } : undefined);
        if (key && keyedByLanguage(node.right)) add(node, { ...key, via: key.spelling === 'enum' ? 'enum member' : languageValued(node.left) ?? 'literal' }, 'in');
      } else if (ts.isElementAccessExpression(node) && keyedByLanguage(node.expression)) {
        const key = specific(node.argumentExpression);
        const via = key?.spelling === 'enum' ? 'enum member' : languageValued(node.argumentExpression) ?? (key ? 'literal' : undefined);
        if (via) add(node, { language: key?.language ?? '(language)', spelling: key?.spelling ?? 'typed', via }, 'index');
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return branches;
}

// ---------------------------------------------------------------------------
// All measures
// ---------------------------------------------------------------------------

/**
 * Count everything.
 *
 * @param {string} root repo root
 */
export async function measure(root) {
  const an = createAnalysisProgram(root);
  const anchors = findAnchors(an);
  const { writers, direct } = findStateWriters(an, anchors);

  const members = contractMembers(an, anchors);
  const reads = classifyReads(an, members);
  const engines = await loadEnginePolicies(an, anchors);
  const { usersOf, outside } = memberUsage(members, reads, engines);

  const languageIds = new Set([...anchors.languageValues, ...engines.map(engine => engine.name)]);
  const branches = findLanguageBranches(an, anchors, languageIds);

  const oneAdapter = members.filter(member => usersOf.get(member.key).length === 1)
    .map(member => ({ key: `${member.key} [${usersOf.get(member.key)[0]}]`, member: member.key, policy: usersOf.get(member.key)[0] }));

  return {
    items: {
      sessionStateWriters: writers,
      directStateWrites: direct,
      policyMembers: members.map(member => ({ key: member.key, users: usersOf.get(member.key) })),
      oneAdapterMembers: oneAdapter,
      languageBranches: branches
    },
    contract: {
      engines: engines.map(engine => engine.name),
      usersOf,
      unread: members.filter(member => reads.get(member.key).reads === 0).map(member => member.key),
      falseIsAbsent: members.filter(member => member.boolean && reads.get(member.key).reads > 0 && reads.get(member.key).valueReads === 0)
        .map(member => member.key),
      falseIsAUse: members.filter(member => member.boolean && !(reads.get(member.key).reads > 0 && reads.get(member.key).valueReads === 0))
        .map(member => member.key),
      outside
    }
  };
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function counts(keys) {
  const map = new Map();
  for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
  return map;
}

/** Items in `a` beyond those in `b`, as a multiset. */
function beyond(a, b) {
  const remaining = counts(b);
  const out = [];
  for (const key of a) {
    if ((remaining.get(key) ?? 0) > 0) remaining.set(key, remaining.get(key) - 1);
    else out.push(key);
  }
  return out;
}

/** The baseline record of one measure: its count, its items, and the growth accepted into it. */
function record(keys, accepted = []) {
  const items = [...keys].sort(byText);
  return { count: items.length, items, accepted };
}

/**
 * Parse and validate a baseline file's text.
 *
 * @throws {StructureError} for anything but a well-formed baseline
 */
export function parseBaseline(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new StructureError(`${BASELINE_FILE} is not valid JSON. ${RESTORE_BASELINE}\n${describe(error)}`);
  }
  const bad = detail => {
    throw new StructureError(`${BASELINE_FILE} ${detail}. ${RESTORE_BASELINE}`);
  };
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) bad('must be a JSON object');
  const expected = MEASURES.map(m => m.id);
  const extra = Object.keys(parsed).filter(key => !expected.includes(key));
  const missing = expected.filter(key => !(key in parsed));
  if (extra.length || missing.length) {
    bad(`must record exactly ${expected.join(', ')}${missing.length ? `; missing ${missing.join(', ')}` : ''}` +
      `${extra.length ? `; unknown ${extra.join(', ')}` : ''}`);
  }
  for (const id of expected) {
    const entry = parsed[id];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) bad(`has a bad '${id}': expected { count, items, accepted }`);
    const keys = Object.keys(entry).sort();
    if (keys.join() !== 'accepted,count,items') bad(`has a bad '${id}': expected exactly count, items and accepted`);
    if (!Array.isArray(entry.items) || entry.items.some(key => typeof key !== 'string' || key === '')) bad(`has a bad '${id}.items'`);
    if (!Number.isInteger(entry.count) || entry.count !== entry.items.length) bad(`has a bad '${id}.count': it must equal the number of items`);
    if (!Array.isArray(entry.accepted) || entry.accepted.some(a => a === null || typeof a !== 'object' ||
      typeof a.item !== 'string' || typeof a.reason !== 'string' || a.reason.trim() === '' || Object.keys(a).length !== 2)) {
      bad(`has a bad '${id}.accepted': expected [{ item, reason }]`);
    }
    if (beyond(entry.accepted.map(a => a.item), entry.items).length > 0) bad(`has a bad '${id}.accepted': it names an item the measure does not record`);
  }
  return parsed;
}

/** One measure: tree against baseline. */
export function compareItems(currentKeys, recordedKeys) {
  const added = beyond(currentKeys, recordedKeys).sort(byText);
  const removed = beyond(recordedKeys, currentKeys).sort(byText);
  const delta = currentKeys.length - recordedKeys.length;
  const outcome = delta > 0 ? 'growth' : delta < 0 ? 'reduction' : added.length || removed.length ? 'change' : 'same';
  return { outcome, added, removed, delta };
}

function serialize(baseline) {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** An item for a message: located items with every place that has this key. */
function describeItem(m, measurement, key) {
  const entries = measurement.items[m.id].filter(candidate => candidate.key === key);
  if (entries.length === 0) return key;
  const [entry] = entries;
  if (m.id === 'policyMembers') return `${key}  (used by: ${entry.users.join(', ') || 'no engine'})`;
  if (m.id === 'oneAdapterMembers') return `${entry.member}: used only by ${entry.policy}`;
  return `${entries.map(e => `${e.file}:${e.line}`).join(', ')}  ${key}`;
}

function describeEntry(m, entry) {
  if (m.id === 'policyMembers') return `${entry.key}  (used by: ${entry.users.join(', ') || 'no engine'})`;
  if (m.id === 'oneAdapterMembers') return `${entry.member}: used only by ${entry.policy}`;
  return `${entry.file}:${entry.line}  ${entry.key}${entry.via ? `  [${entry.form}; ${entry.via}]` : entry.direct ? '  [direct]' : ''}`;
}

function summaryLine(m, measurement) {
  const items = measurement.items[m.id];
  if (m.id !== 'oneAdapterMembers') return `structure: ${m.label}: ${items.length}`;
  const split = {};
  for (const { policy } of items) split[policy] = (split[policy] ?? 0) + 1;
  const parts = Object.entries(split).sort((a, b) => b[1] - a[1] || byText(a[0], b[0]));
  return `structure: ${m.label}: ${items.length}${parts.length ? ` (${parts.map(([p, n]) => `${p} ${n}`).join(', ')})` : ''}`;
}

function report(m, measurement, comparison, recordedCount) {
  const { outcome, added, removed, delta } = comparison;
  const now = measurement.items[m.id].length;
  const lines = [];
  if (outcome === 'growth') {
    lines.push(`structure: ${m.label}: ${recordedCount} recorded, ${now} now. It grew by ${delta}.`);
    for (const key of added) lines.push(`  new:  ${describeItem(m, measurement, key)}`);
    for (const key of removed) lines.push(`  gone: ${key}`);
    lines.push(`  ${m.advice}`);
  } else if (outcome === 'reduction') {
    lines.push(`structure: ${m.label}: ${recordedCount} recorded, ${now} now. ${-delta} fewer.`);
    for (const key of removed) lines.push(`  gone: ${key}`);
    for (const key of added) lines.push(`  new:  ${describeItem(m, measurement, key)}`);
  } else if (outcome === 'change') {
    lines.push(`structure: ${m.label}: ${now}, unchanged. Nothing grew; ${added.length} recorded item(s) moved, were renamed or changed:`);
    for (const key of removed) lines.push(`  was: ${key}`);
    for (const key of added) lines.push(`  now: ${describeItem(m, measurement, key)}`);
  }
  return lines;
}

function listing(measurement) {
  const lines = [];
  for (const m of MEASURES) {
    const items = measurement.items[m.id];
    lines.push(`${m.label} (${items.length}):`);
    for (const entry of items) lines.push(`  ${describeEntry(m, entry)}`);
  }
  const { contract } = measurement;
  lines.push(`engines: ${contract.engines.join(', ')}`);
  lines.push(`members no read in the core resolves to (${contract.unread.length}): ${contract.unread.join(', ') || '-'}`);
  lines.push(`boolean members whose false behaves as absent (${contract.falseIsAbsent.length}): ${contract.falseIsAbsent.join(', ') || '-'}`);
  lines.push(`boolean members whose false is a use (${contract.falseIsAUse.length}): ${contract.falseIsAUse.join(', ') || '-'}`);
  lines.push(`policy keys outside the contract (${contract.outside.length}): ${contract.outside.join(', ') || '-'}`);
  return lines;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = { update: false, init: false, list: false, reason: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--update') options.update = true;
    else if (arg === '--init') options.init = true;
    else if (arg === '--list') options.list = true;
    else if (arg === '--accept-growth') options.reason = argv[++i] ?? '';
    else if (arg.startsWith('--accept-growth=')) options.reason = arg.slice('--accept-growth='.length);
    else return { error: `Unknown argument: ${arg}` };
  }
  if (options.reason !== undefined && !options.update) return { error: '--accept-growth only means something with --update.' };
  if (options.reason !== undefined && options.reason.trim() === '') return { error: '--accept-growth needs a reason: --accept-growth "<why>".' };
  if (options.update && options.init) return { error: '--init writes a first baseline; --update changes an existing one. Pick one.' };
  return { options };
}

/**
 * Run the gate on a repo root. Never exits the process: the caller prints and exits.
 *
 * @param {string} root
 * @param {string[]} argv
 * @returns {Promise<{ code: 0 | 1 | 2, stdout: string, stderr: string }>}
 */
export async function run(root, argv) {
  const out = [];
  const err = [];
  const done = code => ({ code, stdout: out.length ? `${out.join('\n')}\n` : '', stderr: err.length ? `${err.join('\n')}\n` : '' });
  const fail = message => {
    err.push(`structure: ${message}`);
    return done(2);
  };

  const parsedArgs = parseArgs(argv);
  if (parsedArgs.error) {
    return fail(`${parsedArgs.error} Usage: node scripts/check-structure.mjs [--list] [--init | --update [--accept-growth "<why>"]]`);
  }
  const { options } = parsedArgs;
  const file = path.join(root, BASELINE_FILE);

  let measurement;
  try {
    measurement = await measure(root);
  } catch (error) {
    if (error instanceof StructureError) return fail(`the analysis could not be done. ${error.message}`);
    throw error;
  }
  if (options.list) out.push(...listing(measurement), '');

  const keysOf = id => measurement.items[id].map(entry => entry.key);

  if (options.init) {
    if (fs.existsSync(file)) return fail(`${BASELINE_FILE} exists; --init only writes a first one. Use --update.`);
    const baseline = Object.fromEntries(MEASURES.map(m => [m.id, record(keysOf(m.id))]));
    fs.writeFileSync(file, serialize(baseline));
    for (const m of MEASURES) out.push(summaryLine(m, measurement));
    out.push(`structure: first baseline recorded in ${BASELINE_FILE}.`);
    return done(0);
  }

  if (!fs.existsSync(file)) return fail(`Missing ${BASELINE_FILE}. A first one is written with: node scripts/check-structure.mjs --init`);
  let baseline;
  try {
    baseline = parseBaseline(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    if (error instanceof StructureError) return fail(error.message);
    throw error;
  }

  const comparisons = MEASURES.map(m => ({ m, ...compareItems(keysOf(m.id), baseline[m.id].items) }));
  const grown = comparisons.filter(c => c.outcome === 'growth');
  const reduced = comparisons.filter(c => c.outcome === 'reduction');
  const changed = comparisons.filter(c => c.outcome === 'change');

  if (options.update) {
    if (grown.length > 0 && options.reason === undefined) {
      err.push('');
      for (const c of grown) err.push(...report(c.m, measurement, c, baseline[c.m.id].count), '');
      err.push(
        `structure: --update records reductions and changes only, and the counts above grew, so nothing\n` +
        `was written. Growth is structural debt: remove it if you can. If it is unavoidable, accept it\n` +
        `with a reason; each accepted item and the reason are written into the baseline, so the pull\n` +
        `request's diff shows both:\n  ${ACCEPT_COMMAND}`
      );
      return done(1);
    }
    if (options.reason !== undefined && grown.length === 0) {
      return fail('--accept-growth was given, but nothing grew. Run --update without it.');
    }
    const next = {};
    for (const c of comparisons) {
      const current = keysOf(c.m.id);
      const kept = [];
      const available = counts(current);
      for (const accepted of baseline[c.m.id].accepted) {
        if ((available.get(accepted.item) ?? 0) > 0) {
          available.set(accepted.item, available.get(accepted.item) - 1);
          kept.push(accepted);
        }
      }
      const newlyAccepted = c.outcome === 'growth' ? c.added.map(key => ({ item: key, reason: options.reason.trim() })) : [];
      next[c.m.id] = record(current, [...kept, ...newlyAccepted].sort((a, b) => byText(a.item, b.item) || byText(a.reason, b.reason)));
      if (c.outcome !== 'same') {
        out.push(`structure: ${c.m.label}: ${baseline[c.m.id].count} -> ${current.length} (${c.outcome}).`);
        for (const accepted of newlyAccepted) out.push(`  accepted: ${describeItem(c.m, measurement, accepted.item)}\n    reason: ${accepted.reason}`);
        if (newlyAccepted.length > 0 && c.removed.length > 0) {
          out.push(
            `  note: ${c.removed.length} recorded item(s) are gone in the same change, so ${newlyAccepted.length} item(s) are new to\n` +
            `  the baseline for a growth of ${c.delta}. The count cannot tell a rename from a new item, so the reason\n` +
            `  is recorded against all of them; if one is only a rename, delete its 'accepted' entry.`
          );
        }
      }
    }
    fs.writeFileSync(file, serialize(next));
    if (grown.length + reduced.length + changed.length === 0) out.push('structure: nothing changed; the baseline is rewritten as it was.');
    out.push(`structure: baseline recorded in ${BASELINE_FILE}.`);
    return done(0);
  }

  for (const c of grown) err.push(...report(c.m, measurement, c, baseline[c.m.id].count), '');
  for (const c of reduced) err.push(...report(c.m, measurement, c, baseline[c.m.id].count), '');
  for (const c of changed) err.push(...report(c.m, measurement, c, baseline[c.m.id].count), '');

  if (grown.length > 0) {
    err.push(
      `Growth is the one result that adds structural debt; the note under each measure says what to do\n` +
      `instead. If the growth is unavoidable, accept it with a reason, which is written into the baseline\n` +
      `beside the items so the pull request's diff shows both:\n  ${ACCEPT_COMMAND}`
    );
  }
  if (reduced.length > 0) {
    err.push(
      `${grown.length ? '\n' : ''}Fewer items is progress. Re-record it in this pull request so the recorded counts stay true:\n` +
      `  ${UPDATE_COMMAND}`
    );
  }
  if (grown.length > 0 || reduced.length > 0) return done(1);

  if (changed.length > 0) {
    err.push(`Nothing grew. Re-record to keep the item lists current: ${UPDATE_COMMAND}`);
  }
  for (const m of MEASURES) out.push(summaryLine(m, measurement));
  return done(0);
}

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

if (isMain(import.meta.url)) {
  let result;
  try {
    result = await run(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), process.argv.slice(2));
  } catch (error) {
    // A crash is a check that could not run, never a ratchet result.
    result = { code: 2, stdout: '', stderr: `structure: the check crashed.\n${error instanceof Error ? error.stack : String(error)}\n` };
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}
