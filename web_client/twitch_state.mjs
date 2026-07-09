import {BaseClass} from "./baseClass.mjs";
import {DebugPrint} from "./DebugPrint.mjs";
import {IntTimer} from  "./intTimer.mjs";
import {Result} from "./result.mjs";

export class Twitch extends BaseClass {
    static extraConfig = {
        channel: null,
	color: "#6441a5",
    	title: "twitch",
	iconLink: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Twitch_icon_2012.svg/250px-Twitch_icon_2012.svg.png",
        token: null, 
        nick: null, 
        active: false,
        GenerateUiContainer: null, // Target DOM element or ID
	//twitchConfig
    };
    constructor(configMap){
		super({
			childClassName: new.target.name,
			extraConfig: new.target.extraConfig,
		});

        if (configMap) {
            this.updateConfig(configMap);
        }
    }

	DPrint(data){
		window.Cockatiel.DebugPrint(data);
		this.EmitStatus(data);
	}
	
	#twitchSocket = null;
	#isListening = false;


    #socket = null;


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

	buildInterface() {
		let config = this.GetConfigValue("*").value;

	    const fragment = document.createDocumentFragment();

	    let c = document.createElement("div");
	    let s = document.createElement("h4");
	    s.innerText = "twitch config settings";
	    c.appendChild(s);

	    Object.keys(config).forEach(key => {
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
			label.innerText = `Twitch ${key}: (Your bots username in lowercase)`;
			break;
			
		    default:
			label.innerText = `Twitch ${key}: `;
			break;
		}

		const input = document.createElement('input');
		input.type = 'text';
		input.id = `twitch-config-${key}`;
		input.placeholder = key;
		if(key == "token"){
			input.type = "password"
			input.title = "we will not reveal this to protect your channel and your career. DO NOT DO THIS LIVE"
		}
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

	GenerateUI(){
		return Result.ok(window.Cockatiel.UITemplate(
			`https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Twitch_Glitch_Logo_Purple.svg/250px-Twitch_Glitch_Logo_Purple.svg.png`, 
			"twitch",
			window.Cockatiel.Twitch,
			(() => {this.UpdateConfig({isEnabled: true})}),
			(() => {this.UpdateConfig({isEnabled: false})}),
			(() => {
				let d = document.createElement("details");
				let s = document.createElement("summary");
				s.innerText = "expand for sensitive twitch information";
				d.append(s, this.buildInterface());
				return d;
			})()
		));
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

    this.DPrint({ msg: "Testing Twitch token validation..." });

    try {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${cleanToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            this.DPrint({ msg: "Twitch Connection Success!", val: data });
            alert(`✅ Success! Token belongs to: ${data.login}\nScopes: ${data.scopes.join(', ')}`);
        } else {
            this.DPrint({ msg: "Twitch Connection Failed", val: data, type: "warn" });
            alert(`❌ Failed: ${data.message}`);
        }
    } catch (err) {
        this.DPrint({ msg: "Error during Twitch validation", err: err });
        alert("❌ Error: Could not reach Twitch servers.");
    }
}

    connect(onMessageReceived) {
        if (this.#socket) this.#socket.close();

        this.#socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        this.#socket.onopen = () => {
            // When connecting, we pull the LATEST values from the DOM inputs 
            // if they exist, or fallback to the config object.
            const channel = document.getElementById('twitch-config-channel')?.value || config.channel;
            const token = document.getElementById('twitch-config-token')?.value || config.token;
            const nick = document.getElementById('twitch-config-nick')?.value || config.nick;

            this.#socket.send(`PASS ${token}`);
            this.#socket.send(`NICK ${nick}`);
            this.#socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            this.#socket.send(`JOIN #${channel}`);
            config.active = true;
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
		this.DPrint({ msg: "Stopped listening to Twitch chat." });
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
			this.DPrint({ msg: "Connected to Twitch Chat!" });
		    };

		    this.#twitchSocket.onmessage = (event) => {
			// Here is where you would call your message processing logic
			this.ParseAndAddTwitchMessagesToUnprocessedQueue(event.data);
		    };

		    this.#twitchSocket.onerror = (err) => {
			this.DPrint({ msg: "Socket Error", err: err });
			this.toggleChatListener(button); // Reset UI
		    };

		} catch (err) {
		    this.DPrint({ msg: "Failed to connect", err: err });
		    button.innerText = "▶️ Start Listening to Chat";
		}
	    }
	}

	ParseAndAddTwitchMessagesToUnprocessedQueue(item) {
	    try {
		let state = window.Cockatiel.GetState();
		// 1. Simple Regex to pull the username and the actual message text
		// This matches the pattern: :username!user@host PRIVMSG #channel :message
		const match = item.match(/^:([^!]+)![^@]+@[^ ]+ PRIVMSG #[^ ]+ :(.+)\r\n$/);
		
		let username = "system";
		let messageText = item;

		if (match) {
		    username = match[1];
		    messageText = match[2];
		}

		// 2. Define the template
		const template = {
		    version: 1,
		    apiVersion: 3, // Keep as 3 per your requirement
		    data: {
			raw: item,
			username: username,
			message: messageText
		    },
		    dateTime: Date.now(),
		    platform: "twitch",
		    failedProcessingAt: null,
		};

		// 3. Structured Clone and Push
		const formattedMessage = structuredClone(template);
		window.Cockatiel.PushToUnprocessedQueue(formattedMessage);

		this.DPrint({
		    msg: "Twitch message parsed and queued",
		    val: formattedMessage
		});

	    } catch (err) {
		this.DPrint({
		    msg: "Error parsing Twitch message",
		    err: err,
		    val: item,
		    type: "t"
		});
	    }
	}

	async ProcessTwitchV1Data_v1(unprocessedMsg) {    
	    const raw = unprocessedMsg.data.raw;

	    // 1. Explicitly protect actual chat/event messages from being filtered
	    const isUserEvent = raw.includes("PRIVMSG") || raw.includes("USERNOTICE");

	    if (!isUserEvent) {
		// If it's not a user event, check if it's a known Twitch system/handshake message
		const isSystemMessage = 
		    /\.tmi\.twitch\.tv\s+\d{3}\s+/.test(raw) || 
		    raw.includes("tmi.twitch.tv") || 
		    raw.includes("PING") || 
		    raw.includes("CAP * ACK");

		if (isSystemMessage) {
		    this.DPrint({ msg: "Ignoring Twitch System Message", val: "Handshake/NamesList" });
		    return null; 
		}
	    }
	    
	    this.DPrint({ msg: "Twitch processing started:", val: raw });

	    // 2. Determine type for the switch
	    let type = "unknown";
	    if (raw.includes("PRIVMSG")) type = "textmessageevent";
	    else if (raw.includes("USERNOTICE")) type = "usernoticeevent"; 
	    else if (raw.includes("bits=")) type = "bitsevent";

	    let msg = null;
	    
	    switch(type) {
		case "textmessageevent":
		    try {
			// Try the standard parser first
			msg = await this.ProcessTwitchMessage(unprocessedMsg);
		    } catch (innerErr) {
			this.DPrint({ msg: "Primary ProcessTwitchMessage threw an error:", error: innerErr });
		    }

		    // FALLBACK LAYER: If primary parser failed or returned null, run matching YouTube style pipeline
		    if (!msg) {
			this.DPrint({ msg: "Primary parser returned nothing. Running pipeline fallback..." });
			
			const bareIrcRegex = /^:([^!]+)![^ ]+ PRIVMSG #[^\s]+ :([\s\S]*)$/;
			const match = raw.trim().match(bareIrcRegex);

			if (match) {
			    const extractedUsername = match[1];
			    const extractedText = match[2];

			    try {
				const cockatiel = window.Cockatiel; // Reference main controller
				const state = cockatiel.GetState();

				// Parse out target channel name cleanly
				const channelMatch = raw.match(/PRIVMSG\s+(#[^\s:]+)/);
				const extractedChannel = channelMatch ? channelMatch[1] : `#${extractedUsername}`;

				// 1. Structure the message matching global schema templates
				let newMessage = structuredClone(window.Cockatiel.templates.messages);
				newMessage.version = 1;
				newMessage.type = "message-unmonitized";
				newMessage.platform = "twitch";
				newMessage.rawMessage = extractedText;
				newMessage.messageId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
				newMessage.channelOrigin = extractedChannel;
				newMessage.receivedAt = unprocessedMsg.dateTime || Date.now();
				newMessage.username = extractedUsername;
				newMessage.authorId = extractedUsername;

				// 2. Locate or instantiate the user profile context safely
				let foundUuid = cockatiel.FindUserFromChannelIdAndReturnUuid(extractedChannel);
				let user;

				if (!foundUuid) {
				    this.DPrint({ msg: "NEW USER: Creating profile via native flags", val: extractedUsername });
				    user = cockatiel.CreateUserFromFlags(newMessage); 
				    newMessage.userUuid = user.uuid;
				} else {
				    this.DPrint({ msg: "EXISTING USER: Mapping to UUID", val: foundUuid });
				    user = state.users[foundUuid];
				    newMessage.userUuid = foundUuid;
				}

				// 3. Sanitization utility processing
				if (cockatiel.CheckMessageForBannedWords(newMessage.rawMessage)) {
				    // Logic for banned words here if your platform config requires it
				}
				newMessage.processedMessage = cockatiel.SanitizeString(newMessage.rawMessage);

				// 4. Custom command parser extraction
				const commandObject = cockatiel.ParseCommandFromMessage(newMessage);
				newMessage.commands = commandObject || {};
				
				const firstCmdKey = Object.keys(newMessage.commands)[0];
				if (firstCmdKey && newMessage.commands[firstCmdKey].message) {
				    newMessage.processedMessage = newMessage.commands[firstCmdKey].message;
				}

				// 5. Score parsing metrics and award user community engagement points
				newMessage.score = await cockatiel.ScoreMessage(newMessage.processedMessage);
				cockatiel.AddPointsToUserWithUuid(newMessage.score, newMessage.userUuid);

				// 6. Sync User metadata properties across platform boundaries
				if (user) {
				    user.icon = unprocessedMsg.data.icon || user.icon || "";
				    user.isVerified = false;
				    user.isChatOwner = extractedChannel === `#${extractedUsername}`;
				    user.isChatSponsor = false;
				    user.isChatModerator = false;
				}

				newMessage.state = { displayedAt: false };
				msg = newMessage;

				this.DPrint({ msg: "Pipeline fallback successfully built and validated msg object!", val: msg });

			    } catch (fallbackErr) {
				this.DPrint({ 
				    msg: "CRITICAL ERROR in ProcessTwitchV1Data_v1 Fallback Pipeline", 
				    type: "e", 
				    err: fallbackErr.message 
				});
				console.error(fallbackErr);
				msg = null;
			    }
			} else {
			    this.DPrint({ msg: "Fallback regex failed to match raw text stream", val: raw });
			}
		    }

		    return msg;

		case "bitsevent":
		    this.DPrint({ msg: "Bits detected", type: "i" });
		    return null;

		case "usernoticeevent":
		    this.DPrint({ msg: "Sub/UserNotice detected", type: "i" });
		    return null;

		default:
		    this.DPrint({ 
			msg: "UNHANDLED TWITCH IRC COMMAND", 
			val: raw.substring(0, 50) + "...", 
			type: "w" 
		    });
		    return null; 
	    }
	}

	async ProcessTwitchMessage(r_msg){ /*r_msg = raw_message*/
		let p_msg = structuredClone(window.Cockateal.templates.message);
		/*
			//originalData: {},
			commands: [/*eac command being a messageCommandObject],
			version: 1,
			channelOrigin: null,
			donationAmount: 0,
			donationCurrency: undefined,
			messageId: null,
			processedMessage: null,
			platform: null,
			rawMessage: null,
			receivedAt: null, 
			score: null,
			state: {},
			streamOrigin: null, //what streamid via the platform the message came from
			type: null,//must be selected from: templates.message_types[i]
			username: null,
			userUuid: null,
		*/
		p_msg.commands = window.Cockatiel.ParseCommandFromMessage(processedMessage);
		p_msg.version = 1;
		p_msg.channelOrigin = r_msg.username;
		p_msg.donationAmount = 0;
		p_msg.donationCurrency = null;
		p_msg.messageId = crypto.randomUUID();
		p_msg.processedMessage = null;
		p_msg.platform = 'twitch';
		p_msg.rawMessage = r_msg.raw;
		p_msg.receivedAt = r_msg.dateTime;
		p_msg.score = window.Cockatiel.ScoreMessage(r_msg.message);
		p_msg.state = {};
		p_msg.streamOrigin = `twitch.tv/${String(config.nick)}`; //what streamid via the platform the message came from
		p_msg.type = "message-unmonitized" ;//must be selected from: templates.message_types[i]
		p_msg.username = r_msg.username;

		let user = window.Cockatiel.CreateUserFromFlags(newMessage); /*returns user object*/
		p_msg.userUuid = user.uuid;
	}	
}
