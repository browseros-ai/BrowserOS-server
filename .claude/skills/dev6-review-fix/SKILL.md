---
name: dev6-review-fix
description: Apply fixes for review comments from dev5-review and commit. Sub-skill of the /dev workflow.
argument-hint: "[feature_name]"
---

# Dev Workflow — Step 6: Fix Review Comments

You are applying fixes for the code review comments.

## Input

1. Read `.llm/$ARGUMENTS/tmp_review.md` for the review comments
2. Read `.llm/$ARGUMENTS/prd.md` for context on what the feature should do

## Step 1: Triage comments

Read all review comments. Group them:
- **Critical** — Must fix. Bugs, security issues, correctness problems.
- **Suggestions** — Should fix. Code quality, readability improvements.
- **Nits** — Fix if quick. Minor style preferences.

## Step 2: Apply fixes

For each comment (starting with critical, then suggestions, then nits):
1. Read the referenced file and line
2. Apply the fix
3. Verify the fix doesn't break anything (run tests if applicable)

## Step 3: Verify

Run the test suite to make sure fixes didn't introduce regressions.

## Step 4: Commit

Stage and commit the review fixes:

```bash
git add -A && git commit -m "fix: address review comments for $ARGUMENTS"
```

## Step 5: Hand off

Tell the user review fixes are applied and committed, then immediately invoke `/dev7-pr $ARGUMENTS`.
