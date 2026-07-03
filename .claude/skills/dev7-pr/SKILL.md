---
name: dev7-pr
description: Create a PR, push to GitHub, wait for Greptile review, address comments, and push final. Sub-skill of the /dev workflow.
argument-hint: "[feature_name]"
---

# Dev Workflow — Step 7: PR & External Review

You are creating a pull request, waiting for automated review (Greptile), and addressing any comments.

## Input

1. Read `.llm/$ARGUMENTS/prd.md` for the feature summary
2. Read `.llm/$ARGUMENTS/design.md` for design context
3. Run `git log --oneline -10` to see recent commits

## Step 1: Push and create PR

Push the current branch and create a PR:

```bash
git push -u origin HEAD
```

Then create the PR using the PRD Level 1 summary as the body:

```bash
gh pr create --title "feat: <concise feature title>" --body "<PR body from PRD Level 1>"
```

The PR body should include:
- **Summary** — 2-3 bullet points from the PRD requirements
- **Design** — One paragraph on the chosen approach
- **Test plan** — How to verify the feature works

## Step 2: Wait for Greptile review

Tell the user: "Waiting 10 minutes for Greptile to review the PR..."

Start a timer:

```bash
echo "Waiting for Greptile review..." && sleep 600 && echo "Timer complete — checking for PR comments."
```

## Step 3: Pull PR comments

After the timer, fetch PR comments:

```bash
gh pr view --comments
```

Also check the review comments:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

## Step 4: Address PR comments

If there are review comments from Greptile or other reviewers:
1. Read each comment
2. Apply the fix to the relevant file
3. Keep fixes focused — only change what the comment asks for

If there are no comments, skip to Step 5.

## Step 5: Commit and push

If fixes were made:

```bash
git add -A && git commit -m "fix: address PR review comments for $ARGUMENTS" && git push
```

## Step 6: Done

Tell the user:

> PR created and review comments addressed. The feature is ready for human review.
> PR URL: <url from gh pr create>

Write a final summary to `.llm/$ARGUMENTS/tmp_done.md` with:
- PR URL
- Total commits
- Summary of what was built
- Any follow-up items or tech debt noted during review
