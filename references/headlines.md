# Titles, headlines, subjects, and headings

Use this reference when drafting or reviewing a title, hero headline, newsletter
headline, email subject, or section heading. Apply [the editing contract](../SKILL.md#editing-contract)
first: source support, protected content, context, and authorized scope govern
each wording decision. A short title, comma, question, or uppercase treatment is
not itself a finding.

## Decide whether a change is needed

1. Identify the surface and its job, then read the supplied content it represents.
2. Check whether the wording names the subject, a supported point, a concrete
   action, or a question the content addresses. Generic benefit promises such as
   "Insights that inspire" and "A smarter way to thrive" need review when they
   leave the reader unable to tell what the content offers. Swapping in synonyms
   such as "new insights" does not supply a subject.
3. Preserve wording that already does its job. Do not manufacture a finding,
   audience, benefit, novelty claim, urgency, or stance to sharpen a title.
   Retain uncertainty, conditions, design intent, and the source's causal limits.
4. In detect mode, report a justified finding. In rewrite or edit mode, change
   wording only within scope and after checking protected references. If the
   source lacks a subject, flag the gap; use a publication name only when that
   name and the surface make it a supported alternative.

The "could this fit an unrelated product?" test helps review promotional copy.
It does not disqualify conventional navigation labels such as "Overview" or
"Installation," whose surrounding document supplies the subject.

## Match the wording to the surface

| Surface | What the wording should do |
|---|---|
| Piece title | Name its actual topic or supported point. A question is useful when the piece addresses it; do not imply an answer the source does not establish. |
| Hero headline | Identify the product, publication, task, or supported capability. Use audience or benefit claims only when supplied. Supporting copy can carry details that would overload the headline. |
| Newsletter signup | Identify the publication or supported coverage. "The Brainwave newsletter" works when that is the publication's name; an individual edition's topic need not describe every future edition. |
| Newsletter edition | Name what this edition covers. "How sleep affects attention" works only when its supplied content supports that topic and causal framing. |
| Email subject | State the actual topic, request, or event in the message. Keep a supplied deadline or necessary identifier; do not add urgency, "Re:", or a reply claim the source does not support. |
| Section heading | Orient readers to the section. Preserve useful conventional labels; replace a vague label only when a supported wording change improves orientation. |

For the Brainwave signup example, **"A fresh perspective, every fortnight"**
does not say what readers receive. A supported publication name is a clearer
headline. Keep a documented publishing frequency in supporting copy or metadata
when that fits the surface; a schedule can remain in a title when it is itself
the subject. Apply this reasoning across brands rather than imposing Brainwave's
name, cadence, or visual style on another publication.

## Protect names, mechanics, and references

Preserve official product and publication names, approved brand strings,
attributed quotations, documented capitalization, fonts, and other brand
mechanics unless the user specifically asks to change them. A critique may flag
generic wording in a protected slogan, but ordinary cleanup must retain it.
Sentence case is a house-style decision; it does not override an official name
or an intentional uppercase treatment.

A justified title or heading wording fix can belong to ordinary cleanup.
Merging, moving, deleting, or adding sections requires structural scope. Before
changing a heading's wording or case, inspect available table-of-contents entries,
in-document links, explicit IDs, repository references, and the renderer's
heading-slug behavior. A changed heading can break an automatically generated
anchor even when the visible link text stays the same.

Proceed only when references can remain valid while protected URLs and
identifiers are preserved, or when the user has authorized the corresponding
reference changes. Otherwise retain the heading and report the proposed wording
and reference issue. Do not silently rewrite protected links, insert replacement
IDs, or claim that unknown external bookmarks were checked.

## Behavioral examples

These examples show decisions, not mandatory wording. Each proposed edit assumes
the heading is editable, the source supplies the stated facts, and the requested
mode permits it. In detect mode, report the same finding without applying it.

| Source and intent | Existing or proposed copy | Appropriate result |
|---|---|---|
| Signup for the named Brainwave newsletter, published every fortnight | "A fresh perspective, every fortnight" | Use "The Brainwave newsletter"; keep the supported schedule in supporting copy. Do not invent coverage or benefits. |
| An edition explaining established effects of sleep on attention | "Insights that inspire" | "How sleep affects attention" names the supported topic. |
| An observational study reports an association between short sleep and lower attention scores | "Short sleep causes poor attention" | "Short sleep was linked to lower attention scores in this study" preserves the finding's limits. Do not turn an association into causality. |
| A draft title has no supplied subject or publication name | "Small shifts, big impact" | Flag the missing subject and retain it pending source detail; do not guess a topic. |
| Flowdesk is a treasury dashboard that tracks transactions | "A smarter way to thrive" | "Track treasury transactions with Flowdesk" uses the supplied capability; do not add savings or performance claims. |
| An email asks a colleague to review the retry section by Friday | "Let's build something great" | "Review the retry section by Friday" preserves the actual ask and deadline. |
| A README overview introduces the documented tool | "Overview" | Keep it. A useful conventional label needs no optional polish. |
| "Key Points" introduces retry limits and has a link targeting `#key-points`; link changes are outside scope | "Retry limits" is proposed | Keep the existing heading and report the proposal unless its anchor can remain valid without protected-reference changes. |
| The approved official slogan is "A SMARTER WAY TO THRIVE" | Ordinary cleanup of surrounding hero copy | Preserve the exact brand string and treatment; report a copy concern only if relevant. |
| A study quotes an author calling a publication "Insights that inspire" | Quoted title or attributed passage | Preserve the quotation and attribution; do not substitute the editor's preferred headline. |
| The source describes a storage design intended for ten-year retention, with no observed lifespan result | "Storage proven to last ten years" | "A storage design for ten-year retention" preserves intent without asserting demonstrated durability. |
| A roadmap says a feature may eventually support offline use after a migration | "Offline use is here" | Preserve the possibility, delayed timing, and migration condition. Do not treat "may eventually" as duplicated uncertainty. |

## Review and reporting limits

The detector leaves inputs with fewer than ten counted words unscored. A zero
score or absent finding in a short headline is not a quality check. Longer titles
also need model review for subject, truth, stance, and intent. The preservation
validator may mechanically allow heading wording changes; it cannot establish
that their claims are supported or their anchors still work.

Report what was checked and any missing source or reference information. Follow
[the skill's output format](../SKILL.md#output-format), including exact no-op
behavior, the shared editing pass limit, and protected residuals.
