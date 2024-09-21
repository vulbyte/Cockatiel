import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';

//const { dialog } = require('electron');

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {}
	});

	win.loadFile('index.html');
}



let config;
let messages = [];
let tts_messages = [];

async function loadConfig() {
	try {
		const configFilePath = path.join(process.cwd(), './GLOBAL_CONFIG.json');
		const configFile = await fs.readFile(configFilePath, 'utf8');
		config = JSON.parse(configFile);
	} catch (error) {
		console.error('Error reading the config file:', error);
	}
}



var banned_words = [];

async function loadBadWords() {
	try {
		const configFilePath = path.join(process.cwd(), './BAD_WORDS.json');
		const configFile = await fs.readFile(configFilePath, 'utf8');
		banned_words = JSON.parse(configFile);
		banned_words = banned_words.words_array;
		console.log(banned_words);
	} catch (error) {
		console.error('Error reading the config file:', error);
	}
}

async function getLiveChatId(videoId) {
	const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${config.APIs.gcloud_key}`);
	const data = await response.json();
	return data.items[0].liveStreamingDetails.activeLiveChatId;
}

async function getLiveChatMessages(liveChatId) {
	let nextPageToken = '';

	while (true) {
		const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${config.APIs.gcloud_key}&pageToken=${nextPageToken}`);
		const data = await response.json();

		for (const item of data.items) {
			const userName = item.authorDetails.displayName;
			const message = item.snippet.displayMessage;

			// Format and store the message in the array
			let formattedMessage = `${userName}: ${message}`;
			messages.push(formattedMessage);

			function CheckMessage(message) {
				for (let i = 0; i < banned_words.length; i++) {
					if (message.includes(banned_words[i])) {
						console.log("badd word found: ", banned_words[i]);
						return (true);
					}
				}
				return (false);
			};

			// if tts add after formatting
			if (message.slice(0, 4) == '!tts') {
				if (CheckMessage(message) == false) {
					tts_messages.push(
						`${userName}: ${message.slice(4, message.length)}`
					);
				}
				else {
					console.warn(`bad message detected!', ${message}`);
				}
			}

			// Print the message to console
			console.log(formattedMessage);
			//console.log(ttsMessages);
		}

		nextPageToken = data.nextPageToken;

		// Print the current state of the messages array
		console.log("Current messages array:");
		messages.forEach((msg, index) => console.log(`[${index}] ${msg}`));

		console.log("Current tts_messages array:");
		tts_messages.forEach((msg, index) => console.log(`[${index}] ${msg}`));


		// Wait for the polling interval before making the next request
		await new Promise(resolve => setTimeout(resolve, data.pollingIntervalMillis));
	}
}


//import Speech from './node_modules/speak-tts';
//import Speech from 'speak-tts';
import Speech from './node_modules/speak-tts/lib/speak-tts.js'
const speech = new Speech();
let tts_index = 0;

// Initialize speech when the script loads
speech.init({
	'volume': 1,
	'lang': 'en-US',
	'rate': 1,
	'pitch': 1,
	'voice': 'Google US English',
	'splitSentences': true,
	'listeners': {
		'onvoiceschanged': (voices) => {
			console.log("Event voiceschanged", voices)
		}
	}
}).then(() => {
	console.log("Speech is ready");
	speech.setLanguage('en-US');
	speech.setVoice('Google US English');
}).catch(e => {
	console.error("An error occurred while initializing speech:", e);
});

document.getElementById("play_tts").addEventListener('click', () => ReadMessage(tts_messages[tts_index]));

async function ReadMessage(tts_message) {
	if (!tts_message) {
		console.error("No message to read");
		return;
	}

	try {
		await speech.speak({
			text: tts_message,
			queue: false, // current speech will be interrupted
			listeners: {
				onstart: () => {
					console.log("Start utterance")
				},
				onend: () => {
					console.log("End utterance")
					tts_index = (tts_index + 1) % tts_messages.length; // Move to next message, loop back to start if at end
				},
				onresume: () => {
					console.log("Resume utterance")
				},
				onboundary: (event) => {
					console.log(event.name + ' boundary reached after ' + event.elapsedTime + ' milliseconds.')
				}
			}
		});
		console.log("Success!");
	} catch (e) {
		console.error("An error occurred:", e);
	}
}

// If you need to export the function for use in other modules
module.exports = { ReadMessage };
app.whenReady().then(async () => {
	await loadConfig();
	await loadBadWords();

	if (!config || !config.APIs) {
		console.error('Configuration is missing or invalid.');
		return;
	}

	const videoId = 'yj60Oo576So';

	createWindow();

	try {
		const liveChatId = await getLiveChatId(videoId);
		console.log('Live Chat ID:', liveChatId);
		await getLiveChatMessages(liveChatId);
	} catch (error) {
		console.error('Error fetching live chat:', error);
	}

	// if (!ret) {
	// 	console.log('registration failed')
	// }

	// Check whether a shortcut is registered.
	//console.log(globalShortcut.isRegistered('CommandOrControl+Alt+T'))
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
