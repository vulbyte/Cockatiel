import client_session from "../client_session.js";

export default async function getLiveChatMessages(liveChatId) {

	let nextPageToken = '';

	while (true) {
		console.log(client_session.get_chat_url);
		const response = await fetch(client_session.chat_url);

		const data = await response.json();

		for (const item of data.items) {
			const userName = item.authorDetails.displayName;
			const message = item.snippet.displayMessage;

			// Format and store the message in the array
			let formattedMessage = `${userName}: ${message}`;
			client_session.messages.push(formattedMessage);

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

		// Print the current state of themessages arrays
		console.log("Current messages array:", messages);
		console.log("Current TTS messages array:", tts_messages);

		// Wait for the polling interval before making the next request
		await new Promise(resolve => setTimeout(resolve, data.pollingIntervalMillis));
	}
}
