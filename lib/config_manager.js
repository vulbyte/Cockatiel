// this is where the logic and state lives for the application.
// this is where the bridging from ui and the other logic scripts take place

// {{{1 IMPORTS/EXPORTS
import { Monitor_Messages } from './lib/monitor_messages.js';
export var messageMonitor = new Monitor_Messages;
// }}}1

// {{{1 BUTTON BINDING
document.getElementById('start_monitoring_button').addEventListener('click', (e) => {
	let apiKey = document.getElementById('youtuve_apiKey').value;
	async function getChannelBroadcasts(apiKey, channelId) {
		try {
			const response = await fetch(
				`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`
			);
			const data = await response.json();

			if (!data.items || data.items.length === 0) {
				throw new Error('No live broadcasts found for this channel');
			}

			return data.items;
		} catch (error) {
			console.error('Error getting broadcasts:', error);
			throw error;
		}
	}
});
// }}}1

// {{{1 
// }}}1

// {{{1
// }}}1

// {{{1
// }}}1

// {{{1
// }}}1
