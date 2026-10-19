---
name: Server test isolation
description: Keep filesystem failure fixtures away from the development watcher.
---

Create production-server filesystem-failure fixtures outside the project tree, using the operating system's temporary directory.

**Why:** Vite watches project-local temporary directories, including `.cache`; intentionally broken symlinks in regression fixtures can crash its watcher even though the isolated production server handles them correctly.

**How to apply:** Keep destructive or unreadable-file fixtures outside the workspace and remove them after tests. Link dependencies into the isolated fixture instead of moving the fixture into the watched tree.
