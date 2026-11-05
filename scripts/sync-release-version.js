import { spawnSync } from "node:child_process"
import { appendFileSync } from "node:fs"

try {
  for (const name of ["GITHUB_OUTPUT", "VERSION"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`)
  }

  for (const command of [
    ["npm", "pkg", "set", `version=${process.env.VERSION}`],
    ["bun", "install"],
  ]) {
    const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" })
    if (result.status !== 0) {
      throw new Error(`\`${command.join(" ")}\` failed: ${result.stderr?.trim() || result.stdout?.trim()}`)
    }
  }

  const changed = spawnSync("git", ["diff", "--quiet", "--", "package.json", "bun.lock"]).status !== 0
  if (changed) appendFileSync(process.env.GITHUB_OUTPUT, "changed=true\n")
  console.log(
    changed ? `Package version synced to ${process.env.VERSION}.` : `Package version already ${process.env.VERSION}.`,
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
