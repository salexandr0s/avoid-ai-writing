/**
 * Avoid AI Writing — preservation validator
 *
 * SKILL.md promises that a rewrite leaves certain things alone: "Don't edit
 * quoted material, code blocks, tables, or text attributed to someone else"
 * (edit mode), "Preserve the original structure, intent, and all specific
 * technical details" (rewrite mode). Nothing enforced those promises. This does.
 *
 * Usage:
 *   const { validate } = require('./validate.js');
 *   const result = validate(originalText, rewrittenText);
 *   if (!result.ok) { console.error(result.errors); }
 *
 * Preservation errors block mechanical content damage. Residual pattern growth
 * also blocks by default for compatibility; residualPolicy: "warn" makes that
 * quality diagnostic advisory. Neither result proves semantic fidelity.
 *
 * Two carve-outs exist because this skill *documents* the edit in question,
 * and a validator that fires on its own skill's instructions is worse than no
 * validator:
 *
 *   1. AI-tool URL parameters (`utm_source=chatgpt.com` and friends). SKILL.md
 *      says "strip the AI-referrer tracking parameter from every URL that
 *      carries one." So URLs are compared with those parameters removed from
 *      both sides.
 *   2. Heading text. SKILL.md says to convert Title Case headings to sentence
 *      case, and to cut emoji from headings. So heading *text* changing is a
 *      warning; heading count and nesting sequence changing is an error.
 *
 * Dependency-free. Runs on node >= 18. Mirrors the IIFE + module.exports shape
 * of patterns.js so it can be loaded in a browser too.
 */

