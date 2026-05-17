import {DebugPrint} from "./DebugPrint.mjs";

export class YoutubeV3 {
	#isInited = false;

	isReady(){
		
	}

	DPrint(data){
		this.EmitStatus(data);
		DebugPrint(data);
	}
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

	// Listener Arrays
    #start_listeners = [];  // when starts
    #stop_listeners = [];   // when is stopped
    #warn_listeners = [];   // when a minor error occurs
    #error_listeners = [];  // when a major error occurs
    #status_listeners = []; // other general status updates

    // --- Start Listeners ---
    AddStartListener(func) {
        if (typeof func === 'function' && !this.#start_listeners.includes(func)) {
            this.#start_listeners.push(func);
        }
    }
    RemoveStartListener(func) {
        this.#start_listeners = this.#start_listeners.filter(f => f !== func);
    }

    // --- Stop Listeners ---
    AddStopListener(func) {
        if (typeof func === 'function' && !this.#stop_listeners.includes(func)) {
            this.#stop_listeners.push(func);
        }
    }
    RemoveStopListener(func) {
        this.#stop_listeners = this.#stop_listeners.filter(f => f !== func);
    }

    // --- Warning Listeners ---
    AddWarnListener(func) {
        if (typeof func === 'function' && !this.#warn_listeners.includes(func)) {
            this.#warn_listeners.push(func);
        }
    }
    RemoveWarnListener(func) {
        this.#warn_listeners = this.#warn_listeners.filter(f => f !== func);
    }

    // --- Error Listeners ---
    AddErrorListener(func) {
        if (typeof func === 'function' && !this.#error_listeners.includes(func)) {
            this.#error_listeners.push(func);
        }
    }
    RemoveErrorListener(func) {
        this.#error_listeners = this.#error_listeners.filter(f => f !== func);
    }

    // --- Status Listeners ---
    AddStatusListener(func) {
        if (typeof func === 'function' && !this.#status_listeners.includes(func)) {
            this.#status_listeners.push(func);
        }
    }
    RemoveStatusListener(func) {
        this.#status_listeners = this.#status_listeners.filter(f => f !== func);
    }

