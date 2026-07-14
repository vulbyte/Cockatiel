import { BaseClass } from "./baseClass.mjs";

import { BannedWordsManager } from "./bannedWordsManager.mjs";
import { ChatManager } from "./chat_manager.mjs";
import { EventsManager } from "./events_manager.mjs";
import { ScoreHandler } from "./score_handler.mjs";
import { Timeline } from "./timeline.mjs";
import { TtsManager } from "./tts_state.mjs";
import { UserManager } from "./user_manager.mjs";

//import { BilliBilli } from "./";
//import { Discord } from "./";
//import { Facebook } from "./";
//import { Instagram } from "./";
//import { Kick } from "./";
//import { Odysee } from "./";
//import { Picarto } from "./";
//import { Pixiv } from "./";
//import { Rumble } from "./";
//import { Trovo } from "./";
//import { TikTok } from "./";
//import { Twitter } from "./";
import { Twitch } from "./twitch_state.mjs";
import { Youtube } from "./youtube_state.mjs";

import { DebugPrint } from "./DebugPrint.mjs";
import { Result } from "./result.mjs";

// TLDR codebase rules:
/* 1. why do we use getters/setters?: prevent data leaks for sensitive information. ie we don't want api-keys leaking. */
/* 2. why use the result pattern?: javascript stack traces are a massive pain, and often get consumed in the worst way possible at critical times. so a proper pattern that just formal logging is far better than relying on throws. */

export class Cockatiel {
  //assigend to document on init
  #hasInited = false;

	//classes for handling things, declared here to help prevent shadow declarations
  	d	
	BannedWordsManager	
	ChatManager
	EventsManager
	ScoreHandler
	Timeline
	TtsManager
	UserManager
	Twitch
	Youtube

	#saveListeners = new Array();
	addSaveListener(input){
		try{
			if(typeof(input) != "function"){
				return Result.err(`cannot add value to save listeners, is not a function: ${input}`);
			}
			
			this.#saveListeners = this.#saveListeners.filter(func => func !== input);
			this.#saveListeners.push(input);

			return Result.ok("element added to the save listeners");
		}
		catch(err){
			return Result.err(`couldn't not add save listener\n${err}`);
		}
	}
	removeSaveListener(input){
		try{
			if(typeof(input) != "function"){
				return Result.err(`cannot add value to save listeners, is not a function: ${input}`);
			}

			this.#saveListeners = this.#saveListeners.filter(func => func !== input);
		}
		catch(err){
			return Result.err(`could not remove listener, ${input} is not detected as beign in the array ${JSON.stringify(this.#saveListeners)}\n${err}`);
		}
		
	};
	EmitSave(){
		console.log("attempting to save");
		for(let i = 0; i < this.#saveListeners.length; ++i){
			try{
				this.#saveListeners[i]();
			}
			catch(err){
				console.error(err);
			}
		}
		return Result.ok("save ran successfully");
	}
	GetSL(){
		return this.#saveListeners;
	}

