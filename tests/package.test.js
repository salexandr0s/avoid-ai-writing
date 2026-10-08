'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const sourceRoot = path.resolve(__dirname, '..');

function snapshot(directory) {
  const files = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) walk(location);
      else if (entry.isFile()) files[path.relative(directory, location)] = crypto.createHash('sha256')
        .update(fs.readFileSync(location)).digest('hex');
      else files[path.relative(directory, location)] = fs.readlinkSync(location);
    }
  };
  walk(directory);
  return files;
}

function withCheckout(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'avoid-ai-writing-package-'));
  try {
    const checkout = path.join(temp, 'relocated checkout with spaces');
    const unrelated = path.join(temp, 'unrelated cwd');
    const home = path.join(temp, 'isolated home');
    fs.mkdirSync(unrelated);
    fs.mkdirSync(home);
    fs.writeFileSync(path.join(home, 'keep.txt'), 'User content stays unchanged.');
    fs.cpSync(sourceRoot, checkout, {
      recursive: true,
      filter: (source) => !['.git', 'node_modules', 'SESSION_HANDOFF.md'].includes(path.relative(sourceRoot, source).split(path.sep)[0]),
    });
    const verify = () => spawnSync(process.execPath, [path.join(checkout, 'scripts/verify.js')], {
      cwd: unrelated, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, HOME: home, USERPROFILE: home, PATH: '' },
    });
    run({ checkout, home, verify });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('offline verification relocates independently and leaves checkout and home unchanged', () => {
  withCheckout(({ checkout, home, verify }) => {
    const before = snapshot(checkout);
    const homeBefore = snapshot(home);
    const result = verify();
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /PASS: package inventory/);
    assert.match(result.stdout, /PASS: syntax checks for all five/);
    assert.match(result.stdout, /PASS: detector, preservation validator/);
    assert.deepEqual(snapshot(checkout), before);
    assert.deepEqual(snapshot(home), homeBefore);
  });
});

test('verification rejects a missing notice, editing reference, or runtime', () => {
  for (const name of ['NOTICE.md', 'references/headlines.md', 'references/patterns.md', 'detector/patterns.js']) {
    withCheckout(({ checkout, verify }) => {
      fs.unlinkSync(path.join(checkout, name));
      const result = verify();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /FAIL:/);
      assert.ok(result.stderr.includes(`${name}: missing`), result.stderr);
    });
  }
});

test('verification rejects modified protected notices and damaged provenance', () => {
  for (const name of ['LICENSE', 'NOTICE.md']) {
    withCheckout(({ checkout, verify }) => {
      fs.appendFileSync(path.join(checkout, name), '\nUnexpected change.\n');
      const result = verify();
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(`${name}: protected license/notice hash mismatch`), result.stderr);
    });
  }
  withCheckout(({ checkout, verify }) => {
    const target = path.join(checkout, 'provenance.json');
    const provenance = JSON.parse(fs.readFileSync(target, 'utf8'));
    provenance.canonical_source.commit = 'unrecorded';
    fs.writeFileSync(target, JSON.stringify(provenance));
    const result = verify();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /canonical_source must pin a full commit/);
  });
});

test('verification rejects malformed and valid-syntax broken runtimes', () => {
  withCheckout(({ checkout, verify }) => {
    fs.writeFileSync(path.join(checkout, 'detector/validate.js'), 'function broken( {\n');
    const result = verify();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /detector\/validate.js: JavaScript syntax check failed/);
  });
  withCheckout(({ checkout, verify }) => {
    fs.writeFileSync(path.join(checkout, 'scripts/normalize-quotes.js'), "'use strict';\nmodule.exports = { normalize: (text) => text };\n");
    const result = verify();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /runtime smoke checks: normalizer must retain code/);
  });
});

test('verification rejects malformed house-style examples and external package aliases', () => {
  withCheckout(({ checkout, verify }) => {
    fs.writeFileSync(path.join(checkout, 'examples/prose.json'), '{ damaged JSON');
    const result = verify();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /examples\/prose.json: invalid or unreadable JSON/);
  });
  withCheckout(({ checkout, verify }) => {
    const target = path.join(checkout, 'references/patterns.md');
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(sourceRoot, 'references/patterns.md'), target);
    const result = verify();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /references\/patterns.md: missing, empty, or replaced by symlink/);
  });
});
