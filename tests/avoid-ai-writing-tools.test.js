'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const vm = require('node:vm');

const skill = path.resolve(__dirname, '..');
const validatorPath = path.join(skill, 'detector/validate.js');
const { validate, maskCode, extractIndentedBlocks } = require(validatorPath);
const { normalize } = require(path.join(skill, 'scripts/normalize-quotes.js'));
const { check: checkStyle } = require(path.join(skill, 'scripts/check-style.js'));
const { analyzeText } = require(path.join(skill, 'detector/patterns.js'));
const detectorContext = ' We checked the door and replaced the hinge. It opens freely now. The paint has dried, and the latch meets the frame. The room is ready for use.';
const check = (original, rewritten, options = {}) => validate(original, rewritten, { skipResidual: true, ...options });
const codes = (findings) => findings.map(({ code }) => code);
const rejects = (original, rewritten, code) => {
  const result = check(original, rewritten);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes(code), JSON.stringify(result));
};

test('closed YAML frontmatter retains BOM, alternate close, and CRLF protection', () => {
  for (const bom of ['', '\uFEFF']) {
    for (const close of ['---', '...']) {
      for (const newline of ['\n', '\r\n']) {
        const original = `${bom}---${newline}title: Original${newline}${close}${newline}Body stays.`;
        rejects(original, original.replace('Original', 'Changed'), 'frontmatter-modified');
        assert.equal(check(original, original).ok, true);
        assert.equal(check(original, original.replace(/\r\n/g, '\n')).ok, true);
        assert.equal(check(original, original.replace('Body stays.', 'Body reads clearly.')).ok, true);
      }
    }
  }
});

test('thematic breaks and unclosed metadata-like headers remain editable prose', () => {
  for (const original of [
    '---\nOriginal prose.\n---\nBody stays.',
    '---\n\nOriginal prose.\n---\nBody stays.',
    '---\ntitle: Original\nBody stays.',
  ]) {
    const result = check(original, original.replace('Original', 'Changed'));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(!codes(result.errors).includes('frontmatter-modified'));
  }
});

test('realistic YAML mappings preserve comments, quoted keys, and nested array values', () => {
  for (const content of [
    '\n# Metadata\n"title": “Original”',
    "'title': Original",
    'title: Original\ntags:\n  - first\n  - second',
    'title: Original\noptions:\n  nested: true',
  ]) {
    for (const newline of ['\n', '\r\n']) {
      const original = `\uFEFF---\n${content}\n...\nBody stays.`.replace(/\n/g, newline);
      rejects(original, original.replace('Original', 'Changed'), 'frontmatter-modified');
      assert.equal(check(original, original.replace('Body stays.', 'Body reads clearly.')).ok, true);
      assert.equal(normalize(original, 'straight'), original);
      assert.deepEqual(checkStyle(original, { quotes: 'straight' }).hard, []);
    }
  }
});

test('normalizer and style checker inspect prose between thematic breaks and unclosed headers', () => {
  for (const original of [
    '---\n“Ordinary prose.”\n---\nBody stays.',
    '\uFEFF---\r\n“Ordinary prose.”\r\n...\r\nBody stays.',
    '---\n\n“Ordinary prose.”\n---\nBody stays.',
    '---\ntitle: “Ordinary prose.”\nBody stays.',
  ]) {
    assert.equal(normalize(original, 'straight'), original.replace(/[“”]/g, '"'));
    assert.equal(checkStyle(original, { quotes: 'straight' }).hard.length, 1);
    assert.equal(checkStyle(normalize(original, 'straight'), { quotes: 'straight' }).hard.length, 0);
  }
});

test('inline code protects exact matching runs, embedded ticks, and wrapped spans', () => {
  for (const code of ['`original`', '``a`original``', '```a``original```', '`original\ncode`', '``original\n`code``']) {
    const original = `Body ${code} remains.\nProse reads well.`;
    rejects(original, original.replace('original', 'changed'), 'inline-code-missing');
    assert.equal(check(original, original).ok, true);
    assert.equal(check(original, original.replace('Prose reads well.', 'Prose reads clearly.')).ok, true);
  }
  assert.equal(maskCode('A `first\nsecond` B'), 'A       \n        B');
  rejects('Body \\``original` remains.', 'Body \\``changed` remains.', 'inline-code-missing');
  rejects('Body `original\\` remains.', 'Body `changed\\` remains.', 'inline-code-missing');
});

test('unmatched and escaped delimiters do not protect prose or cross Markdown blocks', () => {
  for (const original of [
    'Body `original remains.',
    'Body ``original` remains.',
    'Body \\`original\\` remains.',
    'Body `original.\n\nNext paragraph ends` here.',
    'Body `original.\n# Next heading ends` here.',
    'Body `original.\n---\nNext paragraph ends` here.',
    'Body `original.\n- Next item ends` here.',
    'Body `original.\n```js\nconst n = 1;\n```\nNext paragraph ends` here.',
  ]) {
    assert.equal(check(original, original.replace('original', 'changed')).ok, true, original);
  }
});

