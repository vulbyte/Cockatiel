// {{{3 script stuff
console.log("change made to livestream link, updating");

import { client_session } from '../index.js';

let source_link = document.getElementById("source_link")
source_link.onchange = function() {
	console.log("binding change_source_link to function;")
	change_source_link(source_link.value);
};

function change_source_link(value = null) {
	//let public_ip = document.getElementById("public_ip").value;
	let chat_info = document.getElementById("chat_iframe_info");
	let msg = ""; //used to doup messages for console and chat_iframe_info
	chat_info.inner_text = msg;

	//checks to see if should run
	if (value == null) {
		msg = "source_link is not a valid string";
		console.warn(msg);
		chat_info.inner_text = msg;
		return;
	}

	const streaming_platforms = [ // {{{4 streaming platforms
		// NOTE: COMMENTED OUT ONES ARE NOT SUPPORTED
		"youtube.com",
		// "twitch.tv",
		// "facebook.com/live",
		// "trovo.live",
		// "dlive.tv",
		// "vimeo.com",
		// "streamlabs.com",
		// "caffeine.tv",
		// "dlive.tv",
		// "streamyard.com",
		// "instagram.com/live",
		// "tiktok.com/live",
		// "periscope.tv",  // Twitter's live streaming platform
		// "peertube.social",
		// "afreecatv.com",
		// "mixcloud.com/live",
		// "ok.ru/live",  // Russian platform
		// "goodgame.ru",  // Russian live-streaming platform
		// "vk.com/live",  // VKontakte's live platform
		// "restream.io",
		// "bigo.tv",
		// "happylive.tv",
		// "smashcast.tv",
		// "chaturbate.com", // Adult platform
		// "camfrog.com",
		// "picarto.tv",  // Art-focused live streaming
		// "liveedu.tv",  // Focused on educational content
		// "ustream.tv",  // Enterprise streaming (part of IBM Cloud)
		// "mildom.com",
		// "streamshark.io"
	];
	// }}}4

	//{{{4 error_checking
	let platform_found = false;
	streaming_platforms.forEach((platform) => {
		if (value.includes(platform)) {
			platform_found = true;

			msg = "platform link is valid"
			chat_info.innerText = msg;
			console.log(msg);
			return;
		}
	});
	if (platform_found == false) {
		msg = "source_link is not supported or valid";
		chat_info.innerText = msg;
		console.warn(msg);
		return;
	}
	//}}}4

	//https://www.youtube.com/live/CYoNwOxXk4g?si=XIELLDNvYC3B-ZMs
	//<iframe width="350px" height="500px" src="https://www.youtube.com/live_chat?v=yourvideoid&amp;embed_domain=localhost" ></iframe>
	//
	//https://www.youtube.com/watch?v=CYoNwOxXk4g
	//
	//https://www.youtube.com/live_chat?v=CYoNwOxXk4g&embed_domain=sameorigin

	//{{{4 update iframe to new link
	let iframe = document.getElementById("chat_iframe");
	iframe.src = value;

	//}}}4

	//{{{4 load message and add to queue
	//}}}4

	//{{{4 tts stuff on hotkey
	//}}}4
}
//}}}3

////////////////////////////////////////////////////////////// 
// PLEASE WORK
////////////////////////////////////////////////////////////// 

const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

app.on('ready', () => {
	mainWindow = new BrowserWindow({
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),  // Load preload script
			nodeIntegration: false,  // Disable Node.js integration for security
			contextIsolation: true   // Enable context isolation
		}
	});

	mainWindow.loadURL('path/to/index.html');  // Your HTML file
});



// Read the file synchronously
const config_file = fs.readFileSync('../GLOBAL_CONFIG.json', 'utf8');

// Parse the JSON string
const config = JSON.parse(config_file);

const API_KEY = config.APIs.gcloud_key;  // Replace with your YouTube API key
const videoId = 'yj60Oo576So';  // Video ID of the livestream


// Step 1: Get the live chat ID from the video
async function getLiveChatId(videoId) {
	const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`;

	const response = await fetch(url);
	const data = await response.json();

	if (data.items && data.items.length > 0) {
		liveChatId = data.items[0].liveStreamingDetails.activeLiveChatId;
		return liveChatId;
	} else {
		throw new Error('Live chat not found or stream is not active.');
	}
}

// Step 2: Fetch live chat messages using the liveChatId
async function getLiveChatMessages(liveChatId, nextPageToken = '') {
	const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${API_KEY}&pageToken=${nextPageToken}`;

	const response = await fetch(url);
	const data = await response.json();

	if (data.items) {
		data.items.forEach((item) => {
			const author = item.authorDetails.displayName;
			const message = item.snippet.displayMessage;
			console.log(`${author}: ${message}`);
		});

		// Recursively fetch next set of messages using the nextPageToken
		if (data.nextPageToken) {
			setTimeout(() => getLiveChatMessages(liveChatId, data.nextPageToken), 5000);  // Fetch every 5 seconds
		}
	}
}

// Step 3: Call the functions to start fetching messages
getLiveChatId(videoId)
	.then((liveChatId) => {
		console.log('Live Chat ID:', liveChatId);
		getLiveChatMessages(liveChatId);
	})
	.catch((error) => console.error('Error fetching live chat:', error));

