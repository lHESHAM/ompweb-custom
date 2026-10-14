import { spawnSync } from "node:child_process";
import { mkdirSync, rmdirSync, existsSync, realpathSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export const UPSTREAM_URL = "https://github.com/kahme247/ompweb.git";

/** Merge upstream without stashing, resetting, or overwriting local changes. */
export function updateFromUpstream({ cwd, expectedUrl = UPSTREAM_URL, remote = "upstream", branch = "main", log = console.log } = {}) {
  const git = (args, timeout = 20000) => spawnSync("git", args, { cwd, encoding: "utf8", timeout, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_MERGE_AUTOEDIT: "no" } });
  const result = (status, message, extra = {}) => { log("[upstream] " + message); return { status, message, ...extra }; };
  if (process.env.OMPWEB_SKIP_UPSTREAM_UPDATE === "1") return result("skipped", "Update check disabled for this launch.");
  const root = git(["rev-parse", "--show-toplevel"]);
  if (root.status !== 0) return result("skipped", "Not a Git checkout; starting without an upstream update.");
  const canonical = (path) => { const value = realpathSync(path); return process.platform === "win32" ? value.toLowerCase() : value; };
  if (canonical(root.stdout.trim()) !== canonical(cwd)) return result("skipped", "The app is not at this checkout's root.");
  const gitDirResult = git(["rev-parse", "--absolute-git-dir"]);
  if (gitDirResult.status !== 0) return result("skipped", "Cannot locate Git state.");
  const gitDir = gitDirResult.stdout.trim();
  if (["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"].some((name) => existsSync(join(gitDir, name)))) return result("skipped", "A Git operation is already in progress; your work is unchanged.");
  const lock = join(gitDir, "ompweb-upstream-update.lock");
  try { mkdirSync(lock); } catch { return result("skipped", "Another update check owns the lock."); }
  try {
    const urlResult = git(["remote", "get-url", remote]);
    if (urlResult.status !== 0) return result("skipped", "No upstream remote configured; your work is unchanged.");
    if (urlResult.stdout.trim().replace(/\.git$/, "") !== expectedUrl.replace(/\.git$/, "")) return result("skipped", "Upstream URL does not match the configured original repository.");
    log("[upstream] Checking the original repository...");
    const fetch = git(["fetch", "--prune", remote], 20000);
    if (fetch.status !== 0) return result("skipped", "Could not fetch upstream; starting with your current version.");
    const ref = remote + "/" + branch;
    if (git(["rev-parse", "--verify", ref]).status !== 0) return result("skipped", "Upstream branch is unavailable.");
    const ancestry = git(["merge-base", "--is-ancestor", ref, "HEAD"]);
    if (ancestry.status === 0) return result("current", "Your custom version already includes the latest upstream changes.");
    if (ancestry.status !== 1) return result("skipped", "Could not compare upstream history.");
    if (git(["symbolic-ref", "--short", "HEAD"]).stdout.trim() !== branch) return result("skipped", "Updates available; switch to " + branch + " to merge them.");
    const dirty = git(["status", "--porcelain", "--untracked-files=all"]);
    if (dirty.status !== 0 || dirty.stdout.trim()) return result("skipped", "Updates available, but you have unsaved Git changes. Commit them first; nothing was replaced.");
    const head = git(["rev-parse", "HEAD"]).stdout.trim();
    const backup = "backup/upstream-" + Date.now() + "-" + randomUUID().slice(0, 6);
    if (git(["branch", backup, head]).status !== 0) return result("skipped", "Could not save a pre-update backup.");
    const abort = () => {
      if (!existsSync(join(gitDir, "MERGE_HEAD"))) return true;
      return git(["merge", "--abort"]).status === 0;
    };
    const merge = git(["merge", "--no-ff", "--no-commit", ref]);
    if (merge.status !== 0) {
      if (!abort()) return result("blocked", "The merge needs manual recovery; backup is " + backup + ".", { backup });
      return result("conflict", "Upstream conflicts with your custom changes. Merge aborted; your version is preserved. Backup: " + backup, { backup });
    }
    const commit = git(["commit", "-m", "Merge upstream " + branch + " into custom app"]);
    if (commit.status !== 0) {
      if (!abort()) return result("blocked", "Could not finish the merge; backup is " + backup + ".", { backup });
      return result("skipped", "Could not commit the update; merge aborted and your version is preserved.", { backup });
    }
    const dependencyDiff = git(["diff", "--name-only", head, "HEAD", "--", "package.json", "package-lock.json"]);
    return result("updated", "Merged upstream while retaining your custom commits. Backup: " + backup, { backup, dependenciesChanged: Boolean(dependencyDiff.stdout.trim()) });
  } finally { rmdirSync(lock); }
}

function installDependencies(cwd) {
  if (process.env.npm_execpath) return spawnSync(process.execPath, [process.env.npm_execpath, "ci", "--no-audit", "--no-fund"], { cwd, stdio: "inherit", windowsHide: true }).status === 0;
  if (process.platform === "win32") return spawnSync("cmd.exe", ["/d", "/s", "/c", "npm.cmd ci --no-audit --no-fund"], { cwd, stdio: "inherit", windowsHide: true }).status === 0;
  return spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd, stdio: "inherit" }).status === 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cwd = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const outcome = updateFromUpstream({ cwd });
  if (outcome.status === "blocked") process.exitCode = 1;
  else if (outcome.status === "updated" && outcome.dependenciesChanged && !installDependencies(cwd)) {
    console.error("[upstream] Dependency install failed. Your custom commits and backup remain safe; run npm ci before launching again.");
    process.exitCode = 1;
  }
}
