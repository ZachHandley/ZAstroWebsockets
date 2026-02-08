import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolve workspace:* dependencies in a package.json to actual versions
 * from the upstream Astro monorepo workspace.
 */
export function resolveWorkspaceDeps(packageJsonPath: string, upstreamPackageDir: string): void {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

  for (const depType of ['dependencies', 'peerDependencies'] as const) {
    const deps = packageJson[depType]
    if (!deps) continue

    for (const [dep, version] of Object.entries(deps)) {
      if (version !== 'workspace:*') continue

      const resolvedDir = resolvePackageDir(dep)
      if (!resolvedDir) {
        console.warn(`  ⚠️ Unknown workspace package ${dep}, removing from ${depType}`)
        delete deps[dep]
        continue
      }

      const depPackageJsonPath = join(upstreamPackageDir, resolvedDir, 'package.json')
      if (existsSync(depPackageJsonPath)) {
        const depPackageJson = JSON.parse(readFileSync(depPackageJsonPath, 'utf-8'))
        deps[dep] = `^${depPackageJson.version}`
        console.log(`  ✅ Resolved ${dep}@workspace:* → ^${depPackageJson.version}`)
      } else {
        console.warn(`  ⚠️ Could not find package.json for ${dep} at ${depPackageJsonPath}`)
        delete deps[dep]
      }
    }
  }

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
}

/**
 * Map a package name to its directory path relative to the upstream packages/ root.
 */
function resolvePackageDir(dep: string): string | null {
  if (dep.startsWith('@astrojs/')) {
    const packageName = dep.replace('@astrojs/', '')
    if (packageName === 'internal-helpers') return 'internal-helpers'
    if (packageName === 'underscore-redirects') return 'underscore-redirects'
    return `integrations/${packageName}`
  }
  if (dep === 'astro') return 'astro'
  if (dep === 'astro-scripts') return '../../scripts'
  return null
}

/**
 * Prepare a final package.json for publishing:
 * - Rename the package
 * - Add metadata
 * - Resolve workspace deps
 * - Remove dev/build-only fields
 */
export function createFinalPackageJson(
  upstreamPackageJsonPath: string,
  finalPackageJsonPath: string,
  upstreamPackagesDir: string,
  config: {
    name: string
    description: string
  }
): void {
  const packageJson = JSON.parse(readFileSync(upstreamPackageJsonPath, 'utf-8'))

  // Set our package identity
  packageJson.name = config.name
  packageJson.description = config.description
  packageJson.author = 'Zach Handley <zach@zachhandley.com>'
  packageJson.repository = {
    type: 'git',
    url: 'https://github.com/zachhandley/ZAstroWebsockets.git'
  }

  // Add websockets keyword
  if (packageJson.keywords && !packageJson.keywords.includes('websockets')) {
    packageJson.keywords.push('websockets')
  }

  // Resolve workspace dependencies
  for (const depType of ['dependencies', 'peerDependencies'] as const) {
    const deps = packageJson[depType]
    if (!deps) continue

    for (const [dep, version] of Object.entries(deps)) {
      if (version !== 'workspace:*') continue

      const resolvedDir = resolvePackageDir(dep)
      if (!resolvedDir) {
        console.warn(`  ⚠️ Unknown workspace package ${dep}, removing from ${depType}`)
        delete deps[dep]
        continue
      }

      const depPackageJsonPath = join(upstreamPackagesDir, resolvedDir, 'package.json')
      if (existsSync(depPackageJsonPath)) {
        const depPackageJson = JSON.parse(readFileSync(depPackageJsonPath, 'utf-8'))
        deps[dep] = `^${depPackageJson.version}`
        console.log(`  ✅ Resolved ${dep}@workspace:* → ^${depPackageJson.version}`)
      } else {
        console.warn(`  ⚠️ Could not find package.json for ${dep} at ${depPackageJsonPath}`)
        delete deps[dep]
      }
    }
  }

  // Remove workspace-specific fields
  delete packageJson.bugs
  delete packageJson.homepage
  delete packageJson.scripts
  delete packageJson.devDependencies
  delete packageJson.publishConfig

  writeFileSync(finalPackageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
}
