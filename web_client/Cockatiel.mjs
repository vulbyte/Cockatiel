import {BannedWordsManager} from "./bannedWordsManager.mjs";
import {ChatManager} from "./chat_manager.mjs";
import {EventsManager} from "./events_manager.mjs";
import {ScoreHandler} from "./score_handler.mjs";
import {Timeline} from "./timeline.mjs";
import {TtsManager} from "./tts_state.mjs";
import {UserManager} from "./user_manager.mjs";


import {Twitch} from "./twitch_state.mjs";
import {Youtube} from "./youtube_state.mjs";


import {DebugPrint} from "./DebugPrint.mjs";
import {Result} from "./result.mjs"


// TLDR codebase rules:
/* 1. why do we use getters/setters?: prevent data leaks for sensitive information. ie we don't want api-keys leaking. */
/* 2. why use the result pattern?: javascript stack traces are a massive pain, and often get consumed in the worst way possible at critical times. so a proper pattern that just formal logging is far better than relying on throws. */

export class Cockatiel {
	//assigend to document on init
	#hasInited = false;
	BannedWordsManager = new BannedWordsManager();

	d; // document
	ChatWindow; // chat window
	EventManager; // event window
	UserManager = new UserManager();

	twitch;
	youtube;	

	templates = {
		bannedAt: {
			version: 1, datetime : "", unbannedAt : [], banAppeals : [],
		},
		bannedWord: {
			word: "",
			occurrances: 0,
		},
		channel: {
			version : 1, platform : "", channelName : "", channelId : ""
		},
		commendment: {
			version: 1,
			happenedAt: null,
			byUser: null, // uuid
			messageCommended: null, // messageCommended if any
		},
		commands: {
			version : 1,
			commandType: null,
			flags : {}, // ie: e: {value, type, description,}
			func: null, // function to call when triggered
			//will check the highest perm first, the first to return true will be assumed. if none true assumed to be public
			AuthNeeded: { 
				owner: false,
				admin: false,
				mod: false,
				// trusted users are users who have a certain amount of lifetime score or time since first appearance.
				trusted: false, 
			},
			cost: 0
		},
		events: {
			id: null,
			type: "prediction",
			startedAt: null,
			completedAt: null,
			expiresAt: null,
			state: {
			    prompt: "",
			    votes: [],
			}
		},
		event_prediction: {
			id: null,
			type: "prediction",
			startedAt: null,
			completedAt: null,
			expiresAt: null,
			state: {
			    prompt: "",
			    votes: [],
			    lockoutDuration: 300,
			    timeRemainingUntilLockout: 60,
				timeRemainingUntilEnd: 300,
				timeRemainingUntilRefund: 600,
			},
		},
		errored_data: {
		    version: 1,          	
		    data: null,           	// raw data that errored
		    hardware: null,       	// hardware info of the system that failed
		    erroredAt: null,      	// unixTime of when the error happened
		    errorMessage: null,   	// err.message for quick reference
		    stackTrace: null,     	// err.stack: captures the full path of the failure
		    processingStage: null,	// identifies which function/.valueblock was running
		    retryCount: 0              	// increments if you attempt to re-process
		},
		flags: {
			flag : null, 
			value : null, 
			description : null, 
			range : {min:0.5, max : 3}
		},
		log: {
			type: null, // options: modAction, log, warn, err, 
			message: null, // str only
			data: null, // data passed into the message
			error: null, // error info
		},
		//moved messageTypes to within platformSettings
		messages: {
			//originalData: {},
			commands: [/*eac command being a messageCommandObject*/],
			version: 1,
			channelOrigin: null,
			donationAmount: 0,
			donationCurrency: null,
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
		},
		messageCommand: {
			isValid: false, // if everything passes, then true, if not (ie not enough credits, not the right perms, etc, then false
			commandType: null,
			flags: {}, // flags will be a key value, such as: {-y: true}
			message: null,
			executedAt: null,
			pointsOffer: 0, // amount spent on the command,	
			message: null,
			version: 1, // version to check
			errInfo: {
				err: null,
				erroredAt: null,
			},
			state: {
				readAt: null,
			},
		},
		misconduct: {
			version: 1,
			happenedAt: null, // unixTimestamp	
			byUser: null, //  uuid
			messageMisconduct: null, // if null do not add
		},
		platformSettings: { //key, default value
			cheerMonitized: {
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie claim bits
			cheerUnmonitized: {
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie use a gif
			communityGiftMonitized: {
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie gifted sub
			communityGiftUnmonitized:{
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie +rep 
			followMonitized:{
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie new channel memeber on yt
			followUnmonitized:{
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie new follow on twitch
			messageMonitized:{
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie donation 
			messageUnmonitized:{
				css: null,
				notificationSound: null,
				overrideGlobal: false,
			}, //ie chat
		},
		unprocessed_message_v1: {
			version : 1,
			apiVersion : 3, // youtube,
			data : null,
			dateTime : null,
			platform : null,
			failedProcessingAt : null,
		},
		user: {
			version : 1, 
			username: null,
			channels : {
				facebook: [],
				kick: [],
				tiktok: [],
				twitch: [],
				youtube: [],
			}, 
			uuid : null,
			ttsBans : [], // times they've been restricted from using tts (ie non-english, spam, etc)
			channelBans : [], // when banned and why
			conduct_score: 0, // -5 is the worst, 5 is the best, calculated at init or when a commendment or misconduct is added. ranks are in the following order (worst to best): 
			/*	opal		- 1.5x score multiplier
				obsidian	- can send gifs
				diamond 	- 1.2x score multiplier
				platinum	- no more negative points -- here and above is trusted
				gold		- 1.1x score multiplier
				silver		- ...
				bronze		- 0.85x
				copper		- 0.75x score multiplier
				concrete	- user now automatically hidden from chat (not dashboard tho)
				dirt		- no chat customization perms
				trash		- 0.5x score multiplier*/
			commendments: {
				community: [], // welcoming, helpful, inclusivity, etc
				engagement: [], // hype, constructive feedback, good chatting, etc
				support: [], //the only thing one can buy
				rep: [], // low support, no real value on scoring but can be fun for chat
			},
			misconduct: {
				discrimination: [], // racism, sexism, etc
				harassment: [], // bullying, hate speech, etc
				spam: [], // self-promo, asdl;fknfrtn, links, etc
				integrity: [], // language, spoilers, trolling/rage, bypassing filters
			},
			icon: null, //only allow icons from yt/twitch/etc
			isSponser: false, // is a paying memeber/has payed money this stream 
			isChatModerator: false, // can remove messages or but users on timeout
			isChatAdmin: false, // can manage blocked words, change chat modes, and some other things
			isVerified: false, // if they have been verified by the platform
			firstSeen: null, //Date.now()
			points : 0,
			totalPoints: 0,
			styling: { // ONLY CUSTOMIZABLE PROPERTIES ARE HERE, styles are whiteliste'd
				chatMessageContainer: {
					styling: null,
					chatUserBubble: {	
						styling: null,
						chatBubbleTailContainer: {
							styling: null,
							chatBubbleTailContainer: {
								styling: null,
								chatBubbleTail: {styling: null,},
							},
						},
						chatUserInfo: {
							styling: {
								backgroundColor: "#ff8",
								borderRadius: "3rem",
								color: "black",
							},
							chatUserImageContainer: {
								styling: {
									backgroundColor: "#000",
									borderRadius:"100%",
								},
								chatUserImage: {styling: null},
							},
							chatUserStats: {
								styling: null,
								chatUsername: {styling: null},
								chatUserCommendations: {styling: null,}
							}
						}
					},
					chatMessageBubble: {
						styling: {
							backgroundColor:"#111",
							borderRadius:"1.3rem",
							color: "white",
						},
						chatCommandContainer: {
							styling: {
								height:"1rem",
								paddingBottom:"1rem",
							},
							chatCommand: {
								styling: {
									backgroundColor:"#222",
									borderRadius:"1rem",
									color: "cyan",
								},
							},
						},

						chatMessage: { styling: null },
					},
				},
			}, //end of styling
			totalMessages: 0,
		}
	};	

	DebugPrint(args = {}) {
	    // 1. Improved Error handling: Extract message and stack if it's an Error object
	    const formatError = (e) => {
		if (e instanceof Error) {
		    return `[${e.name}] ${e.message}\nStack: ${e.stack}`;
		}
		return JSON.stringify(e, null, 4) || "";
	    };

	    let errorMessage = formatError(args.err || args.error);
	    
	    // Fixed: You were checking args.value, but your default object uses args.val
	    let value = JSON.stringify(args.val, null, 4) || ""; 
	    let msg = args.msg || "";

	    let statement = `msg: ${msg} \nval: ${value} \nerr: ${errorMessage}`;
	    
	    // 2. Fix the "throw" logic
	    // Your previous code didn't actually throw; it just created a new Error object.
	    const type = args.type?.toLowerCase();

	    switch(type) {
		case "throw":
		case "t":
		    throw new Error(msg/*statement*/); // Use 'throw' to actually stop execution
		case "error":
		case "err":
		case "e":
		    console.error(statement);
		    break;
		case "warning":
		case "warn":
		case "w":
		    console.warn(statement);
		    break;
		default:
		    console.log(statement);
		    break;
	    }

	    // 3. Internal Log Tracking
	    let log = {
		type: args.type || "log",
		message: msg,
		val: args.val,
		error: (errorMessage, errorMessage.stack), // Save the string version for readability
	    };
	    //this.AddLogToLogs(log);

	    return log;
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
		console.error("CHE failed", err);
		return null;
	    }
	}

	UITemplate(
		icon, 
		platformName,
		platformStateManager,
		enabledFunctionListener,
		disabledFunctionListener,
		additionalHTMLOptions,
	){	
		//early exits, these are considered manditory
		if( !icon ){
			this.DebugPrint({
				msg: msg,
				val: icon,
				type: 't'
			});
		}
		if( !platformName ){
			this.DebugPrint({
				msg: "couldn't get platform name, is null",
				val: platformName,
				type: 't'
			});
		}
		if( !platformStateManager ){
			this.DebugPrint({
				msg: "couldn't get platformStateManager, is null",
				val: platformStateManager,
				type: 't'
			});
		}
		if( !enabledFunctionListener){
			this.DebugPrint({
				msg: "couldn't get enabledFunctionListener, is null",
				val: enabledFunctionListener,
				type: 't'
			});
		}
		if( !disabledFunctionListener){
			this.DebugPrint({
				msg: "couldn't get disabledFunctionListener, is null",
				val: disabledFunctionListener,
				type: 't'
			});
		}

		let generalSettings = document.createElement("details");

		let detailedStatus = document.createElement("output");
		
		generalSettings.style = `
			border: 0.1rem solid white;
			overflow: scroll;
		`;
			let summary = document.createElement("summary");
				summary.style = `
						display: flex; 
						flex-direction: row;
				`;
				//summary.innerText = "general settings";
				let iconContainer = document.createElement("img");
					iconContainer.src = icon;
					iconContainer.width = "6.2rem";
					iconContainer.height = "6.2rem";
					iconContainer.style = `
					margin-top:0.3rem;
					padding:0.4rem;
					width:1.6rem;
					height:1.6rem;
					`;
					iconContainer.title = platformName;
				summary.append(iconContainer);
				let statusIndicatorContainer = document.createElement("div");
				//statusIndicatorContainer 
				statusIndicatorContainer.style = `
					width: 1rem;
					height: 1rem;
					margin-top:1.0rem;
					margin-left: 0.4rem;
					margin-right: 0.4rem;
					position: relative;
					padding-right: 1.2rem;
				`;
					let statusIndicator = document.createElement("div");
						statusIndicator.innerText = null;
						statusIndicator.style = `
							background-image: radial-gradient(at 50% 50%, #aaaabb, #334499);
							background-size: 100% 90%;
							background-postion: 0% -70%;
							border-radius: 1rem;
							width: 1rem;
							height: 1rem;
							margin-top:0.0rem;
							margin-left: 0.4rem;
							margin-right: 0.4rem;
							position: absolute;
							/*
							padding-left: 0.4rem;
							padding-right: 1.4rem;
							*/
						`;
					statusIndicatorContainer.append(statusIndicator);	
					let statusIndicatorShine = document.createElement("div");
						statusIndicatorShine.innerText = null;
						statusIndicatorShine.style = `
							background-image: radial-gradient(#ffff00, #ffaa00);
							background-size: 20% 20%;
							background-postion: 0% -0.5rem%;
							border-radius: 1rem;
							filter: opacity(0.4);
							width: 1rem;
							height: 1rem;
							margin-top:0.0rem;
							margin-left: 0.4rem;
							margin-right: 0.4rem;
							mix-blend-mode: multiply;
							position: absolute;
							/*
							padding-left: 0.4rem;
							padding-right: 1.4rem;
							*/
						`;
					statusIndicatorContainer.append(statusIndicatorShine);		
				summary.append(statusIndicatorContainer);	
				/*
				let isActiveLabel = document.createElement("label");
					isActiveLabel.innerText = "start/stop";
					isActiveLabel.style = `	
						padding:0.8rem;
					`
					isActiveLabel.title = "determines if the listener will check for messages" + platformName;
				summary.append(isActiveLabel);
				*/
				let isActiveEnable = document.createElement("input");
					isActiveEnable.value = "▶︎";
					isActiveEnable.type = "button";
					isActiveEnable.style = `	
						color: white;
						background-image: linear-gradient(#007700, #004400);
						height: 3rem;
						width: 3rem;
					`;
					isActiveEnable.id = platformName + "enabledToggle";
					isActiveEnable.title = "enable " + platformName;
					isActiveEnable.addEventListener("click",  (() => {
						//will get the value post update
						this.DebugPrint({msg: `calling enabled function listener for ${platformName}`});
						enabledFunctionListener();	
					}));
				summary.append(isActiveEnable);

				let isActiveDisable = document.createElement("input");
					isActiveDisable.value = "⏸︎";
					isActiveDisable.type = "button";
					isActiveDisable.style = `	
						color: white;
						background-image: linear-gradient(#990000, #770000);
						height: 3rem;
						width: 3rem;
					`;
					isActiveDisable.id = platformName + "enabledToggle";
					isActiveDisable.title = "disable " + platformName;
					isActiveDisable.addEventListener("click",  (() => {
						//will get the value post update
							this.DebugPrint({msg: `calling disbled function listener for ${platformName}`});
							disabledFunctionListener();
					}));
				summary.append(isActiveDisable);

				let statusLines = document.createElement("output");
					let statusListenerId = platformName + "StatusListener";
					statusLines.id = statusListenerId;
					statusLines.style = `
						margin-top: 0.8rem;
						color: #ff0064;
						
					`;
					/*
					platformStateManager.AddStatusListener((update) => {
						//run this when the emitStatusListener is called
						document.getElementById(statusListenerId).innerText = update;
					});
					*/
				summary.append(statusLines);
				platformStateManager.AddStatusListener(
				);
				let simpleStatusMessage = document.createElement("output");
					simpleStatusMessage.id = platformName + "-SimpleStatusListener";
					simpleStatusMessage.style = `
						background-color: #222;
						color: white;
						font-family: monospace;
						min-width: 16rem;
						min-height: 1.5rem;
						padding:0.8rem;
					`;
					platformStateManager.AddStatusListener((data) => {
						data = structuredClone(data);
						if(data == null){return;}
						if(String(typeof(data)).toLowerCase() == 'object'){
							if(data.msg){
								data = data.msg;
							}
							else{
								data = JSON.stringify(data, null, 4);
							}
						}

						//run this when the emitStatusListener is called
						document.getElementById(simpleStatusMessage.id).innerText = data;
					});
				
				summary.append(simpleStatusMessage);	
			generalSettings.append(summary);

			let statusMessage = document.createElement("div");
				statusMessage.id = platformName + "-StatusListener";
				statusMessage.style = `
					background-color: #222;
					border-radius:1rem;
					color: white;
					font-family: monospace;
					min-width: 16rem;
					width: 80%;
					max-width: 60rem;
					margin: auto;
					min-height: 1.5rem;
					padding:0.8rem;
					padding-top: 2rem;
					padding-top: 2rem;
					margin-top:1rem;
					margin-bottom:1rem;
				`;
				
				let nullMessages = [
					 "nothing to display... for now...",
					"nothing here but us chickens...",
					"weeeeeee!... oh... nothing has happened yet...",
				];

				statusMessage.innerText = nullMessages[Math.floor(nullMessages.length*Math.random())];
				platformStateManager.AddStatusListener((data) => {
					if(data == null){return;}
					if(String(typeof(data)).toLowerCase() == 'object'){
						data = JSON.stringify(data, null, 4);
					}
					//run this when the emitStatusListener is called
					document.getElementById(statusMessage.id).innerText = data;
				});
			generalSettings.append(statusMessage)


			//general settings that are pretty consistent
			let globalOverrides = document.createElement("table");

				let headerRow = document.createElement("tr");
					let th1 = document.createElement("th");
						th1.innerText = "flag";
					let th2 = document.createElement("th");
						th2.innerText = "override global audio?";
					let th3 = document.createElement("th");
						th3.innerText = "new Audio";
					let th4 = document.createElement("th");
						th4.innerText = "override global css";
					let th5 = document.createElement("th");
						th5.innerText = "new css";
						th5.style = `
							min-width: 16rem
						`;
					headerRow.append(th1, th2, th3, th4, th5);
				globalOverrides.append(headerRow);
			let keys = Object.keys(this.templates.platformSettings);
			this.DebugPrint({
				msg: `generating inputs for the following keys for ${platformName}`,
				val: keys,
			})
			let key, val;
			for(let i = 0; i < keys.length; ++i){
				/* at time of writing the withins are:
				css: null,
				notificationSound: null,
				overrideGlobal: false,
				*/
				key = keys[i];	
				val = Object.keys(this.templates.platformSettings);

				let container = document.createElement("tr");
					container.style = `
						/*display:block;
						flex-direction: row;*/
						width:100%;
					`;
					//for(let j = 0; j < keys.length; ++j){
					console.log("I AM GENERATING INPUTS")
					
					let labelTd = document.createElement("td");
						let label = document.createElement("label");
							label.innerText = key; //key.slice(key.lastIndexOf('-'), key.length);
							label.id = `${platformName}-${key}-overridelabel`;
						labelTd.append(label);
					container.append(labelTd);
					let audioToggleTd = document.createElement("td");
					let audioToggle = document.createElement("input");
						audioToggle.type = "checkbox";
						audioToggle.input = this.templates.platformSettings[key] || null;
						audioToggle.id = `${platformName}-${key}-${key}Override`;
						audioToggleTd.append(audioToggle);
					container.append(audioToggleTd);
					let audioInputTd = document.createElement("td");
					let audioInput = document.createElement("input");
						audioInput.type = "file";
						audioInput.input = this.templates.platformSettings[key] || null;
						audioInput.id = `${platformName}-${key}-${key}OverrideValue`;
						audioInputTd.append(audioInput);
					container.append(audioInputTd);
					let toggleTd = document.createElement("td");
					let toggle = document.createElement("input");
						toggle.type = "checkbox";
						toggle.input = this.templates.platformSettings[key] || null;
						toggle.id = `${platformName}-${key}-${key}Override`;
						toggleTd.append(toggle);
					container.append(toggleTd);

	let cssInputTd = document.createElement("td");

	// 1. Create the wrapper
	let wrapper = document.createElement("div");
	wrapper.style.cssText = "position: relative; width: 100%; min-height: 2rem; border: 1px solid #3e3d32; box-sizing: border-box; resize: vertical; overflow: auto; background: #272822;";

	// 2. Common styles
	let commonStyles = `
	    position: absolute; top: 0; left: 0; width: 100%; 
	    padding: 10px; margin: 0; border: none;
	    font-family: 'Consolas', 'Monaco', monospace; 
	    font-size: 13px; line-height: 19px; 
	    letter-spacing: normal;
	    white-space: pre-wrap; word-wrap: break-word;
	    box-sizing: border-box;
	`;

	// 3. Visual layers
	let highlightLayer = document.createElement("div");
	highlightLayer.style.cssText = commonStyles + "z-index: 0; color: #f8f8f2; pointer-events: none; overflow: hidden;";

	let cssInput = document.createElement("textarea");
	cssInput.style.cssText = commonStyles + "z-index: 1; background: transparent; color: transparent; caret-color: white; resize: none; outline: none; overflow: hidden; height: 3rem;";

	cssInput.id = `${platformName}-${key}-${key}OverrideValue`;

					/**
	 * Recursively converts the JSON object to CSS string
	 * Usage: let cssString = this.jsonToCss(this.templates.styling);
	 */
	function JSONToCss(data, parentSelectors = "") {
	    let css = "";

	    for (let key in data) {
		let value = data[key];
		
		// If it's a styling object, apply it to the current selector
		if (key === "styling" && value && typeof value === 'object') {
		    if (Object.keys(value).length > 0) {
			css += `.${parentSelectors.trim()} {\n`;
			for (let prop in value) {
			    // Convert camelCase to kebab-case
			    let kebabProp = prop.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
			    css += `    ${kebabProp}: ${value[prop]};\n`;
			}
			css += `}\n\n`;
		    }
		} 
		// If it's a nested container, recurse
		else if (typeof value === 'object' && value !== null) {
		    css += JSONToCss(value, `${parentSelectors} ${key}`);
		}
	    }
	    return css;
	}

	cssInput.value = JSONToCss(window.Cockatiel.templates.user.styling);

	// 4. Robust Tokenizing Logic (Comments added first)
	cssInput.oninput = () => {
	    let text = cssInput.value
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

	    // The Regex now matches:
	    // 1. Comments: /\/\*[\s\S]*?\*\//g
	    // 2. Classes, 3. IDs, 4. Keys, 5. Values
	    highlightLayer.innerHTML = text.replace(
		/(\/\*[\s\S]*?\*\/)|(\.[a-zA-Z0-9_-]+)|(#[a-zA-Z0-9_-]+)|([a-zA-Z\-]+(?=\s*:))|((?<=:\s*)([^;\n]+))/g,
		(match, comment, cls, id, key, val) => {
		    let spanStyle = "color: %COLOR%; font-family: inherit;";
		    if (comment) return `<span style="${spanStyle.replace('%COLOR%', '#75715e')}">${comment}</span>`;
		    if (cls) return `<span style="${spanStyle.replace('%COLOR%', '#e6db74')}">${cls}</span>`;
		    if (id) return `<span style="${spanStyle.replace('%COLOR%', '#f92672')}">${id}</span>`;
		    if (key) return `<span style="${spanStyle.replace('%COLOR%', '#66d9ef')}">${key}</span>`;
		    if (val) return `<span style="${spanStyle.replace('%COLOR%', '#ae81ff')}">${val}</span>`;
		    return match;
		}
	    ) + "\n";
	};

	// 5. Sync scrolling and resize
	let observer = new ResizeObserver(() => {
	    let h = wrapper.clientHeight + "px";
	    cssInput.style.height = h;
	    highlightLayer.style.height = h;
	});
	observer.observe(wrapper);

	cssInput.onscroll = () => {
	    highlightLayer.scrollTop = cssInput.scrollTop;
	    highlightLayer.scrollLeft = cssInput.scrollLeft;
	};

	cssInput.oninput();
	wrapper.append(highlightLayer, cssInput);
	cssInputTd.append(wrapper);
	container.append(cssInputTd);


				globalOverrides.append(container);
			}	
			generalSettings.append(globalOverrides);
					       //globalOverrides

			//more specific stuff injected in
			if(additionalHTMLOptions){
				generalSettings.appendChild(additionalHTMLOptions);
			}
		return generalSettings;
	}

	GenerateControlBarUI(container) {
		if(document == undefined){this.DebugPrint({msg: "no document, cannot append a control bar ui"}); return}
		let controlContainer = this.CHE({type: 'div'})
		this.DebugPrint("GENERATING CONTROL BAR UI");
	    // 1. Main Wrapper
	    const footer = document.createElement('div');
	    footer.style.cssText = `
		background-color: #033; 
		border-radius: 1.4rem; 
		height: auto; 
		position: relative; 
		bottom: 0px; 
		display: flex; 
		flex-direction: row;
		margin-top: 20px;
		flex-wrap: wrap;
		gap: 1rem;
	    `;

	    // Helper to create the column containers
	    const createColumn = () => {
		const col = document.createElement('div');
		col.style.cssText = `
		    height: 100%; 
		    /*width: 16rem; */
		    padding: calc(var(--tib_padding) * 4); 
		    display: flex; 
		    flex-direction: column; 
		    gap: 10px;
		`;
		return col;
	    };

	    // Helper to create buttons
	    const createBtn = (imageLink, altText, bgColor, onClick) => {
		const btn = document.createElement('button');
		if(imageLink == undefined){
			btn.type = "button";
			btn.value = altText;
			btn.style.cssText = `
			    background-color: ${bgColor}; 
			    color: black; 
			    user-select: none; 
			    cursor: pointer; 
			    font-weight: bold; 
			    border: none; 
			    padding: 5px; 
			    border-radius: 4px;
			`;
			btn.onclick = onClick;
			return btn;
		}

		const img = document.createElement('img');
		btn.type = "button";
		img.src = imageLink;
		img.alt = altText;
		img.style.userSelect = "none";
		img.width = "256";
		img.height= "256";
		img.style.maxHeight = "100%";
		img.style.maxWidth = "100%";
		img.style.height = "3rem";
		img.style.width = "3rem";
		img.style.minHeight = "1rem";
		img.style.minWidth = "1rem";
		btn.style.cssText = `
		    background-color: ${bgColor}; 
		    color: black; 
		    user-select: none; 
		    cursor: pointer; 
		    font-weight: bold; 
		    border: none; 
		    padding: 5px; 
		    border-radius: 4px;
		`;
		btn.onclick = onClick;
		btn.append(img);

		return btn;
	    };

		/*
	    let buttonsContainer = document.createElement("div");
		buttonsContainer.style = "width:100%;";
		    let IDs = [
			"startMonitorMessages",
			"startTts",
			"startEventMonitor",
			"stopMonitorMessages",
			"stopTts",
			"stopEventMonitor",
		    ];
		    let startButtons = document.createElement("div");
			startButtons.style = `
				display:flex;
				flex-direction:row;
			`;
			    let activeStartButtonStyle = `
					background-color: #0f0;
					color: #fff; 
					height:1.5rem;
					width:12rem;
				`;
			    let inactiveStartButtonStyle = `
					background-color: #030;
					color: #fff; 
					height:1.5rem;
					width:12rem;
				`;
			let subStartButtons = document.createElement("div");
			subStartButtons.style = `
				display: flex;
				flex-direction: column;
			`;
				let startMonitorMessages = document.createElement("button");
				startMonitorMessages.innerText = "startMonitorMessages";
				startMonitorMessages.id = IDs[0];
				startMonitorMessages.style = inactiveStartButtonStyle;
				startMonitorMessages.onclick = () => {
					let elem = document.getElementById(IDs[0]);
					let counterElem = document.getElementById(IDs[0+3]);
					elem.style = activeStartButtonStyle;
					elem.setAttribute("isActive", true);
					counterElem.setAttribute("isActive", false);
					if (
					    document.getElementById(IDs[0]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[1]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[2]).getAttribute("isActive") === "true"
					) {
					    // If all three sub-start buttons are active, make the main Start button active
					    let mainStart = document.getElementById("cockatielStartButton");
					    mainStart.style = activeStartButtonStyle;
					    mainStart.style.height = "4.5rem";
					    
					    // Also reset the main Stop button to inactive
					    let mainStop = document.getElementById("cockatielStopButton");
					    mainStop.style = inactiveStopButtonStyle;
					    mainStop.style.height = "4.5rem";
					} else {
					    // Fallback if one or more sub-start buttons are still inactive
					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle;
					    document.getElementById("cockatielStartButton").style.height = "4.5rem";

					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
					    document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem";
					}
					counterElem.style = inactiveStopButtonStyle;
					console.log("startMonitorMessages clicked");
					window.Cockatiel.StartMonitoringMessages();
				}
				let startTts = document.createElement("button");
				startTts.innerText = "startTts";
				startTts.id = IDs[1];
				startTts.style = inactiveStartButtonStyle;
				startTts.onclick = () => {
					let elem = document.getElementById(IDs[1]);
					let counterElem = document.getElementById(IDs[1+3]);
					elem.style = activeStartButtonStyle;
					elem.setAttribute("isActive", true);
					counterElem.setAttribute("isActive", false);
					if (
					    document.getElementById(IDs[0]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[1]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[2]).getAttribute("isActive") === "true"
					) {
					    // If all three sub-start buttons are active, make the main Start button active
					    let mainStart = document.getElementById("cockatielStartButton");
					    mainStart.style = activeStartButtonStyle;
					    mainStart.style.height = "4.5rem";
					    
					    // Also reset the main Stop button to inactive
					    let mainStop = document.getElementById("cockatielStopButton");
					    mainStop.style = inactiveStopButtonStyle;
					    mainStop.style.height = "4.5rem";
					} else {
					    // Fallback if one or more sub-start buttons are still inactive
					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle;
					    document.getElementById("cockatielStartButton").style.height = "4.5rem";

					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
					    document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem";
					}
					counterElem.style = inactiveStopButtonStyle;
					console.log("startTts clicked");
					window.Cockatiel.StartTts();
				}
				let startEventMonitor = document.createElement("button");
				startEventMonitor.innerText = "startEventMonitor";
				startEventMonitor.id = IDs[2];
				startEventMonitor.style = inactiveStartButtonStyle;
				startEventMonitor.onclick = () => {
					let elem = document.getElementById(IDs[2]);
					let counterElem = document.getElementById(IDs[2+3]);
					elem.style = activeStartButtonStyle;
					elem.setAttribute("isActive", true);
					counterElem.setAttribute("isActive", false);
					if (
					    document.getElementById(IDs[0]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[1]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[2]).getAttribute("isActive") === "true"
					) {
					    // If all three sub-start buttons are active, make the main Start button active
					    let mainStart = document.getElementById("cockatielStartButton");
					    mainStart.style = activeStartButtonStyle;
					    mainStart.style.height = "4.5rem";
					    
					    // Also reset the main Stop button to inactive
					    let mainStop = document.getElementById("cockatielStopButton");
					    mainStop.style = inactiveStopButtonStyle;
					    mainStop.style.height = "4.5rem";
					} else {
					    // Fallback if one or more sub-start buttons are still inactive
					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle;
					    document.getElementById("cockatielStartButton").style.height = "4.5rem";

					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
					    document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem";
					}
					counterElem.style = inactiveStopButtonStyle;
					console.log("startEventMonitor clicked");
					window.Cockatiel.StartEventMonitor();
				}
			subStartButtons.append(startMonitorMessages, startTts, startEventMonitor);

			let startButton = document.createElement("button");
			startButton.style = inactiveStartButtonStyle; 
			startButton.style.height = "4.5rem";
			startButton.innerText = "start cockatiel";
			startButton.id = "cockatielStartButton";
			startButton.onclick = () => {
				window.Cockatiel.StartMonitoringMessages();
				window.Cockatiel.StartTts();
				window.Cockatiel.StartEventMonitor();	

				document.getElementById(IDs[0]).style = activeStartButtonStyle;
				document.getElementById(IDs[0]).setAttribute("isActive", true);
				document.getElementById(IDs[1]).style = activeStartButtonStyle;
				document.getElementById(IDs[1]).setAttribute("isActive", true);
				document.getElementById(IDs[2]).style = activeStartButtonStyle;
				document.getElementById(IDs[2]).setAttribute("isActive", true);
				document.getElementById(IDs[3]).style = inactiveStopButtonStyle;
				document.getElementById(IDs[3]).setAttribute("isActive", false);
				document.getElementById(IDs[4]).style = inactiveStopButtonStyle;
				document.getElementById(IDs[4]).setAttribute("isActive", false);
				document.getElementById(IDs[5]).style = inactiveStopButtonStyle;
				document.getElementById(IDs[5]).setAttribute("isActive", false);
			        document.getElementById("cockatielStartButton").style = activeStartButtonStyle + "; height:4.5rem;";
			        document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem;";
			};
		    startButtons.append(subStartButtons, startButton);
		    let stopButtons = document.createElement("div");
			let activeStopButtonStyle = `
					background-color: #f00;
					color: #fff; 
					height:1.5rem;
					width:12rem;
				`;
			let inactiveStopButtonStyle = `
					background-color: #600;
					color: #fff; 
					height:1.5rem;
					width:12rem;
				`;
			stopButtons.style = `
					display:flex;
					flex-direction:row;
				`;
			let subStopButtons = document.createElement("div");
			subStopButtons.style = `
				display: flex;
				flex-direction: column;
			`;
				let stopMonitorMessages = document.createElement("button");
				stopMonitorMessages.innerText = "stopMonitorMessages";
				stopMonitorMessages.id = IDs[3];
				stopMonitorMessages.style = activeStopButtonStyle;
				stopMonitorMessages.onclick = () => {
					let elem = document.getElementById(IDs[3]);
					let counterElem = document.getElementById(IDs[3-3]);
					elem.style = activeStopButtonStyle;
					counterElem.style = inactiveStartButtonStyle;
					elem.setAttribute("isActive", true);
					counterElem.setAttribute("isActive", false);
					if (
					    document.getElementById(IDs[3]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[4]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[5]).getAttribute("isActive") === "true"
					) {
					    // If all three sub-start buttons are active, make the main Start button active
					    let mainStart = document.getElementById("cockatielStopButton");
					    mainStart.style = activeStopButtonStyle;
					    mainStart.style.height = "4.5rem";
					    
					    // Also reset the main Stop button to inactive
					    let mainStop = document.getElementById("cockatielStartButton");
					    mainStop.style = inactiveStartButtonStyle;
					    mainStop.style.height = "4.5rem";
					} else {
					    // Fallback if one or more sub-start buttons are still inactive
					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle;
					    document.getElementById("cockatielStartButton").style.height = "4.5rem";

					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
					    document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem";
					}
					console.log("stopMonitorMessages clicked");
					window.Cockatiel.StopMonitoringMessages();
				}
				let stopTts = document.createElement("button");
				stopTts.innerText = "stopTts";
				stopTts.id = IDs[4];
				stopTts.style = activeStopButtonStyle;
				stopTts.onclick = () => {
					let elem = document.getElementById(IDs[4]);
					let counterElem = document.getElementById(IDs[4-3]);
					elem.style = activeStopButtonStyle;
					counterElem.style = inactiveStartButtonStyle;
					elem.setAttribute("isActive", true);
					counterElem.setAttribute("isActive", false);
					if (
					    document.getElementById(IDs[3]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[4]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[5]).getAttribute("isActive") === "true"
					) {
					    // If all three sub-start buttons are active, make the main Start button active
					    let mainStart = document.getElementById("cockatielStopButton");
					    mainStart.style = activeStopButtonStyle;
					    mainStart.style.height = "4.5rem";
					    
					    // Also reset the main Stop button to inactive
					    let mainStop = document.getElementById("cockatielStartButton");
					    mainStop.style = inactiveStartButtonStyle;
					    mainStop.style.height = "4.5rem";
					} else {
					    // Fallback if one or more sub-start buttons are still inactive
					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle;
					    document.getElementById("cockatielStartButton").style.height = "4.5rem";

					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
					    document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem";
					}
					console.log("stopTts clicked");
					window.Cockatiel.StopTts();
				}
				let stopEventMonitor = document.createElement("button");
				stopEventMonitor.innerText = "stopEventMonitor";
				stopEventMonitor.id = IDs[5];
				stopEventMonitor.style = activeStopButtonStyle;
				stopEventMonitor.onclick = () => {
					let elem = document.getElementById(IDs[5]);
					let counterElem = document.getElementById(IDs[5-3]);
					elem.style = activeStopButtonStyle;
					counterElem.style = inactiveStartButtonStyle;
					elem.setAttribute("isActive", true);
					counterElem.setAttribute("isActive", false);
					if (
					    document.getElementById(IDs[3]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[4]).getAttribute("isActive") === "true" 
					    && document.getElementById(IDs[5]).getAttribute("isActive") === "true"
					) {
					    // If all three sub-start buttons are active, make the main Start button active
					    let mainStart = document.getElementById("cockatielStopButton");
					    mainStart.style = activeStopButtonStyle;
					    mainStart.style.height = "4.5rem";
					    
					    // Also reset the main Stop button to inactive
					    let mainStop = document.getElementById("cockatielStartButton");
					    mainStop.style = inactiveStartButtonStyle;
					    mainStop.style.height = "4.5rem";
					} else {
					    // Fallback if one or more sub-start buttons are still inactive
					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle;
					    document.getElementById("cockatielStartButton").style.height = "4.5rem";

					    document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
					    document.getElementById("cockatielStopButton").style = inactiveStopButtonStyle + "; height:4.5rem";
					}
					console.log("stopEventMonitor clicked");
					window.Cockatiel.StopEventMonitor();
				}
			subStopButtons.append(stopMonitorMessages, stopTts, stopEventMonitor);
			// main MonitoringStop()
			let stopButton = document.createElement("button");
			stopButton.id = "cockatielStopButton";
			stopButton.innerText = "stop cockatiel";
			stopButton.style = activeStopButtonStyle; 
			stopButton.style.height = "4.5rem";
			stopButton.onclick = () => {
				window.Cockatiel.StopMonitoringMessages();
				window.Cockatiel.StopTts();
				window.Cockatiel.StopEventMonitor();
				
				
				document.getElementById(IDs[0]).style = inactiveStartButtonStyle;
				document.getElementById(IDs[0]).setAttribute("isActive", false);
				document.getElementById(IDs[1]).style = inactiveStartButtonStyle;
				document.getElementById(IDs[1]).setAttribute("isActive", false);
				document.getElementById(IDs[2]).style = inactiveStartButtonStyle;
				document.getElementById(IDs[2]).setAttribute("isActive", false);
				document.getElementById(IDs[3]).style = activeStopButtonStyle;
				document.getElementById(IDs[3]).setAttribute("isActive", true);
				document.getElementById(IDs[4]).style = activeStopButtonStyle;
				document.getElementById(IDs[4]).setAttribute("isActive", true);
				document.getElementById(IDs[5]).style = activeStopButtonStyle;
				document.getElementById(IDs[5]).setAttribute("isActive", true);
			        document.getElementById("cockatielStartButton").style = inactiveStartButtonStyle + "; height:4.5rem";
			        document.getElementById("cockatielStopButton").style = activeStopButtonStyle + "; height:4.5rem";
			};
		    stopButtons.append(subStopButtons, stopButton);
		buttonsContainer.append(startButtons, stopButtons);

		//status guide
		let guide = document.createElement("ul");
			//offline
			let gray = document.createElement("li");
			    gray.innerText = "nothing has been done yet";	
			    gray.style = "color: lightgray;"
			//tests
			let blue = document.createElement("li");
			    blue.innerText = "all checks passed, good to go!";	
			    blue.style = "color: lightblue;"
			//live
			let purple = document.createElement("li");
			    purple.innerText = "currently live and using";	
			    purple.style = "color: lavender;"
			//errors
			let yellow = document.createElement("li");
			    yellow.innerText = "minor issue, but is still operating!";	
			    yellow.style = "color: lightyellow;"
			let red = document.createElement("li");
			    red.innerText = "critical issue, unable to get messages";	
			    red.style = "color: pink;"
			guide.append(gray, blue, purple, yellow, red);
		buttonsContainer.append(guide);
		//status notifiers
		//width: 100%;
		/*
		let grid_label = document.createElement("label");
		grid_label.innerText = "platform status's:";
		let grid = document.createElement("div");
		grid.style = `
			display:grid-template-columns(auto-fit, minmax(1.5rem, 1fr));
			background-color: #000;
		`;
		    grid.style.padding = "1rem";
		    grid.style.margin = "1rem";

		function createStatusNotifier(platform, platformController) {
		    let container = document.createElement("div");
		    container.style.display = "flex"; // Helpful for alignment
		    container.style.alignItems = "center";
		    container.style.gap = "0.8rem";
		    container.style.padding = "1rem";

		    let icon_container = document.createElement("div");
		    let icon = document.createElement("img");
		    
		    // Use integers for width/height properties
		    icon.width = 32;
		    icon.height = 32;

		    switch(platform) {
			case ("twitch"):
			    icon.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Twitch_icon_2012.svg/1280px-Twitch_icon_2012.svg.png";
			    break;
			case ("youtube"):
			    icon.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/3840px-YouTube_full-color_icon_%282017%29.svg.png";
			    break;
			default:
			    return null; // Return null instead of undefined for cleaner grid appending
		    }

		    icon_container.append(icon);
		    container.append(icon_container);

		    let stat_icon = document.createElement("div");
		    stat_icon.style = `
			width: 1rem;
			height: 1rem;
			border-radius: 100%;
			background-color: #555555; 
		    `;
		switch(platform){
			case("twitch"):
				platformController.AddStartListener((() => (stat_icon.style.backgroundColor = "#00ff00")));
				platformController.AddStopListener((() => (stat_icon.style.backgroundColor = "#555555")));
				platformController.AddWarnListener((() => (stat_icon.style.backgroundColor = "#FFFF00")));
				platformController.AddErrorListener((() => (stat_icon.style.backgroundColor = "#ff0000")));
				// this.twitch.AddStatusListener(); THIS IS FOR THE NEXT PART
				break;
			case("youtube"):
				
				break;
		}
		    
		    container.append(stat_icon);
		    return container;
		}

		// When appending, filter out any null returns from the default case
		const twitchNotifier = createStatusNotifier("twitch", this.twitch);
		const youtubeNotifier = createStatusNotifier("youtube", this.yt);

		if (twitchNotifier) grid.append(twitchNotifier);
		if (youtubeNotifier) grid.append(youtubeNotifier);

		buttonsContainer.append(grid_label, grid);
		*/


	    //call next tts button
	    const callTtsColumn = createColumn();
	    const callTtsBtn = createBtn("../assets/call_tts_message.png", "Call next TTs Message", "#88f", async () => {
		    this.FindOldestUnreadTtsAndCall();
	    });
	    callTtsColumn.append(callTtsBtn);
	    //footer.append();
		
	    //call next tts button
	    const callLoopColumn = createColumn();
	    const callLoopBtn = createBtn("../assets/call_tts_message.png", "call loop (ie process unprocessed queue)", "#f00", async () => {
		    console.log("call loop button pressed");
	    });
	    callLoopColumn.append(callLoopBtn);

	    // --- COLUMN 3: STATE (Export/Import) ---
	    const exportInportColumn = createColumn();


	    const exportBtn = createBtn("../assets/export_settings.png", "Export Settings", "#ff0", () => {
	    // 1. Get the JSON string from your class
	    const data = window.Cockatiel.ExportState();
	    
	    // 2. Create a Blob (Binary Large Object) with the data
	    const blob = new Blob([data], { type: "application/json" });
	    
	    // 3. Create a temporary anchor (<a>) element
	    const url = URL.createObjectURL(blob);
	    const link = document.createElement("a");
	    
	    // 4. Set the filename and the target URL
	    link.href = url;
	    link.download = "cockatiel_settings.json";
	    
	    // 5. Trigger the download and clean up
	    document.body.appendChild(link);
	    link.click();
	    document.body.removeChild(link);
	    URL.revokeObjectURL(url); // Free up memory
	});



	    const importLabel = document.createElement('label');
	    importLabel.innerText = "Import settings from file";
	    importLabel.style.cssText = "color: white; font-size: 0.8rem; margin-top: 5px;";

	    const fileInput = document.createElement('input');
	    fileInput.id = "state_input";
	    fileInput.type = "file";
	    fileInput.style.backgroundColor = "#f0f";
	    fileInput.addEventListener('change', (event) => {
	        this.ImportState(event);
	    });

		//save/load inputs
	    const saveLoadColumn = createColumn(); 
	    const saveBtn = createBtn("../assets/save_inputs.png", "save all inputs", "#0f0", () => {
		let inputs = document.getElementsByTagName('input');
		for (let x of inputs) {
		    if (x.id && x.type != 'button' && x.type != 'file') {
			localStorage.setItem(x.id, x.value);
		    }
		}
		console.log("All inputs saved to LocalStorage.");
	    });
	    saveBtn.innerText = "save inputs";

	    const loadBtn = createBtn("../assets/load_inputs.png", "load all inputs", "#ff0", async () => {
		console.warn("LOAD BUTTON DISBALED, NEEDS TO BE REDONE");
		    /*
		console.log("Loading values from LocalStorage...");
		let inputs = document.getElementsByTagName("input");
		for (let x of inputs) {
		    if (x.id && x.type !== "button" && x.type !== "file") {
			let savedValue = localStorage.getItem(String(x.id));
			if (savedValue !== null) {
			    if(String(String(x.id).toLowerCase()).includes("api")){
				this.DebugPrint({
					msg: `getting value from localStorage("${x.id}")`,
					val: "<restricted value>"
				});
			    }
			    else{
				this.DebugPrint({
					msg: `getting value from localStorage("${x.id}")`,
					val: savedValue
				});
			    }
			    x.value = savedValue;
			}
		    }
		}
		if (window.Cockatiel && window.Cockatiel.yt) {
		    await window.Cockatiel.yt.LoadValuesFromLocalStorage();
		}
		*/
	    });
	    loadBtn.innerText = "load inputs";

	    saveLoadColumn.append(saveBtn, loadBtn);

	    footer.append(
		    buttonsContainer,
		    callTtsColumn,
		callLoopColumn,
		    exportBtn,
		    saveLoadColumn,
		    fileInput,
	    );

	    controlContainer.appendChild(footer);

	    //tests 	
		let tests = document.createElement("details");
		tests.style = "color:white;";
		let summary = document.createElement("summary");
		summary.innerText = "youtube test events";
		tests.append(summary);

		// superChatEvent - message
		let superChatEventMessages = [
			{
				"version": 1,
				"apiVersion": 3,
				"platform": "YouTube",
				"data": {
					"kind": "youtube#liveChatMessage",
					"etag": "cyISaLoRJzops1Dhjhwp5ineYeI",
					"id": "LCC.EhwKGkNLanpxY2J1dnBNREZRbkN3Z1FkVGhZVVJB",
					"snippet": {
						"type": "superChatEvent",
						"liveChatId": "Cg0KC09FeE9LRGI0WnFzKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILT0V4T0tEYjRacXM",
						"authorChannelId": "UCKZigHbgpJG9ldxXMqmiZUg",
						"publishedAt": "2026-03-27T00:52:12.560546+00:00",
						"hasDisplayContent": true,
						"displayMessage": "CA$2.00 from @vulbyte: \"IS A TEST OF THE YOUTUBE API WITH A MESSAGE\"",
						"superChatDetails": {
							"amountMicros": "2000000",
							"currency": "CAD",
							"amountDisplayString": "CA$2.00",
							"userComment": "HERE IS A TEST OF THE YOUTUBE API WITH A MESSAGE",
							"tier": 2
						}
					},
					"authorDetails": {
						"channelId": "UCKZigHbgpJG9ldxXMqmiZUg",
						"channelUrl": "http://www.youtube.com/channel/UCKZigHbgpJG9ldxXMqmiZUg",
						"displayName": "@vulbyte",
						"profileImageUrl": "https://yt3.ggpht.com/jrcU7ZjcLMBzCQbU6QMucPmC-cBiHOFrmTpDS9gDzUdH9FUTyzqgrkX9-rXzRh6Fac_HWWgNoEA=s88-c-k-c0x00ffffff-no-rj",
						"isVerified": false,
						"isChatOwner": true,
						"isChatSponsor": false,
						"isChatModerator": false
					}
				},
				"receivedAt": 1774572732560
			},
			{ //donation with no message
				    "version": 1,
				    "apiVersion": 3,
				    "platform": "YouTube",
				    "data": {
					"kind": "youtube#liveChatMessage",
					"etag": "-mh60g2cUZ1R7_bp6EA76nY3uq0",
					"id": "LCC.EhwKGkNOUEloTGU2dnBNREZmSEN3Z1FkR0lnaTlR",
					"snippet": {
					    "type": "superChatEvent",
					    "liveChatId": "Cg0KC09FeE9LRGI0WnFzKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILT0V4T0tEYjRacXM",
					    "authorChannelId": "UCKZigHbgpJG9ldxXMqmiZUg",
					    "publishedAt": "2026-03-26T21:07:12.021491+00:00",
					    "hasDisplayContent": true,
					    "displayMessage": "CA$1.00 from @vulbyte",
					    "superChatDetails": {
						"amountMicros": "1000000",
						"currency": "CAD",
						"amountDisplayString": "CA$1.00",
						"tier": 1
					    }
					},
					"authorDetails": {
					    "channelId": "UCKZigHbgpJG9ldxXMqmiZUg",
					    "channelUrl": "http://www.youtube.com/channel/UCKZigHbgpJG9ldxXMqmiZUg",
					    "displayName": "@vulbyte",
					    "profileImageUrl": "https://yt3.ggpht.com/jrcU7ZjcLMBzCQbU6QMucPmC-cBiHOFrmTpDS9gDzUdH9FUTyzqgrkX9-rXzRh6Fac_HWWgNoEA=s88-c-k-c0x00ffffff-no-rj",
					    "isVerified": false,
					    "isChatOwner": true,
					    "isChatSponsor": false,
					    "isChatModerator": false
					}
				    },
				    "receivedAt": 1774559232021
				}
			];
		    /*
		    --scoreColor1000plus: #E62117;
		    --scoreColor500plus: #E91E63;
		    --scoreColor100plus: #FFCA28;
		    --scoreColor50plus: #1DE9B6;
		    --scoreColor20plus: #00E5FF;
		    --scoreColor0plus: #1E88E5;
		    --scoreColorBelow0: #0000E5;
		    */
		let superChatTest = document.createElement("button");
		superChatTest.innerText =  'test "superChatEvent" message';
		superChatTest.style = `
			background-color: "#1E88E5";
			color: "#fff";
		`;
		superChatTest.onclick = () => {
			this.yt.ProcessYoutubeV3Data_v1(superChatEventMessages[
				Math.floor(Math.random()*superChatEventMessages.length)
			]);
		};

		tests.append(superChatTest);	

		//let mock = await this.yt.CreateMockYoutubeMessageUI();
		//tests.append(mock);

		let testMessageInput = document.createElement("div");
			let messageInput = document.createElement("input");
			messageInput.type = "text";
			messageInput.id = String("youtubeTestInput" + String(crypto.randomUUID()));
			let messageTester = document.createElement("button");
			messageTester.innerText = "send a test message";
			messageTester.onclick = () => {
				let mockHtml = "";
				console.warn(mockHtml);
			};	
			testMessageInput.append(messageInput, messageTester);
		tests.append(testMessageInput);

		controlContainer.append(tests);
	    return controlContainer;
	}

	/*
	 *
	 */
CreateCockatielDragableChild(inputHTML){
    try{
        const UUID = crypto.randomUUID();
        let handleGap = `0.3rem`;
        let iconSize = `1.5rem`;
        const handleClass = "handle-" + UUID;    

        let r = Number(Math.floor(Math.random() * 255));
        let g = Number(Math.floor(Math.random() * 255));
        let b = Number(Math.floor(Math.random() * 255));
        let randomColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        // for things being moved
        let styleSheet = document.createElement("style");
        document.head.append(styleSheet);
        const movingClassName = ".isBeingMoved";    
        const borderRadius = `0.4rem`;

        styleSheet.sheet.insertRule(
            `${movingClassName} {  
            filter: opacity(0.5);
            }`, 
            styleSheet.sheet.cssRules.length
        );    


        //for bg and border color
        styleSheet.sheet.insertRule(`:root { --${handleClass}-color: ${randomColor}; }`, 0);
        //general class
        styleSheet.sheet.insertRule(
            `.${handleClass}{ 
                background-color: #00000028;
                border-radius: ${borderRadius};
                display: inline;
                position: relative;
                height: ${iconSize};
                max-height: 100%;
                text-align: center;
            }`, 
            styleSheet.sheet.cssRules.length
        );    
        styleSheet.sheet.insertRule(
            `.${handleClass}:hover {
                background-color: #00000077;
            }`, 
            styleSheet.sheet.cssRules.length
        );    
        //mousedown
        styleSheet.sheet.insertRule(
            `.${handleClass}:active {  
                background-color: #000000bb;
            }`, 
            styleSheet.sheet.cssRules.length
        );    
        // FIX: Add this rule right below your existing ones
        styleSheet.sheet.insertRule(
            `body.global-dragging #${handleClass}-textPrompt {
            pointer-events: auto !important;
            }`,
            styleSheet.sheet.cssRules.length
        );

        const container = document.createElement("div");
        container.id = UUID;
        container.classList.add("cockatiel-widget"); // FIX: Added target class to the widget item container
        container.style.cssText = `
		box-sizing: border-box;
            border: 0.4rem solid var(--${handleClass}-color);
            border-radius: ${borderRadius};
		overflow: auto;
            padding: 0.6rem;
            position: relative;
            min-height: 10rem;
	    width: 100%;
        `;
        console.log(randomColor);

        const hoverOver = document.createElement("div");
            hoverOver.id = `${handleClass}-hover_over`;
            hoverOver.style.cssText = `
                border-color: ${randomColor};
                border-radius: ${borderRadius};
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 100;
                display: flex;
                filter: opacity(0);
                flex-direction: column;
                justify-content: center;
                text-align: center;
                align-items: center;
                color: white;
                background-color: #000000bb;
                font-size: 2rem;
                pointer-events: none;
                user-select: none;
            `;
            const textContainer = document.createElement("div");
                textContainer.id = `${handleClass}-textPrompt`;
                let textContainerDefaultText = "drop here to add element AFTER this one";
                textContainer.innerText = textContainerDefaultText;
                textContainer.style.cssText = `
                    pointer-events: none; /* changes to auto on drag*/
                    user-select: none;
                `;
                textContainer.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    console.log("The mouse is hovering, AND something is being dragged!");
                    document.getElementById(hoverOver.id).style.filter = "opacity(1)";
                });

                function EndDrag(){
                    document.getElementById(hoverOver.id).style.filter = "opacity(0.0)";
                }

                textContainer.addEventListener("dragleave", (e) => {
                    console.log("the hovering and drag has now left");
                    EndDrag();
                });

textContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    const droppedElementId = e.dataTransfer.getData("text/plain");
    const droppedElement = document.getElementById(droppedElementId);
    
    // 1. Find the target widget
    const targetCard = e.target.closest('.cockatiel-widget');
    
    // Safety check
    if (!targetCard || droppedElement === targetCard) return;

    // 2. Perform the Physical Move
    // This physically updates the DOM list so the browser renders it correctly
    targetCard.after(droppedElement);
    
    // 3. The "Sync" Step:
    // Now that the DOM is physically correct, iterate through the container
    // and re-assign every single order property to match its new physical index.
    const allSiblings = Array.from(textContainer.querySelectorAll('.cockatiel-widget'));
    
    allSiblings.forEach((child, index) => {
        child.style.order = index;
    });

    EndDrag();
});

            hoverOver.appendChild(textContainer);
        container.appendChild(hoverOver);                        
        const body = document.createElement("div");
		body.id = `${UUID}-body`
            body.style.cssText = `
	    	box-sizing: border-box;
                padding: 0.6rem;
                display: block; /* FIX: Changed from invalid position: inline; */
		width: 100%;
            `;
            const containerHandle = document.createElement("div");
            containerHandle.style.cssText = `
                border-radius: ${borderRadius};
                background-color: var(--${handleClass}-color);                    
                display: grid;
                gap: ${handleGap};
                grid-template-columns: repeat(auto-fit, minmax(${iconSize}, ${iconSize}));
                flex-direction: row;
                overflow: scroll;
                padding: 0.3rem;
                position: relative;
                top: 0px;
                left: 0px;
                height: ${iconSize};
                width: 100%;
		max-width: 16rem;
            `;

                const moveHandle = document.createElement("div");
                    moveHandle.id = `${handleClass}-move_handle`;
                    moveHandle.innerText = `☁︎`;
                    // FIX: Removed "handleClass +" from string injection which caused invalid css formatting
                    moveHandle.style.cssText = `
                        background-image: radial-gradient(
                        circle, 
                        #fff 0%, 
                        #fff 19.9%, 
                        transparent 20%, 
                        transparent 100%
                        );
                        background-repeat: repeat;
                        background-size: 30% 30%;
                        cursor: move;
                        user-select: none;
                    `;
                    moveHandle.draggable = "true";
                    moveHandle.classList.add(handleClass);
                    moveHandle.classList.add("moveHandle");
                    moveHandle.addEventListener("dragstart", (e)=> {
                        try{
                            console.log("drag begin");
                            let elem = document.getElementById(container.id);
                            elem.classList.add("isBeingMoved");
                            // Save the container's ID into the drag data
                            e.dataTransfer.setData("text/plain", container.id);
                            
                            console.log("Started dragging container:", container.id);
                        }
                        catch(err){
                            console.error(err);
                        }
                    });
                    moveHandle.addEventListener("dragend", (e)=> {
                        try{
                            console.log("drag end");
                            let elem = document.getElementById(container.id);
                            elem.classList.remove("isBeingMoved");
                        }
                        catch(err){
                            console.error(err);
                        }    
                    });
                containerHandle.append(moveHandle);
                //detatch btn
                const detatchHandle = document.createElement("div");
			detatchHandle.id = `${UUID}-detatch_button`;
                    detatchHandle.innerText = '⤴️';
                    detatchHandle.classList.add(handleClass);
                    detatchHandle.classList.add("moveHandle");
                    detatchHandle.style.cssText = detatchHandle.style.cssText + `
                        cursor: pointer;
                        user-select: none;
                    `;
                containerHandle.append(detatchHandle);
                //reattach btn
                const reattachHandle = document.createElement("div");
			detatchHandle.id = `${UUID}-detatch_button`;
                    reattachHandle.innerText = '↩️';
                    reattachHandle.classList.add(handleClass);
                    reattachHandle.classList.add("moveHandle");
                    reattachHandle.style.cssText = reattachHandle.style.cssText + `
                        cursor: pointer;
                        user-select: none;
                    `;
                containerHandle.append(reattachHandle);
                //lock btn
                const lockHandle = document.createElement("div");
                    lockHandle.innerText = '🔓';
                    lockHandle.id = String(container.id + "-lock_handle");
                    lockHandle.classList.add(handleClass);
                    lockHandle.classList.add("moveHandle");
                    lockHandle.style.cssText = lockHandle.style.cssText + `
                        cursor: pointer;
                        user-select: none;
                    `;
                    lockHandle.dataset.isLocked = "false";
                    lockHandle.addEventListener("click", (e) => {
                        const isLocked = (lockHandle.dataset.isLocked === "true");
                        lockHandle.dataset.isLocked = isLocked ? "false" : "true";
                        if(isLocked == false){
                            document.getElementById(lockHandle.id).innerText = '🔒';
                        }
                        else {
                            document.getElementById(lockHandle.id).innerText = '🔓';
                        }
                        console.log("lh is:", lockHandle.dataset.isLocked);
                    });;
                containerHandle.append(lockHandle)

                const recolorHandle = document.createElement("input");
                    recolorHandle.type = "color";
                    recolorHandle.value = randomColor;
                    recolorHandle.innerText = '🔓';
                    recolorHandle.id = String(container.id + "-recolor_handle");
                    recolorHandle.classList.add(handleClass);
                    recolorHandle.classList.add("moveHandle");
                    recolorHandle.addEventListener("change", (e) => {
                        document.documentElement.style.setProperty(`--${handleClass}-color`, e.target.value);
                    });

                containerHandle.append(recolorHandle);
                
            body.append(containerHandle);

            const br = document.createElement("br");
            body.append(br);
        body.append(inputHTML);
        container.append(body);
                

        //always keep below right before return
        return Result.ok(container);
    }
    catch(err){
        return Result.err(`could not create dragable child from inputHTML:\n${inputHTML}, \n${err}`);
    }
}

	GenerateUI(){
		try{
			if (!document.body.dataset.dragTrackerAttached) {
			    document.body.dataset.dragTrackerAttached = "true";
			    document.addEventListener("dragstart", () => document.body.classList.add("global-dragging"));
			    document.addEventListener("dragend", () => document.body.classList.remove("global-dragging"));
			}

			const g =  document.createElement('div');
			g.id = "cockatiel-grid_container";
			g.style = `
				border: 0.3rem solid white;
				border-radius: 0.4rem;
				display: grid;
				gap: 1rem;
				grid-template-columns: repeat(auto-fit, minmax(32rem, 1fr));
				margin: auto;
				min-height:3rem;
				min-width: 10rem;
				overflow: scroll;
				width: 90%;	
				max-width: 60rem;
			`;

			let titleContainer = document.createElement("div");
			titleContainer.id = "titleContainer";
			titleContainer.style.cssText = `
				width: 100%;
			`;
				let title = document.createElement("h1");
				title.id = "cockatiel-title";
				title.innerText = "Cockatiel";
				let credit = document.createElement("h3");
				credit.innerText = "- by vulbyte";
				credit.title = "cockatiel-credit";
				titleContainer.append(title, credit);
				let titalContainerFinal = this.CreateCockatielDragableChild(titleContainer);
			if(titalContainerFinal.isSuccess){
				g.append(titalContainerFinal.value);
			}
			else{
				throw new Error("error Generating ui with title container");
			}

			let twitchUI = this.twitch.GenerateUI();
			if(twitchUI.isSuccess){
				let twitchContainer = this.CreateCockatielDragableChild(twitchUI.value);
				console.log(
					twitchContainer.isSuccess, 
					twitchContainer.value
				);
				if(twitchContainer.isSuccess){
					g.append(twitchContainer.value);
				}
			}

			let youtubeUI = this.youtube.GenerateUI();
			if(youtubeUI.isSuccess){
				let ytContainer = this.CreateCockatielDragableChild(youtubeUI.value);
				console.log(
					ytContainer.isSuccess, 
					ytContainer.value
				);
				if(ytContainer.isSuccess){
					g.append(ytContainer.value);
				}
			}

			//keep before append!
			//Array.from(g.children).forEach((child, index) => {
			//	child.style.order = index;
			//});
			document.body.append(g);

			return Result.ok("created UI successfully");
		}
		catch(err){
			return Result.err(`couldn't create UI: ${err}`);
		}
	}

	async Init(){	
		if (this.#hasInited) return; // Stop if already running

		this.d = document;
		this.tts = new TtsManager();		
		this.tts.Init();
		this.ChatManager = new ChatManager();
		this.ChatManager.Init();
		this.EventManager = new EventsManager();
		this.EventManager.Init();
		this.UserManager = new UserManager();
		this.UserManager.Init();

		this.twitch = new Twitch();
		this.twitch.Init();
		this.youtube = new Youtube();
		this.youtube.Init();

		this.d.body.append(
			this.GenerateUI(),
		);

		//essentails above
		this.#hasInited = true;
	}


	/*
	 * WE CANNOT DELETE THIS AS SOME MADLAD (@Cunningstuntsinc) dropped a 50 banger (thankies ily)*
                                                        .=.@@                   
                                             .@..      .@@.@#@                  
                                             @@.@.     .@@.@@@.                 
                                             @@.-..   @.*@..@@.                 
                                             @@#...  ....@.+@@@+                
                                            @@.@.@#@@.@.@@.*@@@..               
                                            .@.@.@=..@@@@@..@@@..               
                                            @@..@@--+*..@..@@@@@.               
                                       ......@@...@@....-@@..#...@@.            
                             @.#.....-@(@@@@=.@@..@.@@@@.@%@.-..@@.@@@.          
                             ..:.@@@@......@@@....@@%.........@.@@@=@@@         
                              .........@@..@#@.++........=@@.@@@@#%%#+@.        
                                   ............=======.@@#..@%+##%%%%#@@.       
                                       ....+==========..#.@@%%@@@@@@@@@@.       
                                          .....======..@.@+*#%@@@........       
                                           .@@..====..*@.@#@@@@.@.@@@@@..       
                                           .%.@......@@@@@@@.@@@@@.@@@@@@.      
                            .@.=@@@@.    .....@@@@@@@.@%%%@.@@@@.@@@@@@@@@@.    
 ...@.@@.                    .........@@..@@@@@@.....@@%%+@@@@.@@@@@@@@@@@@.    
  ........@@@.                  .:.*=....@@.@-@.@@@@@@%@@@@@@.@.@%%#@@@@@%@.    
      .......@@@                 ..++*++..@@@@@@@@@.@@%@.@+@@@@@@@@%%%%%%%@.    
         .+%...@@@                 ...*++..@@@.@@@.@@%@@@@.@@@@@.@@%%%%%@@@@    
          .=%+...@@.                 ...*+.@@@@@@.@@@@@.@.@@#@...@%@@@@@@@@@    
            ..*+..@@@                @@.+@=...@%@@@@....@@@@%@@.@@@@@@#%@@@.    
             ...--.@%%#@@           ..@@.......@@@@@@@@@@.@%%@@@@@@@@@@#%@@.    
                ...@@@@@.@#@.       @@@@@@@@@@@@@@%.@@@@@@@%%@.@..@@@@@@@@..    
                   .@..@@@@@@@%#@. .@@@@@...@..........@@@@@@@@@@@@.@@@@@@..    
                      ....@@@@@%@@@@@@@#@.:...@.@....==...@@@@@@@@@@@@@#@@.     
                        .....@@@@@@@%#@%@@.%...@.@.@@..@@=.....@@@@@@@@@@.@     
                           .....@@@@@%%%@@..@.........=...%=@#............      
                              ......@@@@@@.  .@@=.@@@@.@@.@..-@@@@%+++%:.       
                                  ........   ........:....@.@=....@@:...        
                                             ..@.@@.@:@@.......@@....           
                                            +@@@@@...@..@@..@..@@@@@@.          
                                           .@.@%@@@@@@@@...@@.........          
                                           @@@@@@.@@@.@@.@@....@.@.@:@.         
                                          .@...@@@@.@@.@@@@@@@.@.@@...@         
                                         @@@@@@@.@@@.@@@@....@.@......@.        
                                         .@@@..@@@.@@.@@@.@.@@..@@.@@@@..       

	 */

}

export class OldCockatiel {
	soundContext;
	twitch;
	yt;		
	tts;


	#state = { // when saving and loading this is what will be saved/loaded
		bannedWordsArray: [], //do not add manually, use the AddBannedWord/RemoveBannedWordFunctions
		bannedWordsTrie: new TrieTree(), // tree that's good for strings, basically all you need to worry about is: add(), remove(), ContainsString()
		// NOTE: Assuming this function is part of a class/module where
		config: {
		  blockAddOtherFound: true,
		  monitorMessages : {
		    debug : true,
		    strictMode : false,
		  },
		  censoring: {
			  censorOptions: ["replaceWord", "replaceMessage", "banUser"],
			  censorType: "replaceMessage",
			  censorChar: "•",
			  censorWords: ["tacos"],
		  },
		  flag : {
		    audio: null,
		    description :
			"used to define the token used to trigger the tts,",
		    eventHtml: null,
		    token : "!",
		    positionOptions : [
		      "start",
		      "end",
		      "anything_after",
		    ],
		    positionSelected : "start",
		  },
		  showSystemMessages: {
			Twitch: true,
			Youtube: true,
		  },
		  style: {
			  overwriteUserStyling: true,
		  }
		},
		commands: { // only add commands that are implimented
			clip: {
				version: 1,
				command: "clip",
				audio: "/Users/insert/Cockatiel/assets/audio/vulbyte_pack",
			        eventHtml: null,
				flags: [
					{ flag: ['l'], value: 1, description: "approximate duration of the clip in minutes", range: { min: 0.1, max: 10 } },
				],
				func: 'ProcessClipCommand', //function to call when triggered
				AuthNeeded: { owner: false, admin: false, mod: false, trused: false
				},
				cost: 0,
				state: {},
				errInfo: {err: null, errMsg: null},
			},
			help: {
				version: 1,
				command: "help",
				audio: null,
				description: "",
				flags: [],
				func: 'ProcessHelpCommand', //function to call when triggered
				AuthNeeded: { owner: false, admin: false, mod: false, }
			},
			tts: {
				version: 1,
				command: "tts",
				audio: null,
				description: "",
				flags: {
					p: {value: 0.3, type:"number", description: "modifys the pitch of the tts", range: { min: 0.5, max: 3 } },
					/* below is an alias for speed*/
					r: {value: 0.9, type:"number", description: "modifys the speed [rate] of the tts message", range: { min: 0.5, max: 3 } },
					v: {value: 51, type:"number", description: "modifys the voice of the tts message", range: { min: 0, max: 180 } },
				},
				AuthNeeded: { owner: false, admin: false, mod: false, trused: false},
				func: 'window.Cockatiel.tts.Speak', //function to call when triggered
				cost: 10000,
				state: {readAt: null},
				errInfo: {err: null, errMsg: null},
			},
			prediction: {
				version : 1,
				command : "predition",
				description: "",
				flags : {
					p: {value: "", type: "string", description: "prompt to be shown to the users"},
					r: {value: "", type: "string", description: "refunds the points, value if for reason"},
					e: {value: "", type: "string", description: "ends the current prediction and rewards based on distribution, value is for reason"},
				},
				AuthNeeded: { owner: false, admin: false, mod: true, },
				func: 'ProcessPredictionCommand', // function to call when triggered
				//will check the highest perm first, the first to return true will be assumed. if none true assumed to be public
				cost: 0,
				state: {},
				errInfo: {err: null, errMsg: null},
			},
			vote: {
				version : 1,
				command : "vote",
				description: "",
				flags : {
					a: {type: "number", value: "", description: "amount to wager", range: {min: 100, max: 1000000}},
					dd: { type: "number", value: "", description: "triggers double down, (no payout, but next payout will be double)"},
					y: {type: "boolean", value: "", description: "makes vote for yes"},
					n: {type: "boolean", value: "", description: "makes a vote for no"},

				},
				func: 'ProcessVoteCommand', // function to call when triggered
				//will check the highest perm first, the first to return true will be assumed. if none true assumed to be public
				AuthNeeded: { 
					owner: false,
					admin: false,
					mod: false,
					// trusted users are users who have a certain amount of lifetime score or time since first appearance.
					trusted: false, 
				},
				cost: 0,
				state: {},
				errInfo: {err: null, errMsg: null},
			}
			/* not implimented
			{
				version: 1,
				command: "rank",
				description: "",
				flags: { d: { flag: ['d'], value: 1, description: "for people to add/update their rankings on a game", range: { min: 0.1, max: 10 } },
				],
				func: '', //function to call when triggered
				AuthNeeded: { owner: false, admin: false, mod: false, trused: false }
			},
			*/ 
		},
		debug: true,
		eventsConfig: {
			chatDonation: {
				audio: null,
				eventHtml: null,
				
			},
			chatMessage: {
				audio: null,
				eventHtml: null,

			},
			eventClip: {
				audio: null,
				eventHtml: null,

			},
			eventHelp: {
				audio: null,
				eventHtml: null,

			},
			eventPredicitonStart: {
				audio: null,
				eventHtml: null,

			},
			eventPredicitonEnd: {
				audio: null,
				eventHtml: null,

			},
			eventTts: {
				audio: null,
				eventHtml: null,

			},
			eventVote: {
				audio: null,
				eventHtml: null,

			},
			followTier1: {
				audio: null,
				eventHtml: null,

			},
			followTier2: {
				audio: null,
				eventHtml: null,

			},
			followTier3: {
				audio: null,
				eventHtml: null,

			},
			followTier4: {
				audio: null,
				eventHtml: null,

			},
			followTier5: {
				audio: null,
				eventHtml: null,

			},
			followTier6: {
				audio: null,
				eventHtml: null,

			},
			followTier7: {
				audio: null,
				eventHtml: null,

			},
			followTier8: {
				audio: null,
				eventHtml: null,

			},
			followTier9: {
				audio: null,
				eventHtml: null,

			},
			followGift: {
				audio: null,
				eventHtml: null,

			},
			voteNew: {
				audio: null,
				eventHtml: null,

			},
		},
		flaggedMessageQueue: [],
		event_timeline: [], // everything that has happened, messages, tts, etc
		windows: {
			main: {
				insertId: "cockatiel_settings_container",
			},
			chat: {
				//now in class
			},
			events: {
				// now in class
			}
		},
		unprocessed_queue: [], // messages returned from yt fetch
		users: {},
	};

	subWindows = {};
	/**
	 * Checks if an object is safe for structured cloning (postMessage, IndexedDB, etc.)
	 * @returns {boolean} true if safe, false if it contains non-cloneable nodes.
	 */
	ProbeForBadNodes(obj = this.#state.event_timeline, path = 'root', visited = new WeakSet()) {
	    // 1. Primitives and null are always cloneable
	    if (obj === null || typeof obj !== 'object') return true;

	    // 2. Handle circular references
	    if (visited.has(obj)) return true;
	    visited.add(obj);

	    try {
		// Test current level
		structuredClone(obj);
		return true; 
	    } catch (e) {
		// 3. If it fails, check if this specific leaf is a DOM node
		if (obj instanceof Node) {
		    console.warn(`🛑 Non-cloneable found at [${path}]`);
		    console.warn(`Type: ${obj.constructor.name} | NodeName: ${obj.nodeName}`);
		    return false;
		}

		// 4. Recurse through keys to find the specific culprit
		let allClear = true;
		for (const key in obj) {
		    if (Object.prototype.hasOwnProperty.call(obj, key)) {
			const result = this.ProbeForBadNodes(obj[key], `${path}.${key}`, visited);
			if (!result) allClear = false;
		    }
		}
		return allClear;
	    }
	}
	// for functions that listen for an event to trigger before executing.
	eventListeners = {
		unprocessedAdded: [],
		messageAdded: [],
		ttsAdded: [],
		voteAdded: [],
		commandAdded: [],
	}

	GetTemplates(){
		return this.templates;
	}

	GetState(){
		return structuredClone(this.#state);
	}

	CastValueToType(value, type){
		switch(type){			
			case("string"):
				value = String(value);
				break;
			case("number"):
				value = Number(value);
				break;
			case("boolean"):
				value = Boolean(value);
				break;
			case("symbol"):
				value = Symbol(value);
				break;
			case("bigint"):
				value = BigInt(value);
				break;
			default:
				this.DebugPrint({msg:"value not found for primitive", type: "throw"});
			case("null"):
			case("undefined"):
				break;
		}
		return value;
	}
	AddLogToLogs(logObj){
		this.#state.event_timeline.push(logObj);
		return true;
	}
	GetLogs(){
		let logsArr = [];
		let timelineClone = structuredClone(this.#state.event_timeline);

		for(let i = 0; i < timelineClone; ++i){
			if(
				timelineClone[i].type == "logs" 
				|| timelineClone[i] == "log" 
				|| timelineClone[i] == "l" 
			){
				logsArr.push(timelineClone[i]);
			}
		}

		return msgArr;
	}

	// Private helper to handle the "Clearer Printing" without cluttering the switch
	_printExtraData(val, err) {
	    if (val !== undefined) {
		console.log("%cValue:", "font-weight: bold; color: #888;", val);
	    }
	    
	    if (err) {
		const errMsg = err.message || err;
		console.log(`%cError: ${errMsg}`, "color: #ff7b72; font-weight: bold;");
		if (err.stack) {
		    console.log("%cStack Trace:", "color: #6e7681; font-size: 10px;", err.stack);
		}
	    }
	}

	FormatTime(s = undefined) {
		this.DebugPrint({msg:"attempting to parse time from:", val: s})
	    if (s == null || s == undefined || s == {} || s == []) {
		this.DebugPrint({ msg: "cannot process value, s is undefined or null", type: "throw"});
		return undefined;
	    }

	    if(s == ""){
		this.DebugPrint({ msg: "input is an empty string, no valid input"});
		    return undefined;
	    }

	    let totalSeconds = Number(s);

	    if (isNaN(totalSeconds)) {
		this.DebugPrint({ 
			msg: "cannot parse time from input", 
			val: s, 
			type: "throw"
		});
	    }

	    if (totalSeconds < 1) {
		return "0:00";
	    }

	    const mins = Math.floor(totalSeconds / 60);
	    const secs = Math.floor(totalSeconds % 60);
	    
	    return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	FindCyclicPaths(obj, path = "root", visited = new WeakSet()) {
	    // 1. Only check objects (and not null)
	    if (obj !== null && typeof obj === 'object') {
		
		// 2. If we've seen this exact object reference before, it's cyclic
		if (visited.has(obj)) {
		    console.warn(`cyclic value: ${path}`);
		    return;
		}

		// 3. Add the current object to the visited set
		visited.add(obj);

		// 4. Recursively check all keys
		for (const key in obj) {
		    if(key == "subWindows"){continue;}
		    if (Object.prototype.hasOwnProperty.call(obj, key)) {
			// Build the path string (e.g., "car.engine.piston")
			const newPath = Array.isArray(obj) ? `${path}[${key}]` : `${path}.${key}`;
			this.FindCyclicPaths(obj[key], newPath, visited);
		    }
		}
	    }
	}

	ExportState() {
	    // 1. Create a deep clone so we don't break the live app
	    // We use a custom cloner because structuredClone fails on DOM/Windows
	    let stateCopy = JSON.parse(JSON.stringify(this.#state, (key, value) => {
		// If we hit a window object or a circular-prone key, skip it
		if (key === 'subWindows' || key === 'domElement' || key === 'window') {
		    return undefined; 
		}
		return value;
	    }));

	    // 2. Clear out the windows object specifically if it's still causing issues
	    if (stateCopy.windows) {
		delete stateCopy.windows;
	    }

	    // 3. Now it is safe to stringify
	    return JSON.stringify(stateCopy, null, 4);
	}

	async ImportState(input) {
	    this.DebugPrint({ msg: "ImportState: Determining input type..." });
	    let data;

	    try {
		// 1-4: Standard data extraction (Parsing the input)
		if (input?.target?.files) {
		    const file = input.target.files[0];
		    if (!file) return;
		    data = JSON.parse(await file.text());
		} else if (input instanceof File) {
		    data = JSON.parse(await input.text());
		} else if (typeof input === 'string') {
		    data = JSON.parse(input);
		} else if (typeof input === 'object' && input !== null) {
		    data = input;
		} else {
		    throw new Error("Unsupported import type.");
		}

		// --- Re-hydration Logic ---

		// 1. Re-hydrate the TrieTree (bannedWords)
		this.DebugPrint({ msg: "Converting banned words to Trie structure" });
		const newTrie = new TrieTree();
		// Check both 'bannedWords' (the array) and 'bannedWordsTrie' (the key name)
		const wordsSource = data.bannedWords || data.bannedWordsTrie;
		if (Array.isArray(wordsSource)) {
		    wordsSource.forEach(word => newTrie.Add(word));
		}

		// 2. Handle Windows merge
		// If the import file doesn't have windows (because we deleted them during export), 
		// we keep our current live windows.
		const mergedWindows = {
		    ...this.#state.windows,
		    ...(data.windows || {}) 
		};

		// 3. Assign to state
		this.DebugPrint({ msg: "Assigning state to imported value" });
		this.#state = {
		    ...this.#state,   // Start with current defaults
		    ...data,          // Overwrite with imported data
		    windows: mergedWindows, // Use the carefully merged windows
		    bannedWords: newTrie,   // Assign the actual Class instance back
		};

		// 4. Re-bind commands if they exist in the imported data
		if (Array.isArray(this.#state.commands)) {
		    this.#state.commands = this.#state.commands.map(cmd => {
			if (cmd.command === "tts") {
			    cmd.func = window.Cockatiel.tts.Speak(this);
			}
			// Add logic here for other command re-bindings if needed
			return cmd;
		    });
		}

		this.DebugPrint({ msg: "Import successful!" });

	    } catch (err) {
		console.error("ImportState failed:", err);
		this.DebugPrint({ msg: "Import failed", type: "error", val: err });
	    }

	    // Refresh UI
	    this.UpdateUserDisplay();
	    this.BannedWordsManager.UpdateBannedWordsList();
	}

	ProcessVoteCommand(processedMsg) {
		let ret = this.templates.messageCommand;	
		ret.isValid = null; // false until turned true
		/* reference as of: 2026_03_03
		messageCommand: {
			isValid: false, // if everything passes, then true, if not (ie not enough credits, not the right perms, etc, then false
			type: undefined,
			flags: {}, // flags will be a key value, such as: {-y: true}
			message: undefined,
			executedAt: undefined,
			spend: 0, // amount spent on the command, 			
			version: 1, // version to check
			errInfo: {
				err: undefined,
				erroredAt: undefined,
			},
		},
		*/
		ret.commandType = "vote";

		let flagPlusToken = String(this.#state.config.flag.token + this.#state.commands.vote.command);
		if (processedMsg.rawMessage.slice(0, flagPlusToken.length) !=  flagPlusToken){
			this.DebugPrint({msg: "token found is not detected to be a vote token, aborting processing"});
		}

		this.DebugPrint({msg: "token found is a vote token, processing"});

		//find all flags that come after and start with a "-"
		let msg = processedMsg.rawMessage;
		msg = msg.split(" "); // breaks into array based on space ie: ["hello", "world"]
		//find all flags and parse
		for(let k = 1; k < msg.length; k = ++k){ // start at 1 to skip flag, skip every other flag because key value pairs
			let flag, value;
			if(msg[k][0] == "-"){
				if (msg[k].length < 2){this.DebugPrint({msg: "cannot complete command, flag is improper", type: "t"})};	
				flag = msg[k].slice(1, msg[k].length);
				if(
					flag.toLowerCase() == "y" 
					|| flag.toLowerCase() == "n"
					|| flag.toLowerCase() == "dd"
				){
					ret.flags[flag] = true;
					continue;
				}
	
				if(msg.length > k+1){
					value = msg[k+1];
					ret.flags[flag] = value;
					++k;
				}
				else if(k == msg.length-1){
					this.DebugPrint({msg: "last items doesn't have a value, is likely message:", val: msg[k]});	
					msg = msg[k];
					break;
				}
			}
			else{
				/*
				this.DebugPrint({msg: "command not found, skipping to verify flags"});
				let total = k; //to account for spaces
				for(let l = k; l > -1; --l){
					total += msg[l].length;
				}
				msg = processedMsg.rawMessage.slice(total, processedMsg.rawMessage.length);
				this.DebugPrint({msg: "assign msg value to:", val: msg});
				ret.message = msg;
				*/

				
				this.DebugPrint({msg: "assigning message value if any"});
				let message = "";
				for(let l = k; l < msg.length; ++l){
					message += String(msg[l] + " ");
				}
				message = message.trim(); // to clean space often left at end

				this.DebugPrint({msg: "assign msg value to:", val: message});
				ret.message = message;
				

				break;
			}
		}	

		//helper to ensure valid state
		if(ret.string == undefined || ret.string == ""){
			ret.string = null;
		}

		let flags = this.#state.commands.vote.flags;
		/* as of: 2026_03_03
		flags : {
			a: {type: "number", value: "", description: "amount to wager", range: {min: 100, max: 10000}},
				dd: {type: "number", value: "", description: "triggers double down, (no payout, but next payout will be double)"},
				y: {type: "boolean", value: "", description: "makes vote for yes"},
				n: {type: "boolean", value: "", description: "makes a vote for no"},

		},
		*/
		this.DebugPrint({msg: "flags parsed, verifying flags are valid", val: ret.flags, type:"logs"});
		for(let k = 0; k < Object.keys(flags).length; ++k){	
			let key, value, castValue, currentFlag;

			key = Object.keys(flags)[k];
			value = ret.flags[key];
			currentFlag = flags[key];
			castValue = this.CastValueToType(value, currentFlag.type);

			currentFlag = flags[key];
			/*
			if(ret.flags[key] == undefined){
				this.DebugPrint({
					msg: "currentFlag is null, did a user try use an invalid flag? skipping checks for this flag.", 
					val: {key: value}, 
					type: 'w'
				});
			}
			*/

			if(value == undefined){
				switch(key){
					case('y'):
					case('n'):
						this.DebugPrint({msg: `check for key ${key} is undefined, assigning bool value of false`});
						ret.flags[key] = false;
						break;
					case('dd'):
						this.DebugPrint({msg: `check for key ${key} is undefined, assigning bool value of false`});
						ret.flags[key] = false;
						break;
					case('a'):
						this.DebugPrint({msg: `check for key '${key}' is undefined, giving value of null`});
						ret.flags[key] = null;
						this.DebugPrint({msg: `key '${key}' is now the value of ${ret.flags[key]}`});
						value = ret.flags[key];
						break;
					default:
						this.DebugPrint({msg: "no key for current flag, adding as as undefined", val: key, type: "w"});
						ret.flags[key] = undefined;
						break;
				}
			}

			
			//check type
			if(typeof castValue != currentFlag.type){
				this.DebugPrint({
					msg: "cast value is not equal to the expected type", 
					val: {exp: currentFlag.type || undefined, actual: value, cast: castValue}, 
					type: 'w'
				});
				ret.errInfo = {
					err: `cast value is not expected type. expected: ${currentFlag.type}, got: ${value}, on flag: ${key}`,
					erroredAt: Date.now(),
				}
				this.DebugPrint({msg: "because cast value != currentFlag.type, setting isValid to false"});
				ret.isValid = false;
				continue;
			};
			//check range
			if(
				currentFlag.range != undefined
			){
				let min = currentFlag.range.min;
				let max = currentFlag.range.max;
				this.DebugPrint({msg: `clamping value for flag ${key}:`, val: {value: String(value), min: min, max: max}});
				ret.flags[key] = this.Clamp({
					val: value,
					min: min,
					max: max,
				});

				this.DebugPrint({msg: `key '${key}' has been clamped to a new value of:`, val: ret.flags[key]});
			}
		}


		ret = this.SortMap(ret);
		ret.executedAt = null;

		if (ret.flags.y == ret.flags.n){
			this.DebugPrint({msg: "ret.flags.y == ret.flags.n, impossible to determine outcome"});
				ret.errInfo = {
					err: `missing valid y/n choice`,
					erroredAt: Date.now(),
				}	
				ret.isValid = false;
		}

		if(this.GetEvents().length > 0){
			if(HandleVoteStateUpdate(ret) == true){
				ret.executedAt = Date.now();
			}
			else if(HandleVoteStateUpdate(ret) == false){
				ret.errInfo = {
					err: `could not process vote.`,
					erroredAt: Date.now(),
				}
				ret.isValid == false;
			}
		}

		if(
			ret.isValid == null 
			&& ret.errInfo.err == undefined
			&& ret.errInfo.erroredAt == undefined
		){
			this.DebugPrint({msg: "because cast value == null, setting isValid to true"});
			ret.isValid = true;
		}

		return ret;
	}

	async ProcessPredictionCommand(messageObject) {
	    this.DebugPrint({msg: "--- Function Entered ---"});
	    
	    // 1. Resolve the message content - Added rawMessage as a fallback
	    const message = messageObject.text || messageObject.rawMessage || "";
	    
	    // 2. Auth Check
	    const userUuid = messageObject.userUuid; 
	    const user = this.#state.users.find(u => u.uuid === userUuid);

	    if (!user) {
		this.DebugPrint({msg: `CRITICAL: User [${userUuid}] not found.`});
		return {};
	    }

	    if (!user.isChatModerator) return {};

	    // 3. Setup Command Object
	    let commandObj = {
		version: 1,
		command: "prediction",
		flags: [
		    { flag: ['p'], value: undefined },
		    { flag: ['t', 'l'], value: undefined },
		    { flag: ['e'], value: undefined },
		    { flag: ['r'], value: undefined },
		]
	    };

	    // 4. Parsing Loop - IMPROVED REGEX
	    commandObj.flags.forEach(f => {
		f.flag.forEach(char => {
		    // Updated Regex: Matches the flag, and optionally captures following text 
		    // until the next flag (-) or end of string
		    const regex = new RegExp(`-${char}(?:\\s+([^\\-]+))?`, 'i');
		    const match = message.match(regex);
		    
		    if (match) {
			// If the flag exists, mark it as true/empty string at minimum
			// match[1] will be the value if provided, otherwise an empty string
			f.value = (match[1] ? match[1].trim() : "");
			this.DebugPrint({msg: `Parsed Flag -${char}: ${f.value}`});
		    }
		});
	    });

	    // 5. Execution Gate
	    const pFlag = commandObj.flags.find(f => f.flag.includes('p'));
	    const eFlag = commandObj.flags.find(f => f.flag.includes('e'));
	    const rFlag = commandObj.flags.find(f => f.flag.includes('r'));

	    if (pFlag && pFlag.value !== undefined) {
		this.DebugPrint({msg: "Conditions met for Creation."});
		this.CreateNewPrediction(commandObj);
	    } 
	    // Check if the flags themselves were found (even if value is "")
	    else if (eFlag?.value !== undefined || rFlag?.value !== undefined) {
		this.DebugPrint({msg: "Conditions met for Resolution."});

			let events = await this.GetEvents();

			const activeEvent = events(e => e.type === "prediction");
			if (!activeEvent) {
			    this.DebugPrint({msg: "Resolution failed: No active prediction found."});
			    return commandObj;
			}

			let winningSide = 'refund'; 
			const val = eFlag?.value?.toLowerCase();

			if (val === 'y' || val === 'yes') {
			    winningSide = 'yes';
			} else if (val === 'n' || val === 'no') {
			    winningSide = 'no';
			}

		this.EndPrediction(activeEvent.id, winningSide);
		events(e => e.id !== activeEvent.id);
		this.EventDisplayManager();
		
		this.DebugPrint({msg: `Prediction ${activeEvent.id} resolved as: ${winningSide}`});
	    } 
	    else {
		this.DebugPrint({msg: "No valid execution flags found."});
	    }

	    return commandObj;
	}




	/**
	 * Recursively alphabetizes keys in objects and elements in arrays.
	 */
	SortMap(input) {
	    // 1. Handle non-object types (null, strings, numbers, etc.)
	    if (input === null || typeof input !== 'object') {
		return input;
	    }

	    // 2. Handle Arrays: Sort their contents recursively
	    if (Array.isArray(input)) {
		return input.map(this.SortMap);
	    }

	    // 3. Handle Objects/Classes: Get keys, sort them, and rebuild
	    return Object.keys(input)
		.sort()
		.reduce((acc, key) => {
		    const value = input[key];
		    // Recursively sort the value if it's an object/array
		    acc[key] = this.SortMap(value);
		    return acc;
		}, {});
	}

	//MATH ESC FUNTIONS
	Clamp(args = { val, min, max }) {
	    // 1. Force conversion to numbers
	    let val = Number(args.val);
	    let min = Number(args.min);
	    let max = Number(args.max);

	    if(min > max){
		max = [min, min = max][0];
	    }

	    this.DebugPrint({ msg: `attempting to clamp ${val} between ${min} and ${max}`});

	    if (val == undefined){
	    	this.DebugPrint({ msg: ("value is undefined" + console.trace()), type: "t", val: args,});
	    }

	    if(min == undefined || max == undefined){
	    	this.DebugPrint({ msg: "either min or max is undefined and that's not expected", type: "t", val: {min: min, max: max}});
	    }
	    if(
		    val > max 
		    && max != undefined
	    ){
	    	this.DebugPrint({msg: "value clamped, returning:", val: max});
		return max;
    	    }
	    else if(
		    val< min 
		    && max != undefined
	    ){
	    	this.DebugPrint({msg: "value clamped, returning:", val: min});
	    	return min;
	    }

	    // 4. Return the clamped value
	    this.DebugPrint({msg: "value clamped, returning:", val: val});
	    return val;
	}



	AddUnprocessedMessageToUnprocessedQueue(p_msg) {
    // 1. Create a shallow copy to avoid side-effects if needed
    const validatedMsg = { ...p_msg };
    let errors = [];

    // 2. Validate properties
    if (validatedMsg.version == null) errors.push("version");
    if (validatedMsg.apiVersion == null) errors.push("api version");
    if (validatedMsg.data == null) errors.push("data");
    if (validatedMsg.platform == null) errors.push("platform");

    // 3. Set defaults/fixes
    if (validatedMsg.dateTime == null) {
        validatedMsg.dateTime = Date.now();
    }

    if (errors.length > 0) {
        this.DebugPrint({ msg: `Validation failed for fields: ${errors.join(", ")}` });
        validatedMsg.failedProcessingAt = Date.now();
	this.error_queue.psuh(validatedMsg);
	return;
    }

    this.#state.unprocessed_queue.push(validatedMsg); 
    
    this.DebugPrint({ msg: "Added item to queue" });

    return validatedMsg;
}

	GetUnprocessedQueue(){
		return this.#state.unprocessed_queue;
	}

	async GetMessages(){
		let msgArr = [];
		if(!this.ProbeForBadNodes()){
			//add logic here to trim nodes
			//return null;
		}
		const timelineClone = struct([...this.#state.event_timeline]);
		if(
			timelineClone == undefined 
			|| timelineClone == null
		){
			return [];
		}
		for(let i = 0; i < timelineClone.length; ++i){
			if(
				timelineClone[i].type == undefined
			){
				continue;
			}
			if(
				timelineClone[i].type.toLowerCase() == "message" 
				|| timelineClone[i].type.toLowerCase() == "msg" 
				|| timelineClone[i].type.toLowerCase() == "m"
			){
				msgArr.push(timelineClone[i]);
			}
		}
		return msgArr;
	}
	async GetErroredQueue(){
		let errArr = [];
		let timelineClone = structuredClone(this.#state.event_timeline);

		for(let i = 0; i < timelineClone; ++i){
			if(
				timelineClone[i].type == "error" 
				|| timelineClone[i].type == "err" 
				|| timelineClone[i].type == "e"
			){
				errArr.push(timelineClone[i]);
			}
		}

		return errArr;
	}
	async GetEvents(){
		let eventsArr = [];
		let timelineClone = structuredClone(this.#state.event_timeline);

		for(let i = 0; i < timelineClone; ++i){
			if(
				timelineClone[i].type == "events" 
				|| timelineClone[i].type == "event" 
			){
				eventsArr.push(timelineClone[i]);
			}
		}

		return eventsArr;
	}

	async GetActiveEvents(){
		let eventsArr = this.GetEvents();

		// filter for events taht have yet to expire/completed
		for(let i = 0; i < eventsArr; ++i){
			if(
				completedAt == null
				&& expiresAt > Date.now()
			){
				eventsArr.push(timelineClone[i]);
			}
		}
		return eventsArr;
	}

	GetSubWindows(){
		return this.subWindows;
	}

	async StartMonitoringMessages(){this.#state.timers.GetMessagesTimer.Start();}
	async StopMonitoringMessages(){this.#state.timers.GetMessagesTimer.Stop();}

	async StartTts(){this.#state.timers.ReadTtsTimer.Start();}
	async StopTts(){this.#state.timers.ReadTtsTimer.Stop();}

	async StartEventMonitor(){this.#state.timers.EventDisplayTimer.Start();}
	async StopEventMonitor(){this.#state.timers.EventDisplayTimer.Stop();}

	async MonitoringStart() {
	    this.DebugPrint({msg: "running the loop once as a test"});
	    try{
		await this.#DaLoop(); 
	    }
	    catch(err){
	    	this.DebugPrint({msg: "could not start monitoring, there was an error in the loop.", err:err, type:'t'});	    
	    }

	    	this.DebugPrint({msg: "test loop ran successfully, starting real loop in 3 seconds"});	    
	    /*
	    let key;
	    for(let i = 0; i < Object.keys(this.#state.timers).length; ++i){
	    	try{
	    		key = Object.keys(this.#state.timers)[i];
	    		this.#state.timers[key].Start();
	    	}
	    	catch(err){
	    		this.DebugPrint({msg: "error starting timer", val:key, err:err, type:'e'});
	    	}
	    }
	    */

		/*
		setTimeout(()=>{
		    try {
			this.DebugPrint({msg: "starting timers"});
			// Wrap it so 'this' remains correct when called by the timer
			//this.#state.timers.GetMessagesTimer.Start();
			
			let key; 
			for(let i = 0; i < Object.keys(this.#state.timers).length; ++i){
				try{
					key = Object.keys(this.#state.timers)[i];
					this.#state.timers[key].Start();
				}
				catch(err){
					this.DebugPrint({msg: "error starting timer", val:key, err:err, type:'e'});
				}
			}
		    }
		    catch (err) {
			this.DebugPrint({msg: "error properly starting the loop", err: err, type:'t'});
		    }
		}, 30000);
		*/
	}








	async SafeAddToEventTimeline(p_msg) {
		this.#state.event_timeline.push(p_msg);
	}

	DoTheStuffToAddMessageToQueue(p_msg){
	   this.DebugPrint({msg: "ADDING MESSAGE TO QUEUE", val: p_msg});
	    p_msg.state.displayedAt = Date.now();
	    this.DebugPrint({msg: "message does not exist, adding"});
	    this.#state.users[p_msg.userUuid].totalMessages += 1; /*undefined*/
	    this.SafeAddToEventTimeline(p_msg)

	    // reference: this.#templates.message_types
    	    for(let i = 0; i < Object.keys(this.#state.config.showSystemMessages).length; ++i){
	    	//check if we're skipping the system message for the platform
	    	if(String(Object.keys(this.#state.config.showSystemMessages)).toLowerCase() == String(p_msg.platform).toLowerCase()){
	    		if(this.#state.config.showSystemMessages[Object.keys(this.#state.config.showSystemMessages)[i]] == false){
	    			return;
	    		}	
	    		else{
	    			break;
	    		}
	    	}
	    }

	    switch(String(p_msg.type).toLowerCase()){
		case("cheer-monitized"): //ie claim bits
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "cheer-monitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("cheer-unmonitized"): //ie use a gif
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "cheer-unmonitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("community_gift-monitized"): //ie gifted sub
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "community_gift-monitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("community_gift-unmonitized"): //ie +rep 
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "community_gift-unmonitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("donation"):
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "donation-monitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("follow-monitized"): //ie new channel memeber on yt
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "follow-monitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("follow-unmonitized"): //ie new follow on twitch
			this.DebugPrint({msg: "MESSAGE TYPE NOT YET ACCOUNTED FOR", value: "follow-unmonitized"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("message-monitized"): //ie superchat on youtube
			this.DebugPrint({msg: "adding message-monitized to display"});
			this.PushDonationToChatWindow(p_msg);
			    break;
		case("message"): //imma add this here to be safe
			this.DebugPrint({msg: "adding message-unmonitized to display"});
			this.PushMessageToChatWindow(p_msg);
			    break;
		case("message-unmonitized"): //ie chat
			this.DebugPrint({msg: "adding message-unmonitized to display"});
			this.PushMessageToChatWindow(p_msg);
			    break;
		default:
			this.DebugPrint({msg: "could not push the message to the chat window(s), opting not to display instead"});
			this.PushMessageToChatWindow(p_msg)
			break;
	    }

	    return;
	}


	//let msg = await this.yt.ProcessYoutubeV3Data_v1(unprocessedMsg);

	async ProcessUnprocessedQueue() {
	    let q = this.#state.unprocessed_queue.splice(
		0,
		this.#state.unprocessed_queue.length
	    );

	    for (let i = 0; i < q.length; ++i) {
		const raw = q[i];
		let p_msg = null; // Initialize as null
		
		try {
		    switch (String(raw.platform).toLowerCase()) {
			case "twitch":
			    p_msg = await this.twitch.ProcessTwitchV1Data_v1(raw);
			    break;
			case "youtube":
			    p_msg = await this.yt.ProcessYoutubeV3Data_v1(raw);
			    break;
			default:
			    this.DebugPrint({ 
				msg: "could not find matching platform for message", 
				val: raw,
			    });
		    }

		    // DIAGNOSTIC CHECKS: See exactly what got assigned to p_msg
		    this.DebugPrint({ msg: "Raw data sent to platform logic", val: raw });
		    this.DebugPrint({ msg: "Resulting p_msg value right before validation check:", val: p_msg });

		    if (!p_msg) { 
			this.DebugPrint({ msg: "Message filtered or system handshake, skipping storage logic.", val: JSON.stringify(p_msg, null, 4) });
			continue; 
		    }

		    this.DebugPrint({ msg: "message finished processing", val: p_msg });

		    let doesMessageAlreadyExist = false;
		    let messages = await this.GetMessages();
		    
		    if (messages && messages.length > 0) {
			let m;
			for (let j = messages.length - 1; j >= 0; --j) {
			    m = messages[j];
			    if (
				m.receivedAt === p_msg.receivedAt &&
				(m.authorId === p_msg.authorId || m.username === p_msg.username)
			    ) {
				this.DebugPrint({msg: "message exists, not adding"});
				doesMessageAlreadyExist = true;
				break;
			    }
			}

			if (doesMessageAlreadyExist == false) {
			    this.DoTheStuffToAddMessageToQueue(p_msg);
			    this.DebugPrint({msg: "attempting to add message to display", val: p_msg.type});
			} else {
			    this.DebugPrint({ msg: "message already exists, skipping add" });
			}
		    } else {
			this.DoTheStuffToAddMessageToQueue(p_msg);
		    }
		} catch (err) {
		    this.DebugPrint({ msg: "LOOP CRASHED: ", error: err, val: q[i] });
		}
		
		const currentMsgs = await this.GetMessages();
		this.DebugPrint({ msg: "Current messages count: " + (currentMsgs ? currentMsgs.length : 0) });
	    }
	}
	

	async #DaLoop() {
		this.DebugPrint({msg: "daLoopCalled"});
		// dLive 
		// discord channel(s?)
		// facebook
		// instagram
		// kick
		// picarto
		// tiktok
		// trovo
		// twitch
			/*twitch not needed due to websocket connection, look for "AddTwitchMessageToUnprocessedQueeu()*/	
		// twitter here
		// youtube
		try{
			if(this.yt.isReady()){
				this.DebugPrint({msg: "Fetching messages from youtube"});
				const data = await this.yt.getChatMessages();
				
				this.DebugPrint({msg: `Received ${data.items?.length || 0} items`});

				if (!data.items || data.items.length === 0) return;

				this.DebugPrint({msg: "adding messages to unprocessed queue"});
				for (const item of data.items) {
					this.DebugPrint({msg: `of messages ${data.items.length}, proccessing messages: ${JSON.stringify(item, null, 2)}`});	
					this.AddUnprocessedMessageToUnprocessedQueue(this.yt.ParseYoutubeV3Message(item));
					this.DebugPrint({msg: `added item to unprocessedMessageQueue`});	
				}
			}
			else{
				this.DebugPrint({msg: "YOUTUBE DISABLED IGNORING"});
			}
		}
		catch(err){
			this.DebugPrint({
				msg: "could not run youtube loop in da loop",
				err: err,
			})
		}

		//process unprocessed queue
		this.DebugPrint({msg: "processing unprocecssed_queue"});
		await this.ProcessUnprocessedQueue();
	}
	


	async MonitoringStop() {
		this.DebugPrint({msg: "stopping timers"});
		let key; 
		for(let i = 0; i < Object.keys(this.#state.timers).length; ++i){
			try{
					key = Object.keys(this.#state.timers)[i];
					this.#state.timers[key].Stop();
			}
			catch(err){
				this.DebugPrint({msg: "error starting timer", val:key, err:err, type:'e'});
			}
		}
	}	


	GetEventTimelineIndexByMessageId(messageId) {
	    for (let i = 0; i < this.#state.event_timeline.length; ++i) {
		if (this.#state.event_timeline[i].messageId == messageId) {
		    return i;
		}
	    }
	    return -1;
	}
	
	#LSGI(id) {
		try{
		return localStorage.getItem(String(id));
		}
		catch(err){
			this.DebugPrint({msg: "localStorage could not be accessed", error: err});
		}
	}
	#GEBI(id) {
		try{
			let elem = document.getElementById(id);
			this.DebugPrint({msg: "returninging element", val: elem});
			return 
		}
		catch(err){
			this.DebugPrint({msg: "no document found, cannot return element", error:err});
		}
	}




	/**
	 * Renders the processed messages into a visual HTML table based on the provided
	 * mock structure, styles, and pagination logic.
	 * NOTE: This function relies on the existence of `this.#state.messages` 
	 * (array of processed message objects).
	 * @param {number} pageIndex - The current page of messages to display (0 is newest).
	 * @param {number} itemsPerPage - Number of messages per page.
	 * @returns {void}
	 */
	async RenderMessagesTable(pageIndex = 0, itemsPerPage = 10) {
	    // Ensure DOM is ready (though typically this runs after page load)
	    if(document == undefined){this.DebugPrint({msg:"cannot RenderMessageTable, no dom"}); return}
	    if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => this.RenderMessagesTable(pageIndex, itemsPerPage));
		return;
	    }

	    const containerId = "messages_visualization";
	    let container = document.getElementById(containerId);

	    // 1. Create or clear the container (built off-screen)
	    if (!container) {
		container = document.createElement('div');
		container.id = containerId;
	    }
	    container.innerHTML = '';

	    // 2. Inject CSS Styles
	    const style = document.createElement('style');
	    style.textContent = `
		:root {
		    --youtube-color: #f03;
		    --twitch-color: #6441a5;
		    --kick-color: #00e701;
		    --facebook-color: #1877F2;
		    --picarto-color: #35A775;
		    --tiktok-color: #FE2858;
		    --scoreColor1000plus: #E62117;
		    --scoreColor500plus: #E91E63;
		    --scoreColor100plus: #FFCA28;
		    --scoreColor50plus: #1DE9B6;
		    --scoreColor20plus: #00E5FF;
		    --scoreColor0plus: #1E88E5;
		    --scoreColorBelow0: #0000E5;
		}
		#${containerId} table { 
		    width: 100%; 
		    max-width: 100%; 
		    border-collapse: collapse; 
		    margin-bottom: 15px; 
		    font-family: sans-serif;
		}
		#${containerId} th { 
		    text-align: left; 
		    padding: 0.5rem; 
		    background: #333; 
		    color: white; 
		}
		#${containerId} td { 
		    padding: 0.5rem; 
		    vertical-align: middle; 
		}
		#${containerId} tr { background-color: #2a2a2a; color: white; }
		
		.command-trigger-button {
		    background-color: #3873C7;
		    color: white;
		    border: none;
		    padding: 4px 8px;
		    cursor: pointer;
		    font-size: 0.8em;
		    margin-top: 5px;
		    border-radius: 3px;
		}
		.command-trigger-button:hover {
		    background-color: #4A90E2;
		}
	    `;
	    container.appendChild(style);

	    // 3. Create Table Structure
	    const table = document.createElement('table');
	    
	    const thead = document.createElement('thead');
	    thead.innerHTML = `
		<tr>
		    <th style="min-width: 10rem;">user</th>
		    <th>message</th>
		    <th style="min-width: 8rem;">command</th>
		    <th style="min-width: 10rem;">controls</th>
		</tr>
	    `;
	    table.appendChild(thead);

	    const tbody = document.createElement('tbody');

	    // 4. Calculate Pagination Data
	    const sortedMessages = [...await this.GetMessages()].reverse(); 
	    const totalPages = Math.ceil(sortedMessages.length / itemsPerPage);
	    
	    pageIndex = Math.max(0, Math.min(pageIndex, totalPages > 0 ? totalPages - 1 : 0));
	    
	    const startIndex = pageIndex * itemsPerPage;
	    const endIndex = startIndex + itemsPerPage;
	    const pageItems = sortedMessages.slice(startIndex, endIndex);

	    // 5. Generate Rows using message data
	    pageItems.forEach(msg => {
		const tr = document.createElement('tr');
		
		let platformColorVar = '--youtube-color'; 
		if (msg.platform?.toLowerCase().includes('twitch')) platformColorVar = '--twitch-color';

		const score = msg.score || 0; 

		let scoreColorVar = '--scoreColorBelow0';
		if (score >= 1000) scoreColorVar = '--scoreColor1000plus';
		else if (score >= 500) scoreColorVar = '--scoreColor500plus';
		else if (score >= 100) scoreColorVar = '--scoreColor100plus';
		else if (score >= 50) scoreColorVar = '--scoreColor50plus';
		else if (score >= 20) scoreColorVar = '--scoreColor20plus';
		else if (score > 0) scoreColorVar = '--scoreColor0plus';

		tr.style.cssText = `
		    background-image: linear-gradient(90deg, var(${platformColorVar}), var(${scoreColorVar}));
		    height: 5em;
		    max-height: 5rem;
		    width: 100%;
		    overflow: hidden;
		    border-bottom: 1px solid rgba(0,0,0,0.2);
		    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
		`;

		const now = Date.now();
		const firstSeenTime = msg.date || msg.dateTime || now; 
		const diffSeconds = Math.floor((now - firstSeenTime) / 1000);
		let timeString = "just now";
		if (diffSeconds > 31536000) timeString = `${Math.floor(diffSeconds / 31536000)}y ago`;
		else if (diffSeconds > 2592000) timeString = `${Math.floor(diffSeconds / 2592000)}m ago`;
		else if (diffSeconds > 604800) timeString = `${Math.floor(diffSeconds / 604800)}w ago`;
		else if (diffSeconds > 86400) timeString = `${Math.floor(diffSeconds / 86400)}d ago`;
		else if (diffSeconds > 3600) timeString = `${Math.floor(diffSeconds / 3600)}h ago`;
		else if (diffSeconds > 60) timeString = `${Math.floor(diffSeconds / 60)}min ago`;
		else if (diffSeconds > 10) timeString = `${diffSeconds}s ago`;

		const authorDetails = msg.rawMessage?.data?.authorDetails;
		const isOwner = authorDetails?.isChatOwner;
		const isMod = authorDetails?.isChatModerator;
		const isSponsor = authorDetails?.isChatSponsor;
		
		const gradientStops = ['#000'];
		if (isSponsor) gradientStops.push('#00ffaa');
		if (isMod) gradientStops.push('#2266ff');
		if (isOwner) gradientStops.push('#ffaa00');
		gradientStops.push('#000');
		
		const profileGradient = `radial-gradient(ellipse closest-side, ${gradientStops.join(', ')})`;

		const commandCellDiv = document.createElement('div');
		commandCellDiv.style.cssText = "display:flex; flex-direction:column; font-size: 0.9em; color: white; text-shadow: 1px 1px 1px black;";

		if (msg.commands && msg.commands.length > 0) {
		    msg.commands.forEach(cmd => {
			const cmdDiv = document.createElement('div');
			
			cmdDiv.innerHTML = `
			    <div><strong>${cmd.command}</strong></div>
			    <div style="font-size:0.8em; filter:opacity(0.9); overflow-wrap:break-word;">${JSON.stringify(cmd.params)}</div>
			`;
			
			if (typeof cmd.func === 'function') {
			    const funcButton = document.createElement('button');
			    funcButton.innerText = `Run ${cmd.command}`;
			    funcButton.className = 'command-trigger-button';
			    
			    funcButton.onclick = async () => {
				this.DebugPrint({msg: `Executing command: ${cmd.command} for message: ${msg.processedMessage}`});
				try {
				    // Call the bound function which already has the state reference
				    await cmd.func(); 
				    funcButton.innerText = 'Success!';
				    funcButton.disabled = true;
				    setTimeout(() => {
					funcButton.innerText = `Run ${cmd.command}`;
					funcButton.disabled = false;
				    }, 1500);
				} catch (e) {
				    console.error(`Error running ${cmd.command}:`, e);
				    funcButton.innerText = 'Error';
				}
			    };
			    commandCellDiv.appendChild(funcButton);
			    
			    // Display current TTS state next to the button for debugging/UX
			    if (cmd.command === 'tts') {
				 const stateSpan = document.createElement('span');
				 stateSpan.innerText = ` (Read: ${!!msg.state.ttsHasRead})`;
				 stateSpan.style.color = msg.state.ttsHasRead ? '#7CFC00' : '#FFD700'; // Green if read, Yellow if unread
				 cmdDiv.appendChild(stateSpan);

				 // Check box for manual state change - useful for monitoring the fix
				 const checkbox = document.createElement('input');
				 checkbox.type = 'checkbox';
				 checkbox.checked = !!msg.state.ttsHasRead;
				 checkbox.onchange = (e) => {
				     msg.state.ttsHasRead = e.target.checked;
				     stateSpan.innerText = ` (Read: ${!!msg.state.ttsHasRead})`;
				     stateSpan.style.color = msg.state.ttsHasRead ? '#7CFC00' : '#FFD700';
				     this.DebugPrint(`Manually set ttsHasRead for ${msg.username} to ${msg.state.ttsHasRead}`);
				 };
				 cmdDiv.prepend(checkbox);
			    }
			}
			commandCellDiv.appendChild(cmdDiv);
		    });
		} else {
		    commandCellDiv.innerHTML = '<span style="filter:opacity(0.5);">-</span>';
		}

		tr.innerHTML = `
		    <td>
			<a href="${authorDetails?.channelUrl || '#'}" target="_blank" style="text-decoration:none; color:inherit;">
			    <div style="display:flex; flex-direction:row; height:100%; align-items:center;">
				<div style="
				    border-radius:100%;
				    display:flex; 
				    justify-content: center; 
				    align-items: center;
				    height:4rem; 
				    width:4rem;
				    min-width:4rem;
				    padding:0.2rem;
				    margin-right:1rem;
				    background-image: ${profileGradient};
				    background-size: 150%; 
				    background-position: center;
				    border: solid white 0.1em;
				">
				    <div style="display:flex; justify-content: center; height:100%; width:100%; overflow:hidden; border-radius:100%;">
					<img style="height:100%; width:100%; object-fit:cover;" 
					     src="${authorDetails?.profileImageUrl || 'https://yt3.ggpht.com/jrcU7ZjcLMBzCQbU6QMucPmC-cBiHOFrmTpDS9gDzUdH9FUTyzqgrkX9-rXzRh6Fac_HWWgNoEA=s88-c-k-c0x00ffffff-no-rj'}"
					     onerror="this.src='https://yt3.ggpht.com/jrcU7ZjcLMBzCQbU6QMucPmC-cBiHOFrmTpDS9gDzUdH9FUTyzqgrkX9-rXzRh6Fac_HWWgNoEA=s88-c-k-c0x00ffffff-no-rj'">
				    </div>
				</div>
				<div style="max-width:10rem; max-height:5rem; overflow: hidden; display:flex; flex-direction:column; justify-content:center;">
				    <span style="font-size:1rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color: white; text-shadow: 1px 1px 2px black;">
					${msg.username || authorDetails?.displayName || 'Unknown'}
				    </span>
				    <span style="font-size:0.8rem; color: #eee; text-shadow: 1px 1px 2px black;">
					${timeString}
				    </span>
				</div>
			    </div>
			</a>
		    </td>
		    <td style="overflow-wrap:break-word; max-width:20rem; height: 100%; color: white; text-shadow: 1px 1px 1px black;">
			${msg.processedMessage || ''}
		    </td>
		    <td class="command-cell"></td>
		    <td>
			<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(3em, 6em)); gap: 5px;">
			    <input type="button" style="background-color:darkorange; border:none; color:white; padding:5px; cursor:pointer;" value="Bonus">
			    <input type="button" style="background-color:darkblue; border:none; color:white; padding:5px; cursor:pointer;" value="Timeout">
			    <input type="button" style="background-color:darkred; border:none; color:white; padding:5px; cursor:pointer;" value="Ban">
			    <input type="button" style="background-color:indigo; border:none; color:white; padding:5px; cursor:pointer;" value="TTS Ban">
			</div>
		    </td>
		`;

		tr.querySelector('.command-cell').appendChild(commandCellDiv);
		tbody.appendChild(tr);
	    });

	    table.appendChild(tbody);
	    container.appendChild(table);

	    // 6. Navigation Controls
	    const navDiv = document.createElement('div');
	    navDiv.style.cssText = "width:100%; display:flex; justify-content:center; margin-top: 10px;";
	    
	    const fieldset = document.createElement('fieldset');
	    fieldset.style.cssText = "display:flex; justify-content:center; gap: 10px; border: 1px solid #ccc; padding: 10px; background: #222; align-items:center; border-radius: 5px;";
	    
	    const legend = document.createElement('legend');
	    legend.innerText = `Page Navigation (${pageIndex + 1} / ${totalPages || 1})`;
	    legend.style.color = "white";
	    fieldset.appendChild(legend);

	    const btnPrev = document.createElement('input');
	    btnPrev.type = "button";
	    btnPrev.value = "< Newer"; 
	    btnPrev.onclick = () => this.RenderMessagesTable(pageIndex - 1, itemsPerPage);
	    if (pageIndex <= 0) btnPrev.disabled = true;

	    const inputPage = document.createElement('input');
	    inputPage.type = "number";
	    inputPage.value = pageIndex;
	    inputPage.style.cssText = "width:50px; text-align:center; padding:5px;";
	    inputPage.onchange = (e) => {
		const newPage = parseInt(e.target.value);
		if (!isNaN(newPage) && newPage >= 0 && newPage < totalPages) {
		    this.RenderMessagesTable(newPage, itemsPerPage);
		} else {
		    e.target.value = pageIndex; 
		}
	    };

	    const btnNext = document.createElement('input');
	    btnNext.type = "button";
	    btnNext.value = "Older >";
	    btnNext.onclick = () => this.RenderMessagesTable(pageIndex + 1, itemsPerPage);
	    if (pageIndex >= totalPages - 1) btnNext.disabled = true;
	    
	    const btnReload = document.createElement('input');
	    btnReload.type = "button";
	    btnReload.value = "reload table";
	    btnReload.style.cssText = "background-color: #555; color: white; border: none; padding: 5px 10px; cursor: pointer; margin-left: 10px; border-radius: 3px;";
	    btnReload.onclick = () => this.RenderMessagesTable(0, itemsPerPage);

	    fieldset.appendChild(btnPrev);
	    fieldset.appendChild(inputPage);
	    fieldset.appendChild(btnNext);
	    fieldset.appendChild(btnReload); 
	    
	    navDiv.appendChild(fieldset);
	    container.appendChild(navDiv);

	    // 7. Final append
	    const existingContainer = document.getElementById(containerId);
	    if (!existingContainer) {
		document.body.prepend(container);
	    }
	}
	/**
	 * Renders a settings form to manage default flag values for commands.
	 */
	RenderDefaultCommandSettings() {
		try{
			if(document == undefined){
				this.DebugPrint({msg: "no document detected, cannot render DefaultCommandSettings"}); 	
				return;
			}
		}
		catch(err){
			this.DebugPrint({msg: "no document detected, cannot render DefaultCommandSettings", error: err}); 	
			return;
		}
	    const containerId = "default_command_settings";
	    let container = document.getElementById(containerId);
	    if (!container) {
		container = document.createElement('div');
		container.id = containerId;
		container.style.cssText = "margin: 20px; padding: 15px; border: 1px solid #444; background: #111; color: white;";
		document.body.prepend(container); 
	    }
	    container.innerHTML = '<h2>Default Command Settings</h2>';

	    const table = document.createElement('table');
	    table.style.cssText = 'width: 100%; border-collapse: collapse; margin-top: 10px;';
	    table.innerHTML = `
		<thead>
		    <tr style="background-color: #333;">
			<th style="padding: 10px; text-align: left; width: 10em;">Command</th>
			<th style="padding: 10px; text-align: left;">Flag Inputs / Defaults</th>
			<th style="padding: 10px; text-align: left; width: 10em;">Action</th>
		    </tr>
		</thead>
		<tbody id="default_command_tbody"></tbody>
	    `;
	    container.appendChild(table);
	    const tbody = document.getElementById('default_command_tbody');

	    this.#state.commands.forEach(commandDef => {
		const commandName = commandDef.command;
		const flags = commandDef.flags || [];
		const tr = document.createElement('tr');
		tr.style.borderBottom = '1px solid #444';
		
		const nameTd = document.createElement('td');
		nameTd.style.padding = '10px';
		nameTd.innerHTML = `<strong>!${commandName}</strong>`;
		tr.appendChild(nameTd);

		const inputsTd = document.createElement('td');
		inputsTd.style.padding = '10px';
		const formGroup = document.createElement('div');
		formGroup.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px;";

		flags.forEach(flagDef => {
		    const flagAlias = flagDef.flag[0];
		    const inputId = `cmd-default-${commandName}-${flagAlias}`;
		    const isNumeric = typeof flagDef.value === 'number';

		    const div = document.createElement('div');
		    div.style.cssText = "display: flex; flex-direction: column; min-width: 120px;";

		    const label = document.createElement('label');
		    label.htmlFor = inputId;
		    label.innerText = `-${flagAlias.toUpperCase()}: ${flagDef.description.split(' ')[1] || 'Value'}`;
		    label.title = flagDef.description;
		    label.style.fontSize = '0.9em';
		    label.style.color = '#ccc';

		    const input = document.createElement('input');
		    input.id = inputId;
		    input.name = inputId;
		    input.value = flagDef.value;
		    input.placeholder = `Default: ${flagDef.value}`;
		    input.style.cssText = "padding: 5px; border: 1px solid #888; background: #333; color: white; border-radius: 3px; margin-top: 2px;";

		    if (isNumeric) {
			input.type = 'number';
			input.min = flagDef.range?.min || undefined;
			input.max = flagDef.range?.max || undefined;
			input.step = (flagDef.range?.max - flagDef.range?.min) < 3 ? 0.1 : 1; 
		    } else {
			input.type = 'text'; 
		    }
		    
		    input.classList.add(`flag-input-${commandName}`);

		    div.appendChild(label);
		    div.appendChild(input);
		    formGroup.appendChild(div);
		});

		inputsTd.appendChild(formGroup);
		tr.appendChild(inputsTd);

		const actionTd = document.createElement('td');
		actionTd.style.padding = '10px';
		
		if (typeof commandDef.func === 'function') {
		    const runButton = document.createElement('button');
		    runButton.innerText = `Run !${commandName}`;
		    runButton.style.cssText = "background-color: #007bff; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 4px;";
		    
		    runButton.onclick = async () => {
			runButton.disabled = true;
			runButton.innerText = 'Running...';
			
			const currentParams = {};
			const inputs = document.querySelectorAll(`.flag-input-${commandName}`);
			inputs.forEach(input => {
			    const alias = input.id.split('-').pop();
			    const value = input.type === 'number' ? parseFloat(input.value) : input.value;
			    if (value !== null && value !== undefined && value !== "") {
				 currentParams[alias] = value;
			    }
			});

			const testMessage = `Testing command !${commandName} with UI defaults.`;

			try {
			    await commandDef.func.call(this, testMessage, currentParams, {});
			    
			    runButton.innerText = 'Success!';
			    this.DebugPrint(`Successfully executed !${commandName}:`, currentParams);
			} catch (e) {
			    runButton.innerText = 'Error!';
			    console.error(`Error executing !${commandName}:`, e);
			} finally {
			    setTimeout(() => {
				runButton.innerText = `Run !${commandName}`;
				runButton.disabled = false;
			    }, 2000);
			}
		    };
		    actionTd.appendChild(runButton);
		} else {
		    actionTd.innerHTML = '<span style="color:#aaa;">Function not implemented</span>';
		}

		tr.appendChild(actionTd);
		tbody.appendChild(tr);
	    });
	}

	SanitizeString(strang) {
	  // 1. Type Check
	  if (typeof strang !== 'string') {
	    throw new Error("strang is not a string, UNEXPECTED DATA TYPE");
	  }

	  const cleanStr = strang.toLowerCase().replace(/[^a-z0-9]/g, '');

	  let foundBannedWord = false;
	  for (let i = 0; i < cleanStr.length; i++) {
	    for (let len = 1; len <= cleanStr.length - i; len++) {
	      const windowContent = cleanStr.substring(i, i + len);
	      
	      if (this.#state.bannedWordsArray.includes(windowContent)) {
		// TODO: make switch to change handling
		this.DebugPrint(`Banned word '${foundBannedWord}' detected.`);
		let censorChar = this.#state.config.censoring.censorChar;
		return (censorChar + censorChar + censorChar + censorChar + censorChar);
	      }
	    }
	  }

	  return strang;
	}

	ParseCommandFromMessage(processedMessage) {
		this.DebugPrint("parsing commands from message: ", processedMessage);
	    // 1. Get the raw text from the object
	    const rawText = processedMessage.rawMessage || "";
	    const token = this.#state.config.flag.token;

	    // 2. Quick Exit: If it doesn't start with the command token
	    if (!rawText.startsWith(token)) {
		return {}; 
	    }

	    // 3. Tokenize
	    const tokens = rawText.trim().split(/\s+/);
	    if (tokens.length === 0) return {};

	    // Extract command name (strip the token)
	    const commandName = tokens[0].substring(token.length).toLowerCase();

	    // 4. Command Switchboard
	    // We return the result of the specific processor back to the caller
	    this.DebugPrint({msg: "passing commandName to switch:", val: commandName});
	    switch (commandName) {
		case ('clip'):
		    this.DebugPrint({msg: "clip command found"});
		    // Ensure this function exists to handle clipping logic
		    return {clip: this.ProcessClipCommand(processedMessage)};
		case ('help'):
			    return {help: this.ProcessHelpCommand(processedMessage)};
		case ('prediction'):
		case ('predict'):
		    this.DebugPrint({msg: "prediction command found"});
// Ensure this function exists to handle !predict logic
		    return {prediction: this.ProcessPredictionCommand(processedMessage)};
		case ('tts'):
		    this.DebugPrint({msg: "tts command found"});
		    return {tts: this.ProcessTtsCommand(processedMessage)};
		case ('vote'):
		    this.DebugPrint({msg: "vote command found"});
		    return {vote: this.ProcessVoteCommand(processedMessage)};


		default:
		    this.DebugPrint(`Unknown command: ${commandName}`);
		    return {};
	    }
	}

	async importFileAsString(url) {
	  try {
	    // Fetch the file from the specified URL
	    const response = await fetch(url);

	    // Check if the request was successful
	    if (!response.ok) {
	      throw new Error(`HTTP error! status: ${response.status}`);
	    }

	    // Get the response body as a plain text string
	    const fileContent = await response.text();

	    return fileContent;

	  } catch (error) {
	    console.error('Error fetching file:', error);
		  throw new Error("could not get file");
	    // You might want to return a default value or re-throw the error
	  }
	}

	async CheckMessageForBannedWords(inMessage = undefined){ //TODO: optimize this a bunch
		try{
			if(inMessage == undefined){
				console.warn("in message is undefined, is this intentional?");
				return false;
			}

			//check message without spaces or caps for bad word	
			let formattedMessage = new Array(inMessage.length-1);
			for(let i = 0; i < inMessage.length; ++i){
				switch(inMessage[i].toLowerCase()){
					case("."):
					case("-"):
					case("_"):
						formattedMessage[i] = '';
						break;
					case("@"):
					case("4"):
						formattedMessage[i] = 'a';
						break;
					case("6"):
					case("8"):
						formattedMessage[i] = 'b';
						break;
					case("<"):
					case("["):
						formattedMessage[i] = 'c';
					case("]"):
						formattedMessage[i] = 'd';
						break;
					case("3"):
						formattedMessage[i] = 'e';
						break;
						// formattedMessage[i] = 'f';
					case("9"):
						formattedMessage[i] = 'g';
						break;
					case("#"):
						formattedMessage[i] = 'h';
						break;
					case("1"):
					case("!"):
						formattedMessage[i] = 'i';
						break;
						// formattedMessage[i] = 'j';
						// formattedMessage[i] = 'k';
					case("("):
					case(")"):
					case("\\"):
					case("/"):
					case("|"):
						formattedMessage[i] = 'l';
						break;
						// formattedMessage[i] = 'm';
						// formattedMessage[i] = 'n';
						// formattedMessage[i] = 'o';
						// formattedMessage[i] = 'p';
						// formattedMessage[i] = 'q';
						// formattedMessage[i] = 'r';
					case("5"):
					case("$"):
						formattedMessage[i] = 's';
						break;
					case("7"):
						formattedMessage[i] = 't';
						break;
						// formattedMessage[i] = 'u';
						// formattedMessage[i] = 'v';
						// formattedMessage[i] = 'w';
						// formattedMessage[i] = 'x';
						// formattedMessage[i] = 'y';
					case(">"): //UNKNOWN
					case("2"):
					case("%"):
						formattedMessage[i] = 'z';
						break;
					default: 
						this.DebugPrint({msg:"unaccounted case for input: ", val: inMessage[i], type:"warn"});
					case("a"):
					case("b"):
					case("c"):
					case("d"):
					case("e"):
					case("f"):
					case("g"):
					case("h"):
					case("i"):
					case("j"):
					case("k"):
					case("l"):
					case("m"):
					case("n"):
					case("o"):
					case("p"):
					case("q"):
					case("r"):
					case("s"):
					case("t"):
					case("u"):
					case("v"):
					case("w"):
					case("x"):
					case("y"):
					case("z"):
					case(' '):
					case("'"):
					case('?'):
						//formattedMessage[i] = formattedMessage[i];
						break;
				}
			}
				formattedMessage = String(formattedMessage).toLowerCase();

			for(let i = 0; i < formattedMessage.length; ++i){
				for(let j = formattedMessage.length-1; -1 < j; --j){
					if(this.#state.bannedWordsArray.includes(formattedMessage.slice(i, j))){
						return true
					}
				}
			}
			return false;
		}
		catch(err){
			console.log(err);
		}
	}

	ProcessClipCommand(processedMsg){
		let token = this.#state.config.flag.token;
		if(processedMsg.rawMessage.slice(0, String(token+"clip").length) != String(token + "clip")){
			this.DebugPrint({msg:"cannot process clip, tag at start is not valid trigger", type: 't'});	
		}
		let cmd;

		try{
			/* 
				clip: {
					version: 1,
					command: "clip",
					audio: null,
					eventHtml: null,
					flags: [
						{ flag: ['l'], value: 1, description: "approximate duration of the clip in minutes", range: { min: 0.1, max: 10 } },
					],
					func: 'ProcessClipCommand', //function to call when triggered
					AuthNeeded: { owner: false, admin: false, mod: false, trused: false
					},
					cost: 0,
					state: {},
					errInfo: {err: null, errMsg: null},
				},
			 */
			cmd = this.templates.messageCommand;
		}
		catch(err){
			this.DebugPrint({msg:"cannot process clip, could not get templates.messageCommand", val: {in: processedMsg, state: cmd}, type: 'e', err: err});		
			isValid == false;
		}
		cmd.isValid = null;
		cmd.version = 1;

		cmd.commandType = "clip";
		cmd.flags = {}; // no flags
		try{
			cmd.message = String(processedMsg.rawMessage.slice(String(token+"clip").length, processedMsg.rawMessage.length)).trim();
		}
		catch(err){
			this.DebugPrint({msg:"cannot process clip, could not set message slice", val: {in: processedMsg, state: cmd}, type: 'e', err: err});		
			isValid == false;
		}
		cmd.pointsOffer = 0;		
		cmd.errInfo = {
			err: null,
			erroredAt: null,
		},
		cmd.state = {};

		if(cmd.isValid == null){
			cmd.isValid = true;
			cmd.executedAt = Date.now();
			this.#state.event_timeline.push(cmd);
		}
		
		return cmd;
	}

ProcessHelpCommand(processedMsg){
	/*
		messageCommand: {
			isValid: false, // if everything passes, then true, if not (ie not enough credits, not the right perms, etc, then false
			commandType: null,
			flags: {}, // flags will be a key value, such as: {-y: true}
			message: null,
			executedAt: null,
			pointsOffer: 0, // amount spent on the command,	
			message: null,
			version: 1, // version to check
			errInfo: {
				err: null,
				erroredAt: null,
			},
			state: {},
		},
		*/
	let cmd = this.templates.messageCommand;
	cmd.version = 1;
	cmd.isValid = null;
	cmd.commandType = "help";
	cmd.flags = {};
	cmd.errInfo = {
		err: null,
		erroredAt: null,
	},
	cmd.state = {};

	let token = this.#state.config.flag.token;
	cmd.message = processedMsg.rawMessage.slice(0, Number(token.length + String("help").length));
	cmd.pointsOffer = 0;

	//made it here so we good
	cmd.isValid = true;

	//push to window
	if(document == undefined){
		return cmd;
	}

	if (cmd.isValid) {
	    const commands = this.#state.commands;
	    const commandContainers = [];

	    for (const key in commands) {
		const cmdObj = commands[key];
		
		if (!cmdObj || typeof cmdObj !== 'object' || !cmdObj.command) continue;
		const auth = cmdObj.AuthNeeded || {};
		if (auth.owner || auth.admin || auth.mod) continue;

		// 1. The Wrapper
		const cmdWrapper = this.CHE({ 
		    type: 'div', 
		    className: 'system-command-card',
		    style: "overflow: hidden; width: 100%; font-family: system-ui, sans-serif; height: 100%;" 
		});

		// 2. Header (Command Name)
		const header = this.CHE({ 
		    type: 'div', 
		    style: "border-bottom: 1px solid #444; padding-bottom: 4px; margin-bottom: 8px;"
		});
		header.innerHTML = `<strong style="color: #ff0; font-size: 1.1rem;">!${cmdObj.command.toUpperCase()}</strong>`;
		cmdWrapper.appendChild(header);

		// 3. Flags Table (using CSS Grid for alignment)
		const flagsData = cmdObj.flags;
		if (flagsData) {
		    let normalizedFlags = Array.isArray(flagsData) 
			? flagsData 
			: Object.keys(flagsData).map(k => ({ flag: k, ...flagsData[k] }));

		    if (normalizedFlags.length > 0) {
			const grid = this.CHE({
			    type: 'div',
			    style: "display: grid; grid-template-columns: auto 1fr auto; gap: 8px 12px; align-items: start; font-size: 0.8rem;"
			});

			// Table Headers
			grid.innerHTML = `
			    <div style="color: #888; font-weight: bold; border-bottom: 1px solid #222;">FLAG</div>
			    <div style="color: #888; font-weight: bold; border-bottom: 1px solid #222;">DESCRIPTION</div>
			    <div style="color: #888; font-weight: bold; border-bottom: 1px solid #222;">RANGE</div>
			`;

			const exampleFlags = [];

			normalizedFlags.forEach(f => {
			    const flagKey = Array.isArray(f.flag) ? f.flag[0] : f.flag;
			    const rangeText = f.range ? `${f.range.min}-${f.range.max}` : "—";
			    
			    // Add rows to grid
			    grid.innerHTML += `
				<div style="color: #0f0; font-family: monospace;">-${flagKey}</div>
				<div style="color: #eee; white-space: normal; word-break: break-word;">${f.description || ""}</div>
				<div style="color: #666; text-align: right;">${rangeText}</div>
			    `;

			    // Logic for Random Example: pick one or two flags to showcase
			    if (Math.random() > 0.3 || exampleFlags.length === 0) {
				let val = "";
				if (f.range) {
				    // Pick a random number in range or just the min
				    val = ` ${f.range.min}`;
				} else if (f.type === "string") {
				    val = " text";
				}
				exampleFlags.push(`-${flagKey}${val}`);
			    }
			});

			cmdWrapper.appendChild(grid);

			// 4. Random Example Generator
			const exampleMsg = `!${cmdObj.command} ${exampleFlags.join(' ')} ${cmdObj.command === 'tts' ? 'Hello world!' : ''}`;
			const exampleBox = this.CHE({
			    type: 'div',
			    style: "margin-top: 10px; padding: 6px; background: #222; border-radius: 4px; border: 1px dashed #444;"
			});
			exampleBox.innerHTML = `
			    <div style="font-size: 0.65rem; color: #888; margin-bottom: 2px;">EXAMPLE USAGE:</div>
			    <code style="color: #0af; font-size: 0.8rem; word-break: break-all;">${exampleMsg}</code>
			`;
			cmdWrapper.appendChild(exampleBox);
		    }
		}

		commandContainers.push(cmdWrapper.outerHTML);
	    }

	    // Staggered push
	    commandContainers.forEach((htmlString, index) => {
		setTimeout(() => {
		    this.PushSystemNotificaitonToChatWindow(htmlString);
		}, index * 1250);
	    });
	    
	    cmd.executedAt = Date.now();
	}

	return cmd;
}

	
ProcessTtsCommand(processedMsg) {
	this.DebugPrint({msg: "processing tts command from message", val: processedMsg});

	let cmd = {
	    ...this.templates.messageCommand,
	    flags: {},
	    state: { readAt: null },
	    errInfo: { err: null, erroredAt: null },
	};

	cmd.isValid = null;

	let msg = processedMsg.rawMessage;
	msg = msg.split(" "); // breaks into array based on space ie: ["hello", "world"]

	if(msg[0] != String(this.#state.config.flag.token + "tts")){
		this.DebugPrint({msg: "processing tts command from message", val: processedMsg, type: "t"});	
	}
	cmd.commandType = "tts";

	//find all flags and parse
	for(let k = 1; k < msg.length; k = ++k){ // start at 1 to skip flag, skip every other flag because key value pairs
		let flag, value;
		if(msg[k][0] == "-"){
			if (msg[k].length < 2){this.DebugPrint({msg: "cannot complete command, flag is improper", type: "t"})};	
			flag = msg[k].slice(1, msg[k].length);

			if(
				flag.toLowerCase() == "s"
			){
				if(flag.toLowerCase() == "s"){
				this.DebugPrint({msg: "s flag found, converting to r (rate) to align with the web voice std"});	
					flag = "r";
					cmd.flags[flag] = true;
				}
				cmd.flags[flag] = true;
			}
			
			if(msg.length > k+1){
				value = msg[k+1];
				cmd.flags[flag] = value;
				++k;
			}
			else if(k == msg.length-1){
				this.DebugPrint({msg: "last items doesn't have a value, is likely message:", val: msg[k]});	
				msg = msg[k];
				break;
			}
		}
		else{
			this.DebugPrint({msg: "command not found, skipping to verify flags"});
			let message = "";
			for(let l = k; l < msg.length; ++l){
				message += String(msg[l] + " ");
			}
			message = message.trim(); // to clean space often left at end

			this.DebugPrint({msg: "assign msg value to:", val: message});
			cmd.message = message;
			break;
		}
	}	

	// ensure flags are present
	const manditoryFlags = Object.keys(this.#state.commands.tts.flags);
	for(let i = 0; i < manditoryFlags.length; ++i){
		let flag = manditoryFlags[i];
		if(
			cmd.flags[flag] == undefined 
		){
			cmd.flags[flag] = null;			
		}

		if(cmd.flags[flag] == null){
			switch(flag.toLowerCase()){
				case('p'):
				case('r'):
				case('v'):
					cmd.flags[flag] = this.#state.commands.tts.flags[flag].value;
					break;
			}
		}
	}

	// cast values to proper types
	this.DebugPrint({msg: "checking casts of cmd.flag", val: cmd.flags});
	for(let i = 0; i < Object.keys(cmd.flags).length; ++i){
		try{
			let key = Object.keys(cmd.flags)[i];
			let type = this.#state.commands.tts.flags[key].type;
			let newVal = this.CastValueToType(cmd.flags[key], type);
			this.DebugPrint({msg: "checking cast of key:", val: {key: key, type: type, newVal: newVal}});

			if(typeof newVal != type){
				this.DebugPrint({
					msg: `value ${cmd.flags[flag]} after casting ${newVal} does not match expected type ${type}`, 
					type: 'w'
				});
				cmd.errInfo = {
					err: `value '${cmd.flags[key]}' after casting ${newVal} does not match expected type '${newVal}'`,
					erroredAt: Date.now(),
				}
				cmd.isValid = false;
			}		

			this.DebugPrint({msg: `updating key '${key} to new value`, val: newVal})
			cmd.flags[key] = newVal;
		}
		catch(err){
			this.DebugPrint({
				msg: `error checking cast value at loop itr`, 
				val: i,
				err: err,
			});
		}
	}

	//cmd.state["readAt"] = null;

	if (cmd.isValid == null){cmd.isValid = true;}
	

    return cmd;
}

	/**
	 * Generates the Control Bar UI for Saving, Loading, and Monitoring.
	 * @param {HTMLElement} container - The element to attach the control bar to.
	 */

	PushToUnprocessedQueue(u_msg){
		/*
		unprocessed_message_v1: {
			version : 1,
			apiVersion : 3, // youtube,
			data : null,
			dateTime : null,
			platform : null,
			failedProcessingAt : null,
		},
		*/

		if(u_msg.version == null){this.DebugPrint({
			msg: "cannot push message to unprocessed queue,",
			val: u_msg,
			err: "no version number",
			t: "error"
		});}
		if(u_msg.apiVersion == null){this.DebugPrint({
			msg: "cannot push message to unprocessed queue,",
			val: u_msg,
			err: "no api version",
			t: "error"
		});}
		if(u_msg.data == null){this.DebugPrint({
			msg: "cannot push message to unprocessed queue,",
			val: u_msg,
			err: "no data",
			t: "error"
		});}
		if(u_msg.dateTime == null){dateTime == Date.now()}
		if(u_msg.platform == null){this.DebugPrint({
			msg: "cannot push message to unprocessed queue,",
			val: u_msg,
			err: "no datetime",
			t: "error"
		});}
		if(u_msg.platform == null){this.DebugPrint({
			msg: "cannot push message to unprocessed queue,",
			val: u_msg,
			err: "no datetime",
			t: "error"
		});}

		this.#state.unprocessed_queue.push(u_msg);
	}

	async PlaySound(input = {
		soundfile: null,
		volumne: null,
		pitch: null,
		rate: null,
	}){
		// 1. Create the Audio Context (The central hub)
		const audioContext = new (window.AudioContext || window.webkitAudioContext)();

		// 2. Load the file as an ArrayBuffer (requires a fetch operation)
		fetch(input.soundfile)
		  .then(response => response.arrayBuffer()) // Get the raw binary data
		  .then(arrayBuffer => {
		    // 3. Decode the buffer into an AudioBuffer (The actual playable sound data)
		    audioContext.decodeAudioData(arrayBuffer)
		      .then(audioBuffer => {
			// 4. Create a source node from the buffer
			const source = audioContext.createBufferSource();
			source.buffer = audioBuffer;

			// 5. Connect the source to the speakers (destination)
			source.connect(audioContext.destination);

			// 6. Start playback!
			source.start(0); // Start playing immediately
		      })
		      .catch(err => console.error('Error decoding audio:', err));
		  })
		  .catch(err => console.error('Error fetching audio:', err));
	}

	constructor(){/* DO NOT ADD STUFF HERE, IT WILL CORRUPT TESTING STATE */}
}
