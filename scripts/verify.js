#!/usr/bin/env node
'use strict';

// Offline package checks and runtime probes. Native regression tests run
// separately through npm test, so relocated-package tests cannot recurse.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'SKILL.md', 'README.md', 'LICENSE', 'NOTICE.md', 'provenance.json',
  'package.json', 'agents/openai.yaml', 'references/patterns.md',
  'references/headlines.md', 'detector/CATEGORIES.md', 'detector/patterns.js',
  'detector/validate.js', 'scripts/check-style.js', 'scripts/markdown-prose.js',
  'scripts/normalize-quotes.js', 'scripts/verify.js', 'examples/README.md',
  'examples/prose.json', 'examples/technical.json',
  'tests/avoid-ai-writing-tools.test.js', 'tests/package.test.js',
];
const runtimeFiles = [
  'detector/patterns.js', 'detector/validate.js', 'scripts/check-style.js',
  'scripts/markdown-prose.js', 'scripts/normalize-quotes.js',
];
const requireCheck = (condition, message) => {
  if (!condition) throw new Error(message);
};
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function readJson(name) {
  let value;
  try { value = JSON.parse(read(name)); }
  catch (error) { throw new Error(`${name}: invalid or unreadable JSON (${error.message})`); }
  requireCheck(isObject(value), `${name}: expected a JSON object`);
  return value;
}

function checkPackage() {
  for (const name of ['agents', 'detector', 'examples', 'references', 'scripts', 'tests']) {
    const location = path.join(root, name);
    requireCheck(fs.existsSync(location) && fs.lstatSync(location).isDirectory()
      && !fs.lstatSync(location).isSymbolicLink(), `${name}: missing package directory or replaced by symlink`);
  }
  for (const name of requiredFiles) {
    const location = path.join(root, name);
    requireCheck(fs.existsSync(location) && fs.lstatSync(location).isFile()
      && !fs.lstatSync(location).isSymbolicLink() && fs.statSync(location).size > 0,
    `${name}: missing, empty, or replaced by symlink`);
  }

  const provenance = readJson('provenance.json');
  requireCheck(provenance.schema_version === 1, 'provenance.json: unsupported schema_version');
  requireCheck(provenance.package === 'avoid-ai-writing', 'provenance.json: package name mismatch');
  requireCheck(typeof provenance.imported_version === 'string' && /^\d+\.\d+\.\d+$/.test(provenance.imported_version),
    'provenance.json: imported_version must identify the upstream release');
  requireCheck(Number.isInteger(provenance.local_revision) && provenance.local_revision >= 1,
    'provenance.json: local_revision must be a positive integer');
  for (const [key, repository] of [
    ['immediate_source', 'https://github.com/salexandr0s/avoid-ai-writing'],
    ['canonical_source', 'https://github.com/conorbronsdon/avoid-ai-writing'],
  ]) {
    const source = provenance[key];
    requireCheck(isObject(source) && source.repository === repository,
      `provenance.json: unexpected or missing ${key} repository`);
    requireCheck(typeof source.commit === 'string' && /^[0-9a-f]{40}$/.test(source.commit),
      `provenance.json: ${key} must pin a full commit`);
  }
  requireCheck(Array.isArray(provenance.local_modifications) && provenance.local_modifications.length > 0,
    'provenance.json: local modifications must be documented');
  for (const modification of provenance.local_modifications) {
    requireCheck(isObject(modification) && typeof modification.area === 'string' && modification.area.trim()
      && typeof modification.changes === 'string' && modification.changes.trim(),
    'provenance.json: each local modification needs an area and description');
  }
  requireCheck(isObject(provenance.protected_files), 'provenance.json: protected_files must be an object');
  for (const name of ['LICENSE', 'NOTICE.md']) {
    const record = provenance.protected_files[name];
    requireCheck(isObject(record) && record.algorithm === 'sha256'
      && typeof record.sha256 === 'string' && /^[0-9a-f]{64}$/.test(record.sha256),
    `provenance.json: ${name} must declare a valid SHA-256 hash`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
    requireCheck(actual === record.sha256, `${name}: protected license/notice hash mismatch`);
  }

  const manifest = readJson('package.json');
  requireCheck(manifest.name === 'avoid-ai-writing' && manifest.version === provenance.imported_version,
    'package.json: name/version must match provenance');
  requireCheck(manifest.license === 'MIT', 'package.json: MIT license declaration missing');
  requireCheck(isObject(manifest.engines) && manifest.engines.node === '>=18',
    'package.json: Node.js >=18 engine declaration missing');
  requireCheck(isObject(manifest.scripts) && manifest.scripts.verify === 'node scripts/verify.js',
    'package.json: portable verify entrypoint missing');
  requireCheck(manifest.scripts.test === 'node --test tests/avoid-ai-writing-tools.test.js tests/package.test.js',
    'package.json: native test entrypoint missing');
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    requireCheck(manifest[key] === undefined || (isObject(manifest[key]) && Object.keys(manifest[key]).length === 0),
      `package.json: ${key} would add an installation requirement to offline verification`);
  }

  const header = read('SKILL.md').match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  requireCheck(header !== null, 'SKILL.md: missing frontmatter');
  const fields = Object.fromEntries([...header[1].matchAll(/^([a-z_]+):[ \t]*(.+)$/gm)]
    .map(([, key, value]) => [key, value.replace(/\r$/, '').trim()]));
  requireCheck(fields.name === 'avoid-ai-writing', 'SKILL.md: name mismatch');
  requireCheck(fields.version === provenance.imported_version, 'SKILL.md: version must match provenance');
  requireCheck(fields.license === 'MIT', 'SKILL.md: MIT license declaration missing');
  requireCheck(Boolean(fields.description), 'SKILL.md: description missing');
  const metadata = read('agents/openai.yaml');
  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    requireCheck(new RegExp(`^  ${field}:[ \\t]*\\S.+$`, 'm').test(metadata),
      `agents/openai.yaml: missing ${field}`);
  }
  requireCheck(/^  allow_implicit_invocation: false[ \t]*$/m.test(metadata),
    'agents/openai.yaml: explicit invocation policy changed');
  for (const name of ['prose', 'technical']) {
    const config = readJson(`examples/${name}.json`);
    requireCheck(isObject(config.mechanics), `examples/${name}.json: mechanics must be an object`);
    requireCheck(Array.isArray(config.register) && config.register.every((item) => typeof item === 'string'),
      `examples/${name}.json: register must be an array of strings`);
  }
}

