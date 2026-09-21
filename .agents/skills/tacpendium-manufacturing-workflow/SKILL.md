---
name: tacpendium-manufacturing-workflow
description: Run an existing Tacpendium implementation, test, build-check, code-review, implementation-research, or design-handover-report workflow without duplicating its Claude command source. Use when the user requests add_e2e_spec, app_build_check, audit_validation_coverage, design_handover_report, implement_plan, implement_plan_full, their _wt variants, incorporate_plan, precheck_seed_data, research_plan, research_plan_wt, review_plan, or their _wt variants.
---

# Run a shared manufacturing workflow

1. Resolve the repository root with `git rev-parse --show-toplevel` and remain inside it.
2. Normalize the requested workflow name by removing a leading `/` or `$` and converting `-` to `_` only when needed to match an existing filename.
3. Accept only these manufacturing workflow basenames:
   - `add_e2e_spec`
   - `app_build_check`
   - `audit_validation_coverage`
   - `implement_plan`, `implement_plan_full`, `implement_plan_wt`, `implement_plan_full_wt`
   - `incorporate_plan`, `incorporate_plan_wt`
   - `precheck_seed_data`
   - `research_plan`, `research_plan_wt`
   - `review_plan`, `review_plan_wt`
   - `design_handover_report`
4. If the requested name is not in that list, stop. Explain that design, instruction-authoring, milestone/phase-kit, prompt, and documentation-maintenance commands remain Claude-only. `design_handover_report` is the one explicitly allowed exception: it is the closing step of a manufacturing run, so the list above wins over that general rule.
5. Resolve the accepted workflow as `.claude/commands/<name>.md`, then read `AGENTS.md`, `CLAUDE.md`, and that workflow file completely before acting. If the file is missing, report the mismatch and stop rather than guessing.
6. Treat the user's text after the workflow name as `$ARGUMENTS`. Treat role references to "Claude" or "Claude Code" as Codex unless the workflow explicitly produces material for Claude Web or describes compatibility behavior.
7. Treat `allowed-tools` in Claude frontmatter as documentation of intended scope, not as Codex authorization. Obey the active Codex sandbox, approvals, `.codex/rules`, and the stricter instructions in `AGENTS.md` and the selected workflow.
8. Execute the workflow in order. Preserve any `_wt` worktree guard as the highest-priority workflow constraint.

Keep `.claude/commands` as the canonical workflow source so Claude Code and Codex do not drift. Do not copy or rewrite the selected workflow unless the user explicitly asks to update it.
