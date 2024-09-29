import { config } from "../configs/load_user_config.js";
import { CallTTS } from "./call_tts.js";
import { IntTimer } from './IntTimer.js';

let stream_data = {
	"videoId": undefined,
	"liveChatId": undefined,
	"apiKey": undefined,

}

export let messages = [{}]; // according to youtubes v3 api, this is how the messages will be received
export let message_index = 0;

let tts_queue = 0;


let FetchTimer;
export async function StartGettingMessages(args = { oneshot: true }) {
	FetchTimer = new IntTimer(
		{
			timerName: "fetchMessagesTimer",
			timeoutDuration: 5,
			killOnTimeout: args.oneshot,
		}
	);

	let looper = (data) => {
		console.log("timeout found, fetching messages");

		ConfigApiCalls();
		//ReadNextMessage(); BUG: ERROR HERE
	}

	// ADD LIMITER SO ONLY ONE CAN HAPPEN AT A TIME
	FetchTimer.Connect(looper);
}
export function StopGettingMessages() {
	FetchTimer.Kill();
}



function ConfigApiCalls() {
	stream_data.videoId = config.user_config.stream_url;
	console.log("stream_url:", config.user_config.stream_url);
	stream_data.apiKey = config.global_config.APIs.gcloud_key;
	console.log("api key: ", config.global_config.APIs.gcloud_key);

	async function fetchLiveChatId(videoId, apiKey) {
		try {
			const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`);
			const data = await response.json();
			stream_data.liveChatId = data.items[0].liveStreamingDetails.activeLiveChatId;
			console.log("Live Chat ID:", stream_data.liveChatId);
			return ParseReturn(stream_data.liveChatId, apiKey);
		} catch (err) {
			console.error(err);
			FetchTimer.Kill(); // no need to run further
		}
	}

	// Usage
	fetchLiveChatId(stream_data.videoId, stream_data.apiKey).then((e) => {
		console.log("Returned Live Chat ID:", stream_data.liveChatId);
		// Use liveChatId here after it has been set
	});
}


async function ParseReturn(liveChatId, apiKey) {
	console.log('checking messages and parsing');
	//THIS IS VALID JUST DUMB
	fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${apiKey}`)
		.then(response => response.json())
		.then(data => {
			messages = data.items.map(item => ({
				author: item.authorDetails.displayName,
				message: item.snippet.displayMessage,
				time: item.snippet.publishedAt
			}));

			console.log(messages);

			let newElem, playElem, textElem;

			console.log("child_count = ", document.getElementById("messages_list").childElementCount);

			for (let i = document.getElementById("messages_list").childElementCount; i < messages.length; i++) {
				let ml = document.getElementById("messages_list");

				newElem = document.createElement("li");
				newElem.id = `ml_li${i}`;

				playElem = document.createElement("button");
				playElem.innerText = "▶️";

				textElem = document.createElement("span");
				textElem.id = `message${i}`
				if (messages[i].message.slice(0, 4) == "!tts") {
					textElem.innerText = `user: ${messages[i].author} says; ${messages[i].message.slice(4, messages[i].message.length)}`;
				}
				else {
					textElem.innerText = `user: ${messages[i].author} says; ${messages[i].message}`;
				}

				if (messages[i].message.includes("!tts")) {
					newElem.style.backgroundColor = "#028";
					tts_queue += 1;
				}
				else {
					newElem.style.backgroundColor = '#200';
				}

				playElem.addEventListener("mousedown", (e) => { // BUG: THIS TTS_QUEUE ISN'T ACCURATELY UPDATING
					CallTTS(document.getElementById(`message${i}`).innerText);
					if (document.getElementById(`ml_li${i}`).style.backgroundColor != "#222") {
						document.getElementById(`ml_li${i}`).style.backgroundColor = "#222";
						tts_queue -= 1;
					}
					else {
					}
				});

				newElem.appendChild(playElem);
				newElem.appendChild(textElem);

				ml.appendChild(newElem);
			}

			document.getElementById("tts_queue_indicator").innerText = tts_queue;
		})
		.catch(err => console.error(err));
}

// https://www.youtube.com/live/lD_6c4DZe-U
export async function ReadNextMessage() {
	CallTTS(`${messages[message_index].author} said: ${messages[message_index].message}`);
	message_index += 1; // this is incremented for next call
}