  templates = {
	config: {
		color: "#069420",
		title: "you can click these to rename them!",
		isHidden: false,
	},
	    platformSettings: {
	      //key, default value
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
	      communityGiftUnmonitized: {
		css: null,
		notificationSound: null,
		overrideGlobal: false,
	      }, //ie +rep
	      followMonitized: {
		css: null,
		notificationSound: null,
		overrideGlobal: false,
	      }, //ie new channel memeber on yt
	      followUnmonitized: {
		css: null,
		notificationSound: null,
		overrideGlobal: false,
	      }, //ie new follow on twitch
	      messageMonitized: {
		css: null,
		notificationSound: null,
		overrideGlobal: false,
	      }, //ie donation
	      messageUnmonitized: {
		css: null,
		notificationSound: null,
		overrideGlobal: false,
	      }, //ie chat
	    },
    user: {
      version: 1,
      username: null,
      channels: {
        facebook: [],
        kick: [],
        tiktok: [],
        twitch: [],
        youtube: [],
      },
      uuid: null,
      ttsBans: [], // times they've been restricted from using tts (ie non-english, spam, etc)
      channelBans: [], // when banned and why
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
				trash		- 0.5x score multiplier */
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
      points: 0,
      totalPoints: 0,
      styling: {
        // ONLY CUSTOMIZABLE PROPERTIES ARE HERE, styles are whiteliste'd
        chatMessageContainer: {
          styling: null,
          chatUserBubble: {
            styling: null,
            chatBubbleTailContainer: {
              styling: null,
              chatBubbleTailContainer: {
                styling: null,
                chatBubbleTail: { styling: null },
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
                  borderRadius: "100%",
                },
                chatUserImage: { styling: null },
              },
              chatUserStats: {
                styling: null,
                chatUsername: { styling: null },
                chatUserCommendations: { styling: null },
              },
            },
          },
          chatMessageBubble: {
            styling: {
              backgroundColor: "#111",
              borderRadius: "1.3rem",
              color: "white",
            },
            chatCommandContainer: {
              styling: {
                height: "1rem",
                paddingBottom: "1rem",
              },
              chatCommand: {
                styling: {
                  backgroundColor: "#222",
                  borderRadius: "1rem",
                  color: "cyan",
                },
              },
            },

            chatMessage: { styling: null },
          },
        },
      }, //end of styling
      totalMessages: 0,
    },
  /* ALL COMMENTED OUT TEMPLATES ARE LEGACY, TO BE REMOVED IN THE FUTURE
    bannedAt: {
      version: 1,
      datetime: "",
      unbannedAt: [],
      banAppeals: [],
    },
    bannedWord: {
      word: "",
      occurrances: 0,
    },
    channel: {
      version: 1,
      platform: "",
      channelName: "",
      channelId: "",
    },
    commendment: {
      version: 1,
      happenedAt: null,
      byUser: null, // uuid
      messageCommended: null, // messageCommended if any
    },
    commands: {
      version: 1,
      commandType: null,
      flags: {}, // ie: e: {value, type, description,}
      func: null, // function to call when triggered
      //will check the highest perm first, the first to return true will be assumed. if none true assumed to be public
      AuthNeeded: {
        owner: false,
        admin: false,
        mod: false,
        // trusted users are users who have a certain amount of lifetime score or time since first appearance.
        trusted: false,
      },
      cost: 0,
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
      },
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
      data: null, // raw data that errored
      hardware: null, // hardware info of the system that failed
      erroredAt: null, // unixTime of when the error happened
      errorMessage: null, // err.message for quick reference
      stackTrace: null, // err.stack: captures the full path of the failure
      processingStage: null, // identifies which function/.valueblock was running
      retryCount: 0, // increments if you attempt to re-process
    },
    flags: {
      flag: null,
      value: null,
      description: null,
      range: { min: 0.5, max: 3 },
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
      commands: [/*eac command being a messageCommandObject],
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
      type: null, //must be selected from: templates.message_types[i]
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
    unprocessed_message_v1: {
      version: 1,
      apiVersion: 3, // youtube,
      data: null,
      dateTime: null,
      platform: null,
      failedProcessingAt: null,
    },
    */
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

    switch (type) {
      case "throw":
      case "t":
        throw new Error(msg /*statement*/); // Use 'throw' to actually stop execution
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

      if (args.inputType) elem.type = args.inputType;

      if (args.class) elem.className = args.class;
      if (args.id) elem.id = args.id;
      if (args.HTML) elem.HTML = args.HTML;
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
    } catch (err) {
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
  ) {
    //early exits, these are considered manditory
    if (!icon) {
      this.DebugPrint({
        msg: msg,
        val: icon,
        type: "t",
      });
    }
    if (!platformName) {
      this.DebugPrint({
        msg: "couldn't get platform name, is null",
        val: platformName,
        type: "t",
      });
    }
    if (!platformStateManager) {
      this.DebugPrint({
        msg: "couldn't get platformStateManager, is null",
        val: platformStateManager,
        type: "t",
      });
    }
    if (!enabledFunctionListener) {
      this.DebugPrint({
        msg: "couldn't get enabledFunctionListener, is null",
        val: enabledFunctionListener,
        type: "t",
      });
    }
    if (!disabledFunctionListener) {
      this.DebugPrint({
        msg: "couldn't get disabledFunctionListener, is null",
        val: disabledFunctionListener,
        type: "t",
      });
    }

    let generalSettings = document.createElement("div");

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
    isActiveEnable.addEventListener("click", () => {
      //will get the value post update
      this.DebugPrint({
        msg: `calling enabled function listener for ${platformName}`,
      });
      enabledFunctionListener();
    });
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
    isActiveDisable.addEventListener("click", () => {
      //will get the value post update
      this.DebugPrint({
        msg: `calling disbled function listener for ${platformName}`,
      });
      disabledFunctionListener();
    });
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
    platformStateManager.AddStatusListener();
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
      if (data == null) {
        return;
      }
      if (String(typeof data).toLowerCase() == "object") {
        if (data.msg) {
          data = data.msg;
        } else {
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

    statusMessage.innerText =
      nullMessages[Math.floor(nullMessages.length * Math.random())];
    platformStateManager.AddStatusListener((data) => {
      if (data == null) {
        return;
      }
      if (String(typeof data).toLowerCase() == "object") {
        data = JSON.stringify(data, null, 4);
      }
      //run this when the emitStatusListener is called
      document.getElementById(statusMessage.id).innerText = data;
    });
    generalSettings.append(statusMessage);

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
    });
    let key, val;
    for (let i = 0; i < keys.length; ++i) {
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
      console.log("I AM GENERATING INPUTS");

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
      wrapper.style.cssText =
        "position: relative; width: 100%; min-height: 2rem; border: 1px solid #3e3d32; box-sizing: border-box; resize: vertical; overflow: auto; background: #272822;";

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
      highlightLayer.style.cssText =
        commonStyles +
        "z-index: 0; color: #f8f8f2; pointer-events: none; overflow: hidden;";

      let cssInput = document.createElement("textarea");
      cssInput.style.cssText =
        commonStyles +
        "z-index: 1; background: transparent; color: transparent; caret-color: white; resize: none; outline: none; overflow: hidden; height: 3rem;";

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
          if (key === "styling" && value && typeof value === "object") {
            if (Object.keys(value).length > 0) {
              css += `.${parentSelectors.trim()} {\n`;
              for (let prop in value) {
                // Convert camelCase to kebab-case
                let kebabProp = prop
                  .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
                  .toLowerCase();
                css += `    ${kebabProp}: ${value[prop]};\n`;
              }
              css += `}\n\n`;
            }
          }
          // If it's a nested container, recurse
          else if (typeof value === "object" && value !== null) {
            css += JSONToCss(value, `${parentSelectors} ${key}`);
          }
        }
        return css;
      }

