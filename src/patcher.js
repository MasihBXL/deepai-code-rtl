#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Determine asar package location
let asar;
try {
  asar = require('@electron/asar');
} catch {
  try {
    asar = require('asar');
  } catch {
    const globalNpxAsar = path.join(
      process.env.LOCALAPPDATA || '',
      'npm-cache/_npx/8b3f11f22d4db0c9/node_modules/asar'
    );
    if (fs.existsSync(globalNpxAsar)) {
      asar = require(globalNpxAsar);
    } else {
      console.log('Installing asar dependency...');
      execSync('npm install --no-save asar', { stdio: 'inherit' });
      asar = require('asar');
    }
  }
}

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

function log(msg, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function getDefaultDeepAIPath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'Programs', 'deepai-code-desktop');
}

function findInstallation(customPath) {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  const defaultPath = getDefaultDeepAIPath();
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  return null;
}

function isAppRunning() {
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq DeepAI Code.exe" /NH', { encoding: 'utf8' });
    return output.toLowerCase().includes('deepai code.exe');
  } catch {
    return false;
  }
}

function closeApp() {
  log('Closing running instances of DeepAI Code...', COLORS.yellow);
  try {
    execSync('taskkill /F /IM "DeepAI Code.exe" /T', { stdio: 'ignore' });
  } catch {}
}

function generateInjectionPayload() {
  const cssPath = path.join(__dirname, 'deepai-rtl.css');
  const jsPath = path.join(__dirname, 'deepai-rtl-engine.js');

  const cssContent = fs.readFileSync(cssPath, 'utf8').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  return `
/* === DEEPAI-CODE RTL & PERSIAN ENHANCER INJECTION START === */
(function() {
  try {
    function injectStylesAndEngine() {
      if (document.getElementById('deepai-rtl-injected-styles')) return;

      const style = document.createElement('style');
      style.id = 'deepai-rtl-injected-styles';
      style.textContent = \`${cssContent}\`;
      (document.head || document.documentElement).appendChild(style);

      ${jsContent}
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStylesAndEngine);
    } else {
      injectStylesAndEngine();
    }
  } catch (err) {
    console.error('[DeepAI-RTL] Injection failed:', err);
  }
})();
/* === DEEPAI-CODE RTL & PERSIAN ENHANCER INJECTION END === */
`;
}

