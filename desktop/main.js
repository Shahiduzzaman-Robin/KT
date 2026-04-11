const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "M/S Kamrul Traders - Management System",
    icon: path.join(__dirname, 'icon.png'), // We can add an icon later
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Point to your live website
  win.loadURL('https://kt-jz1b.onrender.com');

  // Optional: Remove the default top menu bar for a cleaner "App" look
  // Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
