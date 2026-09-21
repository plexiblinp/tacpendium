# Tacpendium (SF6 Combo Manager) - Codex Instructions

This repository uses both Claude Code and Codex. `CLAUDE.md` is the shared, canonical project instruction document; read it completely before planning, editing, reviewing, or running a manufacturing workflow. Apply every repository rule in it to Codex as well, replacing references to "Claude Code" with "Codex" when they describe agent behavior.

Codex-specific compatibility rules:

- Use Codex mainly for implementation, testing, and code review. Keep design work, instruction-authoring workflows, milestone/phase kits, and design-document maintenance on the existing Claude side unless the user explicitly asks otherwise.
- Never delete or weaken `CLAUDE.md`, `.claude/settings.json`, `.claude/commands`, or `.claude/hooks`. They remain active for Claude Code.
- Treat the Git and dangerous-command restrictions in `CLAUDE.md` section 10 as mandatory even when the Codex sandbox or `.codex/rules` would technically permit an action.
- `.claude/settings.json` is not a Codex policy file. Equivalent Codex defaults, hooks, and escalation guards live under `.codex/`; textual restrictions in `CLAUDE.md` still take precedence.
- For an allowed manufacturing workflow defined in `.claude/commands`, use the `tacpendium-manufacturing-workflow` repo skill. Do not assume Claude slash commands are native Codex slash commands.
- The existing `.claude/hooks` scripts are shared compatibility assets. Codex invokes the safe quality/test subset through `.codex/hooks.json`; do not edit their Claude behavior solely for Codex.
- Keep authentication and personal settings under `CODEX_HOME` (normally `/home/node/.codex`). Never copy `auth.json`, tokens, sessions, or the contents of `CODEX_HOME` into the repository or display them.
- In a `wt-*` worktree, never read from or write to sibling worktrees or the main working tree. Use paths inside the current Git worktree only.
- When task-specific user instructions conflict with the checkpoint-commit convention in `CLAUDE.md`, follow the explicit task instruction. In particular, do not commit when the user asks to stop in a reviewable uncommitted state.

Keep this adapter concise. Put shared project rules in `CLAUDE.md` so Claude Code and Codex continue to use one source of truth.
