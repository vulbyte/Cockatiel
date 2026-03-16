import {DebugPrint} from "./DebugPrint.mjs";

export class YoutubeV3 {
	config = {
		apiKey: undefined,		
		channelName: undefined,		
		channelId: undefined,
		broadcastId: undefined,		
		broadcastStartedAt: undefined,
		liveChatId: undefined,		
		pageCount: undefined, // TODO: is this used?
		nextPageToken: undefined,

		debug: true,
		autoAssignToConfig: true,
		preserveMessages: true,
		messages: [],
	}
	GetConfig(){
		return this.config;
	}

	async LoadValuesFromLocalStorage() {    
	    DebugPrint("LoadingValuesFromLocalStorage");
	    const keys = Object.keys(this.config);
	    DebugPrint("attenpting to get values for: ", keys);

	    let key, val;
	    for (let i = 0; i < keys.length; ++i) {
		try {
		    key = keys[i];
		    DebugPrint("getting value for: " + key);
		    
		    // Use the actual key name: in the storage string
		    val = localStorage.getItem("youtube-config-" + key); 
		    DebugPrint(`value of ${key} is: `, val);

		    // Only update config if the value actually exists in localStorage
		    if (val !== null) {
			this.config[key] = val;
		    } else {
			DebugPrint(`No saved value found for ${key}`);
		    }
		}
		catch (err) {
		    console.error(`unable to get or load value for ${key[i]}\n ${err.stack}`);
		}
	    }
	}

