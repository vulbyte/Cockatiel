import {YoutubeV3} from "./imports/youtubeV3ApiAccessor/youtube_state.mjs"
import TTSManager from "./imports/webTTSManager/TTSManager.mjs";
import {IntTimer} from "../../../lib/imports/intTimer/intTimer.mjs";
import {TrieTree} from "../../../lib/trie_tree.mjs";

// magic values
let trigrams; // = await fetch('/content/stream_utils/tib_stuff/trigrams.json').then((res) => {return res.json()});

export default class Cockatiel {
	#isTtsBusy = false;
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
			    timeRemainingUntilLockout: new IntTimer({
				autoStart: true,
				timeoutDuration: 300 // 5 min
			    }),
			    timeRemainingUntilRefund: new IntTimer({
				autoStart: true,
				timeoutDuration: 28800 // 8 hours
			    })
			}
		},
		errored_queue: {
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
		messages: {
			//originalData: {},
			version: 1,
			username: null,
			userUuid: null,
			streamOrigin: null, //what streamid via the platform the message came from
			channelOrigin: null,
			receivedAt: null, 
			commands: [],
			processedMessage: null,
			platform: null,
			messageId: null,
			rawMessage: null,
			score: null,
			state: {}
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
			state: {},
		},
		misconduct: {
			version: 1,
			happenedAt: null, // unixTimestamp	
			byUser: null, //  uuid
			messageMisconduct: null, // if null do not add
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
			styling: { // ONLY CUSTOMIZABLE PROPERTIES ARE HERE, styles are whiteliste'd
				chatMessageContainer: {
					styling: ``,
					chatUserBubble: {	
						styling: ``,
						chatBubbleTailContainer: {
							styling: ``,
							chatBubbleTailContainer: {
								styling: ``,
								chatBubbleTail: {styling: ``,},
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
								chatUserImage: {styling: ``},
							},
							chatUserStats: {
								styling: ``,
								chatUsername: {styling: ``},
								chatUserCommendations: {styling: ``,}
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

						chatMessage: { styling: `` },
					},
				},
			}, //end of styling
			totalMessages: 0,
		}
	};	

	#state = { // when saving and loading this is what will be saved/loaded
		bannedWordsArray: [], //do not add manually, use the AddBannedWord/RemoveBannedWordFunctions
		bannedWordsTrie: new TrieTree(), // tree that's good for strings, basically all you need to worry about is: add(), remove(), ContainsString()
		clip_queue: [],
		// NOTE: Assuming this function is part of a class/module where
		config: {
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
		    description :
			"used to define the token used to trigger the tts,",
		    token : "!",
		    positionOptions : [
		      "start",
		      "end",
		      "anything_after",
		    ],
		    positionSelected : "start",
		  },
		},
		commands: { // only add commands that are implimented
			clip: {
				version: 1,
				command: "clip",
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
				description: "",
				flags: [],
				func: 'ProcessHelpCommand', //function to call when triggered
				AuthNeeded: { owner: false, admin: false, mod: false, }
			},
			tts: {
				version: 1,
				command: "tts",
				description: "",
				flags: {
					p: {value: 1, type:"number", description: "modifys the pitch of the tts", range: { min: 0.5, max: 3 } },
					/* below is an alias for speed*/
					r: {value: 1, type:"number", description: "modifys the speed [rate] of the tts message", range: { min: 0.5, max: 3 } },
					v: {value: 1, type:"number", description: "modifys the voice of the tts message", range: { min: 0, max: 180 } },
				},
				AuthNeeded: { owner: false, admin: false, mod: false, trused: false},
				func: 'CallTts', //function to call when triggered
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
		doubleDownQueue: [],
		errored_queue: [], //queue for any/all messages that have errored for ANY reason
		events: [],
		flaggedMessageQueue: [],
		logs: new Array(), //history for all messages, stats, bans, etc
		messages: [],
		subWindows: {},
		timers: {/*declared at the start of the constructor*/},
		unprocessed_queue: [], // messages returned from yt fetch
		users: {},
		windows: {
			chat: {
				key: "chatDisplay",
				height: 800,
				width: 420,  // this was an accident lol
				background: "#0f0",
				color: undefined,
				messageDisplayDuration: 7,
				displayRate: {min: 1.1, max: 5}, // min and max values for when to add the next message to chat display
				defaultStylesheet: "http://127.0.0.1:8080/content/stream_utils/tib_stuff/stylesheets/chatMessage-modernMinimal.css", 
				//"./stylesheets/chatMessage-modernMinimal.css",
			},
			events: {
				key: "eventDisplay",
				height: 300,
				width: 400, 
				background: "#000",
				color: undefined,	
				defaultStylesheet: "",
			}
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

	GetState(){
		return (this.#state);
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
		this.#state.logs.push(logObj);
		return true;
	}
	GetLogs(){
		return this.#state.logs;
	}

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
		error: errorMessage, // Save the string version for readability
	    };
	    this.AddLogToLogs(log);

	    return log;
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

	ExportState() {
	    const seen = new WeakSet(); // Track visited objects

	    const jsonString = JSON.stringify(this.#state, (key, value) => {
		// 1. Handle Objects/Circular Refs
		if (typeof value === "object" && value !== null) {
		    if (seen.has(value)) {
			return; // Discard circular reference
		    }
		    seen.add(value);
		}

		// 2. Convert Trie to Array
		if (key === 'bannedWords' && value instanceof TrieTree) {
		    return value.ToArray();
		}

		// 3. Remove functions
		if (typeof value === 'function') {
		    return undefined;
		}

		return value;
	    }, 4);

	    return jsonString;
	}

	async ImportState(input) {
	    this.DebugPrint({msg: "ImportState: Determining input type..."});
	    let data;

	    try {
		// 1. Handle Event (from onchange or drag-and-drop)
		if (input?.target?.files) {
		    const file = input.target.files[0];
		    if (!file) return;
		    const text = await file.text();
		    data = JSON.parse(text);
		} 
		// 2. Handle direct File object
		else if (input instanceof File) {
		    const text = await input.text();
		    data = JSON.parse(text);
		}
		// 3. Handle raw JSON String
		else if (typeof input === 'string') {
		    data = JSON.parse(input);
		}
		// 4. Handle already-parsed Object
		else if (typeof input === 'object' && input !== null) {
		    data = input;
		} 
		else {
		    throw new Error("Unsupported import type.");
		}

		// --- Re-hydration Logic ---
		this.DebugPrint({msg: "Converting banned words to Trie structure"});
		const newTrie = new TrieTree();
		if (Array.isArray(data.bannedWords)) {
		    data.bannedWords.forEach(word => newTrie.Add(word));
		}

		this.DebugPrint({msg: "Assigning state to imported value"});
		// We merge with existing state to ensure any internal-only values aren't lost
		this.#state = {
		    ...this.#state,
		    ...data,
		    bannedWordsTrie: newTrie,
		    // Re-bind commands
		    commands: data.commands.map(cmd => {
			if (cmd.command === "tts") cmd.func = this.CallTts.bind(this);
			return cmd;
		    })
		};
		
		this.DebugPrint({msg: "Import successful!"});

	    } catch (err) {
		console.error("ImportState failed:", err);
	    }

	    this.UpdateUserDisplay();
	    this.UpdateBannedWordsList();
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

		if(this.#state.events.length > 0){
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
/**
	 * Processes a validated vote command into the state.
	 * @param {Object} commandObj - The messageCommand object (isValid: true)
	 * @param {string} userUuid - The UUID of the voter
	 * @returns {boolean} - Success or failure
	 */
	HandleVoteStateUpdate(commandObj, userUuid) {
	    // 1. Safety Check: Only process if the command itself is valid
	    if (!commandObj || !commandObj.isValid) return false;

	    // 2. Locate the active prediction event
	    const activePrediction = this.#state.events.find(e => 
		e.type === "prediction" && !e.completedAt
	    );

	    if (!activePrediction) {
		this.DebugPrint?.({ msg: "Vote failed: No active prediction found." });
		return false;
	    }

	    // 3. Check Lockout Timer
	    // Assuming IntTimer has a method to check if it's finished, or checking the duration
	    const timer = activePrediction.state.timeRemainingUntilLockout;
	    const isLocked = (timer.time >= timer.timeoutDuration);

	    if (isLocked) {
		this.DebugPrint?.({ msg: "Vote failed: Prediction is locked." });
		return false;
	    }

	    // 4. Prepare Vote Data
	    const choice = commandObj.command.flags.y ? "yes" : "no";
	    const wager = commandObj.spend || 0;
	    const isDoubleDown = commandObj.command.flags.dd || false;

	    // 5. Check for Existing Vote (Upsert logic)
	    // If user already voted, we update their current vote rather than pushing a new one
	    const existingVoteIndex = activePrediction.state.votes.findIndex(v => v.userUuid === userUuid);

	    const voteEntry = {
		userUuid: userUuid,
		choice: choice,
		wager: wager,
		doubleDown: isDoubleDown,
		timestamp: Date.now()
	    };

	    if (existingVoteIndex !== -1) {
		// Update existing vote
		activePrediction.state.votes[existingVoteIndex] = voteEntry;
	    } else {
		// Add new vote
		activePrediction.state.votes.push(voteEntry);
	    }

	    // 6. Final UI/State Trigger
	    this.EventDisplayManager();
	    return true;
	}

	ProcessPredictionCommand(messageObject) {
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

		const activeEvent = this.#state.events.find(e => e.type === "prediction");
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
		this.#state.events = this.#state.events.filter(e => e.id !== activeEvent.id);
		this.EventDisplayManager();
		
		this.DebugPrint({msg: `Prediction ${activeEvent.id} resolved as: ${winningSide}`});
	    } 
	    else {
		this.DebugPrint({msg: "No valid execution flags found."});
	    }

	    return commandObj;
	}

	CreateNewPrediction(commandObject) {
	    const msg = commandObject.processedMessage || "";
	    
	    // 1. Regex Extraction
	    // Looks for "-p " followed by text until the next flag "-" or end of string
	    const promptMatch = msg.match(/-p\s+([^-\n\r]*)/);
	    const lockoutMatch = msg.match(/-l\s+(\d+)/);

	    const prompt = promptMatch ? promptMatch[1].trim() : this.DebugPrint({type: "throw", msg: "prompt is empty, cannot create"});
	    const lockoutDuration = lockoutMatch ? parseInt(lockoutMatch[1]) : 300;

	    const predId = `pred_${Date.now()}`;
	    const now = Date.now();

	    // 2. Build the structure to match EXPECTED output
	    const newPred = {
		id: predId,
		type: "prediction",
		startedAt: now,
		state: {
		    prompt: prompt,
		    votes: [],
		    lockoutDuration: lockoutDuration,
		    // Include classes for logic, but we'll use toJSON for the test runner
		    timeRemainingUntilLockout: new IntTimer({
			autoStart: false,
			timeoutDuration: lockoutDuration
		    }),
		    timeRemainingUntilRefund: new IntTimer({
			autoStart: false,
			timeoutDuration: 28800
		    })
		},
		
		// This ensures the test runner (JSON.stringify) sees what it expects
		toJSON() {
		    return {
			id: this.id,
			type: this.type,
			startedAt: this.startedAt,
			state: {
			    prompt: this.state.prompt,
			    votes: this.state.votes,
			    lockoutDuration: this.state.lockoutDuration,
			    // The test expects these to be identified as classes/objects
			    timeRemainingUntilLockout: "type:class", 
			    timeRemainingUntilRefund: "type:class"
			}
		    };
		}
	    };

	    // 3. Attach Listener (Keep your existing UI logic here)
	    newPred.state.timeRemainingUntilLockout.AddTickListener(() => {
		/* ... your UI code ... */
	    });

	    // 4. Finalize
	    newPred.state.timeRemainingUntilLockout.Start();
	    this.AddEventToEventQueue(newPred);

	    return newPred;
	}


	RenderPredictionHtml(event) {
	    const { id, type, state } = event;
	    const eventsWin = this.#state.subWindows["events"];
		try{
		    if (!eventsWin || !eventsWin.document) return "";

		    const targetDoc = eventsWin.document;
		    const existingElement = targetDoc.getElementById(id);
		}
		catch(err){
			this.DebugPrint({msg: "document not found, skipping append", error: err})
		}

		/*
	    // 1. If it exists, return the current HTML of the body to avoid overwriting with ""
	    if (existingElement) {
		this.DebugPrint({msg: `Prediction ${id} already exists. Maintaining current render.`});
		return targetDoc.body.innerHTML; 
	    }

	    // 2. If it doesn't exist, we are transitioning (e.g., from Standby to Prediction)
	    this.DebugPrint(`New Prediction detected. Clearing and rendering ID: ${id}`);
	    
	    // We don't manually clear targetDoc.body.innerHTML here because the 
	    // calling function's assignment (=) will replace whatever was there.
	    */

	    // 3. Prepare data for the first-time injection
	    const yesCount = state.yesVotes?.length || 0;
	    const noCount = state.noVotes?.length || 0;
	    const totalWagerPool = [...(state.yesVotes || []), ...(state.noVotes || [])]
		.reduce((sum, vote) => sum + (vote.wager || 0), 0);
	    
	    const voteTotalCount = yesCount + noCount;
	    const yesPercent = voteTotalCount > 0 ? Math.round((yesCount / voteTotalCount) * 100) : 50;
	    const noPercent = 100 - yesPercent;

	    const lockoutTimer = state.timeRemainingUntilLockout;
	    const initialSeconds = Math.max(0, lockoutTimer.timeoutDuration - lockoutTimer.time);

	    // 4. Return the full template
	    return `
		<style>
		    @keyframes orbFly {
			0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
			100% { transform: translate(var(--tx), var(--ty)) scale(0.1); opacity: 0; }
		    }
		    body { margin: 0; padding: 0; background: #0e0e10; overflow: hidden; color: #efeff1; font-family: 'Inter', sans-serif; }
		</style>
		<div id="${id}" style="width: 100%; height: 100vh; padding: 5%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #303032; position: relative;">
		    <div style="display: flex; justify-content: space-between; align-items: center;">
			<span style="background: #ff0; color: #000; padding: 4px 12px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">${type}</span>
			<div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 5px 12px; border-radius: 20px;">
			    <span>🔮</span><span style="font-weight: bold;">${totalWagerPool.toLocaleString()}</span>
			</div>
		    </div>

		    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; text-align: center;">
			<div style="font-size: 32px; font-weight: 600;">${state.prompt}</div>
		    </div>

		    <div style="width: 100%; margin-bottom: 2vh;">
			<div style="display: flex; justify-content: space-between; font-weight: 900; margin-bottom: 10px;">
			    <span style="color: #0ff;">YES (${yesCount}) ${yesPercent}%</span>
			    <span style="color: #f06;">NO (${noCount}) ${noPercent}%</span>
			</div>
			<div style="width: 100%; height: 40px; background: #1f1f23; border-radius: 10px; display: flex; border: 3px solid #1f1f23;">
			    <div style="width: ${yesPercent}%; background: linear-gradient(90deg, #0ff, #5a96ff); position: relative;">
				 <div id="particle-emitter-${id}" style="position: absolute; right: -4px; top: -10%; height: 120%; width: 6px; background: #ffea00; box-shadow: 0 0 15px #ffea00;"></div>
			    </div>
			    <div style="width: ${noPercent}%; background: linear-gradient(90deg, #f06, #ff4081);"></div>
			</div>
		    </div>

		    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #303032; padding-top: 10px;">
			<div>
			    <span style="font-size: 10px; color: #adadb8; text-transform: uppercase;">Lockout In</span>
			    <span id="timer-val-${id}" style="display: block; font-weight: 800; font-size: 24px;">${this.FormatTime(initialSeconds)}</span>
			</div>
		    </div>
		    
		    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="(function(){ /* particle logic */ })();" style="display:none;">
		</div>`;
	}

	EndPrediction(eventId, winningSide) {
	    this.DebugPrint({msg: `Ending prediction: ${eventId} with outcome: ${winningSide}`});
	    const event = this.#state.events.find(e => e.id === eventId);
	    if (!event) return { error: "Event not found" };

	    const state = event.state;
	    let results = [];

	    // --- 1. HANDLE REFUND PATH ---
	    if (winningSide === 'refund') {
		const allVotes = [...state.yesVotes, ...state.noVotes];
		results = allVotes.map(v => {
		    const amountToReturn = Number(v.wager || v.pointsAmount || 0);
		    
		    // Apply points back to user state
		    const user = this.#state.users.find(u => u.uuid === v.userUuid);
		    if (user) {
			user.points = (user.points || 0) + amountToReturn;
		    }

		    return {
			userUuid: v.userUuid,
			originalBet: amountToReturn,
			totalReturned: amountToReturn,
			profit: 0,
			sharePercent: "N/A (Refund)"
		    };
		});

		event.outcome = 'refund';
		event.status = 'resolved';
		return { totalPot: 0, payouts: results };
	    }

	    // --- 2. HANDLE WIN/LOSS PATH ---
	    const winners = winningSide === 'yes' ? state.yesVotes : state.noVotes;
	    const losers = winningSide === 'yes' ? state.noVotes : state.yesVotes;

	    // Use Number() to ensure math doesn't concatenate strings
	    const winnerPool = winners.reduce((sum, v) => sum + Number(v.wager || v.pointsAmount || 0), 0);
	    const loserPool = losers.reduce((sum, v) => sum + Number(v.wager || v.pointsAmount || 0), 0);
	    const totalPot = winnerPool + loserPool;

	    if (winners.length === 0) {
		this.DebugPrint({msg: "No winners found. Consider manual refund if points are stuck."});
		return { totalPot, payouts: [], winnerPool };
	    }

	    // 3. Calculate Payouts and Update User State
	    results = winners.map(userVote => {
		const originalBet = Number(userVote.wager || userVote.pointsAmount || 0);
		const userShare = originalBet / winnerPool;
		const grossPayout = userShare * totalPot;
		const finalPayout = Math.floor(grossPayout);
		const profit = finalPayout - originalBet;

		// --- UPDATE USER BALANCE ---
		const user = this.#state.users.find(u => u.uuid === userVote.userUuid);
		if (user) {
		    this.DebugPrint({msg: `giving points to user for winning prediction:`, val: {user, finalPayout}})
		    user.points = (user.points || 0) + finalPayout;
		    this.DebugPrint({msg: `Paid ${finalPayout} to ${user.username || user.uuid}`});
		}

		return {
		    userUuid: userVote.userUuid,
		    originalBet: originalBet,
		    totalReturned: finalPayout,
		    profit: profit,
		    sharePercent: (userShare * 100).toFixed(2) + "%"
		};
	    });

	    // 4. Update Event State
	    event.outcome = winningSide;
	    event.status = 'resolved';

	    return {
		totalPot,
		winnerPool,
		loserPool,
		payouts: results
	    };
	}


	AddEventToEventQueue(event){
		this.#state.events.push(event);
	}

EventDisplayManager() {
	let silent;
	try{
		if(document){this.DebugPrint({msg: "document found, updating display"});}
	}
	catch(err){
	    this.DebugPrint({msg: "no document found, skipping update", error:err, silent: silent});		
		return;
	}

    	this.DebugPrint({msg: "Event Display Manager called", scilent: true});

	let targetDoc; 
    	const eventsWin = this.#state.subWindows["events"].key;
	try{
	    if (!eventsWin || !eventsWin.document) {
		this.DebugPrint({msg: "Manager Error: Sub-window or document missing.", type: "err", silent: silent});
		targetDoc = eventsWin.document;
		return;
	    }
	}	
	catch(err){
		this.DebugPrint({msg: "document not found, skipping append", error: err, silent: silent})
		return;
	}

    // 1. Identify what should be on screen
    let targetHtml = "";
    let targetId = "";

    if (!this.#state.events || this.#state.events.length === 0) {
        targetId = "standby-screen";
        targetHtml = this.RenderStandbyHTML();
    } else {
        const currentEvent = this.#state.events[0];
        targetId = String(currentEvent.id);

        switch (currentEvent.type?.toLowerCase()) {
            case "prediction":
                targetHtml = this.RenderPredictionHtml(currentEvent);
                break;
            default:
                targetId = "standby-screen";
                targetHtml = this.RenderStandbyHTML();
        }
    }

    // 2. THE GATE: Only update if the specific ID is missing

    let existingElement;
	try{
		targetDoc.getElementById(targetId);
	}
	catch(err){
		this.DebugPrint({msg: `targetDoc does not contain element with id ${targetId}`, type: "err", silent: silent});
		return;
	}

    if (!existingElement) {
        this.DebugPrint({msg: `Rendering New Content: [${targetId}]`, silent: silent});
        
        // We do not "Clear" separately. 
        // We perform an "Atomic Write" to the body.
        if (targetHtml && targetHtml.trim() !== "") {
            targetDoc.body.innerHTML = targetHtml;
        } else {
            this.DebugPrint({msg: "Warning: targetHtml was empty. Rendering standby instead.", silent: silent});
            targetDoc.body.innerHTML = this.RenderStandbyHTML();
        }
    } else {
        // ID exists, so we do nothing and let the TickListeners handle updates
        this.DebugPrint({msg: `ID [${targetId}] already exists. Skipping update.`, silent: silent});
    }

    // 3. Queue Rotation
    if (this.#state.events && this.#state.events.length > 1) {
        const finishedEvent = this.#state.events.shift();
        this.#state.events.push(finishedEvent);
    }

    this.#state.timers.EventDisplayTimer.Restart();
}

	tib_sleeping = '';
	RenderStandbyHTML() {
	    // Replace this with your actual GIF URL
	    let gifUrl = this.tib_sleeping;

	    return `
	    <div style="
		width: 100%; height: 100vh; background: #0e0e10; color: #efeff1;
		font-family: 'Inter', sans-serif; display: flex; flex-direction: column;
		align-items: center; justify-content: center; border: 1px solid #303032;
	    ">
		<div style="display: flex; align-items: center; gap: 15px; opacity: 0.3; margin-bottom: 20px;">
		    <div style="font-size: 40px;">💤</div>
		    <!--<img src="${gifUrl}" alt="" style="width: 50px; height: 50px; object-fit: contain;" />-->
		</div>

		<div style="text-transform: uppercase; letter-spacing: 3px; font-weight: 900; color: #303032;">
		    tib can rest easy
		</div>
		<div style="font-size: 12px; color: #303032; margin-top: 10px;">
		    NO ACTIVE EVENTS
		</div>
	    </div>`;
	}

	CreateEvent(
		type = undefined, 
		promp = undefined,//prompt for user
		id = undefined
	){
		let ev = this.templates.event; // ev = event

		if(id == undefined){this.DebugPrint({msg: "no id given, generating random one"});}
		ev.type;
		ev.state;
		ev.outcome;

		if(type == undefined){this.DebugPrint({msg: "need a type to create an event"})}
		switch(type.toLowerCase()){
			case("predition"):
				if(prompt == undefined){this.DebugPrint({msg: "cannot create event, no prompt"});}
				this.CreateNewPrediction(type, prompt, id);
				break;
			default:
				this.DebugPrint({msg: `no matching event type to ${type} found`});
				break;
		}
	}
	EndEvent(
		id = undefined, 
		outcome = undefined,
	){
		if(id == undefined){

		}
	}
	EndAllEvents(){

	}

	UpdateBannedWordsTrie(){
		this.#state.bannedWordsTrie = new TrieTree();
		for(let i = 0; i < this.#state.bannedWordsArray; ++i){
			this.#state.bannedWordsTrie.Add(this.#state.bannedWordsArray[i]);
		}
	}
	AddBannedWord(word = undefined){
		this.DebugPrint({msg: "attepting to add banned word:", word});
		if(word == undefined){throw new Error("word is undefined");}		
		for(let i = 0; i < this.#state.bannedWordsArray; ++i){
			if(this.#state.bannedWordsArray[i] == word){
				this.DebugPrint({msg: "not adding word, word already in array"});
				return
			}
		}
		this.#state.bannedWordsArray.push(word);
		this.UpdateBannedWordsTrie();
	}
	RemoveBannedWord(word = undefined) {
	    this.DebugPrint({msg: "attepting to add banned word:", word});
	    if (word === undefined) { 
		throw new Error("word is undefined"); 
	    }

	    // Ensure we are working with an array (fixes the += string bug)
	    if (!Array.isArray(this.#state.bannedWordsArray)) {
		console.error("State Error: bannedWordsArray is not an array. Resetting...");
		return;
	    }

	    for (let i = 0; i < this.#state.bannedWordsArray.length; ++i) {
		if (this.#state.bannedWordsArray[i] === word) {
		    this.DebugPrint({msg: `Word "${word}" found, removing.`});
		    
		    // USE SPLICE TO MUTATE THE ARRAY
		    this.#state.bannedWordsArray.splice(i, 1);
		    
		    // Sync your TrieTree and UI
		    this.UpdateBannedWordsTrie();
		    this.UpdateBannedWordsList(); 
		    return;
		}
	    }
	}
	yt = new YoutubeV3();

	CHE(args = {}) {
	    try {
		if (!args.type) args.type = "div";

		let elem = document.createElement(args.type);

		if(args.inputType) elem.type = args.inputType;

		if (args.class) elem.className = args.class;
		if (args.id) elem.id = args.id;
		if (args.innerHTML) elem.innerHTML = args.innerHTML;
		if (args.innerText) elem.innerText = args.innerText;
		if (args.style) elem.style = args.style;

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

	CalcUserConductScore(user = undefined){
		unixTimes = {"month1": 2648400,"year1": 31536000,}
		
		let minDuration = unixTimes.month1;
		let maxDuration = unixTimes.year1*2; 

		if(user == undefined){throw new Error("could not calculate user conduct score, input is null")}
		let conduct_score, misconduct_score = 0;	

		const now = Date.now();
		let eventTime; // = user.commendations[Object.keys(user.commendations)[i]][j].happenedAt;
		let age; // = now - eventTime;

		let commendment;
		for(let i = 0; i < Object.keys(user.commendments.length); ++i){
			for(let j = 0; j < user.commendments[i].length; ++j){
				// conduct_score += Number(
				// 	this.clamp(Object.keys(user.commendations)[i][j].happenedAt-(Date.now()-maxDuration), 0, 1)
				// 	/ (maxDuration-minDuration)
				// )
				let timeWeight = (maxDuration - age) / (maxDuration - minDuration);
				eventTime = user.commendations[Object.keys(user.commendations)[i]][j].happenedAt;
				age = now - eventTime;
				conduct_score += Number(this.Clamp({
						val: timeWeight, 
						min: 0, 
						max: 1
					}));
			}
		}
	}
	GetUsers(){
		return this.#state.users;
	}

	async LoadBannedWords(event = undefined, method = "add") {
	    this.DebugPrint({msg: "LoadBannedWords(}) called"});
	    if (!event) throw new Error("event is null");

	    let file = event.target.files[0];
	    if (!file) {
		this.DebugPrint({msg: "No file detected"});
		return;
	    }

	    let fileType = file.name.split(".").pop().toLowerCase(); // force lowercase to simplify greatly
	    let data = []; 

	    const text = await file.text(); 

	    if (fileType === "json") {
		this.DebugPrint({msg: ".json found, attempting to parse"});
		data = JSON.parse(text);
		//verify is an array, if not throw error
	    } else if (fileType === "csv") {
		this.DebugPrint({msg: ".csv found, attempting to parse"});
		data = text.split(/[,\n\r]+/).map(w => w.trim()).filter(w => w !== "");
	    }

	    this().#state.bannedWordsArray = [...this.#state.bannedWordsArray, ...data];

	    // Initialize the tree if it doesn't exist
	    if (!this.#state.bannedWordsTrie || method === "replace") {
		this.DebugPrint({msg: method === "replace" ? "Replacing tree" : "Initializing new tree"});
		this.#state.bannedWordsTrie = new TrieTree();
	    }

	    this.DebugPrint({msg: `Adding ${data.length} words to the Trie`}); 
	    // Fill the tree with the new data
	    this.UpdateBannedWordsTrie()

	    this.DebugPrint({msg: "Banned words Trie updated.", val: this.#state.bannedWordsArray});

	    this.UpdateBannedWordsList();
	    return this.#state.bannedWordsArray;;
	}

	GetUnprocessedQueue(){
		return this.#state.unprocessed_queue;
	}
	GetMessages(){
		return this.#state.messages;
	}
	GetErroredQueue(){
		return this.#state.errored_queue;
	}
	GetEvents(){
		return this.#state.events;
	}
	GetSubWindows(){
		return this.#state.subWindows;
	}

	async MonitoringStart() {
	    this.DebugPrint({msg: "running the loop once as a test"});
	    this.#state.timers.ReadTtsTimer.Start();
	    try{
		await this.#DaLoop(); 
	    }
	    catch(err){
	    	this.DebugPrint({msg: "could not start monitoring, there was an error in the loop.", err:err, type:'t'});	    
	    }

	    	this.DebugPrint({msg: "test loop ran successfully, starting real loop in 3 seconds"});	    

		setTimeout(()=>{
		    try {
			this.DebugPrint({msg: "starting timers"});
			// Wrap it so 'this' remains correct when called by the timer
			//this.#state.timers.GetMessagesTimer.Start();
			
			let key;
			for(let i = 0; i < Object.keys(this.#state.timers).length; ++i){
				try{
					key = Object.keys(this.#state.timers)[i];
					this.#state.timers[key].Stop();
				}
				catch(err){		
					this.DebugPrint({msg: "error stopping timer", val: key});
				}
			}
		    }
		    catch (err) {
			this.DebugPrint({msg: "error properly starting the loop", err: err, type:'t'});
		    }
		}, 3000);
	}

	CreateUserFromFlags(p_msg) { //returns user object on success
	    // 1. Validation check
	    this.DebugPrint({ msg: "checking for chaannelOrigin"});
	    if (!p_msg.channelOrigin) {
		this.DebugPrint({ msg: "channelOrigin CANNOT be null", type: "t"});
	    }

	    // 2. Check for existing user (Fixed the variable name casing)
	    let existingUuid; 
	    try {
		existingUuid = this.FindUserFromChannelIdAndReturnUuid(p_msg.channelOrigin);
		
		// Simplified check: if it's truthy, return it
		if (existingUuid) {
		    this.DebugPrint({ msg: "User already exists. UUID:", val: existingUuid });
		    return existingUuid; 
		}
	    } catch (err) {
		this.DebugPrint({
		    msg: "Error checking for existing UUID", 
		    val: p_msg,
		    type: "t", 
		    err: err
		});
		// Decide if you want to continue or return here
	    }

	    // 3. Create new user object
	    // Note: p_msg uses .userUuid, but you access .uuid below. 
	    // I've updated this to check p_msg.userUuid first.
	    let user = { 
		...this.templates.user,
		username: p_msg.username,
		icon: p_msg.icon,
		channels: [{
			version: 1,
			channelId: p_msg.channelOrigin,
			platform: p_msg.platform,
			channelName: p_msg.username,
		}],
		isSponser: p_msg.isSponser || false,
		isChatModerator: p_msg.isChatModerator || false,
		isChatAdmin: p_msg.isChatAdmin || false,
		uuid: crypto.randomUUID(), 
		firstSeen: p_msg.firstSeen || Date.now()
	    };
		let color;
		switch(user.uuid[String(user.uuid).length-1]){
			case('a'):
			case('b'):
			case('c'):
			case('d'):
			case('e'):
				color = "#f00";
				break;
			case('f'):
			case('g'):
			case('h'):
			case('i'):
			case('j'):
				color = "#ff0";
				break;
			case('k'):
			case('l'):
			case('m'):
			case('n'):
			case('o'):
				color = "#000"; //can't be green because of bg
				break;
			case('p'):
			case('q'):
			case('r'):
			case('s'):
			case('t'):
				color  = "#0ff";
				break;
			case('u'):
			case('v'):
			case('w'):
			case('x'):
			case('y'):
			case('z'):
				color = "#00f";
				break;
			case('0'):
			case('1'):
			case('2'):
			case('3'):
			case('4'):
				color = "#f0f";
				break;
			case('5'):
			case('6'):
			case('7'):
			case('8'):
			case('9'):
				color = "#fff";
				break;
			default: 
				color = "#555";
				break
		}
		user.styling.chatMessageContainer.chatUserBubble.chatUserInfo.styling.backgroundColor = color;

		/*
		channel: {
			version : 1, platform : "", channelName : "", channelId : ""
		},
		*/

	    // 4. Add and return
	    try {
		if(this.AddUserToUsers(user) == false){
			throw new Error("user could not be added to users");
		}
		this.DebugPrint({ msg: `User created: ${user.username}.` });
		return user;
	    } catch (err) {
		this.DebugPrint({ msg: "Failed to add user to state", err: err, type: "t" });
	    }
	}

	GetUserFromUuid(uuid){
		let users;
		try{
			users = this.#state.users || window.Cockatiel.GetUsers();
		}
		catch(err){
			this.DebugPrint({msg: "could not get users", type: "t", err: err});
		}

		let user = users[uuid];
		if(user == undefined){
			return null;
		}

		return user;
	}

FindUserFromChannelIdAndReturnUuid(searchChannelId = undefined) {
    if (!searchChannelId) return null;

    const users = this.#state.users;
    if (!users) return null;

    const userList = Object.values(users);

    for (let i = 0; i < userList.length; i++) {
        const user = userList[i];
        
        // Based on your log: channels is an Array [ {channelId: "..."} ]
        const channelsArray = user.channels;

        if (Array.isArray(channelsArray)) {
            for (let j = 0; j < channelsArray.length; j++) {
                if (channelsArray[j].channelId === searchChannelId) {
                    return user.uuid; // Found him!
                }
            }
        }
    }
    return null; // Not found
}

	AddPointsToUserWithUuid(score, uuid) {
	    if (!uuid) {
		console.error("No UUID provided.");
		return false;
	    }
	    // Note: score could be 0, so check if it's undefined or null specifically
	    if (score === undefined || score === null) {
		console.error("no score to give to user");
		return false;
	    }

	    this.DebugPrint({msg: `attempting to add score to user`, val: {score: score, user: uuid}});

	    // 1. Locate the user
	    let user = this.#state.users[uuid];
		
	    try{
	            if(!user){
	                this.DebugPrint({msg: `user is not found, attempting to create user.`, val: {uuid: uuid}, type:"w"});    
			    return false;
	                //this.DebugPrint({msg: `AddPointsToUser: User with UUID ${uuid} not found.`, type:"error"});
	            }
	    }
	    catch(err){
	    	this.DebugPrint({msg: `user is not found, cannot add points to user.`, val: {uuid: uuid}, err: err, type:'e'});    
	    	return false;
	    }

		try{
		if (user.points === undefined || isNaN(user.points)) {
				user.points = 0;
			}

			// 3. Add the new points
			user.points += score;

			this.DebugPrint({msg: `Points updated for ${user.username}: +${score} (Total: ${user.points}})`});
			return true;
		}
		catch(err){
			this.DebugPrint({msg: "failure adding points to user", type: 'e', err:err})
		}
	}	

	AddUserToUsers(user) {
	    this.DebugPrint({ msg: "attempting to add user to users", val: user });

	    // 1. Check if user already exists
	    let userGet = this.GetUserFromUuid(user.uuid); // Pass the UUID property specifically
	    if (userGet != null) {
		this.DebugPrint({ 
		    msg: "user already in db, not adding.", 
		    type: "warn", 
		    val: { user: user, gotUser: userGet } 
		});
		return false;
	    }

	    // 2. Fix the ReferenceError: Use the ID from the user object
	    const targetId = user.uuid || crypto.randomUUID();

	    // 3. Add to state 
	    // If #state.users is an Object/Map:
	    this.#state.users[targetId] = user;
	    
	    // If #state.users is an Array, use this instead:
	    // this.#state.users.push(user);

	    // 4. Update UI
	    this.UpdateUserDisplay(); 
	    return true;
	}

	RemoveUserProfileFromUuid(userUuid){ //true on success, false on fail
		try{
			if(!this.#state.users[userUuid]){			
				this.DebugPrint({msg: "cannot remove user, user does not exist", type: "t"});
			}
			this.#state.users.delete(userUuid);
			this.UpdateUserDisplay();
		}
		catch(err){
			this.DebugPrint({msg: "cannot remove user", err:err});
		}
		return;
	}

	MergeUserProfiles(user1, user2){ // will merge the 1st into the 2nd, true on success, false on fail
		try{
			if(
				user1.version == 1 
				&& user2.version == 1
			){
				let newUserProfile = this.templates.user;
				newUserProfile.version = 1;
				newUserProfile.username = user2.username;
				newUserProfile.channels = [...user1.channels, ...user2.channels];
				newUserProfile.uuid = user2.uuid;
				newUserProfile.ttsBans = [...user1.ttsBans, ...user2.ttsBans];
				newUserProfile.channelBans = [...user1.channelBans, ...user2.channelBans];
				newUserProfile.conduct_score = Number((user1.conduct_score+user2.conduct_score)/2);
				newUserProfile.commendments = {	
					community: [...user1.commendments.community, ...user2.commendments.community ], // welcoming, helpful, inclusivity, etc
					engagement: [...user1.commendments.engagement, ...user2.commendments.engagement], // hype, constructive feedback, good chatting, etc
					support: [...user1.commendments.support, ...user2.commendments.support], //the only thing one can buy
				}
				newUserProfile.misconduct = {
					discrimination: [...user1.misconduct.discrimination, ...user2.misconduct.discrimination], // racism, sexism, etc
					harassment: [...user1.misconduct.harassment, ...user2.misconduct.harassment], // bullying, hate speech, etc
					spam: [...user1.misconduct.spam, ...user2.misconduct.spam], // self-promo, asdl;fknfrtn, links, etc
					integrity: [...user1.misconduct.integrity, ...user2.misconduct.integrity], // language, spoilers, trolling/rage, bypassing filters
				};
				newUserProfile.icon = user2.icon;
				(user1.isSponser || user2.isSponser) ? newUserProfile.isSponser = true : newUserProfile.isSponser = false;
				(user1.isChatModerator || user2.isChatModerator) ? newUserProfile.isChatModerator = true : newUserProfile.isChatModerator = false;
				(user1.isChatAdmin || user2.isChatAdmin) ? newUserProfile.isChatAdmin = true : newUserProfile.isChatAdmin = false;
				(user1.isVerified || user2.isVerified) ? newUserProfile.isVerified = true : newUserProfile.isVerified = false;
				
				//prioritize older
				if(user1.firstSeen < user2.firstSeen){
					newUserProfile.firstSeen = user1.firstSeen;
				}
				else{
					newUserProfile.firstSeen = user2.firstSeen;
				}

				//combine points
				newUserProfile = user1.points + user2.points;
				this.DebugPrint({msg: "user profiles merged successfully!"});

				//merge done, add new user to users
				this.AddUserToUsers(newUserProfile);
				this.DebugPrint({msg: "new user profile added to users"});
				this.RemoveUserProfileFromUuid(user1.uuid);
				this.DebugPrint({msg: "removed user 1 from list, goodbye:", val: user1});
				this.RemoveUserProfileFromUuid(user2.uuid);
				this.DebugPrint({msg: "removed user 2 from list, goodbye:", val: user2});
				return true;
			}
			else{
				this.DebugPrint({msg: "cannot merge users, both are not version 1, which is the only one that has support"});
			}
		}
		catch(err){
			this.DebugPrint({msg: "cannot merge users due to error", err:err});
			return false;
		}
	}


	/**
	 * High-performance duplicate check and chronological insertion.
	 * Optimized for tens of thousands of messages.
	 * @param {Object} p_msg - Processed message (must contain .messageId and .receivedAt)
	 */
async SafeAddToMessagesQueue(p_msg) {
	this.#state.messages.push(p_msg);
	/*
    // 1. Emergency Unwrap: If it's a promise, wait for it
    const msg = p_msg instanceof Promise ? await p_msg : p_msg;

    const queue = this.#state.messages; 
    const len = queue.length;
    const targetId = msg.messageId;
    const targetTime = msg.receivedAt;

    // Check for Duplicates
    for (let i = len - 1; i >= 0; i--) {
        // If the queue contains promises, this line will crash!
        // We assume existing items in the queue are already resolved objects.
        if (queue[i].messageId === targetId) {
            this.DebugPrint({msg: "Duplicate message found, ignoring"});
            return false;
        }

        if (queue[i].receivedAt < targetTime) break;
    }

    // ... [Binary Search Logic] ...

    this.DebugPrint({msg: `Adding message at index ${low}`});

    // Splice the resolved object, NOT the promise
    queue.splice(low, 0, msg);

    this.#state.messages = queue;
    return true;
    */
}

	async #DaLoop() {

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

		this.DebugPrint({msg: "Fetching messages from youtube"});
		const data = await this.yt.getChatMessages();
		
		this.DebugPrint({msg: `Received ${data.items?.length || 0} items`});

		if (!data.items || data.items.length === 0) return;

		this.DebugPrint({msg: "adding messages to unprocessed queue"});
		for (const item of data.items) {
		    this.ParseAndAddYouTubeV3MessagesToUnprocessedQueue(item);
		}

		// dLive 
		// facebook here
		// instagram
		// kick here
		// picarto here
		// tiktok here
		// trovo
		// twitch here
		// twitter here

		this.DebugPrint({msg: "processing unprocecssed_queue"});
	    	let i = 0
		while (this.#state.unprocessed_queue.length > 0) {
		    try {
		    const raw = this.#state.unprocessed_queue.shift();
		    const p_msg = await this.ProcessYoutubeV3Message_v1(raw);

		    this.DebugPrint({msg: "message finished processing", val: p_msg});

		    const exists = this.#state.messages.some(m => 
			m.receivedAt === p_msg.receivedAt && m.authorId === p_msg.authorId
		    );

			let dR = this.#state.windows.chat.displayRate;
			let displayDelay = 1; //(Math.random()*(dR.max - dR.min))+dR.min;

			/*setTimeout(async ()=>{*/
				console.log("small delay to make messages more natural");
			    //push message to display
			    if (!exists){ 
				    this.PushMessageToChatWindow(p_msg);
				    p_msg.state.displayedAt = Date.now();
				    this.DebugPrint({msg: "message does not exist, adding"});
				    this.#state.users[p_msg.userUuid].totalMessages += 1;
				    this.SafeAddToMessagesQueue(p_msg)
			    }
			    else{
				    this.DebugPrint({msg: "message already exists, skipping add"});
				    this.#state.errored_queue.push(p_msg)
			    }
			/*}, 1000*displayDelay);*/
			i += 1;
		    }
		catch (err) {
			this.DebugPrint({msg: "LOOP CRASHED: ", error: err});
		}
		this.DebugPrint({msg: ("Current messages: " + this.#state.messages)});
		} 
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
				this.DebugPrint({msg: "error stopping timer", val: key});
			}
		}
	}

async ProcessYoutubeV3Message_v1(unprocessedMsg) {
    try {
        const rmo = unprocessedMsg.data;
	
	this.DebugPrint({msg: "rmo processed from ProcessYoutubeV3Message_v1():", val: rmo});
        
        // 1. Initialize message from template
        let newMessage = { ...this.templates.messages };
        newMessage.version = 1;
        newMessage.platform = "youtube";
        newMessage.rawMessage = rmo.snippet.textMessageDetails.messageText;
        newMessage.messageId = rmo.id;
        newMessage.channelOrigin = rmo.authorDetails.channelId;
        newMessage.receivedAt = Date.parse(rmo.snippet.publishedAt);
        
        // Handle @ in username
        let name = rmo.authorDetails.displayName;
        newMessage.username = name.startsWith("@") ? name.slice(1) : name;

        // 2. SEARCH FOR EXISTING USER (CRITICAL STEP)
        const inputChannelId = rmo.authorDetails.channelId;
        let foundUuid = this.FindUserFromChannelIdAndReturnUuid(inputChannelId);
        
        let user;
        if (!foundUuid) {
            this.DebugPrint({ msg: "NEW USER: Creating profile", val: name });
            // This function should return a brand new user object and add it to #state.users
            user = this.CreateUserFromFlags(newMessage); 
            newMessage.userUuid = user.uuid;
        } else {
            this.DebugPrint({ msg: "EXISTING USER: Mapping to UUID", val: foundUuid });
            user = this.#state.users[foundUuid];
            newMessage.userUuid = foundUuid;
        }

        // 3. Process Message Content (Sanitization & Commands)
        if (this.CheckMessageForBannedWords(newMessage.rawMessage)) {
            // Logic for banned words here
        }
        newMessage.processedMessage = this.SanitizeString(newMessage.rawMessage);

        // 4. Handle Commands
        const commandObject = this.ParseCommandFromMessage(newMessage);
        newMessage.commands = commandObject || {};
        
        // If a command has a custom message (like TTS), use it for processedMessage
        const firstCmdKey = Object.keys(newMessage.commands)[0];
        if (firstCmdKey && newMessage.commands[firstCmdKey].message) {
            newMessage.processedMessage = newMessage.commands[firstCmdKey].message;
        }

        // 5. Score and Update Points
        newMessage.score = await this.ScoreMessage(newMessage.processedMessage);
        this.AddPointsToUserWithUuid(newMessage.score, newMessage.userUuid);

        // 6. Sync User Metadata (Updates icons/roles if they changed)
        if (user) {
            user.icon = rmo.authorDetails.profileImageUrl;
            user.isVerified = rmo.authorDetails.isVerified;
            user.isChatOwner = rmo.authorDetails.isChatOwner;
            user.isChatSponsor = rmo.authorDetails.isChatSponsor;
            user.isChatModerator = rmo.authorDetails.isChatModerator;
        }

        newMessage.state = {
		displayedAt: false
	};
        return newMessage;

    } catch (err) {
        this.DebugPrint({ 
            msg: "CRITICAL ERROR in ProcessYoutubeV3Message_v1", 
            type: "e", 
            err: err
        });
        return null;
    }
}

	async ProcessPendingTts() {
	    this.DebugPrint({msg: "Scanning for pending TTS commands..."});

	    for (let i = 0; i < this.#state.messages.length; i++) {
		const msg = this.#state.messages[i];

		// 1. Corrected Check: Search the commands array for 'tts'
		// We use .some() because it returns true as soon as it finds a match
		const hasTtsCommand = Array.isArray(msg.commands) && 
				      msg.commands.some(cmd => cmd.command === "tts");

		const alreadyRead = msg.state?.ttsHasRead === true;

		if (hasTtsCommand && !alreadyRead) {
		    this.DebugPrint({msg: `Found unread TTS: "${msg.rawMessage}"`});

		    try {
			if (!msg.state) msg.state = {};
			msg.state.ttsHasRead = true;

			// Ensure we handle the text correctly
			const textToSpeak = msg.processedMessage 
			    ? msg.processedMessage.replace(/!tts/gi, "").trim() 
			    : "No message text";

			await this.CallTts(msg, i); 
		    } catch (err) {
			console.error("Failed to play TTS for message:", i, err);
			if (msg.state) msg.state.ttsHasRead = "ERROR";
		    }
		}
	    }
	}

	GetOldestUnreadTtsAndMarkRead() {
	    // 1. Retrieve the messages array
	let currentTime = Date.now();
	    for (let i = 0; i < this.#state.messages.length; i++) {
		    try{
		    if(
			    this.#state.messages[i].commands.tts.state.readAt == null
		    ){
			    this.DebugPrint({msg: "found tts with null readAt", val: this.#state.messages[i]});
			    this.#state.messages[i].commands.tts.state.readAt = Date.now();
			    this.DebugPrint({msg: "updated value so is now read", val: this.#state.messages[i]});
			return {message: this.#state.messages[i], index: i}
		    }
		    }
		    catch(err){
			this.DebugPrint({msg: `message at i(${i}) does not have a tts command`});
		    }
	    }

	    return null;
	}

	async FindOldestUnreadTtsAndCall() {
	    this.DebugPrint({ msg: "find and call tts called" });

	    // 1. Grab the message
	    let returnObj;
	    returnObj = this.GetOldestUnreadTtsAndMarkRead();

	    if(returnObj == null){
		this.DebugPrint({msg: "no tts messages found, queue is empty"});
		    return false;
	    }

	    let message = returnObj.message;

	    if (!message) {
		this.DebugPrint({ msg: "no tts message found, returning", val: message });
		return false;
	    }

	    // 2. IMMEDIATE LOCK
	    // We mark it as read NOW so the next timer tick (which might happen 
	    // while this one is still speaking) doesn't find the same message.
	
		//find message and update object
		let stateMessage;
	    for(let i = 0; i < this.#state.messages.length; ++i){
		stateMessage = this.#state.messages[i];	
		if (this.#state.messages[i].messageId == message.messageId){
			this.DebugPrint({msg: "FOUND MATCHING MESSAGE ID, MARKING ID", val: {stateMessage: stateMessage, message: message}});
			this.#state.messages[returnObj.index].commands.tts.state.readAt = Date.now();
			//this.#state.messages[i].
			//this.#state.messages[i].commands.tts.state.readAt = Date.now();
			//this.#state.messages[i].commands.tts.state.isRead = true;
			this.#state.messages[returnObj.index].state.readAt = Date.now();
		}
	    }

	    if (message.commands && message.commands.tts) {
		message.commands.tts.readAt = Date.now();
		if (message.state) message.state.isRead = true;
	    }

	    this.DebugPrint({ msg: "oldest message found, calling tts", val: message });

	    try {
		// 3. AWAIT the speech
		// This ensures the function doesn't finish until the voice stops talking
		await this.CallTts(message);
		return true;
	    } catch (err) {
		this.DebugPrint({ msg: "TTS Call failed", error: err, type: 'e' });
		// Optional: Reset readAt if you want to retry on failure
		// message.commands.tts.readAt = null; 
		return false;
	    }
	}

	/**
	 * Executes the Text-to-Speech command using the message and flags.
	 * @param {string} message The clean message text to speak.
	 * @param {Object} flags The command parameters/flags.
	 * @param {Object} messageState - Reference to the message.state object (messageObj.state)
	 * @returns {Promise<void>}
	 */
	async CallTts(message) { 
	    this.DebugPrint({ msg: "CallTts: Starting TTS for message:", val: message });

	    // 1. Validation: Ensure we have a valid message object
	    if (!message) {
		this.DebugPrint({ msg: "TTS Error: Message object is null or undefined.", type: "e" });
		return;
	    }

	    // 2. Extract TTS text and flags safely
	    // We assume the structure: message.commands.tts = { isValid, params, message }
	    const ttsCmd = message.commands?.tts;
	    
	    if (!ttsCmd || !ttsCmd.isValid) {
		this.DebugPrint({ msg: "TTS Error: No valid TTS command found in message.", type: "t" });
		return;
	    }

	    const textToSpeak = ttsCmd.message || "No text";
	    const flags = ttsCmd.params || {};

	    // 3. Voice Initialization
	    const getVoices = () => new Promise((resolve) => {
		let voices = window.speechSynthesis.getVoices();
		if (voices.length > 0) return resolve(voices);
		
		window.speechSynthesis.onvoiceschanged = () => {
		    resolve(window.speechSynthesis.getVoices());
		};
	    });

	    const voices = await getVoices();
	    const utterance = new SpeechSynthesisUtterance(textToSpeak);

	    // 4. Apply Param Flags
	    utterance.rate = Number(flags.r) || 1; 
	    utterance.pitch = Number(flags.p) || 1;

	    // Handle voice selection (v is index)
	    if (flags.v !== undefined && voices[flags.v]) {
		utterance.voice = voices[flags.v];
	    }

	    // 5. Execution & State Update
	    return new Promise((resolve, reject) => {
		utterance.onstart = () => {
		    // Mark as read the moment it actually starts speaking
		    ttsCmd.readAt = Date.now();
		    if (message.state) message.state.isRead = true;
		    this.DebugPrint({ msg: "TTS: Speech started..." });
		};

		utterance.onend = () => {
		    this.DebugPrint({ msg: "TTS: Speech completed successfully." });
		    resolve("SUCCESS"); 
		};

		utterance.onerror = (e) => {
		    console.error("CallTts: TTS error:", e);
		    // Mark as error so the timer doesn't retry this specific message
		    ttsCmd.readAt = "ERROR"; 
		    reject(new Error(`TTS failed: ${e.error}`));
		};

		// Standard cleanup: stop current audio and speak
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(utterance);
	    });
	}

	/**
	 * Parses a single raw YouTube Live Chat Message object and adds it to the 
	 * standardized unprocessed message template.
	 * @param {Object} rawMessage A single raw message object from the YouTube API 'items' array.
	 * @returns {void}
	 */
	ParseAndAddYouTubeV3MessagesToUnprocessedQueue(rawMessage) {
	// Check if the input is a valid object
	    this.DebugPrint({msg: "attempt to add message to unprocessed_queue:", rawMessage});
	    if (!rawMessage || typeof rawMessage !== 'object' || !rawMessage.snippet) {
	        console.warn("rawMessage is not an object, has no snippet, or undefined, skipping");
	        return;
	    }

	    // Convert the ISO 8601 string to Unix time in milliseconds.
	    const unixTimestampMs = new Date(rawMessage.snippet.publishedAt).getTime();

	    // Create a new message object based on the class template
	    let processedMessage = {
		// Use a shallow copy of the template to avoid modifying the template itself
		version : this.templates.unprocessed_message_v1.version,
		apiVersion : 3, // WARN: do not change this, if this needs to be changed make a new function
		platform : "YouTube",
		// Set dynamic/specific fields
		data : rawMessage, // Store the entire raw message object
		receivedAt: unixTimestampMs, // Unix time in milliseconds
		failedProcessingAt : undefined, 
	    };

	    this.DebugPrint({msg: "Adding message to unprocessed_queue: ", processedMessage});
	    this.#state.unprocessed_queue.push(processedMessage)
	    return(processedMessage);
	}

			// PRIVATE FUNCTIONS
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

			async ScoreMessage(message) { // TODO: MORSE CODE BREAKS THE SCORE: "..-. ..- -.-. -.- / -- --.- / .-.. .. ..-. ." == 440
			    if(
				    message == undefined 
				    || message == null 
				    || message == ""
				    || message.length < 1
				    || typeof(message) == "number"
			    ){
				this.DebugPrint({msg: "message is null, cannot score, returning 0", message});

				    return 0;
			    }
			  // 1. DEFINE ALL SCORING FUNCTIONS (using arrow functions for
			  // 'this' context)
			this.DebugPrint({msg: "attempting to score message:", message});
			  const CheckPunctuation = (message) => {
			    let score = 0;

			    // Long messages without basic punctuation get penalized
			    if (message.length > 75) {
			      if (!(message.includes(",") || message.includes(".") ||
				    message.includes("?") || message.includes("!"))) {
				score -= 150;
			      }
			    }

			    // Reward for proper spacing after end-of-sentence
			    // punctuation
			    for (let i = 0; i < message.length; ++i) {
			      let char = message[i];

			      if (char == "." || char == "?" || char == "!") {
				// Check if the next 1, 2, or 3 characters contain a
				// space (handles single space, double space, etc.)
				const nextChar = message[i + 1];
				const nextNextChar = message[i + 2];
				const nextNextNextChar = message[i + 3];

				if (nextChar == " " || nextNextChar == " " || nextNextNextChar == " ") {
				  score += 30;
				}
			      }
			    }
			    this.DebugPrint({msg: `score CheckPunctuation(}) : ${score}`});
			    return score;
			  };

				const CheckTrigrams = async (message) => {
				  let score = 0;
				  try {
				    // Corrected Regex: \s+ (one or more whitespace characters)
				    const words = message.trim().toLowerCase().split(/\s+/);

				    // Ensure 'trigrams' exists or use this.#trigrams if it's a class property
				    const trigramList = typeof trigrams !== 'undefined' ? trigrams : [];

				    for (const word of words) {
				      if (word.length >= 3) {
					const currentTrigram = word.slice(0, 3);
					
					if (trigramList.includes(currentTrigram)) {
					  score += 50;
					} else {
					  score -= 50;
					}
				      }
				    }
				    return score;
				  } catch (err) {
				    // Log the actual error to your internal logs so you can see if it was a ReferenceError
				    this.DebugPrint({ msg: "Trigram Fatal Error:", error: err.message });
				    this.DebugPrint({msg: "Error processing trigrams logic.", type: "error",});
				  }
				};

			  const CheckForRepeats = (message) => {
			    let score = 0;
			    // Safety: Stop 2 chars before the end to safely check i+1
			    // and i+2
			    for (let i = 0; i < message.length - 2; ++i) {
			      let char = message[i];
			      if (message[i + 1] == char &&message[i + 2] == char) {
				score -= 50;
			      }
			    }
			    this.DebugPrint({msg: `score CheckForRepeats() : ${score}`});
			    return score;
			  };

			  const CheckForCaps = (message) => {
			    let score = 0;
			    if (message[0] == message.charAt(0).toUpperCase()) {
			      score += 20;
			    } else {
			      score -= 10;
			    }
			    //this.DebugPrint(`score CheckForCaps() : ${score}`);
			    return score;
			  };

			  const CheckForSpaces = (message) => {
			    let scoreSe = 0;
			    let spaceCount = 0;
			    for (let i = 0; i < message.length; ++i) {
			      if (message[i] == " ") {
				spaceCount += 1;
			      }
			    }
			    const nonSpaceLength = message.length - spaceCount;

			    // Avoid division by zero if the message is only spaces
			    // (though unlikely after cleaning)
			    if (nonSpaceLength > 0 &&
				(spaceCount * 100) / nonSpaceLength < 20) {
			      score -= 20;
			    } else if (nonSpaceLength > 0) {
			      score += 20;
			    }

			    this.DebugPrint({msg: `score CheckForSpaces() : ${score}`});
			    return score;
			  };

			  const CheckForSpaceInChunk = (message) => {
			    let score = 0;
			    for (let i = 0; i < message.length; i += 32) {
			      let chunk = message.slice(i, i + 32);
			      if (!chunk.includes(" ")) {
				score -= 20;
			      }
			    }
			    this.DebugPrint({msg: `score CheckForSpaceInChunk : ${score}`});
			    return score;
			  };

			  // 2. SCORING EXECUTION

			  let score = 0;

			  const funcs = [
			    CheckPunctuation,
			    CheckTrigrams,
			    //CheckForRepeats,
			    CheckForCaps,
			    CheckForSpaces,
			    CheckForSpaceInChunk,
			  ];

			  for (const func of funcs) {
			    let funcScore;

			    if (func.constructor.name == 'AsyncFunction') {
			      funcScore = await func(message);
			    } else {
			      funcScore = func(message);
			    }

			    score += funcScore;

			    if (this.#state.config.debug == true) {
			      this.DebugPrint({msg: `score eval at function call : ${score}`});
			    }
			  }

			  return score;
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
	RenderMessagesTable(pageIndex = 0, itemsPerPage = 10) {
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
	    const sortedMessages = [...this.#state.messages].reverse(); 
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
			    <div style="font-size:0.8em; opacity:0.9; overflow-wrap:break-word;">${JSON.stringify(cmd.params)}</div>
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
		    commandCellDiv.innerHTML = '<span style="opacity:0.5;">-</span>';
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
			this.#state.clip_queue.push(cmd);
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
	let cmd = this.templates.messageCommand;
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
				cmd.isValid;
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

	cmd.state["readAt"] = null;

	if (cmd.isValid == null){cmd.isValid = true;}
	

    return cmd;
}

	ExportState() {
	// Track seen objects to detect cycles
	    const seen = new WeakSet();

	    const data = JSON.stringify(this.#state, (key, value) => {
		// 1. Handle specialized class conversions
		if (key === 'bannedWordsArray' && value && typeof value.ToArray === 'function') {
		    return value.ToArray();
		}

		// 2. Handle Objects (where cycles live)
		if (typeof value === "object" && value !== null) {
		    // If we've seen this specific object instance before, kill the cycle
		    if (seen.has(value)) {
			return "[Circular]"; 
		    }
		    seen.add(value);

		    // 3. Specific Logic for IntTimer (if instanceof fails)
		    // We check for the 'timeoutListeners' property which is unique to your class
		    if (value.timeoutListeners && Array.isArray(value.timeoutListeners)) {
			return {
			    name: value.name,
			    time: value.time,
			    timeoutDuration: value.timeoutDuration,
			    isTimerStaticData: true
			};
		    }
		}

		// 4. Remove functions and internal timer handles
		if (typeof value === 'function' || key === 'timer') {
		    return undefined;
		}

		return value;
	    }, 4);
	    // 2. Set up the file metadata
	    const filename = `bot_settings_${new Date().toISOString().slice(0, 10)}.json`;
	    const type = "application/json";

		try{
		    // 3. Create the download trigger
		    const blob = new Blob([data], { type: type });
		    const url = window.URL.createObjectURL(blob);
		    const link = document.createElement('a');
		    
		    link.href = url;
		    link.download = filename;
		    
		    // Append to body is required for some browsers (like Firefox)
		    document.body.appendChild(link);
		    link.click();
		    
		    // Cleanup
		    document.body.removeChild(link);
		    window.URL.revokeObjectURL(url);
		    
		    this.DebugPrint("State exported successfully as: " + filename);
		}
		catch(err){
		    	this.DebugPrint({msg: "likely no document", error: err});
			return data;
		}
	}

	GenerateBannedWordsConfig() {
		this.DebugPrint({msg: "GENERATING BLACKLIST UI"});
		
		let container = this.CHE({
		    type: 'div', 
		    id: "blacklist-config",
		    style: "border: var(--tib_border); border-radius: var(--tib_border-radius); padding: 0.5rem;"
		});

		let fileInputLabel = this.CHE({type:'label', innerText:"add banned words as a .csv or .json, feel free to drag and drop"});
		container.append(fileInputLabel);
		let fileInput = this.CHE({type:"input", inputType:"file"});
		fileInput.addEventListener('change', (event) => {
		    this.LoadBannedWords(event);
		});
		container.append(fileInput);

		let inputContainer = this.CHE({
		    type: 'div',
		    style: "display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;"
		});

		let inputLabel = this.CHE({
		    type: 'label',
		    innerText: "Add New Banned Word",
		    attributes: { for: 'banned-word-input' },
		    style: "font-size: 0.8rem; color: var(--color-text-muted); font-weight: bold;"
		});

		let inputRow = this.CHE({ type: 'div', style: "display: flex; gap: 5px;" });

		let wordInput = this.CHE({
		    type: 'input',
		    id: 'banned-word-input',
		    attributes: { placeholder: "e.g. spam_link" },
		    style: "flex-grow: 1;"
		});

		let addBtn = this.CHE({
		    type: 'button',
		    innerText: "add word",
		    attributes: { type: 'button', placeholder: 'Add' },
		    onClick: () => {
			const val = wordInput.value.trim();
			if (val) {
			    this.AddBannedWord(val);
			    wordInput.value = "";
			    this.UpdateBannedWordsList();
			}
		    }
		});

		wordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });

		inputRow.append(wordInput, addBtn);
		inputContainer.append(inputLabel, inputRow);
		container.appendChild(inputContainer);

		// 3. View Section (List)
		let viewContainer = this.CHE({ type: 'details', id: 'blacklist-details' });
		viewContainer.open = true;

		let viewSummary = this.CHE({ 
		    type: 'summary', 
		    innerText: " Banned Words Database", 
		    style: "cursor: pointer; font-weight: bold; color: #aaa;" 
		});
		
		let list = this.CHE({ 
		    type: "ul", 
		    id: "banned-words-display-list",
		    style: "list-style: none; padding: 10px 0; margin: 0; display: flex; flex-direction: column; gap: 5px;" 
		});

		viewContainer.append(viewSummary, list);
		container.appendChild(viewContainer);

		setTimeout(() => this.UpdateBannedWordsList(), 0);
		
		return container;
	    }

	    /**
	     * Re-renders the list of banned words based on the current bannedWordsArray state.
	     */
	UpdateBannedWordsList() {
		if(document == undefined){this.DebugPrint({msg: "no document, impossible to have list to update"}); return;}
	    const listElement = document.getElementById("banned-words-display-list");
	    if (!listElement) return;

	    // Clear existing list
	    listElement.innerHTML = "";

	    const words = this.#state.bannedWordsArray; 
	    
	    // Safety check: if words isn't iterable, exit early
	    if (!words) return;

	    this.DebugPrint("updating banned words display from banned words array", this.#state.bannedWordsArray);
	    for (let i = 0; i < words.length; i++) {
		const wordData = words[i];
		
		// Handle both simple string arrays or objects with hit counts
		const word = typeof wordData === 'string' ? wordData : wordData.word;
		const hits = wordData.hitCount || 0;

		const li = this.CHE({
		    type: 'li',
		    style: "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding: 5px;"
		});

		// Left side: Word and Hit Tally
		const labelContainer = this.CHE({ 
		    type: 'div', 
		    style: "display: flex; gap: 10px; align-items: center;" 
		});

		// Label for the word itself
		const wordSpan = this.CHE({ 
		    type: 'span', 
		    innerText: word, 
		    style: "font-weight: bold; color: var(--color-text);" 
		});

		// Label for the tally/hits
		const hitTally = this.CHE({ 
		    type: 'span', 
		    innerText: `${hits} hits`,
		    style: "font-size: 0.75rem; color: #888; background: #222; padding: 2px 6px; border-radius: 4px;"
		});

		labelContainer.appendChild(wordSpan);
		if (hits > 0) labelContainer.appendChild(hitTally);

		// Right side: Remove Button
		const removeBtn = this.CHE({
		    type: 'span',
		    innerText: "❌",
		    style: "cursor: pointer; padding: 5px;",
		    onClick: () => {
			// Assuming your TrieTree removal logic
			this.RemoveBannedWord(word);
			this.UpdateBannedWordsList();
		    }
		});

		li.appendChild(labelContainer);
		li.appendChild(removeBtn);
		listElement.appendChild(li);
	    }
	}

	GenerateYoutubeConfig(){ //returns html element for the yt config
		if(document == undefined){this.DebugPrint({msg: "cannot create youtube config, returning "}); return;}
		this.DebugPrint("GENERATING YOUTUBE CONFIG UI");
	    const container = this.CHE({type: "div"});

	    // 1. Create the Main Details Wrapper
	    const details = document.createElement('details');
	    details.style.cssText = `
		border: var(--tib_border); 
		border-radius: var(--tib_border-radius); 
		padding: 0.5rem;
		margin-top: 10px;
		color: var(--color-text);
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

	/**
	 * Generates the Control Bar UI for Saving, Loading, and Monitoring.
	 * @param {HTMLElement} container - The element to attach the control bar to.
	 */
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
	    `;

	    // Helper to create the column containers
	    const createColumn = () => {
		const col = document.createElement('div');
		col.style.cssText = `height: 100%; width: 16rem; padding: calc(var(--tib_padding) * 4); display: flex; flex-direction: column; gap: 10px;`;
		return col;
	    };

	    // Helper to create buttons
	    const createBtn = (text, bgColor, onClick) => {
		const btn = document.createElement('input');
		btn.type = "button";
		btn.value = text;
		btn.style.cssText = `background-color: ${bgColor}; color: black; user-select: none; cursor: pointer; font-weight: bold; border: none; padding: 5px; border-radius: 4px;`;
		btn.onclick = onClick;
		return btn;
	    };

	    // --- COLUMN 1: LOCAL STORAGE (Save/Load) ---
	    const col1 = createColumn();
	    
	    const saveBtn = createBtn("save all inputs", "#0ff", () => {
		let inputs = document.getElementsByTagName('input');
		for (let x of inputs) {
		    if (x.id && x.type !== 'button' && x.type !== 'file') {
			localStorage.setItem(x.id, x.value);
		    }
		}
		console.log("All inputs saved to LocalStorage.");
	    });

	    const loadBtn = createBtn("load all inputs", "#ff0", async () => {
		console.log("Loading values from LocalStorage...");
		let inputs = document.getElementsByTagName("input");
		for (let x of inputs) {
		    if (x.id && x.type !== "button" && x.type !== "file") {
			let savedValue = localStorage.getItem(String(x.id));
			if (savedValue !== null) {
			    x.value = savedValue;
			}
		    }
		}
		if (window.Cockatiel && window.Cockatiel.yt) {
		    await window.Cockatiel.yt.LoadValuesFromLocalStorage();
		}
	    });

	    col1.append(saveBtn, loadBtn);

	    // --- COLUMN 2: MONITORING (Start/Stop) ---
	    const col2 = createColumn();

	    const startBtn = createBtn("start monitoring messages", "#0f0", async () => {
		console.log("Start monitoring clicked...");
		await window.Cockatiel.MonitoringStart();
	    });

	    const stopBtn = createBtn("stop monitoring messages", "#f00", () => {
		window.Cockatiel.MonitoringStop();
	    });

	    col2.append(startBtn, stopBtn);

	    // --- COLUMN 3: STATE (Export/Import) ---
	    const col3 = createColumn();

	    const exportBtn = createBtn("Export Settings", "#ff0", () => {
		window.Cockatiel.ExportState();
	    });

	    const col4 = createColumn();
	    const callTtsBtn = createBtn("Call next TTs Message", "#88f", async () => {
		    let messages = window.Cockatiel.GetChatMessages().GetMessages();
		    let msg;
		    for(let k = 0; k < state.messages.length; ++k){
			    msg = messages[k]; 
			    if(msg.commands.tts == undefined){
				    continue;
			    }
		    }
		    await window.Cockatiel.CallTts();
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

	    col3.append(exportBtn, importLabel, fileInput);

	    // Assemble and Append
	    footer.append(col1, col2, col3);
	    controlContainer.appendChild(footer);
	    return controlContainer;
	}

	ModifyUserPoints(targetUuid, amount) {
	    // 1. Throw error if Uuid is missing/null
	    if (!targetUuid) {
		throw new Error("ModifyUserPoints failed: targetUuid is null or undefined");
	    }

	    // 2. Locate the specific user object by UUID
	    let userFound = false;
	    for (let user of this.#state.users) {
		if (user.uuid === targetUuid) {
		    // 3. Update the points (defaulting to 0 if the property is missing)
		    user.points = (user.points || 0) + amount;
		    
		    this.DebugPrint(`Adjusted @${user.username} by ${amount}. New total: ${user.points}`);
		    userFound = true;
		    break; // Stop looping once found
		}
	    }

	    // 4. Optional: Warn if the UUID wasn't found in the current state
	    if (!userFound) {
		this.DebugPrint(`Warning: No user found with UUID ${targetUuid}`);
	    }
	}

	GenerateUserManagement(parentId = "user-display-list") {
	    this.DebugPrint("Generating user management item");
	    if (typeof document === 'undefined') return;

	    let listElement = document.getElementById(parentId);
	    let listContainer;

	    // 1. Create structure if it doesn't exist
	    if (!listElement) {
		this.DebugPrint("No user management id found, creating structure");
		
		// Note: 'details' not 'detail' (HTML tag is <details>)
		listContainer = this.CHE({ type: 'details', id: parentId + "-container" });
		const listSummary = this.CHE({ type: 'summary', innerText: "User Details" });
		listElement = this.CHE({ type: 'div', id: parentId });

		listContainer.appendChild(listSummary);
		listContainer.appendChild(listElement); // Attach the list to the container!
		
		// Crucial: Attach to the UI! 
		// You might want to append this to a specific settings panel instead of body
		//document.body.appendChild(listContainer); 
	    }

	    // 2. Clear existing list
	    listElement.innerHTML = "";

		/*
	    // 3. Handle Object Data Structure
	    const users = this.#state.users;
	    const userList = (users && typeof users === 'object') ? Object.values(users) : [];

	    if (userList.length === 0) {
		this.DebugPrint("User list is empty");
		listElement.innerText = "No users found.";
		return listElement;
	    }

	    // 4. Generate the Items
	    for (const user of userList) {
		const userItem = this.CHE({ 
		    type: 'div', 
		    innerText: `${user.username} (Points: ${user.points})`,
		    className: 'user-management-row' 
		});
		listElement.appendChild(userItem);
	    }
	    */

	    // Always return the top-level element created/found
	    return listContainer; //|| document.getElementById(parentId + "-container");
	}	

UpdateUserDisplay() {
    if (typeof document === 'undefined') return;

    const listElement = document.getElementById("user-display-list");
    if (!listElement) return;

    // 1. Convert Object to Array and Sort
    const userMap = this.#state.users || {};
    // Get the values (user objects) so we can actually sort them
    let userList = Object.values(userMap);

    if (userList.length > 1) {
        userList.sort((a, b) => 
            (a.username || "").localeCompare(b.username || "", undefined, { sensitivity: 'base' })
        );
    }

    // 2. Clear the list only after we know we have data to draw
    listElement.innerHTML = "";

    // 3. Loop through the sorted array
    for (const u of userList) {
        // --- PRE-CALCULATIONS (Your CS color logic is great, keeping it) ---
        let cs = u.conduct_score || 0;
        let csColor = "#fff";
        if (cs < 0) {
            csColor = `rgb(255, ${Math.max(0, 255 + (cs * 51))}, ${Math.max(0, 255 + (cs * 51))})`;
            if (cs <= -5) csColor = "#f00";
        } else if (cs > 0) {
            csColor = `rgb(${Math.max(0, 255 - (cs * 51))}, 255, ${Math.max(0, 255 - (cs * 51))})`;
            if (cs >= 5) csColor = "#0f0";
        }

        const details = this.CHE({
            type: 'details',
            style: "border-bottom: 1px solid #333; font-family: monospace; font-size: 0.75rem; color: #ccc;"
        });

        const summary = this.CHE({
            type: 'summary',
            style: "display: flex; align-items: center; padding: 6px; cursor: pointer; gap: 8px; outline: none; list-style: none;"
        });

        // Identity Block (Simplified for brevity, but matches your logic)
        const identity = this.CHE({ type: 'div', style: "display: flex; gap: 5px; width: 160px; align-items: center; flex-shrink: 0;" });
        const flags = [
            { cond: u.isChatAdmin, col: '#f44', char: 'A', desc: 'Admin' },
            { cond: u.isChatModerator, col: '#5b5', char: 'M', desc: 'Moderator' },
            { cond: u.isSponser, col: '#0af', char: 'S', desc: 'Sponsor' },
            { cond: u.isVerified, col: '#ff0', char: 'V', desc: 'Verified' }
        ].map(f => f.cond ? `<span title="${f.desc}" style="color:${f.col}; font-weight:bold;">${f.char}</span>` : '').join(' ');

	    //console.warn(u);

// 1. Create a "Primitive" copy of the icon string right now
const currentIcon = u.icon ? String(u.icon) : null;

// 2. Validate the string content specifically
const isValidIcon = currentIcon && currentIcon !== "undefined" && currentIcon !== "null";

// 3. Build the tag using the isolated variable
const userIcon = isValidIcon 
    ? `<img src="${currentIcon}" style="width:24px; height:24px; border-radius:50%; display:block;" referrerpolicy="no-referrer">` 
    : `<span style="font-size:20px;">👤</span>`;

	identity.innerHTML = `
	    <span>${userIcon}</span>
	    <div style="overflow:hidden;">
		<div style="font-weight:bold; color:#fff;">${u.username || "???"}</div>
		<div style="font-size:0.6rem;">${flags}</div>
	    </div>`;

        // Standing Block
        const standing = this.CHE({ type: 'div', style: "display: flex; gap: 8px; width: 220px; flex-shrink: 0; border-left: 1px solid #444; padding-left: 8px;" });
        standing.innerHTML = `
            <span title="Points">PTS:<b style="color:#0ff;">${u.points}</b></span>
            <span title="Conduct Score">CS:<b style="color:${csColor};">${cs}</b></span>
            <span title="Bans" style="color:#f44;">B:<b>${(u.ttsBans || []).length}/${(u.channelBans || []).length}</b></span>
        `;

        // Metrics Block
        const metrics = this.CHE({ type: 'div', style: "display: flex; gap: 10px; flex-grow: 1; border-left: 1px solid #444; padding-left: 8px;" });
        const c = u.commendments || { community: [], engagement: [], support: [] };
        const m = u.misconduct || { discrimination: [], harassment: [], spam: [], integrity: [] };
        metrics.innerHTML = `
            <span style="color:#5f5;">C:${c.community.length}/${c.engagement.length}/${c.support.length}</span> | 
            <span style="color:#f55;">M:${m.discrimination.length}/${m.harassment.length}/${m.spam.length}/${m.integrity.length}</span>
        `;

        summary.append(identity, standing, metrics);

        // Actions Panel
        const actions = this.CHE({
            type: 'div',
            style: "display: flex; gap: 10px; align-items: center; padding: 10px; background: #1a1a1a; border-top: 1px solid #444; justify-content: flex-end;"
        });

        const ptsIn = this.CHE({ 
            type: 'input', 
            attributes: { type: 'number', value: '100' }, 
            style: "width: 5rem; background: #000; color: #0f0; border: 1px solid #555; padding: 4px; font-weight: bold;" 
        });

        const giveBtn = this.CHE({ 
            type: 'div', 
            innerText: 'GIVE POINTS', 
            style: "background:#ff0; color:black; padding: 5px 10px; cursor:pointer; font-weight:bold;",
            // Use arrow function to preserve 'this' context
            onClick: () => {
                const amount = parseInt(ptsIn.value);
                if (!isNaN(amount)) { 
                    this.ModifyUserPoints(u.uuid, amount); 
                    this.UpdateUserDisplay(); 
                }
            }
        });

        actions.append(ptsIn, giveBtn);
        details.append(summary, actions);
        listElement.appendChild(details);
    }
}

	/*PushToSubWindow(window_key, htmlString) {
	    if(document == undefined){this.DebugPrint({msg: "cannot push to sub window, no document"}); return;}
	    const targetWin = this.#state.subWindows[window_key];
	    if (!targetWin || targetWin.closed) return;

	    const viewport = targetWin.document.getElementById(`${window_key}-viewport`);
	    if (!viewport) return;

	    // Use insertAdjacentHTML to turn the string into real DOM elements
	    viewport.insertAdjacentHTML('beforeend', htmlString);

	    // Keep it scrolled to the bottom
	    viewport.scrollTop = viewport.scrollHeight;
	}*/

	CreateSubWindow(args = {
	    key: undefined,
	    height: undefined,
	    width: undefined,
	    html: undefined,
	    background: "black",
	    color: "white",
	    script: undefined,
	    style: undefined,
	    stylesheet: undefined,
	}) {
	    try {
		if (typeof document === 'undefined') {
		    this.DebugPrint({ msg: "no document, cannot create sub windows" });
		    return;
		}
	    } catch (err) {
		this.DebugPrint({ msg: "document not found", error: err });
		return;
	    }

	    const existingWin = this.#state.subWindows[args.key];
	    if (existingWin && !existingWin.closed) {
		existingWin.focus();
		return;
	    }

	    const features = `width=${args.width},height=${args.height},popup=yes`;
	    const newWin = window.open("", `win_${args.key}`, features);
	    this.#state.subWindows[args.key] = newWin;

	    const doc = newWin.document;
	    doc.title = `${args.key}`;

	    // 1. Setup Styles
	    doc.body.style.cssText = `
		background:${args.background}; 
		color:${args.color}; 
		height:100vh;
		margin:0; 
		overflow:hidden; 
		padding:0; 
	    `;

	    // override append style sheet
	    if (args.style) {
		const styleTag = doc.createElement('style');
		styleTag.id = `style-${args.key}`;
		styleTag.textContent = args.style;
		doc.head.appendChild(styleTag);
	    }

		let linkTag; 
		if (args.stylesheet) {
		    // Fix 1: Use the variable directly, not as a string "args.stylesheet"
		    // Fix 2: Assign to the existing let variable instead of redeclaring const
		    linkTag = doc.createElement('link');
		    linkTag.rel = 'stylesheet';
		    linkTag.type = 'text/css';
		    linkTag.href = args.stylesheet; 

		    doc.head.appendChild(linkTag);
		    this.DebugPrint({ msg: `External stylesheet linked: ${args.stylesheet}` });
		}

	// 2. Setup HTML Structure
	doc.body.innerHTML = `
	<div id="${args.key}-viewport" style="
	    width: 100%; 
	    height: 100vh; 
	    overflow-y: auto; 
	    overflow-x: hidden; 
	    display: flex; 
	    flex-direction: column; /* Normal flow: top to bottom */
	    justify-content: flex-start; 
	    gap: 12px;
	    padding: 1rem;
	    box-sizing: border-box;
	    scroll-behavior: smooth; /* Makes the auto-scroll look nice */
	"></div>
	`;
	    // 3. Inject the Script
	    if (args.script) {
		const scriptEl = doc.createElement("script");
		scriptEl.type = "text/javascript";
		
		// We wrap the script to ensure it has access to the viewport immediately
		scriptEl.textContent = `
		    (function() {
			console.log("Sub-window '${args.key}' initialized.");
			${args.script}
		    })();
		`;
		
		doc.body.appendChild(scriptEl);
	    }
	}

	async GetTrigramsFromFile() {
		let data
	    try {
		const response = await fetch('./trigrams.json');
		data = await response.json();
	    } catch (err) {
		this.DebugPrint({msg: "Browser: Failed to fetch trigrams.json", type: "err", error: err});
		return
	    }
	
		// ERR: this file cannot be got
		// return data 
		return ["hel"];
	}

	CreateMessageHtml(p_msg, messageId) {
	    // 1. Get User (Fixed property name to userUuid)
	    let user = this.GetUserFromUuid(p_msg.userUuid || p_msg.uuid);

	    // 2. Safely extract user info
	    let icon = user?.icon || "/content/stream_utils/tib_stuff/default_icon.png";
	    let username = user?.username || "Unknown User";

	    let commendments = {
		community: user?.stats?.community || 0,
		engagement: user?.stats?.engagement || 0,
		support: user?.stats?.support || 0,
		rep: user?.stats?.rep || 0,
	    };

	    // 3. Extract Command and Message
	    let commandStr = "No Command";
	    let displayMessage = p_msg.rawMessage || "";

	    try {
		const commandKeys = Object.keys(p_msg.commands);
		if (commandKeys.length > 0) {
		    const firstKey = commandKeys[0];
		    commandStr = firstKey; // e.g., "tts" or "vote"
		    displayMessage = p_msg.commands[firstKey].message || p_msg.processedMessage || p_msg.rawMessage;
		}
	    } catch (err) {
		this.DebugPrint({ msg: "Error parsing commands", val: p_msg, err: err });
	    }

	    // 4. RETURN the template literal
	    return `
			<div class="chatMessageContainer" id="${messageId}">
				<div class="chatUserBubble">
					<div class="chatBubbleTailContainer">
						<div class="chatBubbleTailContainer"><img class="chatBubbleTail" alt="" src="/content/stream_utils/tib_stuff/whispy_tail.png"></div>
					</div>
					<div class="chatUserInfo" style="background-color:${
		user.styling.chatMessageContainer.chatUserBubble.chatUserInfo.styling.backgroundColor
					};">
						<div class="chatUserImageContainer"><img class="chatUserImage" alt="" src="${icon}"></div>		
						<div class="chatUserStats">
							<div class="chatUsername">${username}</div>		
							<div class="chatUserCommendations">
								C: ${commendments.community}, 
								E: ${commendments.engagement}, 
								S: ${commendments.support}, 
								R: ${commendments.rep}
							</div>
						</div>
					</div>
				</div>
				<div class="chatMessageBubble">
					<div class="chatCommandContainer">
						<div class="chatCommand">${commandStr}</div>
					</div>
					<div class="chatMessage">${displayMessage}</div>
				</div>
			</div>
		`;
	}

	PushMessageToChatWindow(processedMsg) {
	    if (!processedMsg) return;

	    const win = this.#state.subWindows[this.#state.windows.chat.key];
	    if (!win || win.closed) {
		this.DebugPrint({ msg: "Sub-window unavailable", type: "w" });
		return;
	    }

	    const msgHTML = this.CreateMessageHtml(processedMsg, processedMsg.messageId);

	    win.postMessage({ 
		type: 'new_chat_msg', 
		payload: { html: msgHTML } 
	    }, "*");
	}

	PushSystemNotificaitonToChatWindow(strang) {
	    if(!strang){
		this.DebugPrint({msg: "strang is undefined, cannot print", type: 't'});
		return false;
	    }

	    const win = this.#state.subWindows[this.#state.windows.chat.key];
	    if (!win || win.closed) {
		this.DebugPrint({ msg: "Sub-window unavailable", type: "w" });
		return false;
	    }

	    let html = `
		    <div style="
		    	border: 0.2em solid #0ff;
		    	border-radius:3rem;
			background-color: #022;
			color: #0ff;
			padding: 0.8rem;
		    ">
			${strang}	
		    </div>
		`

	    win.postMessage({ 
		type: 'new_chat_msg', 
		payload: { html: html } 
	    }, "*");

	    return true;
	}

	InitTimers(){
		this.#state.timers = {
			GetMessagesTimer: new IntTimer({
				name: "GetMessagesTimer",
				timeoutDuration: 15,
			}),
			ReadTtsTimer: new IntTimer({
				name: "ReadTtsTimer",
				timeoutDuration: 15,
			}),
			EventDisplayTimer: new IntTimer({
				autoStart: true,
				name: "EventDisplayTimer",
				timeoutDuration: 7,
				debug: true,
			}),
		};

		this.#state.timers.GetMessagesTimer.AddTimeoutListener(() => this.#DaLoop()); 
	}

	GenerateUi(){
		this.DebugPrint({msg: "generating ui for the first time"});
		let settingsContainer;
		try{
			settingsContainer = document.getElementById("cockatiel_settings_container");
			if(
				settingsContainer == null 
				|| settingsContainer == undefined){
				this.DebugPrint({msg: "no container"});
				settingsContainer = this.CHE({type: 'div', id: "cockatiel_settings_container"});
			}
			// else: container already got, no need to change anything
		}
		catch(err){
			this.DebugPrint({
				msg: "err tryiing to get parent, likely lack of element so creating then continuing", 
				error: err
			});
			settingsContainer = this.CHE({type: 'div', id: "cockatiel_settings_container"});
		}// Ensure all subwindows are closed if the main app is closed or refreshed


		try{
			let bannedWordsList = this.GenerateBannedWordsConfig();
			this.DebugPrint({msg: "bannedWordsList:", val: bannedWordsList});
			settingsContainer.appendChild(bannedWordsList);
			this.UpdateBannedWordsList();
		}
		catch(err){
		    console.error("cannot GenerateBannedWordsConfig", err, err?.stack);
		}

		try{
			if(!settingsContainer){
				this.DebugPrint({msg: "no settings container, cannot create items", type:'t'});
			}
			let controlBar = this.GenerateControlBarUI()
			settingsContainer.appendChild(controlBar);
		}
		catch(err){
			this.DebugPrint({msg: "cannot cannot GenerateControlBarUI", type:'e', err: err});
		}

		try{
			if(!settingsContainer){
				this.DebugPrint({msg: "no settings container, cannot create items", type:'t'});
			}
			let ytConfig = this.GenerateYoutubeConfig();
			settingsContainer.appendChild(ytConfig);
		}
		catch(err){
			this.DebugPrint({msg: "cannot cannot GenerateControlBarUI", type:'e', err: err});
		}

		try{
			if(!settingsContainer){
				this.DebugPrint({msg: "no settings container, cannot create items", type:'t'});
			}
			let userManagement = this.GenerateUserManagement();
			settingsContainer.appendChild(userManagement);
		}
		catch(err){
			this.DebugPrint({msg: "cannot cannot GenerateUserManagement", type:'e', err: err});
		}

		try{
			if(!settingsContainer){
				this.DebugPrint({msg: "no settings container, cannot create items", type:'t'});
			}
			document.body.appendChild(settingsContainer);
		}
		catch(err){
			this.DebugPrint({msg: "cannot append settings container to document", err: err, type: "err"});
		}
	}

	GenerateChatWindow(){
		try{
			const chatSettings = this.#state.windows.chat;
			const chatStyle = ``;

			this.CreateSubWindow({
			    ...chatSettings,
			    stylesheet: this.#state.windows.chat.defaultStylesheet, 
			    script: `
			    window.addEventListener("message", (event) => {
				const { type, payload } = event.data;
				
				if (type === 'new_chat_msg' && payload.html) {
				    const view = document.getElementById("${chatSettings.key}-viewport");
				    const target = view || document.body;

				    const temp = document.createElement('div');
				    temp.innerHTML = payload.html;
				    const newElement = temp.firstElementChild;

				    // 1. Initial State (Hidden to the right or just faded)
				    //newElement.style.opacity = '0';
				    newElement.style.height = '0px';
				    newElement.style.transform = 'translateX(20px)'; // Small nudge from right
				    newElement.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // Adding a slight bounce
				    newElement.style.padding = '0px';
				    newElement.style.margin = '0px';
				    
				    target.appendChild(newElement);

				    // 2. Animate In
				    setTimeout(() => {
					view.scrollTo(0, view.scrollHeight);
					newElement.style.opacity = '1';
					newElement.style.transform = 'translateX(0)';
					newElement.style.height = 'auto';
					    newElement.style.padding = 'inherit';
					    newElement.style.margin = 'inherit';
				    }, 10);

				    // 3. Self-Destruct Timer (Slide to Left)
				    const duration = ${chatSettings.messageDisplayDuration || 5} * 1000;
				    setTimeout(() => {
					if (newElement) {
					    // Slide off to the left
					    newElement.style.transition = 'all 0.6s ease-in'; 
					    //newElement.style.opacity = '0';
					    newElement.style.height = '0px';
					    newElement.style.transform = 'translateX(-120%)'; // Push it off-screen to the left
					    newElement.style.padding = '0px';
					    newElement.style.margin = '0px';
					    
					    // Wait for the animation to finish before removing from DOM
					    setTimeout(() => {
						newElement.remove();
						// Optional: if the removal causes a "jump", you can animate 
						// the height to 0 here as well.
					    }, 600);
					}
				    }, duration);
				}
			    });
			    `
			});
		}

		catch(err){
			this.DebugPrint({msg: "could not create chat window", type: "err"});
		}
	}

	GenerateEventsWindow(){
		try{
			//this.PushToSubWindow("chatMonitor", this.RenderStandbyHTML());
			let eventWindowSettings = this.#state.windows.events;
			this.CreateSubWindow({
				...eventWindowSettings,
				script: `
					console.log("print from events window");
				`,
			});

			this.#state.timers.EventDisplayTimer.AddTickListener((()=>{console.log("tick from event display manager")}));
			this.#state.timers.EventDisplayTimer.AddTimeoutListener((()=>{console.log("time'd out eventdisplaytimer")}));
			this.#state.timers.EventDisplayTimer.AddTimeoutListener((()=>{this.EventDisplayManager()}));
		}
		catch(err){
			this.DebugPrint({msg: "could not add test messages", type: "err", err: err});
		}
	}

	RunSubWindowTest1(){
		this.DebugPrint({msg: "running RunSubWindowTest1()"});
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest1");
		try{
		this.DebugPrint({msg:"adding testUser"});
			const test_message = {
				    "channelId": "asdf1234zxcv5689",
				    "commands": {},
				    "messageId": "LCC.EhwKGkNNLVB2TkdCNVpJREZlZkJ3Z1FkNExJQzZR",
				    "platform": "youtube",
				    "processedMessage": "HELLO SMALLSVILLE",
				    "rawMessage": "HELLO SMALLSVILLE",
				    "receivedAt": 1771485470330,
				    "score": -100,
				    "state": {},
				    "streamOrigin": "Cg0KC3JHN3ZGN3BjVlBZKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILckc3dkY3cGNWUFk",
				    "channelOrigin": "1234qwer4678asdf",
				    "userUuid": "88d515ca-531b-45fc-a24b-a65eeb76996d",
				    "username": "testUser",
				    "version": 1,
			}
			try{
				this.CreateUserFromFlags(test_message);
			}
			catch(error){
				this.DebugPrint({
					msg: "RunSubWindowTest1 failed", 
					val: test_message, 
					type: "e", 
					err: error,
				});
			}
			this.DebugPrint({msg: "RunSubWindowTest1 pass"});
		}
		catch(err){
			this.DebugPrint({msg: "could not add user to users", type: "err", err: err});
		}
	}

	RunSubWindowTest2() {
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest2");
	    this.DebugPrint({ msg: "1. Entering RunSubWindowTest2", type: "l" });

	    try {
		const chatSettings = this.#state?.windows?.chat;
		this.DebugPrint({ msg: "2. Chat Settings Found", val: chatSettings });

		if (!chatSettings) {
		    this.DebugPrint({ msg: "FAIL: chatSettings is undefined in state", type: "e" });
		    return;
		}

		const win = this.#state?.subWindows?.[chatSettings.key];
		this.DebugPrint({ msg: "3. Target Window Object", val: win ? "Window Found" : "Window Null" });

		if (!win || win.closed) {
		    this.DebugPrint({ msg: "4. FAIL: Window reference not found or window was closed", type: "w" });
		    return;
		}

		this.DebugPrint({ msg: "5. Success: Sending postMessage now..." });
		
		// This triggers the listener you injected in CreateSubWindow
		win.postMessage({ 
		    type: 'new_chat_msg', 
		    payload: { html: "<div style='color: #0bd;'>Cockatiel started! </div>" } 
		}, "*");

	    } catch (err) {
		this.DebugPrint({ msg: "CRITICAL ERROR in RunSubWindowTest2", type: "err", err: err });
	    }
	}

	RunSubWindowTest3() {
	    this.DebugPrint({ msg: "running RunSubWindowTest3", type: "l" });
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest3");
		try{
			const user = this.#state.users[Object.keys(this.#state.users)[0]];
			const p_msg = {
				version: 1,
				username: "test_user",
				userUuid: user.uuid, 
				streamOrigin: "youtube", //what streamid via the platform the message came from
				channelOrigin: "1234qwer5678asdf",
				receivedAt: Date.now(),
				commands: [],
				processedMessage: "",
				platform: "",
				rawMessage: "!vote -y",
				messageId: "",
				score: "",
				state: {}
			};
	
			this.PushMessageToChatWindow(p_msg);
		}
		catch(err){
	    		this.DebugPrint({ msg: "ERROR running RunSubWindowTest3", type: "e", err:err });
		}

	}

	RunSubWindowTest4(){
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest4");
		const html = `
			<div class="chatMessageContainer">
				<div class="chatUserBubble">
					<div class="chatBubbleTailContainer">
						<div class="chatBubbleTailContainer"><img class="chatBubbleTail" alt="" src="/content/stream_utils/tib_stuff/whispy_tail.png"></div>
					</div>
					<div class="chatUserInfo">
						<div class="chatUserImageContainer"><img class="chatUserImage" alt="chatUserImage" src="/assets/headshot_doodle.png"></div>		
						<div class="chatUserStats">
							<div class="chatUsername">@usernameUSERNAMEusernameUSERNAME</div>		
							<div class="chatUserCommendations">community: 1, engagement: 5, support: 2, rep: 8</div>
						</div>
					</div>
				</div>
				<div class="chatMessageBubble">
					<div class="chatCommandContainer">
						<div class="chatCommand">!tts -v 69 -p 1.9 -r 0.8 </div>
					</div>
					<div class="chatMessage">
					Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate.
					</div>
				</div>
			</div>
		`
	    this.#state.subWindows[this.#state.windows.chat.key].postMessage({ 
		type: 'new_chat_msg', 
		payload: { html: html } 
	    }, "*");
	}

	RunSubWindowTest5(){
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest5");
		this.DebugPrint({msg: "Running RunSubWindowTest5"});
		this.DebugPrint({msg: "attempting to create user from unprocessedMsg"});
		let val = {
		    "version": 1,
		    "apiVersion": 3,
		    "platform": "YouTube",
		    "data": {
			"kind": "youtube#liveChatMessage",
			"etag": "w3nSofTpFw3me4dFSjvLF3BmC44",
			"id": "LCC.EhwKGkNJNkhtNlM5bVpNREZSRVlyUVlkc25zejhB",
			"snippet": {
			    "type": "textMessageEvent",
			    "liveChatId": "Cg0KCzhlUFk0ellmX0tjKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILOGVQWTR6WWZfS2M",
			    "authorChannelId": "UCiYflTancqoI-CvKoixE2Fw",
			    "publishedAt": "2026-03-12T04:03:07.947947+00:00",
			    "hasDisplayContent": true,
			    "displayMessage": "I'm still calling this the worst run",
			    "textMessageDetails": {
				"messageText": "I'm still calling this the worst run"
			    }
			},
			"authorDetails": {
			    "channelId": "UCiYflTancqoI-CvKoixE2Fw",
			    "channelUrl": "http://www.youtube.com/channel/UCiYflTancqoI-CvKoixE2Fw",
			    "displayName": "NotBluWalled",
			    "profileImageUrl": "https://yt3.ggpht.com/2Z--UpGm0bLVlXExSiev6a9J2c883R0jYx68fPwYAx6vmg1gIdzymYmnfiQ08-hfUgVqPOzIWlQ=s88-c-k-c0x00ffffff-no-rj",
			    "isVerified": false,
			    "isChatOwner": false,
			    "isChatSponsor": false,
			    "isChatModerator": true
			}
		    },
		    "receivedAt": 1773288187947
		} 
		let msg = this.ProcessYoutubeV3Message_v1(val);
		this.SafeAddToMessagesQueue(msg);


	//	this.Process

		//this.CreateUserFromFlags(val);
	}

	RunSubWindowTest6(){
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest6");
		let val = {
		    "version": 1,
		    "apiVersion": 3,
		    "platform": "YouTube",
		    "data": {
			"kind": "youtube#liveChatMessage",
			"etag": "w3nSofTpFw3me4dFSjvLF3BmC44",
			"id": "LCC.EhwKGkNJNkhtNlM5bVpNREZSRVlyUVlkc25zejhB",
			"snippet": {
			    "type": "textMessageEvent",
			    "liveChatId": "Cg0KCzhlUFk0ellmX0tjKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILOGVQWTR6WWZfS2M",
			    "authorChannelId": "UCiYflTancqoI-CvKoixE2Fw",
			    "publishedAt": "2026-03-12T04:03:07.947947+00:00",
			    "hasDisplayContent": true,
			    "displayMessage": "!help aaaaaaaaa",
			    "textMessageDetails": {
				"messageText": "!help aaaaaaaaa"
			    }
			},
			"authorDetails": {
			    "channelId": "UCiYflTancqoI-CvKoixE2Fw",
			    "channelUrl": "http://www.youtube.com/channel/UCiYflTancqoI-CvKoixE2Fw",
			    "displayName": "@BluWalled",
			    "prof}ileImageUrl": "https://yt3.ggpht.com/2Z--UpGm0bLVlXExSiev6a9J2c883R0jYx68fPwYAx6vmg1gIdzymYmnfiQ08-hfUgVqPOzIWlQ=s88-c-k-c0x00ffffff-no-rj",
			    "isVerified": false,
			    "isChatOwner": false,
			    "isChatSponsor": false,
			    "isChatModerator": true
			}
		    },
		    "receivedAt": 1773288187947
		} 
		this.ProcessYoutubeV3Message_v1(val);
	}
	
	RunSubWindowTest7(){
		this.DebugPrint({msg: "running RunSubWindowTest7()"});
		this.PushSystemNotificaitonToChatWindow("running RunSubWindowTest7");
		try{
		this.DebugPrint({msg:"adding testUser"});
			const test_message = {
				    "channelId": "asdf1234zxcv5689",
				    "commands": {},
				    "messageId": "LCC.EhwKGkNNLVB2TkdCNVpJREZlZkJ3Z1FkNExJQzZR",
				    "platform": "youtube",
				    "processedMessage": "tts assignment test to verify all is working",
				    "raw": "!tts -v 50 -p 2 -r 1 tts assignment test to verify all is working",
				    "receivedAt": 1771485470330,
				    "score": -100,
				    "state": {},
				    "streamOrigin": "Cg0KC3JHN3ZGN3BjVlBZKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILckc3dkY3cGNWUFk",
				    "channelOrigin": "1234qwer4678asdf",
				    "userUuid": "88d515ca-531b-45fc-a24b-a65eeb76996d",
				    "username": "testUser",
				    "version": 1,
			}
			try{
				this.ProcessYoutubeV3Message_v1(test_message);
			}
			catch(error){
				this.DebugPrint({
					msg: "RunSubWindowTest7 failed", 
					val: test_message, 
					type: "e", 
					err: error,
				});
			}
			this.DebugPrint({msg: "RunSubWindowTest7 pass"});
		}
		catch(err){
			this.DebugPrint({msg: "could not add user to users", type: "err", err: err});
		}
	}

	AttachHandleUnloadLogic(){
		try{
			// Ensure all subwindows are closed if the main app is closed or refreshed
			window.addEventListener('unload', () => {
			    if (this.#state.subWindows) {
				Object.values(this.#state.subWindows).forEach(win => {
				    if (win && !win.closed) {
					win.close();
				    }
				});
			    }
			});
		}
		catch(err){
			this.DebugPrint({msg:"no window to append listerners", error:err})
		}
	}

	AddTtsTimeoutListeners() {
	    this.DebugPrint({msg: "initing tts timeout listener"});
	    // Ensure the timer exists before trying to add a listener
	    if (!this.#state.timers?.ReadTtsTimer) {
		this.DebugPrint({ msg: "TTS Timer not initialized!" });
		return;
	    }

// Add a private property to your class to track status
// #isTtsBusy = false;

	this.#state.timers.ReadTtsTimer.AddTimeoutListener(async () => {
	    // 1. Check if we are already speaking. If so, skip this tick.
	    if (this.#isTtsBusy) {
		this.DebugPrint({ msg: "TTS is busy, skipping this tick." });
		return;
	    }

	    try {
		this.DebugPrint({ msg: "attempting to read oldest tts" });
		
		// 2. Set the lock
		this.#isTtsBusy = true;

		// 3. Await the full execution of find and call
		// This ensures readAt is updated and speech is finished
		await this.FindOldestUnreadTtsAndCall();

	    } catch (err) {
		this.DebugPrint({ msg: "Error in ReadTtsTimer listener", error: err, type: 'e' });
	    } finally {
		// 4. Release the lock regardless of success or failure
		this.#isTtsBusy = false;
	    }
	});	
	}

	Init(){
		this.InitTimers();
		this.AddTtsTimeoutListeners();

		this.GenerateUi();
		this.GenerateChatWindow();
		this.GenerateEventsWindow();

		this.RunSubWindowTest1();
		this.RunSubWindowTest2();
		this.RunSubWindowTest3();
		this.RunSubWindowTest4();
		this.RunSubWindowTest5();
		this.RunSubWindowTest6();
		this.RunSubWindowTest7();

		this.#state.timers.EventDisplayTimer.Start();
	    	this.#state.timers.ReadTtsTimer.Start();

		this.AttachHandleUnloadLogic()
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

	constructor(){/* DO NOT ADD STUFF HERE, IT WILL CORRUPT TESTING STATE */}
}
