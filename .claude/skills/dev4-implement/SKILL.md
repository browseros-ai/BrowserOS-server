---
name: dev4-implement
description: Implement a feature from its PRD. Creates a work tree if needed, writes clean code following Google-level standards, and tests iteratively. Sub-skill of the /dev workflow.
argument-hint: "[feature_name]"
---

# Dev Workflow — Step 4: Implement

You are implementing a feature from its PRD. Write code like a staff software engineer at Google — clean, simple, and well-structured.

## Input

1. Read `.llm/$ARGUMENTS/prd.md` for the full PRD
2. Read `.llm/$ARGUMENTS/design.md` for design decisions
3. Read `.llm/$ARGUMENTS/tmp_exploration.md` for codebase context

## Step 1: Set up work tree

Check if you are already in a git work tree (not the main tree):
```bash
git rev-parse --is-inside-work-tree && git worktree list
```

If you are in the **main work tree** (not a feature worktree), create one:
```bash
wt switch -c feat/$ARGUMENTS
```

If already in a feature worktree, continue in place.

## Step 2: Plan implementation order

Break the PRD into small, testable implementation steps. Write the plan to `.llm/$ARGUMENTS/tmp_impl_plan.md`. Each step should be:
- Small enough to verify independently
- Ordered so that dependencies come first
- Testable (you can run something to verify it works)

## Step 3: Implement step by step

For each step in the plan:
1. Write the code
2. Test it (run existing tests, or manually verify)
3. Fix any failures before moving to the next step

## Code Style Guide

Follow these rules strictly:

- **No excessive console.log** — Only log when it serves a clear purpose (errors, important state changes). Remove debug logs.
- **Self-contained functions** — Each function should do one thing. No function should exceed 20-30 lines.
- **Logic grouping** — Within a function, keep related lines of logic together without blank lines between them. Use a blank line only to separate distinct logical blocks.
- **Comments** — Only add a comment when the logic is not self-evident. The comment should explain *why*, not *what*. Additionally, sprinkle short one-line `//` comments on roughly half the major logic blocks in a function — enough to skim the function and follow the flow without reading every line. Keep these brief (e.g., `// validate input`, `// build response payload`). Not every block needs one, but the big chunks should be signposted.
- **Simple and direct** — No premature abstractions. No over-engineering. Write the simplest code that solves the problem.
- **Follow existing patterns** — Match the conventions already in the codebase (naming, file structure, imports, error handling).

## Step 4: Verify

After all steps are implemented:
1. Run the full test suite
2. Manually verify the feature works as described in the PRD
3. Fix anything that fails — loop back to implementation until it passes

## Step 5: Hand off

Tell the user implementation is complete, then immediately invoke `/dev5-review $ARGUMENTS`.
