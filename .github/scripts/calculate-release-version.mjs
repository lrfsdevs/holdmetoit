import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

function git(args) {
   return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function setOutput(name, value) {
   const line = `${name}=${value}\n`;
   if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, line);
   else process.stdout.write(line);
}

function parseVersion(tag) {
   const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
   return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
   for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return b[i] - a[i];
   }
   return 0;
}

function bumpVersion(version, level) {
   const next = [...version];
   if (level === "major") return [next[0] + 1, 0, 0];
   if (level === "minor") return [next[0], next[1] + 1, 0];
   return [next[0], next[1], next[2] + 1];
}

function commitBump(subject, body) {
   const match = /^([a-z][a-z0-9-]*)(?:\([^)]+\))?(!)?: .+/.exec(subject);
   if (!match) return null;
   const type = match[1];
   const breaking =
      Boolean(match[2]) || /(?:^|\n)BREAKING CHANGE:\s*\S/m.test(body);
   if (breaking) return "major";
   if (type === "feat") return "minor";
   if (["fix", "perf", "revert"].includes(type)) return "patch";
   return null;
}

const tags = git(["tag", "--list", "v[0-9]*"])
   .split("\n")
   .filter((tag) => parseVersion(tag))
   .sort((a, b) => compareVersions(parseVersion(a), parseVersion(b)));
const latestTag = tags[0] || null;
const range = latestTag ? `${latestTag}..HEAD` : "HEAD";
const rawLog = execFileSync("git", ["log", range, "--format=%s%x1f%b%x1e"], {
   encoding: "utf8",
});
const commits = rawLog
   .split("\x1e")
   .filter((entry) => entry.trim())
   .map((entry) => {
      const separator = entry.indexOf("\x1f");
      return {
         subject: entry.slice(0, separator).trim(),
         body: entry.slice(separator + 1).trim(),
      };
   });

const ranks = { patch: 1, minor: 2, major: 3 };
let bump = null;
for (const commit of commits) {
   const candidate = commitBump(commit.subject, commit.body);
   if (candidate && (!bump || ranks[candidate] > ranks[bump])) bump = candidate;
}

if (!bump) {
   setOutput("release", "false");
   setOutput("version", "");
   setOutput("target_sha", git(["rev-parse", "HEAD"]));
   setOutput(
      "reason",
      "No release-worthy Conventional Commits since the previous release."
   );
   process.exit(0);
}

let next;
if (!latestTag) {
   const pkg = JSON.parse(readFileSync("package.json", "utf8"));
   const base = parseVersion(`v${pkg.version}`);
   if (!base)
      throw new Error(
         "package.json version must be a stable SemVer version, such as 0.1.0."
      );
   next = base;
} else {
   next = bumpVersion(parseVersion(latestTag), bump);
}

const version = `v${next.join(".")}`;
if (tags.includes(version))
   throw new Error(`Refusing to overwrite existing tag ${version}.`);
setOutput("release", "true");
setOutput("version", version);
setOutput("target_sha", git(["rev-parse", "HEAD"]));
setOutput(
   "reason",
   `Detected ${bump} changes since ${latestTag || "the beginning of history"}.`
);
console.log(`Release candidate: ${version}`);
