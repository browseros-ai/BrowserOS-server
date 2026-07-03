---
name: dev1-start
description: Start a new feature development. Does a high-level exploration of the codebase to understand the stack and project layout, then kicks off the design phase. Sub-skill of the /dev workflow.
argument-hint: "[feature description]"
---

# Dev Workflow — Step 1: Start & Explore

You are beginning a new feature development workflow. Do a quick, high-level exploration to understand the stack, project layout, and what already exists. This is not a deep dive — just orient yourself.

## Step 1: Set up the feature workspace

1. Derive a short snake_case feature name from the user's description (e.g., "add user auth" → `add_user_auth`)
2. Create the directory `.llm/<feature_name>/`
3. Write `.llm/<feature_name>/tmp_context.md` with:
   - The original feature request (verbatim from `$ARGUMENTS`)
   - Timestamp
   - Current working directory

## Step 2: High-level code exploration

Get a quick lay of the land:

1. **Read CLAUDE.md** — If there is a `CLAUDE.md` (or `.claude/CLAUDE.md`) in the project root, read it first. It contains project-specific instructions and context.
2. **Understand the stack** — What language(s), frameworks, and key dependencies does this project use? Check `package.json`, `Cargo.toml`, `go.mod`, or equivalent.
3. **Map the project structure** — List top-level directories and what each one is for. If it's a monorepo, identify the different packages/apps.
4. **Identify high-level features** — What does this project do? What are its main features or entry points?

Write your learnings to `.llm/<feature_name>/tmp_exploration.md`. Keep it concise — bullet points are fine.

## Step 3: Summarize for the user

Present a brief summary to the user:
- The stack and project structure
- Key projects/packages if it's a monorepo
- Where the new feature likely fits in

## Step 4: Hand off

Tell the user the exploration is complete, then immediately invoke `/dev2-design <feature_name>` (where `<feature_name>` is the slug you created in Step 1).
