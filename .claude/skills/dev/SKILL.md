---
name: dev
description: Full feature development workflow. Explores codebase, designs, writes PRD, implements, reviews, fixes, and creates PR. Use with "/dev <feature description>".
disable-model-invocation: true
argument-hint: "[feature description]"
---

# Dev Workflow — Orchestrator

Run the full feature development pipeline by invoking sub-skills sequentially. Start by invoking `/dev1-start $ARGUMENTS`. Each sub-skill will automatically chain to the next one.

## Pipeline

1. `/dev1-start` — High-level code exploration
2. `/dev2-design` — Design options (user picks one)
3. `/dev3-prd` — Questions + PRD
4. `/dev4-implement` — Implementation
5. `/dev5-review` — Code review + commit
6. `/dev6-review-fix` — Apply review fixes + commit (skipped if review is clean)
7. `/dev7-pr` — Create PR, wait for Greptile, address comments, push

## Instructions

Invoke `/dev1-start $ARGUMENTS` now. It will chain through the rest of the pipeline automatically. Each skill writes artifacts to `.llm/<feature_name>/` and hands off to the next skill.

Skills that need user input (design choice, question answers, PR approval) will pause and wait before continuing.
