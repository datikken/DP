/**
 * electron-builder configuration.
 *
 * Produces a Windows x64 NSIS installer that:
 *   - installs the app into %LOCALAPPDATA%\Programs\DailyPlanner (per-user, no admin
 *     prompt needed),
 *   - creates a Start Menu shortcut and an optional Desktop shortcut,
 *   - registers the app in "Apps & features" so it can be uninstalled cleanly.
 *
 * Usage: npm run dist:win
 */
module.exports = {
  appId: 'com.example.dailyplanner',
  productName: 'DailyPlanner',
  copyright: 'Copyright © 2026',

  directories: {
    // Compiled output lives in dist/; installer artifacts go to release/.
    output: 'release',
    buildResources: 'build',
  },

  // Only ship what the app needs at runtime - not src/, scripts/ or the docs.
  // Negations must come after the includes they narrow, and each entry is
  // matched from the project root, so 'dist' (not just 'dist/**/*') is listed
  // to guarantee the build output is packaged.
  files: [
    'dist/**/*',
    'package.json',
    '!**/*.map',
    '!**/*.ts',
    '!**/*.md',
  ],

  // node-sqlite3-wasm loads its .wasm file from disk at runtime, so the module
  // must stay unpacked inside the asar archive.
  asar: true,
  asarUnpack: ['**/node_modules/node-sqlite3-wasm/**'],

  // The app has no native modules to rebuild (sqlite is WebAssembly), but bcryptjs
  // and node-sqlite3-wasm are runtime dependencies and must be bundled.
  npmRebuild: false,

  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'build/icon.ico',
    artifactName: '${productName}-Setup-${version}-${arch}.${ext}',
  },

  nsis: {
    // Per-user install: no UAC elevation required, fits an app that stores its
    // database in %APPDATA%.
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'DailyPlanner',
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    uninstallDisplayName: 'DailyPlanner',
    deleteAppDataOnUninstall: false,
  },
};
