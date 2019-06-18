'use strict';

const electron = require( 'electron' ),
      fs       = require( 'fs' );

const debug = process.argv[2] === "debug";
electron.app.commandLine.appendSwitch('ignore-gpu-blacklist', 'true');
electron.Menu.setApplicationMenu( null );

electron.app.on('ready', () => {

	const win = new electron.BrowserWindow( {

		icon: 'icon.png',
		title:'EduAnat2',
		webPreferences: { nodeIntegration: true },
		show:false

	} );

	const begin = 'file://' + __dirname + '/';
	const url = !fs.existsSync( __dirname + "/build" ) ? begin + 'index.html'
		: begin +  ( debug ? 'source-output' : 'build' ) + '/index.html';

	win.loadURL( url );

	const splash = new electron.BrowserWindow( {

		width: 410,
		height: 402,
		resizable:false,
		frame: false,
		alwaysOnTop: true

	} );

	splash.loadURL('file://' + __dirname + '/splash.html');

	require("electron").ipcMain.once('qx-ready', function () {

		splash.destroy();
		win.show();
		setTimeout( win.maximize.bind( win ), 200 );
		if ( debug ) win.webContents.openDevTools();

	} );

} )
.on('window-all-closed', () => {

	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if ( process.platform !== 'darwin' ) electron.app.quit();

} )

