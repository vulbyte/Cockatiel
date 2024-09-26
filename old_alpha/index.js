import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';  // Remove if using Node.js 18+
import { client_session } from './client_session';


async function loadConfig() {
	try {
		const configFilePath = path.join(process.cwd(), './GLOBAL_CONFIG.json');
		const configFile = await fs.readFile(configFilePath, 'utf8');
		client_session.config = JSON.parse(configFile);
		console.log(client_session.config);
	} catch (error) {
		console.error('Error reading the config file:', error);
	}
}
loadConfig();

async function loadBadWords() {
	try {
		const configFilePath = path.join(process.cwd(), './BAD_WORDS.json');
		const configFile = await fs.readFile(configFilePath, 'utf8');
		banned_words = JSON.parse(configFile);
		banned_words = banned_words.words_array;
		console.log(banned_words);
	} catch (error) {
		console.error('Error reading the bad words file:', error);
	}
}
loadBadWords();

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: false,
			enableRemoteModulke: true,
			nodeIntegration: true,
		},
	});
	win.loadFile('index.html');
}

async function getLiveChatMessages(liveChatId) {
	let nextPageToken = '';

	while (true) {
		const response = await fetch(
			`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${config.APIs.gcloud_key}&pageToken=${nextPageToken}`
		);
		const data = await response.json();

		for (const item of data.items) {
			const userName = item.authorDetails.displayName;
			const message = item.snippet.displayMessage;

			// Format and store the message in the array
			let formattedMessage = `${userName}: ${message}`;
			messages.push(formattedMessage);

			// Check if message contains banned words
			function checkMessage(message) {
				for (let word of banned_words) {
					if (message.includes(word)) {
						console.log("Bad word found:", word);
						return true;
					}
				}
				return false;
			}

			// Handle TTS
			if (message.startsWith('!tts')) {
				if (!checkMessage(message)) {
					tts_messages.push(`${userName}: ${message.slice(4).trim()}`);
				} else {
					console.warn(`Bad message detected: ${message}`);
				}
			}

			// Print the message to console
			console.log(formattedMessage);
		}

		nextPageToken = data.nextPageToken;

		// Print the current state of the messages arrays
		console.log("Current messages array:", messages);
		console.log("Current TTS messages array:", tts_messages);

		// Wait for the polling interval before making the next request
		await new Promise(resolve => setTimeout(resolve, data.pollingIntervalMillis));
	}
}

app.whenReady().then(async () => {
	await loadConfig();
	await loadBadWords();

	if (!config || !config.APIs) {
		console.error('Configuration is missing or invalid.');
		return;
	}

	client_session.videoId = 'your_video_id_here'; // Set the video ID here

	createWindow();
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

