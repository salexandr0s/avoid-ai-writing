# Avoid AI Writing Skill

Standalone Codex/agentskills package derived from
[conorbronsdon/avoid-ai-writing](https://github.com/conorbronsdon/avoid-ai-writing).
The bundled skill, references, detector, scripts, examples, MIT license, and
notice were copied from upstream v3.37.0 at commit
`5a5cf6a45331384d4ff68f1f6ce50da24da0da4c`, then extended with one local
headline-specificity rule.

The upstream project is by Conor Bronsdon. `NOTICE.md` is retained verbatim from
the installed package, including the packaging credit to Mamdouh Aboammar. Its
language about the canonical project, ChatGPT/Codex package, router, workflow
skills, and OpenAI package describes the upstream full package context. This
repository is a smaller standalone subset containing the skill and bundled local
tools needed to use it directly. Two copied detector documentation links were
also repaired to point at the pinned upstream detector README, since that file
is not included in this standalone subset.

## Local Headline Rule

This package adds an editorial rule for vague promotional titles like "A fresh
perspective, every fortnight." The rule asks the skill to prefer titles that
name the subject, state a supported point, or describe a concrete question or
action.

That rule is not a new mechanical detector category. It is applied by the skill
as editorial judgment during title, hero headline, newsletter headline, email
subject, and section-heading review.

## Calibration

The inherited Avoid AI Writing rules are calibrated for English. Applying them
to other languages requires language-specific rules and evidence.

## Install

Install into a project-local agentskills directory:

```bash
mkdir -p .agents/skills
git clone https://github.com/salexandr0s/avoid-ai-writing .agents/skills/avoid-ai-writing
```

Or install globally for agents that read `~/.agents`:

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/salexandr0s/avoid-ai-writing ~/.agents/skills/avoid-ai-writing
```

## Use

Invoke the skill explicitly when you want it:

```text
$avoid-ai-writing scan this, don't rewrite
$avoid-ai-writing rewrite this in a warmer voice
$avoid-ai-writing edit draft.md in place
```

The copied `agents/openai.yaml` keeps `allow_implicit_invocation: false`, so
Codex should not auto-apply this skill without an explicit request.

The bundled scripts are plain Node.js tools and require Node >=18. There is no
project-level package manager setup or typechecker in this standalone subset.

## Verification

This subset does not include upstream's full package test harness. For this
publication package, use targeted checks:

```bash
node --check detector/patterns.js
node --check detector/validate.js
node --check scripts/check-style.js
node --check scripts/markdown-prose.js
node --check scripts/normalize-quotes.js
node -e 'const r = require("./detector/patterns.js").analyzeText("In order to leverage robust solutions, it is important to note the future looks bright."); if (!r.issues.length) throw new Error("detector smoke failed");'
node -e 'for (const p of ["examples/prose.json", "examples/technical.json"]) JSON.parse(require("fs").readFileSync(p, "utf8"));'
tmp_dir=$(mktemp -d)
printf '%s\n' 'In order to leverage robust solutions, it is important to note the future looks bright.' > "$tmp_dir/original.md"
printf '%s\n' 'Use sturdy systems. The future looks bright.' > "$tmp_dir/rewritten.md"
node detector/validate.js --residual-policy warn "$tmp_dir/original.md" "$tmp_dir/rewritten.md"
node scripts/check-style.js "$tmp_dir/rewritten.md" --config examples/technical.json --json
node scripts/normalize-quotes.js "$tmp_dir/rewritten.md" --quotes straight > "$tmp_dir/normalized.md"
```
