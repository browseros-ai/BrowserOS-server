---
name: dev2-design
description: Generate high-level design options for a feature. Presents 2-4 design alternatives with pros and cons. Sub-skill of the /dev workflow.
argument-hint: "[feature_name]"
---

# Dev Workflow — Step 2: Design Options

You are generating design options for a feature. Think like a staff software engineer at Google presenting options in a design review.

## Input

1. Read `.llm/$ARGUMENTS/tmp_context.md` for the original feature request
2. Read `.llm/$ARGUMENTS/tmp_exploration.md` for codebase exploration findings

## Step 1: Generate design options

Present **2 to 4 high-level design options**. For each option:

- **Name** — A short descriptive title (e.g., "Option A: Event-driven with pub/sub")
- **Overview** — 2-3 paragraphs explaining the approach at a high level. NO code snippets. Describe the architecture, data flow, and key decisions in plain language.
- **Advantages** — Bullet list of pros
- **Disadvantages** — Bullet list of cons
- **Complexity** — Low / Medium / High
- **Risk** — Low / Medium / High

If there is genuinely only one reasonable way to implement the feature, present that single option and explain why alternatives don't make sense.

## Rules

- **No code snippets** in design options. This is a high-level architectural discussion.
- Design options need not be very futureproof; prioritize solving the immediate need over speculative extensibility.
- Focus on trade-offs: maintainability vs performance, simplicity vs flexibility, etc.
- Ground each option in the actual codebase — reference real modules, patterns, and conventions found during exploration.
- Be honest about disadvantages. Don't present a straw man option just to fill the count.

## Step 2: Present and get user's choice

Present all options to the user in a clear format. Ask the user which design option they prefer (or if they want to combine aspects of multiple options).

## Step 3: Save the chosen design

After the user picks an option, write `.llm/$ARGUMENTS/design.md` with:
- The chosen design option (full description)
- Any user modifications or clarifications
- Key decisions and rationale

## Step 4: Hand off

Tell the user the design is locked in, then immediately invoke `/dev3-prd $ARGUMENTS`.