      cssInput.value = JSONToCss(window.Cockatiel.templates.user.styling);

      // 4. Robust Tokenizing Logic (Comments added first)
      cssInput.oninput = () => {
        let text = cssInput.value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        // The Regex now matches:
        // 1. Comments: /\/\*[\s\S]*?\*\//g
        // 2. Classes, 3. IDs, 4. Keys, 5. Values
        highlightLayer.innerHTML =
          text.replace(
            /(\/\*[\s\S]*?\*\/)|(\.[a-zA-Z0-9_-]+)|(#[a-zA-Z0-9_-]+)|([a-zA-Z\-]+(?=\s*:))|((?<=:\s*)([^;\n]+))/g,
            (match, comment, cls, id, key, val) => {
              let spanStyle = "color: %COLOR%; font-family: inherit;";
              if (comment)
                return `<span style="${spanStyle.replace("%COLOR%", "#75715e")}">${comment}</span>`;
              if (cls)
                return `<span style="${spanStyle.replace("%COLOR%", "#e6db74")}">${cls}</span>`;
              if (id)
                return `<span style="${spanStyle.replace("%COLOR%", "#f92672")}">${id}</span>`;
              if (key)
                return `<span style="${spanStyle.replace("%COLOR%", "#66d9ef")}">${key}</span>`;
              if (val)
                return `<span style="${spanStyle.replace("%COLOR%", "#ae81ff")}">${val}</span>`;
              return match;
            },
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
    if (additionalHTMLOptions) {
      generalSettings.appendChild(additionalHTMLOptions);
    }
    return generalSettings;
  }

  GenerateControlBarUI(container) {
    if (document == undefined) {
      this.DebugPrint({ msg: "no document, cannot append a control bar ui" });
      return;
    }
    let controlContainer = this.CHE({ type: "div" });
    this.DebugPrint("GENERATING CONTROL BAR UI");
    // 1. Main Wrapper
    const footer = document.createElement("div");
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
      const col = document.createElement("div");
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
      const btn = document.createElement("button");
      if (imageLink == undefined) {
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

      const img = document.createElement("img");
      btn.type = "button";
      img.src = imageLink;
      img.alt = altText;
      img.style.userSelect = "none";
      img.width = "256";
      img.height = "256";
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
    const callTtsBtn = createBtn(
      "../assets/call_tts_message.png",
      "Call next TTs Message",
      "#88f",
      async () => {
        this.FindOldestUnreadTtsAndCall();
      },
    );
    callTtsColumn.append(callTtsBtn);
    //footer.append();

    //call next tts button
    const callLoopColumn = createColumn();
    const callLoopBtn = createBtn(
      "../assets/call_tts_message.png",
      "call loop (ie process unprocessed queue)",
      "#f00",
      async () => {
        console.log("call loop button pressed");
      },
    );
    callLoopColumn.append(callLoopBtn);

    // --- COLUMN 3: STATE (Export/Import) ---
    const exportInportColumn = createColumn();

    const exportBtn = createBtn(
      "../assets/export_settings.png",
      "Export Settings",
      "#ff0",
      () => {
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
      },
    );

    const importLabel = document.createElement("label");
    importLabel.innerText = "Import settings from file";
    importLabel.style.cssText =
      "color: white; font-size: 0.8rem; margin-top: 5px;";

    const fileInput = document.createElement("input");
    fileInput.id = "state_input";
    fileInput.type = "file";
    fileInput.style.backgroundColor = "#f0f";
    fileInput.addEventListener("change", (event) => {
      this.ImportState(event);
    });

    //save/load inputs
    const saveLoadColumn = createColumn();
    const saveBtn = createBtn(
      "../assets/save_inputs.png",
      "save all inputs",
      "#0f0",
      () => {
        let inputs = document.getElementsByTagName("input");
        for (let x of inputs) {
          if (x.id && x.type != "button" && x.type != "file") {
            localStorage.setItem(x.id, x.value);
          }
        }
        console.log("All inputs saved to LocalStorage.");
      },
    );
    saveBtn.innerText = "save inputs";

    const loadBtn = createBtn(
      "../assets/load_inputs.png",
      "load all inputs",
      "#ff0",
      async () => {
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
      },
    );
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
;
    controlContainer.appendChild(footer);

    //tests
    let tests = document.createElement("div");
    tests.style = "color:white;";
    let summary = document.createElement("div");
    summary.innerText = "youtube test events";
    tests.append(summary);

    // superChatEvent - message
    let superChatEventMessages = [
      {
        version: 1,
        apiVersion: 3,
        platform: "YouTube",
        data: {
          kind: "youtube#liveChatMessage",
          etag: "cyISaLoRJzops1Dhjhwp5ineYeI",
          id: "LCC.EhwKGkNLanpxY2J1dnBNREZRbkN3Z1FkVGhZVVJB",
          snippet: {
            type: "superChatEvent",
            liveChatId:
              "Cg0KC09FeE9LRGI0WnFzKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILT0V4T0tEYjRacXM",
            authorChannelId: "UCKZigHbgpJG9ldxXMqmiZUg",
            publishedAt: "2026-03-27T00:52:12.560546+00:00",
            hasDisplayContent: true,
            displayMessage:
              'CA$2.00 from @vulbyte: "IS A TEST OF THE YOUTUBE API WITH A MESSAGE"',
            superChatDetails: {
              amountMicros: "2000000",
              currency: "CAD",
              amountDisplayString: "CA$2.00",
              userComment: "HERE IS A TEST OF THE YOUTUBE API WITH A MESSAGE",
              tier: 2,
            },
          },
          authorDetails: {
            channelId: "UCKZigHbgpJG9ldxXMqmiZUg",
            channelUrl:
              "http://www.youtube.com/channel/UCKZigHbgpJG9ldxXMqmiZUg",
            displayName: "@vulbyte",
            profileImageUrl:
              "https://yt3.ggpht.com/jrcU7ZjcLMBzCQbU6QMucPmC-cBiHOFrmTpDS9gDzUdH9FUTyzqgrkX9-rXzRh6Fac_HWWgNoEA=s88-c-k-c0x00ffffff-no-rj",
            isVerified: false,
            isChatOwner: true,
            isChatSponsor: false,
            isChatModerator: false,
          },
        },
        receivedAt: 1774572732560,
      },
      {
        //donation with no message
        version: 1,
        apiVersion: 3,
        platform: "YouTube",
        data: {
          kind: "youtube#liveChatMessage",
          etag: "-mh60g2cUZ1R7_bp6EA76nY3uq0",
          id: "LCC.EhwKGkNOUEloTGU2dnBNREZmSEN3Z1FkR0lnaTlR",
          snippet: {
            type: "superChatEvent",
            liveChatId:
              "Cg0KC09FeE9LRGI0WnFzKicKGFVDS1ppZ0hiZ3BKRzlsZHhYTXFtaVpVZxILT0V4T0tEYjRacXM",
            authorChannelId: "UCKZigHbgpJG9ldxXMqmiZUg",
            publishedAt: "2026-03-26T21:07:12.021491+00:00",
            hasDisplayContent: true,
            displayMessage: "CA$1.00 from @vulbyte",
            superChatDetails: {
              amountMicros: "1000000",
              currency: "CAD",
              amountDisplayString: "CA$1.00",
              tier: 1,
            },
          },
          authorDetails: {
            channelId: "UCKZigHbgpJG9ldxXMqmiZUg",
            channelUrl:
              "http://www.youtube.com/channel/UCKZigHbgpJG9ldxXMqmiZUg",
            displayName: "@vulbyte",
            profileImageUrl:
              "https://yt3.ggpht.com/jrcU7ZjcLMBzCQbU6QMucPmC-cBiHOFrmTpDS9gDzUdH9FUTyzqgrkX9-rXzRh6Fac_HWWgNoEA=s88-c-k-c0x00ffffff-no-rj",
            isVerified: false,
            isChatOwner: true,
            isChatSponsor: false,
            isChatModerator: false,
          },
        },
        receivedAt: 1774559232021,
      },
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
    superChatTest.innerText = 'test "superChatEvent" message';
    superChatTest.style = `
			background-color: "#1E88E5";
			color: "#fff";
		`;
    superChatTest.onclick = () => {
      this.yt.ProcessYoutubeV3Data_v1(
        superChatEventMessages[
          Math.floor(Math.random() * superChatEventMessages.length)
        ],
      );
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
  CreateCockatielDragableChild(INPUT = { 
	  color: null, 
	  HTML: null, 
	  icon: null,
	  platform: null,
	  title: null,
  }) {
	function EvalHighestContrastColor(color) {
	    try {
		if (!color || typeof color !== 'string') throw new Error("Invalid color");

		let hex = color.replace('#', '');
		let r, g, b;

		if (hex.length === 3) { // 4bit RGB
		    r = parseInt(hex[0] + hex[0], 16);
		    g = parseInt(hex[1] + hex[1], 16);
		    b = parseInt(hex[2] + hex[2], 16);
		} else if (hex.length === 6) { //8bit RGB
		    r = parseInt(hex.substring(0, 2), 16);
		    g = parseInt(hex.substring(2, 4), 16);
		    b = parseInt(hex.substring(4, 6), 16);
		} else if (hex.length === 8) { // 8bit RGBA
		    r = parseInt(hex.substring(0, 2), 16);
		    g = parseInt(hex.substring(2, 4), 16);
		    b = parseInt(hex.substring(4, 6), 16);
		} else {
		    throw new Error("Unsupported hex length");
		}

		const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

		return Result.ok(luminance > 0.5 ? "#000000" : "#ffffff");
		
	    } catch (err) {
		return Result.err(`could not EvalHighestContrastColor(${color}): ${err.message}`);
	    }
	}

	function SetHandleTitleColor(color, id){
		try{
			let elem = document.getElementById(id);
			if(elem == null){
				return Result.err(`elem is null, ${id}`);
			}
			let newColor = EvalHighestContrastColor(color);
			if(newColor.isFailure){
				return Result.err(`EvalHighestContrastColor() failed ${newColor.err}`);
			}
			elem.style.color = newColor.value;
			return Result.ok(newColor.value);

		}
		catch(err){
			console.error(err);
		}

	}

    try {
	    if(INPUT.color == null){
		    let r = Number(Math.floor(Math.random() * 255));
		    let g = Number(Math.floor(Math.random() * 255));
		    let b = Number(Math.floor(Math.random() * 255));
		    INPUT.color  = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
	    }
	    if(INPUT.HTML ==  null){
		    INPUT.HTML = document.createElement("div");
		    INPUT.HTML.innerText = "no inner text given";
	    }
	    if(INPUT.title == null){
		    INPUT.title = "no title given";
	    }
	    if(INPUT.icon == null){
		    INPUT.icon = ""
	    }
      const UUID = crypto.randomUUID();
      let handleGap = `0.3rem`;
      let iconSize = `1.5rem`;
      const handleClass = "handle-" + UUID;


      // for things being moved
      let styleSheet = document.createElement("style");
      document.head.append(styleSheet);
      const movingClassName = ".isBeingMoved";
      const borderRadius = `0.4rem`;

      styleSheet.sheet.insertRule(
        `${movingClassName} {  
            filter: opacity(0.5);
            }`,
        styleSheet.sheet.cssRules.length,
      );

      //for bg and border color
      styleSheet.sheet.insertRule(
        `:root { --${handleClass}-color: ${INPUT.color}; }`,
        0,
      );
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
        styleSheet.sheet.cssRules.length,
      );
      styleSheet.sheet.insertRule(
        `.${handleClass}:hover {
                background-color: #00000077;
            }`,
        styleSheet.sheet.cssRules.length,
      );
      //mousedown
      styleSheet.sheet.insertRule(
        `.${handleClass}:active {  
                background-color: #000000bb;
            }`,
        styleSheet.sheet.cssRules.length,
      );
      // FIX: Add this rule right below your existing ones
      styleSheet.sheet.insertRule(
        `body.global-dragging #${handleClass}-textPrompt {
            pointer-events: auto !important;
            }`,
        styleSheet.sheet.cssRules.length,
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
            /*min-height: 10rem;*/
	    width: 100%;
        `;
      console.log(INPUT.color);

      const hoverOver = document.createElement("div");
      hoverOver.id = `${handleClass}-hover_over`;
      hoverOver.style.cssText = `
                border-color: ${INPUT.color};
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

      function EndDrag() {
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
        const targetCard = e.target.closest(".cockatiel-widget");

        // Safety check
        if (!targetCard || droppedElement === targetCard) return;

        // 2. Perform the Physical Move
        // This physically updates the DOM list so the browser renders it correctly
        targetCard.after(droppedElement);

        // 3. The "Sync" Step:
        // Now that the DOM is physically correct, iterate through the container
        // and re-assign every single order property to match its new physical index.
        const allSiblings = Array.from(
          textContainer.querySelectorAll(".cockatiel-widget"),
        );

        allSiblings.forEach((child, index) => {
          child.style.order = index;
        });

        EndDrag();
      });

      hoverOver.appendChild(textContainer);
      container.appendChild(hoverOver);

      const body = document.createElement("details");
	body.open = true;
      body.id = `${UUID}-body`;
      body.style.cssText = `
	    	box-sizing: border-box;
                padding: 0.6rem;
                display: block; /* FIX: Changed from invalid position: inline; */
		width: 100%;
            `;
    	//body.addEventListener("toggle", () => {
	//    indicator.style.transform = body.open ? "rotate(0deg)" : "rotate(-90deg)";
	//});
      const containerHandle = document.createElement("summary");
      containerHandle.style.cssText = `
                border-radius: ${borderRadius};
                background-color: var(--${handleClass}-color);                    
                display: grid;
                gap: ${handleGap};
                grid-template-columns: repeat(auto-fit, minmax(${iconSize}, ${iconSize}));
                flex-direction: row;
                overflow-x: scroll;
		overflow-y: hidden;
                padding: 0.3rem;
                position: relative;
                top: 0px;
                left: 0px;
                height: ${iconSize};
                width: 100%;
		/*max-width: 16rem;*/
            `;

	const IconContainer = document.createElement("div");
		const icon = document.createElement("img");

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
      moveHandle.addEventListener("dragstart", (e) => {
        try {
          console.log("drag begin");
          let elem = document.getElementById(container.id);
          elem.classList.add("isBeingMoved");
          // Save the container's ID into the drag data
          e.dataTransfer.setData("text/plain", container.id);

          console.log("Started dragging container:", container.id);
        } catch (err) {
          console.error(err);
        }
      });
      moveHandle.addEventListener("dragend", (e) => {
        try {
          console.log("drag end");
          let elem = document.getElementById(container.id);
          elem.classList.remove("isBeingMoved");
        } catch (err) {
          console.error(err);
        }
      });
      containerHandle.append(moveHandle);

    // Create the graphic element
// Create the graphic element
    const indicator = document.createElement("div");
    indicator.style.display = "inline-block";
    indicator.style.marginRight = "0.5rem";
	indicator.style.aspect = "1/1";
    indicator.style.cursor = "pointer"; // Added to show it's clickable
      indicator.classList.add(handleClass);
      indicator.classList.add("moveHandle");

    // Define icons for states
    const ICON_OPEN = "👀";
    const ICON_CLOSED = "🙈";

    // Set initial state
    indicator.innerText = body.open ? ICON_OPEN : ICON_CLOSED;

    // Listener to update graphic
    body.addEventListener("toggle", () => {
        indicator.innerText = body.open ? ICON_OPEN : ICON_CLOSED;
	INPUT.platform.SetConfigValue("isHidden",  body.open);
    });

    // Make the graphic toggle the open state when clicked
    indicator.addEventListener("click", (e) => {
        e.preventDefault(); 
        body.open = !body.open;
    });

    containerHandle.append(indicator);	


      //detatch btn
      const detatchHandle = document.createElement("div");
      detatchHandle.id = `${UUID}-detatch_button`;
      detatchHandle.innerText = "⤴️";
      detatchHandle.classList.add(handleClass);
      detatchHandle.classList.add("moveHandle");
      detatchHandle.style.cssText =
        detatchHandle.style.cssText +
        `
                        cursor: pointer;
                        user-select: none;
                    `;
      containerHandle.append(detatchHandle);
      //reattach btn
      const reattachHandle = document.createElement("div");
      detatchHandle.id = `${UUID}-detatch_button`;
      reattachHandle.innerText = "↩️";
      reattachHandle.classList.add(handleClass);
      reattachHandle.classList.add("moveHandle");
      reattachHandle.style.cssText =
        reattachHandle.style.cssText +
        `
                        cursor: pointer;
                        user-select: none;
                    `;
      containerHandle.append(reattachHandle);
      //lock btn
      const lockHandle = document.createElement("div");
      lockHandle.innerText = "🔓";
      lockHandle.id = String(container.id + "-lock_handle");
      lockHandle.classList.add(handleClass);
      lockHandle.classList.add("moveHandle");
      lockHandle.style.cssText =
        lockHandle.style.cssText +
        `
                        cursor: pointer;
                        user-select: none;
                    `;
      lockHandle.dataset.isLocked = "false";
      lockHandle.addEventListener("click", (e) => {
        const isLocked = lockHandle.dataset.isLocked === "true";
        lockHandle.dataset.isLocked = isLocked ? "false" : "true";
        if (isLocked == false) {
          document.getElementById(lockHandle.id).innerText = "🔒";
        } else {
          document.getElementById(lockHandle.id).innerText = "🔓";
        }
        console.log("lh is:", lockHandle.dataset.isLocked);
      });
      containerHandle.append(lockHandle);

      const recolorHandle = document.createElement("input");
      recolorHandle.type = "color";
      recolorHandle.value = INPUT.color;
      recolorHandle.innerText = "🔓";
      recolorHandle.id = String(container.id + "-recolor_handle");
      recolorHandle.classList.add(handleClass);
      recolorHandle.classList.add("moveHandle");
	recolorHandle.style.gridColumn = "span 3";
      recolorHandle.addEventListener("change", (e) => {
		document.documentElement.style.setProperty(
		  `--${handleClass}-color`,
		  e.target.value,
		);
		try{
			console.error(e.target.value);
	 		document.getElementById(recolorHandle.id).style.color = SetHandleTitleColor(e.target.value, `${UUID}-title`).value;
			INPUT.platform.SetConfigValue("color", e.target.value);
		}
	      catch(err){
		      console.error(err);
	      }
      });
      containerHandle.append(recolorHandle);

	const handleTitle = document.createElement("input");
	handleTitle.value = INPUT.title;
	handleTitle.style = `
		all: unset;
    `;
	handleTitle.style.fontSize = "0.8rem";
	handleTitle.style.fontWeight = "bolder";;
	handleTitle.id = `${UUID}-title`;
	const contrastResult = EvalHighestContrastColor(INPUT.color);
	if (contrastResult.isSuccess) {
	    handleTitle.style.color = contrastResult.value;
	}
	handleTitle.style.minWidth = `${INPUT.title.length * 0.8}rem`;
	handleTitle.style.padding = `0.5rem`;
	handleTitle.style.margin = 0;
	handleTitle.style.gridColumn = "span 10";
	handleTitle.addEventListener("change", ((e)=>{
		try{
			if(INPUT.platform == null){
				Result.ok("no platform to update");
			}
			INPUT.platform.SetConfigValue("title", document.getElementById(handleTitle.id).value);
			Result.ok("no platform to update");
		}
		catch(err){
			Result.err(`could not update the title of the platform ${err}`);
		}
	}));

	containerHandle.append(handleTitle);


      body.append(containerHandle);

      const br = document.createElement("br");
      body.append(br);
    if(INPUT.HTML.isSuccess != null){
	    body.append(INPUT.HTML.value);
    }
	    else if(INPUT.HTML.isSuccess == null && INPUT.HTML.isFailure == null){
		    body.append(INPUT.HTML);
	    }
      container.append(body);

      //always keep below right before return
      return Result.ok(container);
    } catch (err) {
      return Result.err(
        `could not create dragable child from HTML:\n${INPUT.HTML}, \n${err}\n${err.stack}`,
      );
    }
  }

  GenerateUI() {
      if (!document.body.dataset.dragTrackerAttached) {
        document.body.dataset.dragTrackerAttached = "true";
        document.addEventListener("dragstart", () =>
          document.body.classList.add("global-dragging"),
        );
        document.addEventListener("dragend", () =>
          document.body.classList.remove("global-dragging"),
        );
      }

      const g = document.createElement("div");
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
	titleContainer.append(
	      credit,
	      title, 
	);
	titleContainer.append(document.createElement("br"));

	// Remove the Result.ok wrapper
	let saveBtn = document.createElement("input");
	saveBtn.type = "button";
	saveBtn.value = "save"; // Note: 'value', not 'innerText' for <input type="button">
	saveBtn.addEventListener("click", () => this.EmitSave());
	titleContainer.append(saveBtn);

	titleContainer.append(saveBtn);


	const TC = class TitleClass extends BaseClass {
	    extraConfig = {
		color: "#000000",
		title: "Cockatiel - by vulbyte",
	    };
	    constructor() {
			super({
				childClassName: new.target.name,
				extraConfig: new.target.extraConfig,
			});
	    }


	    Save() {
		localStorage.setItem(`${new.target.name}_config`, JSON.stringify(this.GetConfigValue("*")));
	    }
	};

	const titlePlatform = new TC({
	    title: "Cockatiel - By Vulbyte",
	    color: '#' + Math.floor(Math.random()*8*255*3).toString(16).padStart(6, '0'),
	});

	let titalContainerFinal = this.CreateCockatielDragableChild({
	    title: titlePlatform.GetConfigValue("title").value, 
	    color: titlePlatform.GetConfigValue("color").value,
	    platform: titlePlatform, // Pass the instance here
	    HTML: titleContainer,
	});

	if (titalContainerFinal.isSuccess) {
	    const container = titalContainerFinal.value;
	    container.setAttribute("draggable", "true");
	    container.classList.add("draggable");
	    
	    g.append(container);
	} else {
	    console.error("Failed to create container:", titalContainerFinal.error);
	}


	function AddUI(input) {
		try{
		    let res;
			input.HTMLContainer = window.Cockatiel.CreateCockatielDragableChild(input);
			
			if (input.HTMLContainer.isSuccess) {
			    res = g.append(input.HTMLContainer.value);
			    return Result.ok(res);
			} else {
			    return Result.err(`Failed to create draggable child: ${res}`);
			}
		    } 		
		catch(err){
			return Result.err(`failed to run AddUI \n${err}`);
		}
	}

	let uiArray = [
		{
			HTML: this.BannedWordsManager.GenerateUI(), 
			color: this.BannedWordsManager.GetConfigValue("color").value,
			title: this.BannedWordsManager.GetConfigValue("title").value,
			platform: this.BannedWordsManager,
		},
		{
			HTML: this.ChatManager.GenerateUI(), 
			color: this.ChatManager.GetConfigValue("color").value,
			title: this.ChatManager.GetConfigValue("title").value,
			platform: this.ChatManager,
		},
		{
			HTML: this.EventsManager.GenerateUI(), 
			color: this.EventsManager.GetConfigValue("color").value,
			title: this.EventsManager.GetConfigValue("title").value,
			platform: this.EventsManager,
		},
		{
			HTML: this.ScoreHandler.GenerateUI(), 
			color: this.ScoreHandler.GetConfigValue("color").value,
			title: this.ScoreHandler.GetConfigValue("title").value,
			platform: this.ScoreHandler,
		},
		{
			HTML: this.Timeline.GenerateUI(), 
			color: this.Timeline.GetConfigValue("color").value,
			title: this.Timeline.GetConfigValue("title").value,
			platform: this.Timeline,
		},
		{
			HTML: this.TtsManager.GenerateUI(), 
			color: this.TtsManager.GetConfigValue("color").value,
			title: this.TtsManager.GetConfigValue("title").value,
			platform: this.TtsManager,
		},
		{
			HTML: this.UserManager.GenerateUI(), 
			color: this.UserManager.GetConfigValue("color").value,
			title: this.UserManager.GetConfigValue("title").value,
			platform: this.UserManager,
		},
		{
			HTML: this.Twitch.GenerateUI(), 
			color: this.Twitch.GetConfigValue("color").value,
			title: this.Twitch.GetConfigValue("title").value,
			platform: this.Twitch, 
		},
		{
			HTML: this.Youtube.GenerateUI(), 
			color: this.Youtube.GetConfigValue("color").value,
			title: this.Youtube.GetConfigValue("title").value,
			platform: this.Youtube, 
		},
	];

	for (let i = 0; i < uiArray.length; ++i) {
		try{
		    let res = AddUI(uiArray[i]);
		    if(res.isFailure){
			console.warn(`could not add item to the UI: \n${uiArray[i]}`);
		    }
		}
		catch(err){
			console.warn(`could not create or add item to the UI: \n${uiArray[i]}`);
		}
	}

      document.body.append(g);

      return Result.ok("created UI successfully");
  }

  async Init() {
    if (this.#hasInited) return; // Stop if already running

	this.d = document; // document
	this.BannedWordsManager = new BannedWordsManager();
	if(this.BannedWordsManager.Init().isFailure){throw new Error("bannedWordsManager failed to init")}
	this.ChatManager = new ChatManager();
	if(this.ChatManager.Init().isFailure){throw new Error("chatManager failed to init")}
	this.EventsManager = new EventsManager();
	if(this.EventsManager.Init().isFailure){throw new Error("eventsManagerfailed to init")}
	this.ScoreHandler = new ScoreHandler();
	if(this.ScoreHandler.Init().isFailure){throw new Error("scoreHandler failed to init")}
	this.Timeline = new Timeline();
	if(this.Timeline.Init().isFailure){throw new Error("timeline failed to init")}
	this.TtsManager = new TtsManager();
	if(this.TtsManager.Init().isFailure){throw new Error("tts manager failed to init")}
	this.UserManager = new UserManager();
	if(this.UserManager.Init().isFailure){throw new Error("userManager failed to init")}
	this.Twitch = new Twitch();
	if(this.Twitch.Init().isFailure){throw new Error("twitch failed to init")}
	this.Youtube = new Youtube();
	if(this.Youtube.Init().isFailure){throw new Error("youtubekfailed to init")}

    this.d.body.append(this.GenerateUI());

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
