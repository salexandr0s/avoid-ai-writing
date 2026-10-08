# House-style config examples

`--style` adds house-style review to the AI-writing audit. In rewrite and edit modes,
apply authorized **register/voice** and **mechanics** changes under the editing contract;
in detect mode, report findings without changing the text. The preferred input is a
**config file** (`--style ./house.json`, or a bare name matching `examples/<name>.json`).
The checker covers a subset of its mechanics; report verification only after it runs
(see the table below for which rules gate the exit code and which are advisory).
The files here are *examples of that format*; copy one into the document's project
and edit the copy. Bare `--config`
names resolve against this directory. From the repository root, run
`npm run verify` (or `node scripts/verify.js`) for offline package and tool checks,
and `npm test` for the portable regression suite.

## Where encoded guides live

For a published guide, see the
README's [**House style is a different job**](https://github.com/conorbronsdon/avoid-ai-writing/blob/main/README.md#house-style-is-a-different-job)
section, which points at [Vale](https://github.com/vale-cli/vale) (where licensed, attributed
guide packages live) and records the licensing decision in
[#88](https://github.com/conorbronsdon/avoid-ai-writing/issues/88). Vale enforces a
guide's mechanics; this layer adds register/voice and removes AI tells. The config
format below is for a custom house style.

**This repo bundles no style guides.** The example files are generic and guide-neutral (no
guide names or aliases), so nothing here claims to implement a guide or tracks its edition.

A bare name resolves by filename only: `--config technical` loads `technical.json`. Because
the shipped examples carry no guide names, `--style chicago` resolves to no config and falls
back to applying the guide from the model's own knowledge as best-effort, labeled such as
`Applying Chicago from general knowledge (not verified; no compliance claim).`. `SKILL.md`
instructs the model to print that status line and not to reproduce the guide's text; both are
instructions rather than checked rules, so treat that path as unverified. For enforcement, use
Vale or write a config. The checker covers only the config path, so pointing it at an
unresolvable name exits 2 (a tool error).

## Schema

A config is JSON with two parts:

```json
{
  "name": "My house style",
  "genre": "technical documentation",
  "register": [
    "Second person, active voice, present tense.",
    "No hype."
  ],
  "mechanics": {
    "quotes": "straight",
    "headings": "sentence",
    "emDash": "sparing",
    "latinAbbrev": "parentheses",
    "serialComma": true,
    "spellNumbersUpTo": 9
  }
}
```

- **`register`** (list of strings) — voice/register directives the model applies as
  guidance. These are judgment calls, not machine-checked.
- **`genre`** (string, optional) — what the config is written for. Don't apply a config
  to a genre it wasn't written for.
- **`mechanics`** (object) — output rules, of which the checkable subset is verified by
  `node scripts/check-style.js <file> --config <config.json>`:

| key | values | how it's checked |
|---|---|---|
| `quotes` | `straight` \| `curly` | **hard** — flags the wrong mark form in prose |
| `latinAbbrev` | `never` \| `parentheses` \| `any` | **hard** — `never` flags any `e.g.`/`i.e.`; `parentheses` flags them outside parentheses; `any` is unchecked |
| `headings` | `sentence` \| `title` | advisory — proper nouns make sentence vs. title case ambiguous, so it can't be verified deterministically |
| `emDash` | `sparing` \| `deliberate` | advisory — `sparing` flags a rate over ~1 per 1,000 words; `deliberate` is unchecked |
| `spellNumbersUpTo` | number | advisory — flags numerals at or below the threshold in prose |
| `serialComma` | `true` \| `false` | model-applied only; not machine-checked |

`prose.json` sets `headings: "title"` although the catalog flags Title Case headings. It shows
the rule from `SKILL.md`'s `--style` section: when a config's mechanics conflict with the
catalog, the config wins the mechanic.

Unrecognized keys or values are reported as **warnings** (a config the tool couldn't fully
apply) rather than silently ignored; omitted keys do nothing.

Before checking, the checker skips closed recognizable mapping-style YAML frontmatter, fenced/inline/indented code,
link destinations and titles, reference identifiers, HTML tags and comments, and escaped
punctuation. Link titles use straight quotes as *syntax*. List paragraph continuations stay
checked; extra indentation can start code inside an item. A closed mapping header may
start with YAML blank or comment lines; ordinary prose between thematic breaks remains
editable. Other YAML forms need model review. The `latinAbbrev` parenthesis carve-out carries
across wrapped lines but resets at a paragraph break, so an unclosed `(` disables that rule
for the rest of its paragraph.

## Normalize quote marks after a rewrite

Rewrite and edit mode plan this pass within the editing budget; detect mode never
normalizes the source. Follow [the skill's file-handling contract](../SKILL.md#file-handling):
retain complete original and final snapshots separately for preservation checks,
and create model-identified changed editable prose plus its matching original
prose reference in an owned OS temporary directory outside the skill and project.
Exclude unchanged prose, quotations, attributed passages, tables, and other
protected spans from both filtered inputs. Do not use the complete original as
the marks reference or write the result over the complete target document.

Replace the absolute placeholder paths below with the installed skill path,
the invocation's temporary input paths, and the resolved user-config path:

```bash
node '/path/to/skill/scripts/normalize-quotes.js' '/path/to/temp/changed-prose.md' --reference '/path/to/temp/original-prose.md'
node '/path/to/skill/scripts/normalize-quotes.js' '/path/to/temp/changed-prose.md' --reference '/path/to/temp/original-prose.md' --write
node '/path/to/skill/scripts/check-style.js' '/path/to/temp/changed-prose.md' --config '/path/to/project/house.json'
```

The default `--quotes auto` infers double quotes and single quotes/apostrophes
independently from unprotected reference prose. Each family's majority wins; ties
use its first observed style. With no evidence, that family stays unchanged. Without
`--reference`, inference uses the input itself. Explicit house style takes precedence:
use `--quotes straight` or `--quotes curly` without `--reference`.

Without `--write`, stdout contains
only the resulting document and the file stays unchanged. The command exits 0 on success
or 2 for invalid arguments or file errors. It also exports
`normalize(text, quotes = 'auto', reference = text)` and `inferQuotes(text)`.
Apply the result only to its corresponding changed editable spans. Report the
style check's filtered scope, rather than whole-document compliance, and retain
exempt quotations, tables, and attributed text when inserting the result.

The normalizer shares the checker's Markdown protection and changes only quotation marks
and apostrophes in prose. Protected source, whitespace, BOM and line endings survive
verbatim. Dashes and heading case stay as written. This pass does not claim guide
compliance. Curly education
uses neighboring characters, so leading elisions such as `'twas` and `rock 'n' roll` need
review. Straight marks after digits follow the checker's feet/inch carve-out.

For a bare URL immediately surrounded by single quotes, a closing quote followed
only by terminal punctuation ends the URL even if its parentheses are unbalanced.
Internal apostrophes such as `O'Reilly` remain part of the URL. If a URL literally
ends in an apostrophe or has ambiguous punctuation, use an explicit Markdown link
or `<https://example.com/...>` autolink to keep its destination unchanged.