	async getChannelId(
		apiKey = this.config.apiKey, 
		handle = this.config.channelName
	) {
		DebugPrint("getting channel id");
		// formatting the inputs
		apiKey = String(apiKey).trim();
		handle = String(handle).trim();
		if(handle[0] == "@"){
			handle = handle.slice(1, handle.length-1);
		}

		const getHandleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`;
		try {
			const response = await fetch(getHandleUrl);
			const data = await response.json();
			if (data.items && data.items.length > 0) {
				const channelId = data.items[0].id;

				DebugPrint(`Channel ID: ${channelId}`);

				if(this.config.autoAssignToConfig){this.config.channelId = channelId;}

				return channelId;
			} else {
				DebugPrint("No channel found for that handle.");
				return null;
			}
		} catch (error) {
			console.error("Error fetching data:", error);
		}
	}

	async getLiveAndUpcoming(apiKey, channelId) {
		DebugPrint("getting live and upcoming messages");
		const _apiKey = apiKey || this.config.apiKey;
		const _channelId = channelId || this.config.channelId;
		const statuses = ['live', 'upcoming'];
		let allBroadcasts = [];

		for (const status of statuses) {
			const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${_channelId}&type=video&eventType=${status}&maxResults=5&safeSearch=none&key=${_apiKey}`;
			try {
				const response = await fetch(url);
				const data = await response.json();
				if (data.error) {
					DebugPrint(`YouTube API Error (${status}):`, data.error.message);
					continue; 
				}
				if (data.items && data.items.length > 0) {
					const itemsWithStatus = data.items.map(item => ({
						...item,
						broadcastStatus: status
					}));
					allBroadcasts = allBroadcasts.concat(itemsWithStatus);
				} else {
					DebugPrint(`No ${status} streams found.`);
				}
			} catch (error) {
				console.error(`Network Error fetching ${status} broadcasts:`, error);
			}
		}
		DebugPrint("Broadcasts found:", allBroadcasts);
		return allBroadcasts;
	}

	async getLiveChatId(apiKey = this.config.apiKey, videoId = this.config.broadcastId) {
		DebugPrint("getting live chat id");
	    // 1. Define the base URL
	    const baseUrl = `https://www.googleapis.com/youtube/v3/videos`;
	    
	    // 2. Create the query string
	    const params = new URLSearchParams({
		part: 'snippet,contentDetails,statistics,liveStreamingDetails',
		id: videoId,
		key: apiKey,
	    });

	    // 3. Combine them
	    const url = `${baseUrl}?${params.toString()}`;

	    try {
		const response = await fetch(url); // You don't even need 'new Request' for a simple GET
		const data = await response.json();
		
		if (data.error) {
		    console.error("YouTube API Error:", data.error.message);
		    return null;
		}

		console.log("YouTube Data:", data);
		
		// Extract the chat ID
		this.config.liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
		console.log("liveChatId: ", this.config.liveChatId);
		return this.config.liveChatId;
	    } catch (error) {
		console.error("Fetch Error:", error);
		return null;
	    }
	}
	/*
	async getChatMessages(
		ChatId = this.config.liveChatId, 
		pageToken = this.config.nextPageToken
	) {
		const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${ChatId}&part=snippet,authorDetails&maxResults=200${pageToken ? `&pageToken=${pageToken}` : ''}&key=${this.config.apiKey}`;
		DebugPrint("getting chat messages", url);

		const response = await fetch(url);
		const data = await response.json();
		if (data.error) {
			throw new Error("Error fetching chat messages:", data.error);
		}

		if(
			data == undefined
			&& this.config.debug == true
		){
			DebugPrint(`no new messages received, for testing purposes removing pageToken(${pageToken}) and trying again in 2 seconds`);
			this.config.pageToken = undefined;
			SetTimeout(async () => {
				response = await fetch(url);
				data = await response.json();
				if (data.error) {
					throw new Error("Error fetching chat messages:", data.error);
				}
			}, 2000);
		}

		this.config.nextPageToken = data.nextPageToken;
		if(this.config.preserveMessages){
			for(let i = 0; i < data.items.length; ++i){
				this.config.messages.push(data.items[i]); // this is very very wrong lol
			}
		}
		DebugPrint("returning data from getChatMessages(): ", data);
		return data;
	}
	*/

	
	async getChatMessages(chatId, token) {
	    // 1. Prioritize the passed token, fallback to config
	    const activeChatId = chatId || this.config.liveChatId;
	    const activeToken = token || this.config.nextPageToken;

	    const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${activeChatId}&part=snippet,authorDetails&maxResults=200${activeToken ? `&pageToken=${activeToken}` : ''}&key=${this.config.apiKey}`;
	    
	    DebugPrint("Fetching URL: " + url);

	    const response = await fetch(url);
	    const data = await response.json();

	    if (data.error) {
		throw new Error("YouTube API Error: " + data.error.message);
	    }

	    // 2. Update the token for the next call
	    if (data.nextPageToken) {
		this.config.nextPageToken = data.nextPageToken;
		DebugPrint("Updated Token to: " + data.nextPageToken);
	    }

	    DebugPrint("getChatMessages:", JSON.stringify(data, null, 4));

	    return data;
	}
	

	/*
	async getChatMessages(chatId, token) {
	    // 1. Prioritize the passed token, fallback to config
	    const activeChatId = chatId || this.config.liveChatId;
	    const activeToken = token || this.config.nextPageToken;

	    const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${activeChatId}&part=snippet,authorDetails&maxResults=200${activeToken ? `&pageToken=${activeToken}` : ''}&key=${this.config.apiKey}`;
	    
	    DebugPrint("Fetching URL: " + url);

	    const response = await fetch(url);
	    const data = await response.json();

	    if (data.error) {
		throw new Error("YouTube API Error: " + data.error.message);
	    }

	    // 2. Update the token for the next call
	    if (data.nextPageToken) {
		this.config.nextPageToken = data.nextPageToken;
		DebugPrint("Updated Token to: " + data.nextPageToken);
	    }

	    return data;
	}
	*/

	async getStreamStartUnix(videoId = this.config.broadcastId, apiKey = this.config.apiKey) {
	    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
	    
	    try {
		const response = await fetch(url);
		const data = await response.json();
		
		if (data.items && data.items.length > 0) {
		    const liveDetails = data.items[0].liveStreamingDetails;
		    const startTimeStr = liveDetails?.actualStartTime;
		    
		    if (startTimeStr) {
			// Convert ISO 8601 string to Unix Timestamp (milliseconds)
			const unixTimestamp = new Date(startTimeStr).getTime();
			
			DebugPrint(`Stream started at Unix: ${unixTimestamp}`);
			this.config.broadcastStartedAt = unixTimestamp;
			return unixTimestamp;
		    }
		}
		DebugPrint("Actual start time not found. Is the stream live?");
		return null;
	    } catch (err) {
		console.error("Error fetching stream start time:", err);
		return null;
	    }
	}

	// WARN: due to CORS and other stuff, this will have to be handled by the cpp local client when made.
	/* 
	async SendMessage(messageText) {
	  try {
	    const response = await gapi.client.youtube.liveChatMessages.insert({
	      "part": ["snippet"],
	      "resource": {
		"snippet": {
		  "liveChatId": this.config.liveChatId,
		  "type": "textMessageEvent",
		  "textMessageDetails": {
		    "messageText": messageText
		  }
		}
	      }
	    });
	    console.log("Message Sent!", response.result.id);
	  } catch (err) {
	    console.error("Error sending message", err);
	  }
	}
	*/
}
