import fs from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { Bumper } from 'conventional-recommended-bump'
import pico from 'picocolors'
import * as semver from 'semver'

import { getPublickPackageDirs, ROOT, run } from './utils.js'

const allPublicPackageDirs = getPublickPackageDirs()

const { values: cliArgs } = parseArgs({
  options: {
    // the versions of these packages will be bumped, but `pnpm publish --recursive` will try to publish
    // all packages that have a version that isn't in the registry, not just the packages to be bumped now.
    bumpPackages: { type: 'string', multiple: true, default: allPublicPackageDirs },
    tag: { type: 'string' },
    registry: { type: 'string' },
    skipGit: { type: 'boolean' },
    skipChangelog: { type: 'boolean' },
    dryRun: { type: 'boolean' },
  },
  strict: true,
})

const bumpPackages = cliArgs.bumpPackages
  .map((name) => resolve(ROOT, 'packages', name))
  .filter((dir) => allPublicPackageDirs.includes(dir))

/** @type {string[]} */
const newTags = []

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}

async function main() {
  await ensureCleanIndex()
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

/**
 * @param {string} oldVersion
 * @param {string} bump
 */
function getTargetVersion(oldVersion, bump) {
  if (!oldVersion || !bump)
    throw new Error(`Missing target version ${JSON.stringify({ prev: oldVersion, newVersion: bump })}`)

  if (bump === 'patch' || bump === 'minor' || bump === 'major')
    return /** @type {string} */ (semver.inc(oldVersion, bump))

  if (semver.valid(bump)) return bump

  throw new Error(`Invalid version "${bump}"`)
}

async function updateVersions() {
  await Promise.all(
    bumpPackages.map(async (packageDir) => {
      const pkg = await getPackageJson(packageDir)
      const tagPrefix = `${pkg.name}@`
      const bumper = new Bumper().loadPreset('angular')

      bumper.tag({ prefix: tagPrefix })
      bumper.commits({ path: packageDir })
      const result = await bumper.bump()

      if (!('releaseType' in result)) {
        console.log(pico.bgBlue(pkg.name), pico.yellow('nothing to release'))
        return
      }

      const { reason, releaseType } = result
      console.log(pico.bgBlue(pkg.name), pico.blue(`${reason} - ${releaseType}`))

      const targetVersion = getTargetVersion(pkg.version, releaseType)
      pkg.version = targetVersion
      await writePackageJson(packageDir, pkg)
      newTags.push(`${tagPrefix}${targetVersion}`)

      if (!cliArgs.skipChangelog)
        await run('conventional-changelog', [
          '--preset',
          'angular',
          '--infile',
          resolve(packageDir, 'CHANGELOG.md'),
          '--same-file',
          '--pkg',
          resolve(packageDir, 'package.json'),
          '--commit-path',
          packageDir,
          '--tag-prefix',
          tagPrefix,
        ])
    }),
  )

  if (!newTags.length) console.warn(pico.bgYellow('No packages were bumped.'))
}

async function build() {
  await run('pnpm', ['run', 'build'])
}

/** Commit and add new version tag */
async function commit() {
  if (cliArgs.skipGit) return

  if (await indexIsDirty()) {
    await runUnlessDry('git', ['add', '--all'])
    await runUnlessDry('git', ['commit', '--no-verify', '--message', `release: ${newTags.join(' ')}`])
  }
}

async function pushAndPublish() {
  if (!cliArgs.skipGit) {
    await Promise.all(
      newTags.map((tag) => runUnlessDry('git', ['push', '--no-verify', 'origin', `HEAD:refs/tags/${tag}`])),
    )
    await runUnlessDry('git', ['push', '--no-verify'])
  }

  await run('pnpm', [
    'publish',
    '--recursive',
    ...(cliArgs.tag ? ['--tag', cliArgs.tag] : []),
    ...(cliArgs.registry ? ['--registry', cliArgs.registry] : []),
    ...(cliArgs.skipGit || cliArgs.dryRun ? ['--no-git-checks'] : []),
    ...(cliArgs.dryRun ? ['--dry-run'] : []),
  ])
}

/**
 * @param {string} packageDir
 * @returns {Promise<Record<string, any>>}
 */
async function getPackageJson(packageDir) {
  const filePath = resolve(packageDir, 'package.json')
  return JSON.parse((await fs.promises.readFile(filePath)).toString())
}

/**
 * @param {string} packageDir
 * @param {Record<string, any>} pkg
 * @returns {Promise<void>}
 */
async function writePackageJson(packageDir, pkg) {
  const filePath = resolve(packageDir, 'package.json')
  await fs.promises.writeFile(filePath, `${JSON.stringify(pkg, null, 2)}\n`)
}

/**
 * @type {typeof run}
 */
async function runUnlessDry(file, args) {
  if (cliArgs.dryRun) console.info('[would run]', file, ...(args ?? []))
  else await run(file, args)
}