async function applyPatch(options = {}) {
  log('\n=== DeepAI Code RTL & Persian Patch Installer ===\n', COLORS.cyan + COLORS.bold);

  const installDir = findInstallation(options.path);
  if (!installDir) {
    log('Error: Could not locate DeepAI Code installation directory.', COLORS.red);
    log(`Looked in: ${getDefaultDeepAIPath()}`, COLORS.yellow);
    log('Please specify custom path with --path <path>', COLORS.yellow);
    process.exit(1);
  }

  log(`Found DeepAI Code installation at:\n  ${installDir}`, COLORS.green);

  if (isAppRunning()) {
    log('DeepAI Code is currently running.', COLORS.yellow);
    closeApp();
  }

  const resourcesDir = path.join(installDir, 'resources');
  const appAsarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  if (!fs.existsSync(appAsarPath)) {
    log(`Error: app.asar not found at ${appAsarPath}`, COLORS.red);
    process.exit(1);
  }

  // Backup original if not already backed up
  if (!fs.existsSync(backupPath)) {
    log('Creating original backup at app.asar.bak...', COLORS.cyan);
    fs.copyFileSync(appAsarPath, backupPath);
  } else {
    log('Original backup already exists at app.asar.bak.', COLORS.cyan);
  }

  const tempExtractDir = path.join(resourcesDir, `temp_patch_${Date.now()}`);

  try {
    log('Unpacking app.asar...', COLORS.cyan);
    asar.extractAll(appAsarPath, tempExtractDir);

    const preloadPath = path.join(tempExtractDir, 'apps', 'desktop', 'dist-electron', 'preload.cjs');
    if (!fs.existsSync(preloadPath)) {
      throw new Error(`preload.cjs not found inside app.asar at ${preloadPath}`);
    }

    let preloadContent = fs.readFileSync(preloadPath, 'utf8');

    if (preloadContent.includes('DEEPAI-CODE RTL & PERSIAN ENHANCER INJECTION START')) {
      log('Existing RTL patch detected in preload.cjs. Updating patch...', COLORS.yellow);
      preloadContent = preloadContent.replace(
        /\/\* === DEEPAI-CODE RTL & PERSIAN ENHANCER INJECTION START ===[\s\S]*?DEEPAI-CODE RTL & PERSIAN ENHANCER INJECTION END === \*\//,
        ''
      );
    }

    const payload = generateInjectionPayload();
    preloadContent += '\n' + payload;

    fs.writeFileSync(preloadPath, preloadContent, 'utf8');
    log('Injected RTL engine and CSS into preload.cjs.', COLORS.green);

    log('Repacking app.asar...', COLORS.cyan);
    const newAsarPath = path.join(resourcesDir, 'app.asar.new');

    await asar.createPackageWithOptions(tempExtractDir, newAsarPath, {
      unpack: '{**/*.node,**/*.exe}'
    });

    // Replace original app.asar with new one
    fs.unlinkSync(appAsarPath);
    fs.renameSync(newAsarPath, appAsarPath);

    log('\n✓ RTL Patch applied successfully!', COLORS.green + COLORS.bold);
    log('You can now open DeepAI Code and enjoy beautiful Persian RTL rendering.\n', COLORS.cyan);
  } catch (err) {
    log(`Patching failed: ${err.message}`, COLORS.red);
    if (fs.existsSync(backupPath)) {
      log('Restoring backup...', COLORS.yellow);
      try {
        fs.copyFileSync(backupPath, appAsarPath);
        log('Restored original app.asar from backup.', COLORS.green);
      } catch (rErr) {
        log(`Failed to restore backup: ${rErr.message}`, COLORS.red);
      }
    }
    process.exit(1);
  } finally {
    if (fs.existsSync(tempExtractDir)) {
      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

function restoreBackup(options = {}) {
  log('\n=== DeepAI Code RTL Restore Original ===\n', COLORS.cyan + COLORS.bold);

  const installDir = findInstallation(options.path);
  if (!installDir) {
    log('Error: Could not locate DeepAI Code directory.', COLORS.red);
    process.exit(1);
  }

  if (isAppRunning()) {
    closeApp();
  }

  const resourcesDir = path.join(installDir, 'resources');
  const appAsarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  if (!fs.existsSync(backupPath)) {
    log('Error: Backup file app.asar.bak does not exist.', COLORS.red);
    process.exit(1);
  }

  try {
    fs.copyFileSync(backupPath, appAsarPath);
    log('✓ Restored original unpatched app.asar successfully.', COLORS.green + COLORS.bold);
  } catch (err) {
    log(`Failed to restore: ${err.message}`, COLORS.red);
    process.exit(1);
  }
}

function checkStatus(options = {}) {
  const installDir = findInstallation(options.path);
  if (!installDir) {
    log('DeepAI Code not found on this system.', COLORS.red);
    return;
  }

  const resourcesDir = path.join(installDir, 'resources');
  const appAsarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  log(`DeepAI Code Path: ${installDir}`, COLORS.cyan);
  log(`Backup exists: ${fs.existsSync(backupPath) ? 'Yes' : 'No'}`, COLORS.cyan);

  try {
    const relativePreloadPath = path.join('apps', 'desktop', 'dist-electron', 'preload.cjs');
    const preloadBuf = asar.extractFile(appAsarPath, relativePreloadPath);
    const isPatched = preloadBuf.toString('utf8').includes('DEEPAI-CODE RTL & PERSIAN ENHANCER INJECTION START');
    if (isPatched) {
      log('Status: Patched with RTL & Persian Support (Active)', COLORS.green + COLORS.bold);
    } else {
      log('Status: Original (Not Patched)', COLORS.yellow);
    }
  } catch (err) {
    log(`Unable to read app.asar: ${err.message}`, COLORS.red);
  }
}

// CLI Argument Parsing
const args = process.argv.slice(2);
const command = args[0] || 'patch';

const pathArgIdx = args.indexOf('--path');
const customPath = pathArgIdx !== -1 && args[pathArgIdx + 1] ? args[pathArgIdx + 1] : null;

if (command === 'patch' || command === 'install') {
  applyPatch({ path: customPath });
} else if (command === 'restore' || command === 'unpatch' || command === 'uninstall') {
  restoreBackup({ path: customPath });
} else if (command === 'status') {
  checkStatus({ path: customPath });
} else {
  console.log(`
Usage:
  node patcher.js [patch|restore|status] [--path <deepai-code-path>]

Commands:
  patch     Apply RTL and Persian support to DeepAI Code (default)
  restore   Restore original unpatched DeepAI Code
  status    Check current patch status
`);
}