const AIDetectorValidate = (() => {
  // ═══ Block extractors ══════════════════════════════════════════════
/**
   * A small line-scanner walked over the text once and remembers the opening
   * fence marker and its run length. A fence closes only on a line whose
   * marker matches the opener, is at least as long, and carries no payload
   * (just a closing fence, whitespace allowed). All fence content is captured
   * as one span. An unclosed fence runs to end of document.
   *
   * Replaces the FENCED_CODE regex (GH-236): it closed on any single ~~~ or
   * ``` line regardless of what opened the block, and it mis-respected
   * markers shorter vs longer run-length. Regex can't express run lengths
   * reliably, so this is a plain scan.
   *
   * The algorithm mirrors fenceRanges() in detector/patterns.js so both
   * report the same boundaries for the same input.
   */
  function fenceSpans(text) {
    const spans = [];
    const lines = text.split('\n');
    let cursor = 0;
    let open = null; // { marker, len, start }

    for (const line of lines) {
      const markerMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
      if (!open) {
        // CommonMark forbids backticks in the info string of a backtick fence.
        // Without this guard a prose line that starts with an inline span such
        // as ```npm test``` opens a fence that never closes, and every later
        // prose edit reports as code-block-modified.
        const isOpen =
          markerMatch &&
          !(markerMatch[1][0] === '`' && line.slice(markerMatch[0].length).includes('`'));
        if (isOpen) {
          open = { marker: markerMatch[1][0], len: markerMatch[1].length, start: cursor };
        }
      } else {
        const isClose =
          markerMatch &&
          markerMatch[1][0] === open.marker &&
          markerMatch[1].length >= open.len &&
          /^[ \t]*\r?$/.test(line.slice(markerMatch[0].length));
        if (isClose) {
          spans.push([open.start, cursor + line.length]);
          open = null;
        }
      }
      cursor += line.length + 1; // +1 for the newline
    }

    if (open) spans.push([open.start, text.length]);
    return spans;
  }

  /** The full text of each fenced code block, in document order. */
  function fenceBlockTexts(text) {
    return fenceSpans(text).map(([start, end]) => text.slice(start, end));
  }
  const BLOCKQUOTE_BLOCK = /(?:^[ \t]*>[^\n]*(?:\n[ \t]*>[^\n]*)*)/gm;
  const MD_HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;
  const URL = /https?:\/\/[^\s)>\]"'`]+/g;
  const MD_LINK_TARGET = /\[[^\]\n]*\]\(([^)\s]+)[^)]*\)/g;
  const PATH = /(?:^|[\s(])((?:(?:~|\.{0,2})\/)[A-Za-z0-9._~\-]+(?:\/[A-Za-z0-9._~\-]+)*|[A-Za-z]:\\[A-Za-z0-9._\\~\-]+)/g;
  const NUMBER = /\b\d[\d,]*(?:\.\d+)?%?\b/g;

  // Tracking parameters this skill is documented to strip (SKILL.md,
  // "AI-tool URL parameters"). Kept in sync with the `ai-utm-source`
  // detector category in patterns.js. Match complete values: the detector also
  // flags prefixes in unfamiliar hosts, which is not permission to remove them.
  const AI_URL_PARAM = /^(?:utm_source=(?:(?:chatgpt|openai|copilot|claude|grok|gemini|perplexity)(?:\.com|\.ai)?|gemini\.google\.com)|referrer=(?:chatgpt|copilot|grok|claude|gemini|perplexity)\.(?:com|ai))$/i;

  /** Closed YAML mappings only; paired thematic breaks remain prose. */
  function frontmatterText(text) {
    const lines = text.split('\n');
    const bare = (line) => line.replace(/\r$/, '');
    if (!/^---[ \t]*$/.test(bare(lines[0]).replace(/^\uFEFF/, ''))) return null;
    let firstContent = null;
    let end = lines[0].length + 1;
    const yamlKey = /^[ \t]*(?:[A-Za-z0-9_.-]+|"[^"\r\n]+"|'[^'\r\n]+')[ \t]*:/;
    for (let i = 1; i < lines.length; i += 1) {
      const line = bare(lines[i]);
      if (/^(?:---|\.\.\.)[ \t]*$/.test(line)) {
        return firstContent !== null && yamlKey.test(firstContent)
          ? text.slice(0, end + lines[i].length) : null;
      }
      if (firstContent === null && line.trim() && !/^[ \t]*#/.test(line)) firstContent = line;
      end += lines[i].length + 1;
    }
    return null;
  }

  function extractAll(re, text) {
    const out = [];
    const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = rx.exec(text)) !== null) {
      out.push(m[1] !== undefined ? m[1] : m[0]);
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
    return out;
  }

  /** Replace protected characters without losing line boundaries or offsets. */
  function blankSpans(text, spans) {
    const out = text.split('');
    for (const [start, end] of spans) {
      for (let i = start; i < end; i += 1) {
        if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
      }
    }
    return out.join('');
  }

  /**
   * Pair equal backtick runs, including spans wrapped within one paragraph.
   * Fences, blank lines and common block starts stop pairing. Precomputing the
   * next matching run keeps unmatched delimiters from causing quadratic scans.
   * Backslash escapes affect an opener; inside a span they remain literal.
   */
  function inlineCodeSpans(text) {
    const source = blankSpans(text, fenceSpans(text));
    const boundaries = new Set();
    let offset = 0;
    let quoteDepth = 0;
    for (const line of source.split('\n')) {
      const next = offset + line.length + 1;
      const prefix = line.match(/^(?: {0,3}>[ \t]?)+/);
      const depth = prefix ? (prefix[0].match(/>/g) || []).length : 0;
      if (depth !== quoteDepth) boundaries.add(offset);
      quoteDepth = depth;
      const body = prefix ? line.slice(prefix[0].length) : line;
      if (!body.trim()
        || /^ {0,3}#{1,6}(?:[ \t]|$)/.test(body)
        || /^ {0,3}(?:=+|-+)[ \t]*\r?$/.test(body)
        || /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})\r?$/.test(body)) {
        boundaries.add(offset);
        boundaries.add(next);
      } else if (/^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/.test(body)) {
        boundaries.add(offset);
      }
      offset = next;
    }

    const runs = [];
    let segment = 0;
    for (let i = 0; i < source.length;) {
      if (boundaries.has(i)) segment += 1;
      if (source[i] !== '`') { i += 1; continue; }
      const start = i;
      while (source[i] === '`') i += 1;
      let slashes = 0;
      for (let j = start - 1; j >= 0 && source[j] === '\\'; j -= 1) slashes += 1;
      runs.push({ start, end: i, length: i - start, escaped: slashes % 2 === 1, segment });
    }

    const nextSame = [], nextShorter = [];
    const nextByLength = new Map();
    for (let i = runs.length - 1; i >= 0; i -= 1) {
      if (i === runs.length - 1 || runs[i].segment !== runs[i + 1].segment) nextByLength.clear();
      nextSame[i] = nextByLength.get(runs[i].length);
      nextShorter[i] = nextByLength.get(runs[i].length - 1);
      nextByLength.set(runs[i].length, i);
    }
    const spans = [];
    for (let i = 0; i < runs.length;) {
      const run = runs[i];
      const close = run.escaped ? nextShorter[i] : nextSame[i];
      if (close === undefined) { i += 1; continue; }
      spans.push([run.start + (run.escaped ? 1 : 0), runs[close].end]);
      i = close + 1;
    }
    return spans;
  }

  /** Blank code before scanning URLs, tables and other prose-level constructs. */
  function maskCode(text) {
    return blankSpans(blankSpans(text, fenceSpans(text)), inlineCodeSpans(text));
  }

  function normalizeUrl(u) {
    const queryStart = u.indexOf('?');
    const fragmentStart = u.indexOf('#');
    if (queryStart === -1 || (fragmentStart !== -1 && fragmentStart < queryStart)) return u;

    const queryEnd = fragmentStart === -1 ? u.length : fragmentStart;
    let query = u.slice(queryStart + 1, queryEnd);
    let suffix = u.slice(queryEnd);

    // A terminal question mark is ambiguous with sentence punctuation because
    // the bare-URL extractor captures it. Preserve it for symmetric comparison.
    if (queryStart === u.length - 1) return u;

    // Bare-URL extraction includes adjacent sentence punctuation. Treat it as
    // prose only when removing it exposes an exact tracker in the final field.
    if (queryEnd === u.length) {
      // The extractor also keeps emphasis markers, and a dash or ellipsis plus
      // prose follows it without a space. Query separators or escapes in that suffix
      // keep it inside the URL, so functional fields cannot become prose.
      const punctuation = query.match(/(?:[–—…][^&=%]*|[.,;:!?*_~|]+)$/)?.[0] || '';
      const withoutPunctuation = query.slice(0, query.length - punctuation.length);
      const finalParam = withoutPunctuation.slice(withoutPunctuation.lastIndexOf('&') + 1);
      if (punctuation && AI_URL_PARAM.test(finalParam)) {
        query = withoutPunctuation;
        suffix = punctuation;
      }
    }

    const params = query.split('&');
    const kept = params.filter((param) => param !== '' && !AI_URL_PARAM.test(param));
    if (kept.length === params.length) return u;

    return kept.length > 0
      ? `${u.slice(0, queryStart)}?${kept.join('&')}${suffix}`
      : `${u.slice(0, queryStart)}${suffix}`;
  }

  // Keep table-row semantics in sync with scripts/self-scan.js. Four-space
  // and tab-indented lines are top-level code, not tables. Escaped pipes stay
  // inside their cells rather than creating separators.
  function tableCells(line) {
    if (/^(?: {4}|\t)/.test(line)) return null;
    const trimmed = line.trim();
    const separators = [];
    for (let i = 0; i < trimmed.length; i += 1) {
      if (trimmed[i] !== '|') continue;
      let slashes = 0;
      for (let j = i - 1; j >= 0 && trimmed[j] === '\\'; j -= 1) slashes++;
      if (slashes % 2 === 0) separators.push(i);
    }
    if (separators.length === 0) return null;

    const cells = [];
    let start = separators[0] === 0 ? 1 : 0;
    for (const separator of separators) {
      if (separator < start) continue;
      cells.push(trimmed.slice(start, separator));
      start = separator + 1;
    }
    if (start < trimmed.length) cells.push(trimmed.slice(start));
    return cells;
  }

  function isTableDelimiter(line) {
    const cells = tableCells(line);
    return cells !== null && cells.length > 0
      && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
  }

  /**
   * Extract GFM tables with or without outer pipes. A delimiter row is
   * required, so ordinary prose such as `use a | b in the shell` stays prose.
   * Scanning once by line avoids backtracking on long whitespace runs.
   */
  function extractTableBlocks(text) {
    const lines = text.split('\n');
    const blocks = [];
    for (let i = 1; i < lines.length; i++) {
      const headerCells = tableCells(lines[i - 1]);
      const delimiterCells = tableCells(lines[i]);
      if (!headerCells || !isTableDelimiter(lines[i])
        || headerCells.length !== delimiterCells.length) continue;
      let end = i;
      while (end + 1 < lines.length && tableCells(lines[end + 1])) end++;
      blocks.push(lines.slice(i - 1, end + 1).join('\n'));
      i = end;
    }
    return blocks;
  }

  /** Collapse cell padding so a re-aligned table isn't reported as edited. */
  function normalizeTable(block) {
    return block
      .split('\n')
      .map((row, index) => {
        const normalized = row.trim().replace(/\s*\|\s*/g, '|');
        return index === 1 ? normalized.replace(/-{2,}/g, '-') : normalized;
      })
      .join('\n');
  }

  function normalizeQuote(block) {
    return block
      .split('\n')
      .map((line) => line.replace(/^[ \t]*>[ \t]?/, '').trimEnd())
      .join('\n')
      .trimEnd();
  }

  /**
   * Indented code blocks are deliberately warning-level, not error-level.
   * Four-space indentation is also how markdown continues a list item, and a
   * validator that blocks a legitimate rewrite is worse than one that reports
   * a soft signal. Only blocks that follow a blank line and are not inside a
   * list are counted.
   */
  function extractIndentedBlocks(text) {
    const lines = text.split('\n');
    const visible = blankSpans(text, fenceSpans(text)).split('\n');
    const blocks = [];
    let current = null;
    let inList = false;
    let previousBlank = true;
    const finish = () => {
      if (current !== null) blocks.push(lines.slice(current.start, current.end + 1).join('\n'));
      current = null;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== visible[i]) { finish(); previousBlank = false; continue; }
      const isIndented = /^(?: {4}| *\t)/.test(line);
      const isBlank = /^\s*$/.test(line);
      const isCode = !isBlank && isIndented && !inList && (previousBlank || current !== null);
      if (isCode) {
        if (current === null) current = { start: i, end: i };
        else current.end = i;
      } else if (!isBlank) {
        finish();
        if (/^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/.test(line)) inList = true;
        else if (/^\S/.test(line)) inList = false;
      }
      previousBlank = isBlank;
    }
    finish();
    return blocks;
  }

  function counts(list) {
    const map = new Map();
    for (const item of list) map.set(item, (map.get(item) || 0) + 1);
    return map;
  }

  /** Items present in `a` more often than in `b`. */
  function missingFrom(a, b) {
    const have = counts(b);
    const out = [];
    for (const item of a) {
      const n = have.get(item) || 0;
      if (n === 0) out.push(item);
      else have.set(item, n - 1);
    }
    return out;
  }

  function sample(list, n = 5) {
    const shown = list.slice(0, n);
    return shown.join(', ') + (list.length > n ? ` (+${list.length - n} more)` : '');
  }

  function wordCount(text) {
    const words = maskCode(text).trim().match(/\S+/g);
    return words ? words.length : 0;
  }

  /**
   * @param {string} original   text as the writer supplied it
   * @param {string} rewritten  text the skill produced
   * @param {object} [options]
   * @param {object} [options.detector]   AIDetector instance; defaults to
   *                                      requiring ./patterns.js when available
   * @param {boolean} [options.skipResidual]  skip residual pattern analysis
   * @param {"error"|"warn"} [options.residualPolicy]  growth handling (default "error")
   * @param {number} [options.maxShrinkRatio]  warn when the rewrite drops more
   *                                      than this fraction of words (default 0.4)
   * @returns {{ok: boolean, errors: Array, warnings: Array, stats: object, preservation: object, quality: object}}
   */
  function validate(original, rewritten, options = {}) {
    const errors = [];
    const warnings = [];
    const err = (code, message) => errors.push({ code, message });
    const warn = (code, message) => warnings.push({ code, message });

    if (typeof original !== 'string' || typeof rewritten !== 'string') {
      throw new TypeError('validate(original, rewritten): both arguments must be strings');
    }

    const residualPolicy = options.residualPolicy === undefined ? 'error' : options.residualPolicy;
    if (!['error', 'warn'].includes(residualPolicy)) {
      throw new TypeError('validate: residualPolicy must be error or warn');
    }

    // The regex-backed extractors above anchor on a bare \n. A Windows-authored
    // document arrives with CRLF, so protected content can become invisible:
    // frontmatter could be rewritten and validate() still returned ok. See the
    // CRLF regression cases in the repository's native tests. Normalize once, so
    // extraction sees one line-ending shape. A rewrite that only re-terminates
    // CRLF lines is not a preservation failure, but a lone carriage return can
    // be meaningful code content and must remain visible to exact comparisons.
    original = original.replace(/\r\n/g, '\n');
    rewritten = rewritten.replace(/\r\n/g, '\n');

    // ── Fenced code: exact, in order. Code is never the skill's business. ──
    const origFenced = fenceBlockTexts(original);
    const newFenced = fenceBlockTexts(rewritten);
    if (origFenced.length !== newFenced.length) {
      err('code-block-count', `Fenced code blocks changed in number: ${origFenced.length} → ${newFenced.length}.`);
    } else if (origFenced.some((block, i) => block !== newFenced[i])) {
      const changed = origFenced.findIndex((block, i) => block !== newFenced[i]);
      err('code-block-modified', `Fenced code block #${changed + 1} was modified.`);
    }

    // ── YAML frontmatter: exact. ──
    if (frontmatterText(original) !== frontmatterText(rewritten)) {
      err('frontmatter-modified', 'YAML frontmatter was modified, added, or removed.');
    }

    const origProse = maskCode(original);
    const newProse = maskCode(rewritten);

    // ── Blockquotes: someone else's words. ──
    const origQuotes = extractAll(BLOCKQUOTE_BLOCK, origProse).map(normalizeQuote);
    const newQuotes = extractAll(BLOCKQUOTE_BLOCK, newProse).map(normalizeQuote);
    const lostQuotes = missingFrom(origQuotes, newQuotes);
    if (lostQuotes.length) {
      err('blockquote-modified', `Blockquote content was modified or removed (${lostQuotes.length} block(s)). Quoted material is attributed to someone else.`);
    }

    // ── Tables: reference content, not prose. ──
    const origTables = extractTableBlocks(origProse).map(normalizeTable);
    const newTables = extractTableBlocks(newProse).map(normalizeTable);
    const lostTables = missingFrom(origTables, newTables);
    if (lostTables.length) {
      err('table-modified', `Markdown table content was modified or removed (${lostTables.length} table(s)).`);
    }

    // ── Inline code: identifiers, flags, filenames. ──
    const origInline = inlineCodeSpans(original).map(([start, end]) => original.slice(start, end));
    const newInline = inlineCodeSpans(rewritten).map(([start, end]) => rewritten.slice(start, end));
    const lostInline = missingFrom(origInline, newInline);
    if (lostInline.length) {
      err('inline-code-missing', `Inline code removed: ${sample(lostInline)}`);
    }

    // Indentation can also continue list prose, so this remains advisory.
    const origIndented = extractIndentedBlocks(original);
    const newIndented = extractIndentedBlocks(rewritten);
    if (origIndented.length !== newIndented.length || origIndented.some((block, i) => block !== newIndented[i])) {
      warn('indented-code-modified', 'Top-level indented code was modified, added, or removed. Check that code content was preserved.');
    }

    // ── URLs, compared with AI tracking parameters stripped from both sides. ──
    const origUrls = [
      ...extractAll(URL, origProse),
      ...extractAll(MD_LINK_TARGET, origProse),
    ].map(normalizeUrl);
    const newUrls = [
      ...extractAll(URL, newProse),
      ...extractAll(MD_LINK_TARGET, newProse),
    ].map(normalizeUrl);
    const lostUrls = missingFrom(origUrls, newUrls);
    if (lostUrls.length) {
      err('url-missing', `URL removed or altered: ${sample(lostUrls)}`);
    }

    // ── Filesystem paths. ──
    const lostPaths = missingFrom(extractAll(PATH, origProse), extractAll(PATH, newProse));
    if (lostPaths.length) {
      err('path-missing', `File path removed or altered: ${sample(lostPaths)}`);
    }

    // ── Headings: structure is an error, wording is a warning. ──
    const origHeadings = [];
    const newHeadings = [];
    for (const [, hashes, text] of original.matchAll(MD_HEADING)) origHeadings.push({ level: hashes.length, text });
    for (const [, hashes, text] of rewritten.matchAll(MD_HEADING)) newHeadings.push({ level: hashes.length, text });
    if (origHeadings.length !== newHeadings.length) {
      err('heading-count', `Heading count changed: ${origHeadings.length} → ${newHeadings.length}. Restructuring the document is out of scope for a rewrite.`);
    } else {
      const levelDrift = origHeadings.findIndex((h, i) => h.level !== newHeadings[i].level);
      if (levelDrift !== -1) {
        err('heading-level', `Heading nesting changed at heading #${levelDrift + 1}: h${origHeadings[levelDrift].level} → h${newHeadings[levelDrift].level}.`);
      }
      const reworded = origHeadings.filter((h, i) => h.text !== newHeadings[i].text);
      if (reworded.length) {
        warn('heading-text', `${reworded.length} heading(s) reworded. Expected when fixing Title Case or removing emoji; check nothing else moved.`);
      }
    }

    // ── Numbers: SKILL.md says preserve specific technical details. ──
    const lostNumbers = missingFrom(extractAll(NUMBER, origProse), extractAll(NUMBER, newProse));
    if (lostNumbers.length) {
      warn('number-missing', `Figures present in the original are absent from the rewrite: ${sample(lostNumbers)}. Legitimate when a numeral was spelled out; a fabrication risk otherwise.`);
    }

    const addedNumbers = missingFrom(extractAll(NUMBER, newProse), extractAll(NUMBER, origProse));
    if (addedNumbers.length) {
      warn('number-added', `New numeric literals in the rewrite: ${sample(addedNumbers)}. Check against the source; spelling out or digitizing a number can be legitimate.`);
    }

    // ── Volume: a rewrite that halves the text probably dropped content. ──
    const origWords = wordCount(original);
    const newWords = wordCount(rewritten);
    const maxShrink = options.maxShrinkRatio == null ? 0.4 : options.maxShrinkRatio;
    if (origWords > 0 && newWords / origWords < 1 - maxShrink) {
      warn('large-shrink', `Rewrite dropped ${Math.round((1 - newWords / origWords) * 100)}% of the words (${origWords} → ${newWords}). Check for lost content.`);
    }

    // Keep mechanical preservation independent of the residual policy.
    const preservation = { ok: errors.length === 0, errors: errors.slice(), warnings: warnings.slice() };
    const quality = { status: options.skipResidual ? 'skipped' : 'unavailable', policy: residualPolicy, findings: [], residual: null };
    let residual = null;
    if (!options.skipResidual) {
      let detector = options.detector;
      if (!detector && typeof require === 'function') {
        try {
          detector = require('./patterns.js');
        } catch (_) {
          detector = null;
        }
      }
      if (detector && typeof detector.analyzeText === 'function') {
        const before = detector.analyzeText(original);
        const after = detector.analyzeText(rewritten);
        residual = {
          issuesBefore: before.issues.length,
          issuesAfter: after.issues.length,
          scoreBefore: before.score,
          scoreAfter: after.score,
        };
        const declined = (r) => r.document_classification === 'UNSCORED' || r.tooShort || r.tooLong || r.unsupportedScript;
        quality.status = declined(before) || declined(after) ? 'unscored' : 'checked';
        quality.residual = residual;
        if (after.issues.length > before.issues.length) {
          const message = `Residual pattern count increased: ${before.issues.length} to ${after.issues.length} flagged issues. Review applicability; this does not establish content damage.`;
          quality.findings.push({ code: 'residual-grew', message });
          (residualPolicy === 'warn' ? warn : err)('residual-grew', message);
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      preservation,
      quality,
      stats: {
        wordsBefore: origWords,
        wordsAfter: newWords,
        fencedBlocks: origFenced.length,
        headings: origHeadings.length,
        indentedBlocks: origIndented.length,
        residual,
      },
    };
  }

  /** Human-readable one-liner per finding, for CLI and skill output. */
  function formatResult(result) {
    const lines = [];
    const mechanical = result.preservation || result;
    lines.push(!mechanical.ok
      ? `FAIL - ${mechanical.errors.length} mechanical preservation error(s)`
      : result.ok ? 'PASS - no mechanical preservation errors found'
        : 'FAIL - residual policy blocked; no mechanical preservation errors found');
    if (result.quality) lines.push(`  residual ${result.quality.status} (policy: ${result.quality.policy})`);
    for (const e of result.errors) lines.push(`  error   [${e.code}] ${e.message}`);
    for (const w of result.warnings) lines.push(`  warning [${w.code}] ${w.message}`);
    return lines.join('\n');
  }

  return { validate, formatResult, maskCode, extractIndentedBlocks };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIDetectorValidate;
}

// CLI: node detector/validate.js [--residual-policy error|warn] <original> <rewritten>
// Exits 1 on mechanical errors or residual growth under the default error policy.
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const fs = require('node:fs');
  const args = process.argv.slice(2);
  let residualPolicy = 'error';
  if (args[0] === '--residual-policy') {
    args.shift();
    residualPolicy = args.shift();
  }
  if (args[0] === '--') args.shift();
  const [origPath, newPath] = args;
  if (!origPath || !newPath || args.length !== 2 || !['error', 'warn'].includes(residualPolicy)) {
    console.error('usage: node detector/validate.js [--residual-policy error|warn] <original-file> <rewritten-file>');
    process.exit(2);
  }
  const result = AIDetectorValidate.validate(
    fs.readFileSync(origPath, 'utf8'),
    fs.readFileSync(newPath, 'utf8'),
    { residualPolicy },
  );
  console.log(AIDetectorValidate.formatResult(result));
  process.exit(result.ok ? 0 : 1);
}
