import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename, sep } from "node:path";
import { updateFromUpstream } from "./check-upstream.mjs";

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), "ompweb-upstream-test-"));
  t.after(() => {
    assert.ok(resolve(base).startsWith(resolve(tmpdir()) + sep) && basename(base).startsWith("ompweb-upstream-test-"));
    rmSync(base, { recursive: true, force: true });
  });
  const remote = join(base, "original.git"), seed = join(base, "seed"), cwd = join(base, "custom");
  const git = (dir, ...args) => {
    const run = spawnSync("git", args, { cwd: dir, encoding: "utf8", windowsHide: true });
    assert.equal(run.status, 0, run.stderr || run.stdout); return run.stdout.trim();
  };
  git(base, "init", "--bare", "--initial-branch=main", remote);
  mkdirSync(seed); git(seed, "init", "--initial-branch=main");
  for (const [key, value] of [["user.name", "Updater Test"], ["user.email", "updater@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) git(seed, "config", key, value);
  writeFileSync(join(seed, "custom.txt"), "base\n"); writeFileSync(join(seed, "upstream.txt"), "base\n");
  git(seed, "add", "."); git(seed, "commit", "-m", "Base"); git(seed, "remote", "add", "origin", remote); git(seed, "push", "origin", "main");
  git(base, "-c", "core.autocrlf=false", "clone", remote, cwd); git(cwd, "remote", "rename", "origin", "upstream");
  for (const [key, value] of [["user.name", "Updater Test"], ["user.email", "updater@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) git(cwd, "config", key, value);
  writeFileSync(join(cwd, "custom.txt"), "my customization\n"); git(cwd, "add", "."); git(cwd, "commit", "-m", "Custom UI");
  const originalHead = git(cwd, "rev-parse", "HEAD");
  const upstreamChange = (file = "upstream.txt") => { writeFileSync(join(seed, file), "new upstream change\n"); git(seed, "add", "."); git(seed, "commit", "-m", "Upstream update"); git(seed, "push", "origin", "main"); };
  const update = (extra = {}) => updateFromUpstream({ cwd, expectedUrl: remote, log() {}, ...extra });
  return { base, remote, seed, cwd, git, originalHead, upstreamChange, update };
}

test("clean update retains custom commits, merges upstream, and saves a backup", (t) => {
  const f = fixture(t); f.upstreamChange(); const result = f.update();
  assert.equal(result.status, "updated");
  assert.equal(readFileSync(join(f.cwd, "custom.txt"), "utf8"), "my customization\n");
  assert.equal(readFileSync(join(f.cwd, "upstream.txt"), "utf8"), "new upstream change\n");
  assert.equal(f.git(f.cwd, "rev-parse", result.backup), f.originalHead);
  assert.equal(f.git(f.cwd, "rev-list", "--parents", "-n", "1", "HEAD").split(" ").length, 3);
  assert.equal(f.git(f.cwd, "status", "--porcelain"), "");
  assert.equal(f.update().status, "current");
});
test("conflicting upstream edits abort the merge and preserve the original custom version", (t) => {
  const f = fixture(t); f.upstreamChange("custom.txt"); const result = f.update();
  assert.equal(result.status, "conflict");
  assert.equal(f.git(f.cwd, "rev-parse", "HEAD"), f.originalHead);
  assert.equal(readFileSync(join(f.cwd, "custom.txt"), "utf8"), "my customization\n");
  assert.equal(f.git(f.cwd, "status", "--porcelain"), "");
});
test("uncommitted files are never stashed, merged, or overwritten", (t) => {
  const f = fixture(t); f.upstreamChange(); writeFileSync(join(f.cwd, "custom.txt"), "unsaved edit\n"); writeFileSync(join(f.cwd, "draft.txt"), "draft\n");
  assert.equal(f.update().status, "skipped");
  assert.equal(f.git(f.cwd, "rev-parse", "HEAD"), f.originalHead);
  assert.equal(readFileSync(join(f.cwd, "custom.txt"), "utf8"), "unsaved edit\n");
  assert.equal(readFileSync(join(f.cwd, "draft.txt"), "utf8"), "draft\n");
});
test("feature branches and detached work are not automatically merged", (t) => {
  const f = fixture(t); f.upstreamChange(); f.git(f.cwd, "switch", "-c", "feature");
  assert.equal(f.update().status, "skipped"); assert.equal(f.git(f.cwd, "rev-parse", "HEAD"), f.originalHead);
});
test("offline fetch failure leaves the current custom checkout usable", (t) => {
  const f = fixture(t); const missing = join(f.base, "missing.git"); f.git(f.cwd, "remote", "set-url", "upstream", missing);
  assert.equal(f.update({ expectedUrl: missing }).status, "skipped"); assert.equal(f.git(f.cwd, "status", "--porcelain"), "");
});
test("wrong upstream URL is refused", (t) => { const f = fixture(t); assert.equal(f.update({ expectedUrl: "https://example.invalid/other.git" }).status, "skipped"); });
test("concurrent update lock prevents a second merge", (t) => { const f = fixture(t); mkdirSync(join(f.cwd, ".git", "ompweb-upstream-update.lock")); assert.equal(f.update().status, "skipped"); });
test("an existing user merge is left untouched", (t) => {
  const f = fixture(t); f.upstreamChange("custom.txt"); f.git(f.cwd, "fetch", "upstream");
  const merge = spawnSync("git", ["merge", "--no-commit", "upstream/main"], { cwd: f.cwd, encoding: "utf8" });
  assert.notEqual(merge.status, 0); const state = f.git(f.cwd, "status", "--porcelain");
  assert.equal(f.update().status, "skipped"); assert.equal(f.git(f.cwd, "status", "--porcelain"), state);
});
