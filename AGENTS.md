<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:repo-git-workflow -->
# Git workflow for AI agents

After completing a requested change, commit AND push the work immediately unless the user explicitly asks not to — never wait for the user to request a push.

- Use the `smart-conventional-commits` skill to group and commit the changes; fall back to manual Conventional Commits only if the skill is unavailable.
- Run `git push` right after committing.
- Use Conventional Commits for every commit message.
- Stage only files that are directly relevant to the completed task.
- Do not use broad staging commands such as `git add .`.
- Leave unrelated worktree changes untouched.
<!-- END:repo-git-workflow -->
