# Avoid AI Writing: Prose and Headlines

Review English prose, titles, and headings for generic phrasing, repetition, and
filler. Scan without changing text, return a rewrite, or edit a prose file in
place while preserving facts, uncertainty, voice, and protected content.

This repository is the complete standalone skill package for Claude Code,
Codex, and other assistants that support the [Agent Skills format](https://agentskills.io).
It needs no `ai-config` folder or extra configuration repository.
Install the whole folder, including its references and tools. The bundled checks
require **Node.js 18 or newer**, with no dependencies to install. The instructions
also support a clearly labelled model-only review when Node is unavailable.

## Install for Claude Code

For all your projects:

```bash
mkdir -p "$HOME/.claude/skills"
git clone https://github.com/salexandr0s/avoid-ai-writing.git "$HOME/.claude/skills/avoid-ai-writing"
```

For one project, run from that project's root instead:

```bash
mkdir -p .claude/skills
git clone https://github.com/salexandr0s/avoid-ai-writing.git .claude/skills/avoid-ai-writing
```

Invoke it with `/avoid-ai-writing`. These are Claude Code's
[personal and project skill locations](https://code.claude.com/docs/en/skills#choose-where-skills-load).

## Install for Codex

For all your projects:

```bash
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/salexandr0s/avoid-ai-writing.git "$HOME/.agents/skills/avoid-ai-writing"
```

For one project, run from that project's root instead:

```bash
mkdir -p .agents/skills
git clone https://github.com/salexandr0s/avoid-ai-writing.git .agents/skills/avoid-ai-writing
```

Invoke it with `$avoid-ai-writing`. These are Codex's
[user and repository skill locations](https://developers.openai.com/codex/skills).
The bundled `agents/openai.yaml` keeps automatic invocation disabled in Codex.

Choose one installation per assistant and scope. If the destination already
exists, review that installation before updating it; cloning will not replace it.
Start a fresh chat or restart your assistant if the skill does not appear.
The shell examples work on macOS and Linux. On Windows, clone or copy the
complete folder into the corresponding skill directory under your user profile
or project; no symlinks are required.

## Share one copy between both assistants

Both assistants support symlinked skill folders. On macOS or Linux, you can keep
one checkout in any directory and link both assistants to it. For example:

```bash
mkdir -p "$HOME/skills"
git clone https://github.com/salexandr0s/avoid-ai-writing.git "$HOME/skills/avoid-ai-writing"
mkdir -p "$HOME/.claude/skills" "$HOME/.agents/skills"
ln -s "$HOME/skills/avoid-ai-writing" "$HOME/.claude/skills/avoid-ai-writing"
ln -s "$HOME/skills/avoid-ai-writing" "$HOME/.agents/skills/avoid-ai-writing"
```

Use this as an alternative to the direct clones above. The link commands do not
replace an existing installation. Update the links if you move the checkout.
Keep one discoverable copy per assistant to avoid duplicate skill entries.
For another Agent Skills assistant, use its documented skill directory. A GitHub
ZIP also works: extract it and name the installed folder `avoid-ai-writing`, with
`SKILL.md` directly inside.

## Use

| Request | Claude Code | Codex |
| --- | --- | --- |
| Scan only | `/avoid-ai-writing scan this, don't rewrite` | `$avoid-ai-writing scan this, don't rewrite` |
| Rewrite | `/avoid-ai-writing rewrite this in a warmer voice` | `$avoid-ai-writing rewrite this in a warmer voice` |
| Review titles | `/avoid-ai-writing review these titles against the supplied article` | `$avoid-ai-writing review these titles against the supplied article` |
| Edit a file | `/avoid-ai-writing edit draft.md in place` | `$avoid-ai-writing edit draft.md in place` |

Paste text or provide the file and source context after your request. Relative
user paths resolve from the project where you invoked the skill. Scan mode changes
no files. A rewrite is returned in the conversation unless you request a saved
file. In-place editing keeps the target's name and folder. Snapshots and tool
scratch files use a separate temporary directory and are cleaned up afterward.

Mode, voice, context, style, and iteration options are interpreted by the assistant;
they are not flags for a single bundled executable. Read [SKILL.md](SKILL.md)
for the editing contract and workflow.

## Package contents

```text
avoid-ai-writing/
├── SKILL.md                 # editing contract and workflow
├── agents/openai.yaml       # Codex display and invocation metadata
├── references/              # pattern catalog and headline guidance
├── detector/                # pattern analysis and preservation validator
├── scripts/                 # style checker, quote normalizer, and verifier
├── examples/                # generic house-style configs
├── tests/                   # native Node tool and packaging regressions
├── package.json             # dependency-free verification commands
├── provenance.json          # source pins, local revision, and attribution hashes
├── LICENSE                  # MIT license
└── NOTICE.md                # retained upstream attribution
```

Keep drafts, reports, house-style overrides, and generated output in your own
project. The installed folder holds the reusable rules and tools. Copy a
[house-style example](examples/README.md) into your project before adapting it.

## Verify

From the checkout root:

```bash
npm run verify
npm test
```

No `npm install` is needed. Without npm, use Node directly:

```bash
node scripts/verify.js
node --test tests/*.test.js
```

The verifier checks the package, metadata, source pins, license and notice hashes,
example configs, runtime syntax, and tool smoke behavior. The regression suite
covers protected Markdown regions, CLI behavior, relocation, and damaged packages.
Checks run offline, use temporary fixtures, and leave the skill package, assistant
settings, and installed links unchanged. Scripts resolve resources from their own
package, so the verifier also works by absolute path from another working directory.
There is no configured TypeScript checker or ESLint setup; syntax checks and
native tests provide targeted validation.

The rules are calibrated for English. Findings are candidates for editorial review,
not evidence of authorship. Markdown and YAML recognition is bounded, not a complete
parser. Passing checks cannot establish factual accuracy, preserved meaning, source
support, or working heading anchors. Titles under ten counted words are unscored and
still need contextual review. See [references/headlines.md](references/headlines.md).

## Update or customize

For an unmodified Git installation, update the actual checkout with:

```bash
git -C "/path/to/avoid-ai-writing" pull --ff-only
```

Then run verification and tests. For symlinks, update the checkout once; both
assistants see that copy. For ZIP installs, download the new version and review
it before replacing your installed copy. Keep customizations in your own repository
or fork and review updates before merging them. There is no automatic overwrite.

## License and provenance

Use, copy, modify, redistribute, or sell this package under the [MIT license](LICENSE),
retaining its copyright and permission notice. Keep [NOTICE.md](NOTICE.md) with
redistributed copies to preserve contributor attribution.

The canonical project is [Conor Bronsdon's Avoid AI Writing](https://github.com/conorbronsdon/avoid-ai-writing),
imported from version `3.37.0`, commit `5a5cf6a45331384d4ff68f1f6ce50da24da0da4c`.
This edition adds the editing and saving contract, source-supported headline
guidance, updated display copy, protected-content fixes, and portable checks.
The imported version and local revision are separate in [provenance.json](provenance.json).

The MIT license and upstream notice remain unchanged. The notice also credits
Mamdouh Aboammar's upstream packaging work and describes the broader upstream
package. This subset does not include that project's router, MCP server, full
test harness, or optional integrations.
