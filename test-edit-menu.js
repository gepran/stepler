const { app, BrowserWindow, Menu } = require('electron');
app.on('ready', () => {
  const template = [{ role: 'editMenu' }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  console.log(Menu.getApplicationMenu().items[0].submenu.items.map(i => i.label).join(', '));
  app.quit();
});
