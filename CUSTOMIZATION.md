# Your customized ompweb

This checkout keeps the original project's MIT license and history. Your custom
interface and fixes are saved as additional commits on main.

## Launch and update

Double-click **Launch ompweb.cmd** on Windows, or run **npm run launch**.
The development server opens at http://127.0.0.1:30178. The same upstream check
runs before npm run dev and npm run dev:lan. The OMP agent runtime is still
required for live model conversations.

The launcher fetches **upstream** (https://github.com/kahme247/ompweb.git).
When main has a clean working tree, it saves a backup branch and merges new
upstream commits with your custom commits. It never resets, force-pushes,
stashes your edits, or automatically pushes to GitHub. When upstream modifies
the same lines as your changes, it aborts the merge and starts your existing
version with a conflict notice in the terminal. Offline launches keep working.

Commit any further customizations before launching if you want the automatic
merge to run. A feature branch, unsaved changes, or an existing Git operation
causes the merge to be skipped. A changed package manifest or lockfile triggers
npm ci after a successful update. An install failure stops startup and reports
the recovery command rather than launching with missing dependencies.

For one launch without an update check, set OMPWEB_SKIP_UPSTREAM_UPDATE=1.
If the computer stops during an update, inspect Git state before removing the
ompweb-upstream-update.lock directory inside the Git directory.

## Remotes and production builds

**origin** is your own GitHub repository. **upstream** is the original project.
Use git push origin main to publish subsequent local changes or merged updates.
The auto-update launch path is the source/development launcher above. Packaged
npm installs and npm start production builds do not automatically merge source:
production builds need a separate rebuild after a manual upstream update.
