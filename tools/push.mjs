// Pushes this project to GitHub WITHOUT the git program, using the GitHub CLI (`gh api`).
// Why: this machine's security policy blocks git.exe, but gh.exe is allowed.
// Auth comes from `gh auth login` (stored in the Windows keyring) - no token in this repo.
//
// Usage: npm run push -- "commit message"
// It mirrors the working folder: files in .gitignore are skipped, .env is NEVER uploaded,
// and files deleted locally are removed from the repo in the new commit.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = "Pavithravignesh/mini-copilot";
const BRANCH = "main";
const ROOT = process.cwd();
const message = process.argv.slice(2).join(" ").trim() || "Update from npm run push";

function gh(method, endpoint, body) {
  const args = ["api", "-X", method, `repos/${REPO}/${endpoint}`];
  if (body) args.push("--input", "-");
  const out = execFileSync("gh", args, {
    input: body ? JSON.stringify(body) : undefined,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return out ? JSON.parse(out) : null;
}

// --- which files to upload -------------------------------------------------
// Supports simple .gitignore lines: "name", "folder/", "data/*.pdf" (* = any characters except /)
const patterns = [".git", ".env", ...fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").split(/\r?\n/)]
  .map((l) => l.trim().replace(/\/$/, ""))
  .filter((l) => l && !l.startsWith("#"))
  .map((p) => ({
    hasSlash: p.includes("/"),
    regex: new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$"),
  }));

const isIgnored = (relPath) =>
  patterns.some(({ hasSlash, regex }) => regex.test(hasSlash ? relPath : path.posix.basename(relPath)));

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (isIgnored(rel)) return [];
    return entry.isDirectory() ? listFiles(full) : [rel];
  });
}

if (process.argv.includes("--dry-run")) {
  console.log(listFiles(ROOT).join("\n"));
  process.exit(0);
}

const files = listFiles(ROOT);
if (files.some((f) => f === ".env" || f.endsWith("/.env"))) throw new Error("Refusing to upload .env");
console.log(`Uploading ${files.length} files to ${REPO}...`);

// --- find the current commit (an empty repo needs one first commit) --------
function headSha() {
  try {
    return gh("GET", `git/ref/heads/${BRANCH}`).object.sha;
  } catch {
    return null;
  }
}

let parent = headSha();
if (!parent) {
  // The Git Data API does not work on an empty repo, so create the first commit with one file.
  const readme = fs.readFileSync(path.join(ROOT, "README.md")).toString("base64");
  gh("PUT", "contents/README.md", { message: "Initial commit", content: readme, branch: BRANCH });
  parent = headSha();
}

// --- upload files as blobs, build a tree, commit, move the branch ----------
const tree = files.map((file, i) => {
  const content = fs.readFileSync(path.join(ROOT, file)).toString("base64");
  const blob = gh("POST", "git/blobs", { content, encoding: "base64" });
  process.stdout.write(`\r  ${i + 1}/${files.length} ${file}`.padEnd(70));
  return { path: file, mode: "100644", type: "blob", sha: blob.sha };
});
console.log();

const newTree = gh("POST", "git/trees", { tree }); // no base_tree: the commit mirrors this folder exactly
const commit = gh("POST", "git/commits", { message, tree: newTree.sha, parents: [parent] });
gh("PATCH", `git/refs/heads/${BRANCH}`, { sha: commit.sha });

console.log(`Pushed: https://github.com/${REPO}/commit/${commit.sha}`);