test('fences retain marker and run-length protection independently of inline spans', () => {
  const original = 'Body `label` remains.\n\n````md\n```js\nconst original = 1;\n```\n````\nFinal prose.';
  rejects(original, original.replace('const original', 'const changed'), 'code-block-modified');
  assert.equal(check(original, original.replace('Final prose.', 'Final words.')).ok, true);
  const unclosed = '~~~js\nconst original = 1;';
  rejects(unclosed, unclosed.replace('original', 'changed'), 'code-block-modified');
  const inlineTriple = '```original``` begins this paragraph.\nProse follows.';
  rejects(inlineTriple, inlineTriple.replace('original', 'changed'), 'inline-code-missing');
  assert.equal(check(inlineTriple, inlineTriple.replace('Prose follows.', 'Words follow.')).ok, true);
});

test('indented code changes warn while list continuations and paragraph indentation remain prose', () => {
  for (const indent of ['    ', '        ', '\t', ' \t']) {
    const original = `Paragraph stays.\n\n${indent}original();\n\n${indent}second();\n\nProse follows.`;
    const result = check(original, original.replace('original', 'changed'));
    assert.equal(result.ok, true);
    assert.ok(codes(result.warnings).includes('indented-code-modified'), JSON.stringify(result));
    assert.equal(extractIndentedBlocks(original).length, 1);
    assert.equal(check(original, original).warnings.length, 0);
  }
  for (const original of [
    '- List item.\n\n    original prose continues.',
    '1. List item.\n\n    original prose continues.',
    '- List item.\n  prose continues.\n\n    original prose continues.',
    'Paragraph starts.\n    original prose continues.',
  ]) {
    const result = check(original, original.replace('original', 'changed'));
    assert.equal(result.ok, true);
    assert.ok(!codes(result.warnings).includes('indented-code-modified'), JSON.stringify(result));
    assert.equal(extractIndentedBlocks(original).length, 0);
  }
  assert.equal(extractIndentedBlocks('```js\n    original();\n```').length, 0);
});

test('home-relative paths are preserved alongside the existing filesystem path forms', () => {
  for (const target of ['~/folder/file.md', '/folder/file.md', './folder/file.md', '../folder/file.md', 'C:\\folder\\file.md']) {
    const original = `Open ${target} to read the file.`;
    rejects(original, original.replace('file.md', 'other.md'), 'path-missing');
    assert.equal(check(original, original).ok, true);
  }
});

test('documented AI tracking fields can be stripped without altering functional URL fields', () => {
  const fields = [];
  for (const source of ['chatgpt', 'openai', 'copilot', 'claude', 'grok', 'gemini', 'perplexity']) {
    for (const suffix of ['', '.com', '.ai']) fields.push(`utm_source=${source}${suffix}`);
  }
  fields.push('utm_source=gemini.google.com');
  for (const source of ['chatgpt', 'copilot', 'grok', 'claude', 'gemini', 'perplexity']) {
    for (const suffix of ['.com', '.ai']) fields.push(`referrer=${source}${suffix}`);
  }
  for (const field of fields) {
    const original = `Read https://example.com/docs?mode=full&${field}#intro for details.`;
    const rewritten = 'Read https://example.com/docs?mode=full#intro for details.';
    assert.ok(analyzeText(original + detectorContext).issues.some(({ type }) => type === 'ai-utm-source'), field);
    assert.equal(check(original, rewritten).ok, true, field);
    assert.equal(check(original, original).ok, true);
  }
  for (const field of ['utm_source=claude.com.evil', 'utm_source=claude.com%2Fevil', 'utm_campaign=claude.com', 'referrer=openai.com', 'utm_source=newsletter']) {
    rejects(`Read https://example.com/?${field} for details.`, 'Read https://example.com/ for details.', 'url-missing');
  }
  rejects('Read https://example.com/?mode=full&utm_source=claude.com for details.', 'Read https://example.com/?mode=brief for details.', 'url-missing');
});

test('residual policy and mechanical preservation remain separate', () => {
  const detector = {
    analyzeText(text) {
      return { issues: text.includes('added') ? [{}] : [], score: 0 };
    },
  };
  const blocked = validate('Original prose.', 'Original prose added.', { detector });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.preservation.ok, true);
  assert.deepEqual(codes(blocked.errors), ['residual-grew']);
  const advisory = validate('Original prose.', 'Original prose added.', { detector, residualPolicy: 'warn' });
  assert.equal(advisory.ok, true);
  assert.deepEqual(codes(advisory.warnings), ['residual-grew']);
  const damaged = validate('Keep `original`.', 'Keep `changed` added.', { detector, residualPolicy: 'warn' });
  assert.equal(damaged.ok, false);
  assert.equal(damaged.preservation.ok, false);
  assert.ok(codes(damaged.errors).includes('inline-code-missing'));
});

