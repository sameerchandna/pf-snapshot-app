---
name: push
description: Stage all changes, auto-generate a commit message, and push to remote
user_invocable: true
---

# /push — Git add, commit, and push

Follow these steps exactly:

1. Run `git status` to see all current changes (staged, unstaged, and untracked).
2. Run `git diff` and `git diff --cached` to review the changes.
3. Run `git log --oneline -5` to match the repository's commit message style.
4. Analyze the changes and auto-generate a concise commit message (1-2 sentences) that summarizes the "why" of the changes. Match the style of recent commits. Do NOT ask the user for a message.
5. Stage all changes with `git add -A`.
6. Create the commit with the auto-generated message. Append the co-authored-by trailer:
   ```
   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   ```
7. Push to the remote with `git push`. If no upstream is set, use `git push -u origin <current-branch>`.
8. Confirm success and show the final `git status`.
