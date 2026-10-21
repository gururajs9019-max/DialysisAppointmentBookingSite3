---
name: GitHub remote verification
description: Distinguish Replit's GitHub chat connector from the workspace Git remote and credentials.
---

Before pushing, verify the configured Git remote matches the repository the user intends to update. Replit's GitHub connector being active does not guarantee shell Git authentication. The Git Settings page manages remotes, while push controls appear in the main Git pane.

**Why:** Creating a remote through the UI changed the workspace's `origin` to a repository other than the intended destination, and shell pushes still failed despite an active GitHub connection.

**How to apply:** Confirm the remote URL and branch before any push. If push fails with authentication errors, do not request or expose credentials; explain the connection/permission issue and ask the user to reconnect the source-control account with write access.
