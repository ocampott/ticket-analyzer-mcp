import path from "node:path";

const notFound = (error) => error?.code === "ENOENT";
async function kind(filesystem, target) {
  try {
    const stat = await filesystem.lstat(target);
    return stat.isSymbolicLink?.() ? "symlink" : stat.isDirectory?.() ? "directory" : stat.isFile?.() ? "file" : "other";
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}
function ancestors(start) {
  const result = [];
  let current = path.resolve(start);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) return result;
    current = parent;
  }
}

export async function resolveProjectRoot(cwd, filesystem) {
  if (!filesystem?.realpath || !filesystem?.lstat) throw new Error("Project-root resolution requires an injected filesystem.");
  const canonicalCwd = await filesystem.realpath(cwd);
  for (const candidate of ancestors(canonicalCwd)) {
    const git = await kind(filesystem, path.join(candidate, ".git"));
    if (git === "directory" || git === "file") return { root: candidate, canonicalRoot: candidate };
  }
  for (const candidate of ancestors(canonicalCwd)) {
    if ((await kind(filesystem, path.join(candidate, "package.json"))) === "file") {
      return { root: candidate, canonicalRoot: candidate };
    }
  }
  throw new Error("Cannot resolve a project root: run setup inside a Git worktree or a project containing package.json.");
}
