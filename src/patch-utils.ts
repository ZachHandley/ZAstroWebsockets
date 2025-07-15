/**
 * Patch management utilities for applying WebSocket support to Astro adapters
 */
import { readdir, readFile, writeFile, access, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface AdapterInfo {
  name: string
  version: string
  path: string
  packageJsonPath: string
}

export interface PatchInfo {
  adapter: string
  version: string
  patchFiles: string[]
  backupPath?: string
}

/**
 * Detect installed Astro adapters and their versions
 */
export async function detectInstalledAdapters(): Promise<AdapterInfo[]> {
  const adapters: AdapterInfo[] = []
  const adapterNames = ['node', 'cloudflare', 'netlify', 'vercel']
  
  for (const adapterName of adapterNames) {
    try {
      const packageName = `@astrojs/${adapterName}`
      const adapterPath = join(process.cwd(), 'node_modules', packageName)
      const packageJsonPath = join(adapterPath, 'package.json')
      
      // Check if adapter exists
      await access(packageJsonPath)
      
      // Read version from package.json
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
      
      adapters.push({
        name: adapterName,
        version: packageJson.version,
        path: adapterPath,
        packageJsonPath
      })
    } catch (error) {
      // Adapter not installed, skip
    }
  }
  
  return adapters
}

/**
 * Get available patch files for an adapter version
 */
export async function getAvailablePatches(adapter: string, version: string): Promise<string[]> {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const patchDir = join(__dirname, '..', 'patches', adapter, version)
  
  try {
    const files = await readdir(patchDir)
    return files
      .filter(file => file.endsWith('.patch'))
      .sort() // Ensure patches are applied in order
  } catch (error) {
    return []
  }
}

/**
 * Get the best matching patch version for an adapter
 */
export async function getBestPatchVersion(adapter: string, installedVersion: string): Promise<string | null> {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const adapterPatchDir = join(__dirname, '..', 'patches', adapter)
  
  try {
    const availableVersions = await readdir(adapterPatchDir)
    
    // First try exact version match
    if (availableVersions.includes(installedVersion)) {
      return installedVersion
    }
    
    // Try to find the closest compatible version
    // This is a simplified version - in production we'd use semver
    const [major, minor] = installedVersion.split('.').map(n => parseInt(n, 10))
    
    const compatibleVersions = availableVersions
      .filter(v => {
        const [vMajor, vMinor] = v.split('.').map(n => parseInt(n, 10))
        return vMajor === major && vMinor <= minor
      })
      .sort((a, b) => {
        const [aMajor, aMinor, aPatch] = a.split('.').map(n => parseInt(n, 10))
        const [bMajor, bMinor, bPatch] = b.split('.').map(n => parseInt(n, 10))
        
        if (aMajor !== bMajor) return bMajor - aMajor
        if (aMinor !== bMinor) return bMinor - aMinor
        return bPatch - aPatch
      })
    
    return compatibleVersions[0] || null
  } catch (error) {
    return null
  }
}

/**
 * Create backup of adapter files before patching
 */
export async function createBackup(adapterPath: string): Promise<string> {
  const backupPath = `${adapterPath}.zastro-backup`
  
  try {
    await execAsync(`cp -r "${adapterPath}" "${backupPath}"`)
    return backupPath
  } catch (error) {
    throw new Error(`Failed to create backup: ${error}`)
  }
}

/**
 * Restore adapter from backup
 */
export async function restoreFromBackup(adapterPath: string, backupPath: string): Promise<void> {
  try {
    await execAsync(`rm -rf "${adapterPath}"`)
    await execAsync(`cp -r "${backupPath}" "${adapterPath}"`)
  } catch (error) {
    throw new Error(`Failed to restore from backup: ${error}`)
  }
}

/**
 * Apply patch files to an adapter
 */
export async function applyPatches(adapterInfo: AdapterInfo, patchVersion: string): Promise<PatchInfo> {
  const patchFiles = await getAvailablePatches(adapterInfo.name, patchVersion)
  
  if (patchFiles.length === 0) {
    throw new Error(`No patches available for ${adapterInfo.name}@${patchVersion}`)
  }
  
  // Create backup first
  const backupPath = await createBackup(adapterInfo.path)
  
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const patchDir = join(__dirname, '..', 'patches', adapterInfo.name, patchVersion)
    
    for (const patchFile of patchFiles) {
      const patchPath = join(patchDir, patchFile)
      
      console.log(`[zastro-websockets] Applying patch: ${patchFile}`)
      
      // Apply patch using git apply
      await execAsync(`cd "${adapterInfo.path}" && git apply "${patchPath}"`, {
        cwd: adapterInfo.path
      })
    }
    
    console.log(`[zastro-websockets] Successfully applied ${patchFiles.length} patches to ${adapterInfo.name}`)
    
    return {
      adapter: adapterInfo.name,
      version: patchVersion,
      patchFiles,
      backupPath
    }
  } catch (error) {
    // Restore backup on failure
    await restoreFromBackup(adapterInfo.path, backupPath)
    throw new Error(`Failed to apply patches to ${adapterInfo.name}: ${error}`)
  }
}

/**
 * Remove patches from an adapter (restore original)
 */
export async function removePatches(adapterInfo: AdapterInfo, patchInfo: PatchInfo): Promise<void> {
  if (patchInfo.backupPath) {
    await restoreFromBackup(adapterInfo.path, patchInfo.backupPath)
    
    // Clean up backup
    await execAsync(`rm -rf "${patchInfo.backupPath}"`)
    
    console.log(`[zastro-websockets] Removed patches from ${adapterInfo.name}`)
  }
}

/**
 * Check if an adapter has been patched
 */
export async function isPatched(adapterPath: string): Promise<boolean> {
  try {
    // Check for our WebSocket marker files
    const markerFiles = [
      join(adapterPath, 'src', 'websocket.ts'),
      join(adapterPath, 'src', 'websocket-middleware.ts')
    ]
    
    for (const markerFile of markerFiles) {
      try {
        await access(markerFile)
        return true
      } catch {
        // File doesn't exist, continue
      }
    }
    
    return false
  } catch (error) {
    return false
  }
}

/**
 * Get patch status for all installed adapters
 */
export async function getPatchStatus(): Promise<Array<{adapter: AdapterInfo, isPatched: boolean, availableVersion: string | null}>> {
  const adapters = await detectInstalledAdapters()
  const status = []
  
  for (const adapter of adapters) {
    const patched = await isPatched(adapter.path)
    const availableVersion = await getBestPatchVersion(adapter.name, adapter.version)
    
    status.push({
      adapter,
      isPatched: patched,
      availableVersion
    })
  }
  
  return status
}