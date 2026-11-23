/* PITLANE for Windows: opens the web app in its own window. Set SITE_URL to your published address,
   or leave it empty to load the bundled copy in app/ (run `node copy-web.js` first). */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const SITE_URL = '';
function createWindow() {
  const win = new BrowserWindow({ width: 1180, height: 820, minWidth: 380, backgroundColor: '#7A1C32', title: "PITLANE",
    icon: path.join(__dirname, 'app/icons/icon-512.png'), autoHideMenuBar: true });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (SITE_URL) win.loadURL(SITE_URL); else win.loadFile(path.join(__dirname, 'app/index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
