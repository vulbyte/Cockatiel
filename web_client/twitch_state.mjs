import {DebugPrint} from "./DebugPrint.mjs";

export class TwitchApi {
	#twitchSocket = null;
	#isListening = false;
    // Configuration defaults
    #twitch_config = {
        channel: null,
        token: null, 
        nick: null, 
        active: false,
        GenerateUiContainer: null // Target DOM element or ID
    };

    #socket = null;

    constructor(configMap = null) {
        if (configMap) {
            this.updateConfig(configMap);
        }
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
    }
    EmitStop(data){
	    this.#emit(this.#stop_listeners, data);
    }
    EmitWarn(data){
	    this.#emit(this.#warn_listeners, data);
    }
    EmitError(data){
	    this.#emit(this.#error_listeners, data);
    }
    EmitStatus(data){
	    this.#emit(this.#status_listeners, data);
    }

    /**
     * Updates internal config. 
     * If GenerateUiContainer is set, it triggers the UI build.
     */
    updateConfig(configMap) {
        const entries = configMap instanceof Map ? configMap.entries() : Object.entries(configMap);
        let needsReconnect = false;

        for (const [key, value] of entries) {
            if (key in this.#twitch_config) {
                if (this.#twitch_config[key] !== value && (key === 'channel' || key === 'token')) {
                    needsReconnect = true;
                }
                this.#twitch_config[key] = value;
            }
        }

        // Trigger UI generation if a container is provided
        if (this.#twitch_config.GenerateUiContainer) {
            this.buildInterface();
        }

        if (needsReconnect && this.#twitch_config.active) {
            this.connect();
        }
    }

	buildInterface() {
	    const fragment = document.createDocumentFragment();

	    let c = document.createElement("details");
	    let s = document.createElement("summary");
	    s.innerText = "twitch config settings";
	    c.appendChild(s);

	    Object.keys(this.#twitch_config).forEach(key => {
		if (key === 'GenerateUiContainer' || key === 'active') return;

		const wrapper = document.createElement('div');
		wrapper.className = 'twitch-config-wrapper';
		wrapper.style.marginBottom = "15px";

		const label = document.createElement('label');
		label.style.display = "block";
		label.setAttribute('for', `twitch-config-${key}`);
		
		switch (key.toLowerCase()) {
		    case "channel":
			label.innerText = `Twitch ${key}: (twitch.tv/THIS_PART_HERE)`;
			break;
		    case "token":
			label.innerText = `Twitch ${key}: `;
			let d = document.createElement("details");
			let s = document.createElement("summary");
			s.innerText = "How do I get a token?";
			d.appendChild(s);

			let intro = document.createElement("div");
			intro.innerHTML = `
			    <div style="background: #222; color: #eee; padding: 15px; border-radius: 4px; margin-top: 10px; border: 1px solid #444;">
				<p style="color: #ff4444; font-weight: bold;">
				    ⚠️ DO NOT SHARE THIS TOKEN ON STREAM!
				</p>

				<ol>
				    <li>Go to the <a href="https://dev.twitch.tv/console/" target="_blank">Twitch Developer Console</a>.</li>
				    <li>Register your app with <strong>Redirect URL: http://localhost/</strong></li>
				    <li>Paste your <strong>Client ID</strong> below and click Generate.</li>
				    <li style="color: #00ff00; font-weight: bold; margin-top: 10px;">
					IMPORTANT: After you click "Authorize", you will be sent to a "dead" or "broken" page. THIS IS NORMAL.
				    </li>
				    <li>
					Look at the <strong>URL bar</strong> of that broken page. Copy the text between <code>access_token=</code> and <code>&scope</code>.
				    </li>
				    <li>
					Paste that text into the "Twitch token" box above, but make sure you add <code>oauth:</code> to the front of it!
					<details><summary>need more specific help? click here!</summary>
						you'll see in the url bar of your browser something like:<br>
						<span style="color:pink;">https://localhost/#access_token=dnjgzhmp4jttx9gxrvmcxibll8pnpx&scope=chat%3Aread+chat%3Aedit&token_type=bearer</span>

						the part you are specifically looking for is:<br>
						<span style="color:pink;">https://localhost/#access_token=<span style="color:red; font-style:italic;">dnjgzhmp4jttx9gxrvmcxibll8pnpx</span>&scope=chat%3Aread+chat%3Aedit&token_type=bearer</span>
					</details>

				    </li>
				</ol>
			    </div>`;
			
			const genContainer = document.createElement('div');
			genContainer.style.padding = "10px";
			genContainer.style.background = "#333";
			genContainer.style.marginTop = "10px";

			const helperInput = document.createElement('input');
			helperInput.type = "text";
			helperInput.id = "twitch-helper-client-id";
			helperInput.placeholder = "Paste Client ID here...";
			helperInput.style.width = "65%";

			const genBtn = document.createElement('button');
			genBtn.innerText = "Generate Token";
			genBtn.style.marginLeft = "5px";
			genBtn.onclick = () => {
			    const cid = document.getElementById('twitch-helper-client-id').value.trim();
			    if (!cid) return alert("Enter your Client ID first!");
			    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${cid}&redirect_uri=http://localhost/&response_type=token&scope=chat:read+chat:edit`;
			    window.open(url, '_blank');
			};

			intro.appendChild(genContainer);
			genContainer.appendChild(helperInput);
			genContainer.appendChild(genBtn);
			
			d.appendChild(intro);
			label.appendChild(d);
			break;

		    case "nick":
			label.innerText = `Twitch ${key}: (Your Twitch username in lowercase)`;
			break;
			
		    default:
			label.innerText = `Twitch ${key}: `;
			break;
		}

		const input = document.createElement('input');
		input.type = 'text';
		input.id = `twitch-config-${key}`;
		input.placeholder = key;
		input.style.width = "100%";
		input.style.marginTop = "5px";

		wrapper.appendChild(label);
		wrapper.appendChild(input);
		c.appendChild(wrapper);
	    });

	    fragment.appendChild(c);


		const testBtnWrapper = document.createElement('div');
