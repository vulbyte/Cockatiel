console.log("cockatiel started");

const { app, BrowserWindow } = require('electron');

const createWindow = () => {
	const win = new BrowserWindow({
		width: 640,
		height: 480
	})

	win.loadFile('index.html')
}

app.whenReady().then(() => {
	createWindow()
})
