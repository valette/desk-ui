'use strict';

const electron = require('electron');

electron.app.commandLine.appendSwitch('ignore-gpu-blacklist', 'true');

var win;

electron.app.on('ready', () => {
	win = new electron.BrowserWindow({
		icon: 'icone_eduanat2.png',
		experimentalFeatures : true,
		experimentalCanvasFeatures : true,
		title:'EduAnat2',
		show:false
	});

	win.once('ready-to-show', () => {
    win.show()
  });
  
win.webContents.on('will-navigate', (event, url) => {
  event.preventDefault()
  shell.openExternal(url)
});	

  var url = 'file://' + __dirname + '/index.html';
	win.loadURL(url);



	win.maximize();
  //win.webContents.openDevTools();

	win.on('close', () => {
		process.exit();
	});
})
.on('window-all-closed', () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		electron.app.quit();
	}
})
.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow();
	}
});