function checkSyntax() {
  for (const name of runtimeFiles) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, name)], {
      cwd: root, encoding: 'utf8', timeout: 30000,
    });
    requireCheck(!result.error && result.status === 0,
      `${name}: JavaScript syntax check failed\n${result.error ? result.error.message : (result.stderr || result.stdout).trim()}`);
  }
}

function checkRuntime() {
  const detector = require(path.join(root, 'detector/patterns.js'));
  const validator = require(path.join(root, 'detector/validate.js'));
  const style = require(path.join(root, 'scripts/check-style.js'));
  const normalizer = require(path.join(root, 'scripts/normalize-quotes.js'));
  const noisy = detector.analyzeText('In order to leverage robust solutions, it is important to note the future looks bright.');
  assert.ok(noisy.issues.length > 0, 'detector must flag known patterns');
  assert.equal(detector.analyzeText('Open the file.').issues.length, 0, 'simple instruction must stay clean');
  const original = '# Sync notes\n\nUse the existing process for 7 files.\n\n`node --version`\n';
  const rewritten = '# Sync notes\n\nCheck the current process for 7 files.\n\n`node --version`\n';
  assert.ok(validator.validate(original, rewritten, { residualPolicy: 'warn' }).ok, 'preserved rewrite must pass');
  assert.ok(validator.validate(original, rewritten.replace('7', '8'), { residualPolicy: 'warn' }).warnings
    .some(({ code }) => code === 'number-missing'), 'number changes must be reported for review');
  assert.equal(validator.validate(original, rewritten.replace('node --version', 'node --help'), { residualPolicy: 'warn' }).ok,
    false, 'code damage must fail');
  for (const name of ['prose', 'technical']) {
    const configPath = style.resolveConfig(name);
    assert.equal(configPath, path.join(root, 'examples', `${name}.json`), 'house-style examples must resolve within this checkout');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const result = style.check('Open the file.', config.mechanics);
    assert.equal(result.hard.length, 0, `${name} mechanics must accept plain prose`);
    assert.equal(result.warnings.length, 0, `${name} mechanics must be recognized`);
  }
  assert.ok(style.check('“Quoted text” e.g. an example.', { quotes: 'straight', latinAbbrev: 'never' }).hard.length >= 2,
    'style violations must be visible');
  assert.equal(style.check('`“quoted” e.g.`', { quotes: 'straight', latinAbbrev: 'never' }).hard.length, 0, 'style must ignore code');
  const source = '“Editable prose.”\n\n```js\nconst x = "“protected”";\n```\n';
  const expected = '"Editable prose."\n\n```js\nconst x = "“protected”";\n```\n';
  assert.equal(normalizer.normalize(source, 'straight'), expected, 'normalizer must retain code');
  assert.equal(normalizer.normalize(expected, 'straight'), expected, 'normalizer must be idempotent');
}

function main() {
  if (process.argv.length > 2) {
    console.error('usage: node scripts/verify.js');
    process.exitCode = 2;
    return;
  }
  try {
    requireCheck(Number(process.versions.node.split('.')[0]) >= 18, `Node.js 18 or newer is required; found ${process.version}`);
    checkPackage();
    console.log('PASS: package inventory, metadata, provenance, protected notices, and example JSONs');
    checkSyntax();
    console.log('PASS: syntax checks for all five bundled JavaScript files');
    try { checkRuntime(); }
    catch (error) { throw new Error(`runtime smoke checks: ${error.message}`); }
    console.log('PASS: detector, preservation validator, house-style examples, and quote normalizer smoke checks');
    console.log('Editorial title quality and semantic fidelity still require source review. Run npm test for native regressions.');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
