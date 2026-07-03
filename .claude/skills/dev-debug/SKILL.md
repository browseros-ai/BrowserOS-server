---
name: dev-debug
description: Debug an issue by identifying root causes, fixing the most probable one, testing, and committing. Use with "/dev-debug <description of the issue>".
disable-model-invocation: true
argument-hint: "[issue description]"
---

# Debug Workflow

You are debugging an issue. Be methodical — understand before you fix.

## Step 1: Understand the issue

1. Derive a short slug from the issue description (e.g., "login fails after redirect" → `login_redirect_fail`)
2. Create `.llm/debug_<slug>/` directory
3. Read the relevant code paths. Trace the logic that relates to the issue described in `$ARGUMENTS`.
4. Identify **2-5 possible root causes**, ranked by probability.

Write your analysis to `.llm/debug_<slug>/tmp_root_causes.md`:

```
## Issue
<restate the issue clearly>

## Root Causes (ranked by probability)

### 1. [Most likely] — <short title>
- **Why**: Explanation of why this could be the cause
- **Evidence**: What in the code supports this theory
- **Files**: Relevant file paths

### 2. <short title>
...
```

Present the root causes to the user. Ask if they agree with the ranking or want to override which one to fix first.

## Step 2: Fix the most probable root cause

After user confirms (or you proceed with #1 by default):

1. Implement the fix — keep it minimal and focused. Only change what's needed to address the root cause.
2. Follow existing code patterns and conventions.
3. No drive-by refactors — fix the bug, nothing else.

## Step 3: Test

1. Run existing tests if they cover the affected code path.
2. If no tests exist or tests don't cover this case, tell the user what to test manually and what the expected behavior should be.
3. If tests fail, fix and re-test in a loop.

## Step 4: Commit

Stage and commit the fix:

```bash
git add -A && git commit -m "fix: <concise description of what was fixed and why>"
```

## Step 5: Check for remaining issues

If the fix didn't fully resolve the issue (or if there are related problems):
1. Update `.llm/debug_<slug>/tmp_root_causes.md` — mark #1 as addressed, re-rank remaining causes
2. Go back to Step 2 with the next root cause
3. Commit after each fix

When the issue is resolved, tell the user:

> Debug complete. Fixed in N commit(s). See `.llm/debug_<slug>/tmp_root_causes.md` for the full analysis.