testBtnWrapper.style.marginTop = "10px";
testBtnWrapper.style.padding = "10px";
testBtnWrapper.style.borderTop = "1px solid #444";

const testBtn = document.createElement('button');
testBtn.innerText = "🔍 Test Twitch Credentials";
testBtn.style.width = "100%";
testBtn.style.padding = "8px";
testBtn.style.cursor = "pointer";
testBtn.style.backgroundColor = "#6441a5"; // Twitch Purple
testBtn.style.color = "white";
testBtn.style.border = "none";
testBtn.style.borderRadius = "4px";

testBtn.onclick = () => this.TestTwitchConnection();

testBtnWrapper.appendChild(testBtn);
c.appendChild(testBtnWrapper); // Add it to the bottom of the twitch config details

fragment.appendChild(c);

		// ... after the Test Connection button code ...

	const controlBtnWrapper = document.createElement('div');
	controlBtnWrapper.style.marginTop = "5px";
	controlBtnWrapper.style.padding = "0 10px 10px 10px";

	const startBtn = document.createElement('button');
	startBtn.innerText = "▶️ Start Listening to Chat";
	startBtn.style.width = "100%";
	startBtn.style.padding = "10px";
	startBtn.style.fontWeight = "bold";
	startBtn.style.cursor = "pointer";
	startBtn.style.backgroundColor = "#444";
	startBtn.style.color = "white";
	startBtn.style.border = "1px solid #666";
	startBtn.style.borderRadius = "4px";

	startBtn.onclick = () => this.toggleChatListener(startBtn);

	controlBtnWrapper.appendChild(startBtn);
	c.appendChild(controlBtnWrapper); // Append to the Twitch config container

	    return fragment;
	}

	async TestTwitchConnection() {
    // 1. Grab values directly from the UI inputs
    const token = document.getElementById('twitch-config-token')?.value.trim();
    const nick = document.getElementById('twitch-config-nick')?.value.trim();

    if (!token || !nick) {
        alert("Please enter both a Nick and a Token to test.");
        return;
    }

    // Clean the token (Twitch API expects just the string, no 'oauth:' prefix)
    const cleanToken = token.replace('oauth:', '');

    DebugPrint({ msg: "Testing Twitch token validation..." });

    try {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${cleanToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            DebugPrint({ msg: "Twitch Connection Success!", val: data });
            alert(`✅ Success! Token belongs to: ${data.login}\nScopes: ${data.scopes.join(', ')}`);
        } else {
            DebugPrint({ msg: "Twitch Connection Failed", val: data, type: "warn" });
            alert(`❌ Failed: ${data.message}`);
        }
    } catch (err) {
        DebugPrint({ msg: "Error during Twitch validation", err: err });
        alert("❌ Error: Could not reach Twitch servers.");
    }
}

    connect(onMessageReceived) {
        if (this.#socket) this.#socket.close();

        this.#socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        this.#socket.onopen = () => {
            // When connecting, we pull the LATEST values from the DOM inputs 
            // if they exist, or fallback to the config object.
            const channel = document.getElementById('twitch-config-channel')?.value || this.#twitch_config.channel;
            const token = document.getElementById('twitch-config-token')?.value || this.#twitch_config.token;
            const nick = document.getElementById('twitch-config-nick')?.value || this.#twitch_config.nick;

            this.#socket.send(`PASS ${token}`);
            this.#socket.send(`NICK ${nick}`);
            this.#socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            this.#socket.send(`JOIN #${channel}`);
            this.#twitch_config.active = true;
            console.log(`Twitch Connection Attempt: ${channel}`);
        };

        this.#socket.onmessage = (event) => {
            const messages = this.processRawData(event.data);
            if (onMessageReceived && messages.length > 0) {
                messages.forEach(msg => onMessageReceived(msg));
            }
        };
    }

    processRawData(rawData) {
        return rawData
            .trim()
            .split('\r\n')
            .filter(line => line.includes('PRIVMSG'))
            .map(line => this.formatToUnprocessedStruct(line))
            .filter(msg => msg !== null);
    }

    formatToUnprocessedStruct(line) {
        const parsedData = this.parseTwitchIRC(line);
        if (!parsedData) return null;

        return {
            version: 1,
            apiVersion: 3, 
            data: parsedData,
            dateTime: parsedData.serverTimestamp || new Date().toISOString(),
            platform: 'twitch',
            failedProcessingAt: null,
        };
    }

    parseTwitchIRC(raw) {
        const match = raw.match(/^@([^ ]+) :([^!]+)![^@]+@[^ ]+ PRIVMSG #[^ ]+ :(.+)$/);
        if (!match) return null;

        const [_, tagString, username, messageText] = match;
        const tags = Object.fromEntries(tagString.split(';').map(t => t.split('=')));

        return {
            user: username,
            text: messageText,
            id: tags['id'],
            displayName: tags['display-name'],
            color: tags['color'],
            serverTimestamp: tags['tmi-sent-ts'] 
                ? new Date(parseInt(tags['tmi-sent-ts'])).toISOString() 
                : null
        };
    }

	async toggleChatListener(button) {
	    if (this.#isListening) {
		// STOP LOGIC
		if (this.#twitchSocket) {
		    this.#twitchSocket.close();
		    this.#twitchSocket = null;
		}
		this.#isListening = false;
		button.innerText = "▶️ Start Listening to Chat";
		button.style.backgroundColor = "#444";
		DebugPrint({ msg: "Stopped listening to Twitch chat." });
	    } else {
		// START LOGIC
		const token = document.getElementById('twitch-config-token')?.value.trim();
		const nick = document.getElementById('twitch-config-nick')?.value.trim();
		const channel = document.getElementById('twitch-config-channel')?.value.trim();

		if (!token || !nick || !channel) {
		    alert("Please fill in Nick, Token, and Channel before starting.");
		    return;
		}

		button.innerText = "⏳ Connecting...";
		
		try {
		    // Example using WebSockets for Twitch IRC
		    this.#twitchSocket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

		    this.#twitchSocket.onopen = () => {
			const cleanToken = token.startsWith('oauth:') ? token : `oauth:${token}`;
			this.#twitchSocket.send(`PASS ${cleanToken}`);
			this.#twitchSocket.send(`NICK ${nick.toLowerCase()}`);
			this.#twitchSocket.send(`JOIN #${channel.toLowerCase()}`);
			
			this.#isListening = true;
			button.innerText = "⏹️ Stop Listening";
			button.style.backgroundColor = "#ff4444";
			DebugPrint({ msg: "Connected to Twitch Chat!" });
		    };

		    this.#twitchSocket.onmessage = (event) => {
			// Here is where you would call your message processing logic
			window.Cockatiel.ParseAndAddTwitchMessagesToUnprocessedQueue(event.data);
		    };

		    this.#twitchSocket.onerror = (err) => {
			DebugPrint({ msg: "Socket Error", err: err });
			this.toggleChatListener(button); // Reset UI
		    };

		} catch (err) {
		    DebugPrint({ msg: "Failed to connect", err: err });
		    button.innerText = "▶️ Start Listening to Chat";
		}
	    }
	}
}