test('validator CLI returns 0 for preserved content, 1 for damage, and 2 for invalid usage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avoid-ai-writing-'));
  try {
    const original = path.join(dir, 'original.md');
    const rewritten = path.join(dir, 'rewritten.md');
    fs.writeFileSync(original, '\uFEFF---\ntitle: Original\n...\nBody remains.');
    fs.copyFileSync(original, rewritten);
    const run = (...args) => spawnSync(process.execPath, [validatorPath, ...args], { encoding: 'utf8' });
    assert.equal(run('--residual-policy', 'warn', original, rewritten).status, 0);
    fs.writeFileSync(rewritten, '\uFEFF---\ntitle: Changed\n...\nBody remains.');
    const damaged = run('--residual-policy', 'warn', original, rewritten);
    assert.equal(damaged.status, 1);
    assert.match(damaged.stdout, /frontmatter-modified/);
    assert.equal(run().status, 2);
    assert.equal(run('--residual-policy', 'invalid', original, rewritten).status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('validator loads in a browser VM without Node dependencies', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(validatorPath, 'utf8'), context, { filename: validatorPath });
  const result = vm.runInContext('AIDetectorValidate.validate("Body ``a`b`` remains.", "Body ``a`c`` remains.", { skipResidual: true })', context);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('inline-code-missing'));
  assert.equal(vm.runInContext('AIDetectorValidate.validate("Prose stays.", "Prose stays.").quality.status', context), 'unavailable');
});

test('selected detector prose rules mask wrapped code and retain findings in editable prose', () => {
  const findings = (source, type) => analyzeText(source + detectorContext).issues.filter((issue) => issue.type === type);
  for (const source of [
    'Body `code-base\ncontinues` remains.',
    'Body ``code-base`\ncontinues`` remains.',
    '```code-base``` starts this paragraph.',
    '````md\n```js\ncode-base\n```\n````',
    '~~~js\ncode-base',
  ]) {
    assert.deepEqual(findings(source, 'unnecessary-hyphenation'), [], source);
    const changedCode = source.replace('code-base', 'data-set');
    assert.deepEqual(findings(changedCode, 'unnecessary-hyphenation'), [], changedCode);
    assert.equal(findings(source + '\nThe code-base exists.', 'unnecessary-hyphenation').length,
      source.startsWith('~~~') ? 0 : 1, source);
  }
  for (const source of [
    'Body `code-base remains.',
    'Body ``code-base` remains.',
    'Body `code-base.\n\nNext paragraph ends` here.',
    'Body `code-base.\n# Next heading ends` here.',
    'Body `code-base.\n- Next item ends` here.',
  ]) assert.equal(findings(source, 'unnecessary-hyphenation').length, 1, source);
  assert.deepEqual(findings('Body `#one #two #three\n#four #five #six` remains.', 'hashtag-stuff'), []);
  assert.equal(findings('Body #one #two #three\n#four #five #six remains.', 'hashtag-stuff').length, 1);
  assert.equal(findings('- A list item.\n\n    #one #two #three #four #five #six', 'hashtag-stuff').length, 1);
  assert.deepEqual(findings('---\nTitle: code-base\n...\nBody stays.', 'unnecessary-hyphenation'), []);
});

test('rendered detector source mode recognizes dot-closed mapping metadata and retains source offsets', () => {
  for (const bom of ['', '\uFEFF']) {
    for (const newline of ['\n', '\r\n']) {
      for (const close of ['---', '...']) {
        const source = `${bom}---\n\n# Metadata\n"title": delve into the topic\n${close}\nBody stays.${detectorContext}`.replace(/\n/g, newline);
        const result = analyzeText(source, { sourceMode: 'rendered-markdown' });
        assert.equal(result.stats.maskedFrontmatter, 1);
        assert.ok(!result.issues.some(({ text }) => /delve/.test(text)));
        assert.equal(analyzeText(source.replace('delve', 'leverage'), { sourceMode: 'rendered-markdown' }).stats.maskedFrontmatter, 1);
        const withUrl = `${source}\nRead https://example.com?utm_source=claude.com for details.`;
        const tracker = analyzeText(withUrl, { sourceMode: 'rendered-markdown' }).issues.find(({ type }) => type === 'ai-utm-source');
        assert.ok(tracker);
        assert.equal(tracker.index, withUrl.indexOf('?utm_source=claude.com'));
      }
    }
  }
  for (const source of [
    '---\nWe delve into the topic.\n---\nBody stays.',
    '---\ntitle: delve into the topic\nBody stays.',
  ]) {
    const result = analyzeText(source + detectorContext, { sourceMode: 'rendered-markdown' });
    assert.equal(result.stats.maskedFrontmatter, 0);
    assert.ok(result.issues.some(({ type, text }) => type === 'tier1' && /delve/.test(text)));
  }
  // Plain/default vocabulary scoring is deliberately broader than prose-rule masks.
  assert.ok(analyzeText('Body `delve\ninto the topic` remains.' + detectorContext).issues.some(({ type }) => type === 'tier1'));
});

test('detector retains its browser-loadable API and selected prose-rule masks', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(skill, 'detector/patterns.js'), 'utf8'), context);
  const source = 'Body `code-base\ncontinues` remains.' + detectorContext;
  const result = vm.runInContext(`AIDetector.analyzeText(${JSON.stringify(source)})`, context);
  assert.ok(!result.issues.some(({ type }) => type === 'unnecessary-hyphenation'));
  assert.equal(typeof result.stats.wordCount, 'number');
});
