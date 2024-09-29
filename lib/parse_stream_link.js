// // // import client_session from "../client_session.js";
// import getLiveChatMessages from "./get_live_chat_messages.js";

import { config } from '../configs/load_user_config.js'

try {
	document.getElementById("stream_link").addEventListener("change", ((e) => {
		console.log("adding event listener");
	}))
}
catch (err) {
	console.warn(err);
}

export function UpdateStreamLink() {
	console.log("updating stream link");

	let message_value = document.getElementById("stream_link").value;

	//{{{2 parsing logic
	if (message_value.includes("=")) {
		message_value = message_value.slice(
			message_value.indexOf("=") + 1,
			message_value.length
		);
	}
	else if (message_value.lastIndexOf("/") != -1) {
		message_value = message_value.slice(
			message_value.lastIndexOf("/") + 1,
			message_value.length
		);
	}
	else {
		document.getElementById("formatted_stream_link").innerText = "err! try another!";
		return;
	}
	//}}}2 parsing logic end

	// client_session.liveChatId = message_value;

	document.getElementById("formatted_stream_link").innerText = message_value;

	config.user_config.video_link = message_value;

	// getLiveChatMessages();
	return (message_value);
}
