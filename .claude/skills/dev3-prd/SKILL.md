---
name: dev3-prd
description: Generate questions, clarify unknowns, then write a PRD using pyramid principles. Sub-skill of the /dev workflow.
argument-hint: "[feature_name]"
---

# Dev Workflow — Step 3: Questions & PRD

You are writing a Product Requirements Document (PRD) / design spec. Before writing, you must clarify all unknowns.

## Input

1. Read `.llm/$ARGUMENTS/tmp_context.md` for the original feature request
2. Read `.llm/$ARGUMENTS/tmp_exploration.md` for codebase exploration findings
3. Read `.llm/$ARGUMENTS/design.md` for the chosen design

## Step 1: Generate questions

Think about what a staff software engineer would need clarified before writing a design spec. Write your questions to `.llm/$ARGUMENTS/tmp_questions.md`.

For each question:
- Write the question clearly
- Attempt to answer it yourself by reading the codebase
- Mark each question as either `[RESOLVED]` (you found the answer in the code) or `[NEEDS INPUT]` (requires human clarification)

## Step 2: Ask the human

If there are any `[NEEDS INPUT]` questions remaining, present ONLY those to the user. Wait for their answers. Update `.llm/$ARGUMENTS/tmp_questions.md` with the answers.

If all questions were self-resolved, tell the user: "No open questions — all clarified from the codebase. Proceeding to PRD."

## Step 3: Write the PRD

Write the PRD to `.llm/$ARGUMENTS/prd.md` following the **pyramid principle** in three levels:

### Level 1 — Executive Summary

1. **Requirements** — Clear bullet points listing what the feature must do. Just the requirements, nothing else.
2. **Background** — What are we building and why? Context and motivation in 2-3 paragraphs.
3. **Design Overview** — High-level overview of the chosen design. How the pieces fit together. No code.

### Level 2 — Component Details

For each major component or module in the design:
- **One paragraph** explaining what this component does, its responsibilities, and how it interacts with other components.

### Level 3 — Implementation Details

For each component from Level 2:
- Code snippets showing key interfaces, data structures, or function signatures
- Specific file paths where changes will be made
- Any migration or configuration changes needed

## Step 4: Present and confirm

Show the user a summary of the PRD (Level 1 only) and ask if they want to review the full document or proceed.

## Step 5: Hand off

Tell the user the PRD is complete, then immediately invoke `/dev4-implement $ARGUMENTS`.
