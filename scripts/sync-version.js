#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getSubmoduleCommit() {
  try {
    const result = execSync('git submodule status astro-upstream', { encoding: 'utf8' });
    const commit = result.trim().split(' ')[0].replace(/^[+-]/, '');
    return commit;
  } catch (error) {
    console.error('Error getting submodule commit:', error.message);
    process.exit(1);
  }
}

function getAstroVersion() {
  try {
    const astroPackagePath = path.join(__dirname, '../astro-upstream/package.json');
    const astroPackage = JSON.parse(fs.readFileSync(astroPackagePath, 'utf8'));
    return astroPackage.version;
  } catch (error) {
    console.error('Error reading Astro version:', error.message);
    process.exit(1);
  }
}

function updatePackageVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const astroVersion = getAstroVersion();
    const submoduleCommit = getSubmoduleCommit();
    const shortCommit = submoduleCommit.substring(0, 7);
    
    const newVersion = `${astroVersion}-${shortCommit}`;
    const currentVersion = packageJson.version;
    
    if (currentVersion === newVersion) {
      console.log(`✅ Version already up to date: ${currentVersion}`);
      return false;
    }
    
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`📦 Updated version from ${currentVersion} to ${newVersion}`);
    console.log(`🔗 Based on Astro ${astroVersion} (commit ${shortCommit})`);
    
    // Update changelog
    updateChangelog(newVersion, astroVersion);
    
    return true;
  } catch (error) {
    console.error('Error updating package version:', error.message);
    process.exit(1);
  }
}

function updateChangelog(newVersion, astroVersion) {
  try {
    const changelogPath = path.join(__dirname, '../CHANGELOG.md');
    const today = new Date().toISOString().split('T')[0];
    
    const newEntry = `# Changelog

## [${newVersion}] - ${today}

### Updated
- Updated to Astro ${astroVersion}
- Synced with upstream Astro repository

`;
    
    let existingChangelog = '';
    if (fs.existsSync(changelogPath)) {
      existingChangelog = fs.readFileSync(changelogPath, 'utf8');
      // Remove the first line (# Changelog) if it exists
      const lines = existingChangelog.split('\n');
      if (lines[0].trim() === '# Changelog') {
        existingChangelog = lines.slice(1).join('\n');
      }
    }
    
    fs.writeFileSync(changelogPath, newEntry + existingChangelog);
    console.log(`📝 Updated CHANGELOG.md`);
  } catch (error) {
    console.warn('Warning: Could not update changelog:', error.message);
  }
}

function main() {
  console.log('🔄 Syncing version with Astro submodule...');
  
  const wasUpdated = updatePackageVersion();
  
  if (wasUpdated) {
    console.log('✨ Version sync complete!');
    console.log('💡 Run "npm run build" to build with the new version');
    console.log('🚀 Run "npm publish" to publish to npm');
  }
}

if (require.main === module) {
  main();
}

module.exports = { updatePackageVersion, getAstroVersion, getSubmoduleCommit };