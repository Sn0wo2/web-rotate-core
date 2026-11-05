import { spawnSync } from "node:child_process"

function git(command) {
  const result = spawnSync("git", command, { encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`\`git ${command.join(" ")}\` failed: ${result.stderr?.trim() || result.stdout?.trim()}`)
  }
  return result.stdout?.trim()
}

try {
  for (const name of ["VERSION", "GH_TOKEN", "DEFAULT_BRANCH"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`)
  }

  const version = process.env.VERSION
  const tag = `v${version}`
  const defaultBranch = process.env.DEFAULT_BRANCH

  git(["config", "user.name", "github-actions[bot]"])
  git(["config", "user.email", "github-actions[bot]@users.noreply.github.com"])
  git(["add", "-u", "--", "package.json", "bun.lock"])

  const tagExists = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`]).status === 0
  const staged = spawnSync("git", ["diff", "--cached", "--quiet"]).status !== 0
  if (!staged && tagExists) {
    console.log(`Tag ${tag} already points at the checked version; nothing to commit.`)
  } else {
    if (staged) git(["commit", "-m", `chore(release): bump version to ${version}`])
    const releaseSha = git(["rev-parse", "HEAD"])

    if (tagExists) {
      git(["fetch", "origin", defaultBranch])
      git(["checkout", "--detach", "FETCH_HEAD"])
      const picked = spawnSync("git", ["cherry-pick", releaseSha], { encoding: "utf8" })
      if (picked.status !== 0) {
        if (spawnSync("git", ["diff", "--cached", "--quiet"]).status !== 0) {
          throw new Error(`\`git cherry-pick ${releaseSha}\` failed: ${picked.stderr?.trim() || picked.stdout?.trim()}`)
        }
        git(["cherry-pick", "--skip"])
        console.log(`Version bump for ${tag} is already on ${defaultBranch}; nothing to cherry-pick.`)
      } else {
        git(["-c", "credential.helper=!gh auth git-credential", "push", "origin", `HEAD:refs/heads/${defaultBranch}`])
        console.log(`Cherry-picked the version bump for ${tag} onto ${defaultBranch}.`)
      }
      git(["checkout", "--detach", releaseSha])
    } else {
      git(["tag", tag])
      git([
        "-c",
        "credential.helper=!gh auth git-credential",
        "push",
        "--atomic",
        "origin",
        `HEAD:refs/heads/${defaultBranch}`,
        `refs/tags/${tag}`,
      ])
      console.log(`Tagged ${tag} and pushed it with ${defaultBranch}.`)
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