    /**
     * INTERNAL HELPER: Dispatches events to the appropriate listener array.
     * Use this inside your class (e.g., this.#emit(this.#error_listeners, "Connection Failed")).
     */
    #emit(queue, data = null) {
        queue.forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error("Listener Callback Error:", err);
            }
        });
    }
    EmitStart(data){
	    this.#emit(this.#start_listeners, data);
	    if(data != null){
		    this.#emit(this.#status_listeners, data)
	    }
    }
    EmitStop(data){
	    this.#emit(this.#stop_listeners, data);
	    if(data != null){
		    this.#emit(this.#status_listeners, data)
	    }
    }
    EmitWarn(data){
	    this.#emit(this.#warn_listeners, data);
	    if(data != null){
		    this.#emit(this.#status_listeners, data)
	    }
    }
    EmitError(data){
	    this.#emit(this.#error_listeners, data);
	    if(data != null){
		    this.#emit(this.#status_listeners, data)
	    }
    }
    EmitStatus(data){
	    this.#emit(this.#status_listeners, data);
	    if(data != null){
		    this.#emit(this.#status_listeners, data)
	    }
    }

	async LoadValuesFromLocalStorage() {    
	    this.DPrint("LoadingValuesFromLocalStorage");
	    const keys = Object.keys(this.config);
	    this.DPrint("attenpting to get values for: ", keys);

	    let key, val;
	    for (let i = 0; i < keys.length; ++i) {
		try {
		    key = keys[i];
		    this.DPrint("getting value for: " + key);
		    
		    // Use the actual key name: in the storage string
		    val = localStorage.getItem("youtube-config-" + key); 
		    this.DPrint(`value of ${key} is: `, val);

		    // Only update config if the value actually exists in localStorage
		    if (val !== null) {
			this.config[key] = val;
		    } else {
			this.DPrint(`No saved value found for ${key}`);
		    }
		}
		catch (err) {
		    console.error(`unable to get or load value for ${key[i]}\n ${err.stack}`);
		    this.EmitError(err);
		}
	    }
	}

	async getChannelId(
		apiKey = this.config.apiKey, 
		handle = this.config.channelName
	) {
		this.DPrint("getting channel id");
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

				this.DPrint(`Channel ID: ${channelId}`);

				if(this.config.autoAssignToConfig){this.config.channelId = channelId;}

				return channelId;
			} else {
				this.DPrint("No channel found for that handle.");
				return null;
			}
		} catch (error) {
			console.error("Error fetching data:", error);
			this.EmitWarn(error);
		}
	}

	async getLiveAndUpcoming(apiKey, channelId) {
		this.DPrint("getting live and upcoming messages");
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
					this.DPrint(`YouTube API Error (${status}):`, data.error.message);
					continue; 
				}
				if (data.items && data.items.length > 0) {
					const itemsWithStatus = data.items.map(item => ({
						...item,
						broadcastStatus: status
					}));
					allBroadcasts = allBroadcasts.concat(itemsWithStatus);
				} else {
					this.DPrint(`No ${status} streams found.`);
				}
			} catch (error) {
				console.error(`Network Error fetching ${status} broadcasts:`, error);
				this.EmitError(error);
			}
		}
		this.DPrint("Broadcasts found:", allBroadcasts);
		return allBroadcasts;
	}

	async getLiveChatId(apiKey = this.config.apiKey, videoId = this.config.broadcastId) {
		this.DPrint("getting live chat id");
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
		this.EmitWarn(error);
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
	    
	    this.DPrint("Fetching URL: " + url);

	    const response = await fetch(url);
	    const data = await response.json();

	    if (data.error) {
		    this.EmitError(data.error.message);
		throw new Error("YouTube API Error: " + data.error.message);
	    }

	    // 2. Update the token for the next call
	    if (data.nextPageToken) {
		this.config.nextPageToken = data.nextPageToken;
		this.DPrint("Updated Token to: " + data.nextPageToken);
	    }

	    this.DPrint("getChatMessages got:", JSON.stringify(data, null, 4));

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
			
			this.DPrint(`Stream started at Unix: ${unixTimestamp}`);
			this.config.broadcastStartedAt = unixTimestamp;
			return unixTimestamp;
		    }
		}
		this.DPrint("Actual start time not found. Is the stream live?");
		return null;
	    } catch (err) {
		this.EmitWarn(err);
		console.error("Error fetching stream start time:", err);
		return null;
	    }
	}

	CHE(args = {}) {
	    try {
		if (!args.type) args.type = "div";

		let elem = document.createElement(args.type);

		if(args.inputType) elem.type = args.inputType;

		if (args.class) elem.className = args.class;
		if (args.id) elem.id = args.id;
		if (args.innerHTML) elem.innerHTML = args.innerHTML;
		if (args.innerText) elem.innerText = args.innerText;
		if (args.style) elem.style.cssText = args.style;

		if (args.attributes) {
		    for (const [key, value] of Object.entries(args.attributes)) {
			elem.setAttribute(key, value);
		    }
		}

		if (args.onClick) {
		    elem.addEventListener("click", args.onClick);
		}

		return elem;
	    }
	    catch (err) {
		this.EmitWarn(err);
		console.error("CHE failed", err);
		return null;
	    }
	}

	GenerateYoutubeConfigUI(){ //returns html element for the yt config
		try{
		if(document == undefined){this.DPrint({msg: "cannot create youtube config, returning "}); return;}
		this.DPrint("GENERATING YOUTUBE CONFIG UI");
	    const container = this.CHE({type: "div"});

	    // 1. Create the Main Details Wrapper
	    const details = document.createElement('details');
	    details.style.cssText = `
		border: var(--tib_border); 
		border-radius: var(--tib_border-radius); 
		padding: 0.5rem;
		margin-top: 10px;
		color: #fff;
	    `;

	    const summary = document.createElement('summary');
	    summary.innerText = "youtube config";
	    summary.style.cursor = "pointer";
	    details.appendChild(summary);

	    // 2. Helper function to create standard inputs
	    const createInputGroup = (labelPath, id, isPassword = false, prefix = null) => {
		const group = document.createElement('div');
		group.className = "youtube-config-input";
		group.style.marginBottom = "10px";

		const label = document.createElement('label');
		label.innerText = ` ${labelPath}`;
		label.style.display = "block";
		group.appendChild(label);

		const row = document.createElement('div');
		row.style.display = "flex";
		row.style.flexDirection = "row";

		if (prefix) {
		    const span = document.createElement('span');
		    span.innerText = prefix;
		    span.style.cssText = `
			padding: var(--input-pad);
			background: var(--color-surface);
			border: 0.1rem solid var(--color-border);
			border-top-left-radius: var(--border_radius_default);
			border-bottom-left-radius: var(--border_radius_default);
			font-size: var(--font-size-base);
		    `;
		    row.appendChild(span);
		}

		const input = document.createElement('input');
		input.id = id;
		input.type = isPassword ? "password" : "text";
		input.placeholder = "Enter " + labelPath;
		input.style.cssText = `
		    flex-grow: 1;
		    display: inline-block;
		    border-top-left-radius: ${prefix ? '0' : 'var(--border_radius_default)'};
		    border-bottom-left-radius: ${prefix ? '0' : 'var(--border_radius_default)'};
		`;
		
		row.appendChild(input);
		group.appendChild(row);
		return group;
	    };

	    // 3. Append Initial Inputs
	    details.appendChild(createInputGroup("channelName", "youtube-config-channelName", false, "@"));
	    details.appendChild(createInputGroup("apiKey", "youtube-config-apiKey", true));

	    // 4. Create the Broadcasts Container
	    const broadcastsContainer = document.createElement('div');
	    broadcastsContainer.id = "broadcastsContainer";
	    broadcastsContainer.style.cssText = `
		background: var(--color-surface-hover);        
		border: 0.1rem solid var(--color-border);
		border-color: var(--color-border-light);
		height: 10rem;     
		overflow-x: auto;
		display: flex;
		gap: 5%;
		width: 90%;
		margin: 5% 0;
	    `;
	    details.appendChild(broadcastsContainer);

	    // 5. Create the Action Button
	    const btn = document.createElement('input');
	    btn.type = "button";
	    btn.value = "click to complete";
	    btn.className = "complete-btn";
	    
	    // 6. The Async Logic
	    btn.onclick = async () => {
		try {
		    const channelName = document.getElementById("youtube-config-channelName").value;
		    const apiKey = document.getElementById("youtube-config-apiKey").value;

		    window.Cockatiel.yt.config.channelName = channelName;
		    window.Cockatiel.yt.config.apiKey = apiKey;

		    await window.Cockatiel.yt.getChannelId();
		    const broadcasts = await window.Cockatiel.yt.getLiveAndUpcoming();
		    
		    broadcastsContainer.innerHTML = ""; // Clear existing

		    broadcasts.forEach(b => {
			const bs = document.createElement("div");
			bs.className = "broadcastSelector";
			bs.style.backgroundImage = `url(${b.snippet.thumbnails.default.url})`;

			const vi = document.createElement("div");
			vi.className = "video_info";
			
			const t = document.createElement("div");
			t.className = "title";
			t.innerText = b.snippet.title;
			t.style.fontSize = "0.8rem";
			t.style.padding = "2px";
			
			vi.appendChild(t);
			bs.appendChild(vi);

			bs.onclick = async () => {
			    window.Cockatiel.yt.config.broadcastId = b.id.videoId;
			    const startTimeStr = b.liveStreamingDetails?.actualStartTime;
			    window.Cockatiel.yt.config.streamStartedAt = startTimeStr ? new Date(startTimeStr).getTime() : null;

			    document.getElementById("youtube-config-channelId").value = b.snippet.channelId;
			    document.getElementById("youtube-config-broadcastId").value = b.id.videoId;

			    const lcid = await window.Cockatiel.yt.getLiveChatId();
			    document.getElementById("youtube-config-liveChatId").value = lcid;

			    await window.Cockatiel.MonitoringStart();
			};

			broadcastsContainer.appendChild(bs);
		    });
		} catch (err) {
		    console.error("Config Error:", err);
		}
	    };

	    details.appendChild(btn);

	    // 7. Append Footer Read-only Inputs
	    details.appendChild(createInputGroup("channelId", "youtube-config-channelId"));
	    details.appendChild(createInputGroup("broadcastId", "youtube-config-broadcastId"));
	    details.appendChild(createInputGroup("liveChatId", "youtube-config-liveChatId"));

	    container.appendChild(details);
		return container;
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
		 catch(err){
			this.EmitError(err);
			 console.error("could not generate youtube ui: ", err);
		}
	}
}
