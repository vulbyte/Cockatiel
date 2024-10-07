import { app, BrowserWindow } from 'electron';

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: false,
			enableRemoteModulke: true,
			nodeIntegration: true,
		},
		icon: './non-code_assets/cockatiel_logo.icns'
	});
	win.loadFile('index.html');
}

app.whenReady().then(async () => {
	try {
		LoadConfig();
		//console.log(config);
	}
	catch (err) {
		console.log("error loading initial config");

	}
	finally {
		createWindow();
	}
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});


