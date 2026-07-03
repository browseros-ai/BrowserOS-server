---
name: dev5-review
description: Review implemented code for quality, correctness, and style. Produces review comments and creates a commit. Sub-skill of the /dev workflow.
argument-hint: "[feature_name]"
---

# Dev Workflow — Step 5: Code Review

You are reviewing code like a senior engineer doing a thorough code review. Be constructive but rigorous.

## Input

1. Read `.llm/$ARGUMENTS/prd.md` for what the feature should do
2. Read `.llm/$ARGUMENTS/design.md` for the chosen design
3. Run `git diff` to see all changes made during implementation

## Step 1: Style guide review

If the project uses TypeScript, invoke `/ts-style-review` to check all changed files against the Google TypeScript Style Guide and team conventions. Incorporate its findings into your review comments.

## Step 2: Review the code

Review every changed file. Check for:

### Correctness
- Does the implementation match the PRD requirements?
- Are there edge cases not handled?
- Are there logical errors?

### Code Quality
- Functions under 20-30 lines?
- Logic grouped without unnecessary blank lines?
- No excessive console.log statements?
- Comments only where logic is non-obvious (explaining *why*, not *what*)?
- Self-contained functions that do one thing?

### Architecture
- Does it follow existing codebase patterns?
- Are there unnecessary abstractions or over-engineering?
- Is the code simple and direct?

### Safety
- Any security issues (injection, XSS, etc.)?
- Proper error handling at system boundaries?
- No leaked secrets or credentials?

## Step 3: Write review comments

Write review comments to `.llm/$ARGUMENTS/tmp_review.md` in this format:

```
## Review Comments

### [file_path:line_number] — severity (critical/suggestion/nit)
Description of the issue and suggested fix.

### [file_path:line_number] — severity
...
```

## Step 4: Present review to user

Show the user a summary:
- Total files reviewed
- Number of critical / suggestion / nit comments
- Top 3 most important issues (if any)

## Step 5: Commit

Stage all changes and create a commit with a clear, descriptive commit message that summarizes the feature:

```bash
git add -A && git commit -m "feat: <concise description of what was built>"
```

## Step 6: Hand off

Tell the user the review summary, then:
- If there are critical or suggestion comments: immediately invoke `/dev6-review-fix $ARGUMENTS`
- If there are zero actionable comments (only nits or clean code): skip dev6 and immediately invoke `/dev7-pr $ARGUMENTS`
