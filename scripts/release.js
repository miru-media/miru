/* eslint-disable @typescript-eslint/no-unsafe-assignment, import/no-extraneous-dependencies */
import fs from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { globSync } from 'glob'
import spawn from 'nano-spawn'
import * as semver from 'semver'

const ROOT = resolve(import.meta.dirname, '..')

const { values: cliArgs } = parseArgs({
  options: {
    version: { type: 'string' },
    tag: { type: 'string' },
    registry: { type: 'string' },
    skipGit: { type: 'boolean' },
    skipChangelog: { type: 'boolean' },
    dryRun: { type: 'boolean' },
  },
  strict: true,
})

/** @type {string | null} */
let targetVersion

let packages = globSync(join(ROOT, 'packages', '*', 'package.json'))
  .filter((p) => {
    const pkg = /** @type {{ private?: boolean }} */ (JSON.parse(fs.readFileSync(p).toString()))
    return !pkg.private
  })
  .map((p) => dirname(p))

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}

async function main() {
  await ensureCleanIndex()
  getTargetVersion()
  await updateVersions()
  await build()
  await commit()
  await pushAndPublish()
}

/** Make sure the repo is clean */
async function ensureCleanIndex() {
  if (await indexIsDirty()) throw new Error('Working directory must be clean.')
}

async function indexIsDirty() {
  try {
    await run('git', ['diff-index', '-G', '.', 'HEAD', '--stat', '--exit-code'])
    return false
  } catch {
    return true
  }
}

/** Bump by or use --version arg */
function getTargetVersion() {
  const versionArg = cliArgs.version
  if (!versionArg) throw new Error('Missing "--version" argument.')

  if (versionArg === 'patch' || versionArg === 'minor' || versionArg === 'major') {
    /** @type {{ version: string }} */
    const pkg = JSON.parse(fs.readFileSync(resolve(ROOT, 'package.json')).toString())
    const oldVersion = pkg.version
    targetVersion = semver.inc(oldVersion, versionArg)
  } else if (semver.valid(versionArg)) targetVersion = versionArg
  else throw new Error(`Invalid version "${versionArg}"`)
}

async function updateVersions() {
  await editPackageJsons((pkg) => {
    pkg.version = targetVersion
  })
  if (!cliArgs.skipChangelog) await run('pnpm', ['run', 'changelog'])
}

async function build() {
  await run('pnpm', ['run', 'build'])
}

/** Commit and add new version tag */
async function commit() {
  if (cliArgs.skipGit) return

  if (await indexIsDirty()) {
    await runUnlessDry('git', ['add', '--all'])
    await runUnlessDry('git', ['commit', '--no-verify', '--message', `release: v${targetVersion}`])
  }
  await runUnlessDry('git', ['tag', `v${targetVersion}`])
}

async function pushAndPublish() {
  if (!cliArgs.skipGit) {
    await runUnlessDry('git', ['push', '--no-verify', 'origin', `HEAD:refs/tags/v${targetVersion}`])
    await runUnlessDry('git', ['push', '--no-verify'])
  }

  await run('pnpm', [
    'publish',
    '--recursive',
    ...(cliArgs.tag ? ['--tag', cliArgs.tag] : []),
    ...(cliArgs.registry ? ['--registry', cliArgs.registry] : []),
    ...(cliArgs.skipGit ? ['--no-git-checks'] : []),
    ...(cliArgs.dryRun ? ['--dry-run'] : []),
  ])
}

/**
 * @param {(pkg: Record<string, any>) => void} edit
 */
async function editPackageJsons(edit) {
  await Promise.all(
    ['.', ...packages].map(async (packageDir) => {
      const filePath = resolve(packageDir, 'package.json')
      const pkg = JSON.parse((await fs.promises.readFile(filePath)).toString())
      edit(pkg)
      await fs.promises.writeFile(filePath, `${JSON.stringify(pkg, null, 2)}\n`)
    }),
  )
}

/**
 * @param {string} file
 * @param {readonly string[] | undefined} args
 */
async function run(file, args) {
  console.info(file, ...(args ?? []))
  await spawn(file, args, { stdio: 'inherit' })
}

/**
 * @type {typeof run}
 */
async function runUnlessDry(file, args) {
  if (cliArgs.dryRun) console.info('[would run]', file, ...(args ?? []))
  else await run(file, args)
}
