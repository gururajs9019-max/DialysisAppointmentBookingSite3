---
name: Browser test runtime
description: Runtime requirements for the project's Playwright browser checks.
---

Browser tests must declare the Chromium shared-library dependencies in the Replit Nix configuration in addition to the Playwright npm package.

**Why:** Playwright can download Chromium successfully while the browser still fails at launch when the container does not expose its GLib, graphics, X11, and ALSA libraries.

**How to apply:** When changing browser-test tooling or recreating the environment, keep the project-level browser runtime dependencies in sync and verify the existing automated test command launches Chromium.