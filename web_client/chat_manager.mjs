import {BaseClass} from "./baseClass.mjs";
import {IntTimer} from  "./intTimer.mjs";
import { Result } from "./result.mjs";

export class ChatManager extends BaseClass {
	static extraConfig = {
		key: "chatDisplay",
		height: 800,
		width: 420,  // this was an accident lol
		background: "#0f0",
		color: "#00ffff",
		title: "chat manager",
		messageDisplayDuration: 30,
		displayRateVariation: {min: 1.1, max: 5}, // min and max values for when to add the next message to chat display
		defaultStylesheet: "/stylesheets/chat/claud-bold_block.css", 
	}
	constructor(){
		super({
			childClassName: new.target.name,
			extraConfig: new.target.extraConfig,
		});
	}
	chatWindow;

	CreatePopOut(){
		this.chatWindow = window.open(
			'',
			'Cockatiel-chatWindow',
			`width=${this.config.width},height=${this.config.height}`
		);
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

	GenerateUI(){
		let phDiv = document.createElement("div");
		phDiv.innerText = "chat manager UI to go here";

		
		return Result.ok(phDiv);
	}
}
	
	/* 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 * BELOW HERE IS OLD LEGACY CRUD THAT NEEDS TO BE UPDATED 
	 */
// CreateMessageHtml(p_msg, messageId) {
// 	    // 1. Get User (Fixed property name to userUuid)
// 	    let user = this.GetUserFromUuid(p_msg.userUuid || p_msg.uuid);
// 
// 	    // 2. Safely extract user info
// 	    let icon = user?.icon || "/content/stream_utils/tib_stuff/default_icon.png";
// 	    let username = user?.username || "Unknown User";
// 
// 	    let commendments = {
// 		community: user?.stats?.community || 0,
// 		engagement: user?.stats?.engagement || 0,
// 		support: user?.stats?.support || 0,
// 		rep: user?.stats?.rep || 0,
// 	    };
// 
// 	    // 3. Extract Command and Message
// 	    let commandStr = "";
// 	    let displayMessage = p_msg.rawMessage || "";
// 
// 	    try {
// 		const commandKeys = Object.keys(p_msg.commands);
// 		if (commandKeys.length > 0) {
// 		    const firstKey = commandKeys[0];
// 		    commandStr = firstKey; // e.g., "tts" or "vote"
// 		    displayMessage = p_msg.commands[firstKey].message || p_msg.processedMessage || p_msg.rawMessage;
// 		}
// 	    } catch (err) {
// 		this.DebugPrint({ msg: "Error parsing commands", val: p_msg, err: err });
// 	    }
// 
// 	    // 4. RETURN the template literal
// 	    return `
// 			<div class="chatMessageContainer" id="${messageId}">
// 				<link rel="stylesheet" href="./stylesheets/chatMessage-modernMinimal.css">
// 				<div class="chatUserBubble">
// 					<div class="chatBubbleTailContainer">
// 						<div class="chatBubbleTailContainer"><img class="chatBubbleTail" alt="" src="/content/stream_utils/tib_stuff/whispy_tail.png"></div>
// 					</div>
// 					<div class="chatUserInfo" style="background-color:${
// 		user.styling.chatMessageContainer.chatUserBubble.chatUserInfo.styling.backgroundColor
// 					};">
// 						<div class="chatUserImageContainer"><img class="chatUserImage" alt="" src="${icon}"></div>		
// 						<div class="chatUserStats">
// 							<div class="chatUsername">${username}</div>		
// 							<div class="chatUserCommendations">
// 								C: ${commendments.community}, 
// 								E: ${commendments.engagement}, 
// 								S: ${commendments.support}, 
// 								R: ${commendments.rep}
// 							</div>
// 						</div>
// 					</div>
// 				</div>
// 				<div class="chatMessageBubble">
// 					<div class="chatCommandContainer">
// 						<div class="chatCommand">${commandStr}</div>
// 					</div>
// 					<div class="chatMessage">${displayMessage}</div>
// 				</div>
// 			</div>
// 		`;
// 	}
// 
// 	CreateDonationHtml(p_msg, messageId) {
// 		console.warn(JSON.stringify(p_msg));
// 	    // 1. Get User (Fixed property name to userUuid)
// 	    let user = this.GetUserFromUuid(p_msg.userUuid || p_msg.uuid);
// 
// 	    // 2. Safely extract user info
// 	    let icon = user?.icon || "/content/stream_utils/tib_stuff/default_icon.png";
// 	    let username = user?.username || "Unknown User";
// 
// 	    let commendments = {
// 		community: user?.stats?.community || 0,
// 		engagement: user?.stats?.engagement || 0,
// 		support: user?.stats?.support || 0,
// 		rep: user?.stats?.rep || 0,
// 	    };
// 
// 	    // 3. Extract Command and Message
// 	    let commandStr = "";
// 	    let displayMessage = p_msg.rawMessage || "";
// 
// 	    // 4. RETURN the template literal
// 	    return `
// 		<div class="chatMessageContainer donor-neon" id="${messageId}" style="
// 			font-size: 1.6rem;
// 		    position: relative;
// 		    padding: 0.3rem;
// 		    background: linear-gradient(-90deg, #ffff00, #ff00ff, #00ffff, #ffff00);
// 		    background-size: 200% 200%;
// 		    animation: gradientMove 4s linear infinite;
// 		    border-radius: 0.7rem;
// 		    margin: 0.3rem 0.15rem;
// 		    max-width:60rem;
// 		">
// 		    <style>
// 			@keyframes gradientMove {
// 			    0% { background-position: 0% 50%; }
// 			    100% { background-position: 200% 50%; }
// 			}
// 		    </style>
// 		    
// 		    <div style="background: #000; border-radius: 0.0rem; padding: 0.5rem;">
// 			<div style="display:flex; align-items: center; margin: 0.5rem;">
// 			    <img src="${icon}" alt="" style="width:3rem !important; height:3rem !important; border-radius: 100%; box-shadow: 0 0 0.7rem #00ffff;">
// 			    <div style="margin-left: 0.6rem;">
// 				<span style="color: #00ffff; font-weight: 900; display:block;">
// 					${p_msg.username}
// 				</span>
// 				<span style="color: #ff00ff;">
// 					donation amount:
// 				</span>
// 				<span style="color: #ffff00;">
// 					$${p_msg.donationAmount}
// 				</span>
// 			    </div>
// 			</div>
// 			<div style="color: #fff; font-family: sans-serif; letter-spacing: 0.1rem;">
// 			    ${p_msg.processedMessage}
// 			</div>
// 		    </div>
// 		</div>
// 		`;
// 	}
// 
// 	CreateSubWindow(args = {
// 	    key: undefined,
// 	    height: undefined,
// 	    width: undefined,
// 	    html: undefined,
// 	    background: "black",
// 	    color: "white",
// 	    script: undefined,
// 	    style: undefined,
// 	    stylesheet: undefined,
// 	}) {
// 	    try {
// 		if (typeof document === 'undefined') {
// 		    this.DebugPrint({ msg: "no document, cannot create sub windows" });
// 		    return;
// 		}
// 	    } catch (err) {
// 		this.DebugPrint({ msg: "document not found", error: err });
// 		return;
// 	    }
// 
// 	    const existingWin = this.subWindows[args.key];
// 	    if (existingWin && !existingWin.closed) {
// 		existingWin.focus();
// 		return;
// 	    }
// 
// 	    const features = `width=${args.width},height=${args.height},popup=yes`;
// 	    const newWin = window.open("", `win_${args.key}`, features);
// 	    this.subWindows[args.key] = newWin;
// 
// 	    const doc = newWin.document;
// 	    doc.title = `${args.key}`;
// 
// 	    // 1. Setup Styles
// 	    doc.body.style.cssText = `
// 		background:${args.background}; 
// 		color:${args.color}; 
// 		height:100vh;
// 		margin:0; 
// 		overflow:hidden; 
// 		padding:0; 
// 	    `;
// 
// 	    // override append style sheet
// 	    if (args.style) {
// 		const styleTag = doc.createElement('style');
// 		styleTag.id = `style-${args.key}`;
// 		styleTag.textContent = args.style;
// 		doc.head.appendChild(styleTag);
// 	    }
// 
// 		let linkTag; 
// 		if (args.stylesheet) {
// 		    // Fix 1: Use the variable directly, not as a string "args.stylesheet"
// 		    // Fix 2: Assign to the existing let variable instead of redeclaring const
// 		    linkTag = doc.createElement('link');
// 		    linkTag.rel = 'stylesheet';
// 		    linkTag.type = 'text/css';
// 		    linkTag.href = args.stylesheet; 
// 
// 		    doc.head.appendChild(linkTag);
// 		    this.DebugPrint({ msg: `External stylesheet linked: ${args.stylesheet}` });
// 		}
// 
// 	// 2. Setup HTML Structure
// 	if(args.html != undefined){	
// 		doc.body.innerHTML = args.html;
// 	}
// 	else{
// 		doc.body.innerHTML = `
// 	<div id="${args.key}-viewport" style="
// 	    width: 100%; 
// 	    height: 100vh; 
// 	    overflow-y: auto; 
// 	    overflow-x: hidden; 
// 	    display: flex; 
// 	    flex-direction: column; /* Normal flow: top to bottom */
// 	    justify-content: flex-start; 
// 	    gap: 12px;
// 	    padding: 1rem;
// 	    box-sizing: border-box;
// 	    scroll-behavior: smooth; /* Makes the auto-scroll look nice */
// 	"></div>
// 	`;
// 		// 3. Inject the Script
// 		if (args.script) {
// 			const scriptEl = doc.createElement("script");
// 			scriptEl.type = "text/javascript";
// 
// 			// We wrap the script to ensure it has access to the viewport immediately
// 			scriptEl.textContent = `
// 		    (function() {
// 			console.log("Sub-window '${args.key}' initialized.");
// 			${args.script}
// 		    })();
// 		`;
// 
// 			doc.body.appendChild(scriptEl);
// 		}
// 	}
// 	}
// 	GenerateChatWindow(){
// 		try{
// 			const chatSettings = structuredClone(this.#state.windows.chat);
// 			const chatStyle = ``;
// 
// 			this.CreateSubWindow({
// 			    ...chatSettings,
// 			    stylesheet: structuredClone(this.#state.windows.chat.defaultStylesheet), 
// 			    script: `
// 			    window.addEventListener("message", (event) => {
// 				const { type, payload } = event.data;
// 				
// 				if (type === 'new_chat_msg' && payload.html) {
// 				    const view = document.getElementById("${chatSettings.key}-viewport");
// 				    const target = view || document.body;
// 
// 				    const temp = document.createElement('div');
// 				    temp.innerHTML = payload.html;
// 				    const newElement = temp.firstElementChild;
// 
// 				    // 1. Initial State (Hidden to the right or just faded)
// 				    //newElement.style.opacity = '0';
// 				    newElement.style.height = '0px';
// 				    newElement.style.transform = 'translateX(20px)'; // Small nudge from right
// 				    newElement.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // Adding a slight bounce
// 				    newElement.style.padding = '0px';
// 				    newElement.style.margin = '0px';
// 				    
// 				    target.appendChild(newElement);
// 
// 				    // 2. Animate In
// 				    setTimeout(() => {
// 					view.scrollTo(0, view.scrollHeight);
// 					newElement.style.opacity = '1';
// 					newElement.style.transform = 'translateX(0)';
// 					newElement.style.height = 'auto';
// 					    newElement.style.padding = 'inherit';
// 					    newElement.style.margin = 'inherit';
// 				    }, 10);
// 
// 				    // 3. Self-Destruct Timer (Slide to Left)
// 				    const duration = ${chatSettings.messageDisplayDuration || 5} * 1000;
// 				    setTimeout(() => {
// 					if (newElement) {
// 					    // Slide off to the left
// 					    newElement.style.transition = 'all 0.6s ease-in'; 
// 					    //newElement.style.opacity = '0';
// 					    newElement.style.height = '0px';
// 					    newElement.style.transform = 'translateX(-120%)'; // Push it off-screen to the left
// 					    newElement.style.padding = '0px';
// 					    newElement.style.margin = '0px';
// 					    
// 					    // Wait for the animation to finish before removing from DOM
// 					    setTimeout(() => {
// 						newElement.remove();
// 						// Optional: if the removal causes a "jump", you can animate 
// 						// the height to 0 here as well.
// 					    }, 600);
// 					}
// 				    }, duration);
// 				}
// 			    });
// 			    `
// 			});
// 		}
// 
// 		catch(err){
// 			this.DebugPrint({msg: "could not create chat window", type: "err"});
// 		}
// 	}
// 		
// 	PushMessageToChatWindow(processedMsg) {
// 	    if (!processedMsg) return;
// 
// 	    const win = this.subWindows[this.#state.windows.chat.key];
// 	    if (!win || win.closed) {
// 		this.DebugPrint({ msg: "Sub-window unavailable", type: "w" });
// 		return;
// 	    }
// 
// 	    const msgHTML = this.CreateMessageHtml(processedMsg, processedMsg.messageId);
// 
// 	    win.postMessage({ 
// 		type: 'new_chat_msg', 
// 		payload: { html: msgHTML } 
// 	    }, "*");
// 
// 		/*
// 	    if(this.#config.commands.clip.audio != null){
// 
// 	    }
// 	    */
// 	}
// 
// 	PushDonationToChatWindow(processedMsg) {
// 	    if (!processedMsg) return;
// 
// 
// 	    const win = this.subWindows[this.#state.windows.chat.key];
// 	    if (!win || win.closed) {
// 		this.DebugPrint({ msg: "Sub-window unavailable", type: "w" });
// 		return;
// 	    }
// 
// 	let msgHTML = this.CreateDonationHtml(processedMsg);
// 
// 	    win.postMessage({ 
// 		type: 'new_chat_msg', 
// 		payload: { html: msgHTML } 
// 	    }, "*");
// 	}
// 
// 	PushSystemNotificaitonToChatWindow(strang) {
// 	    if(!strang){
// 		this.DebugPrint({msg: "strang is undefined, cannot print", type: 't'});
// 		return false;
// 	    }
// 
// 	    const win = /*structuredClone*/(this.subWindows[this.#state.windows.chat.key]);
// 	    if (!win || win.closed) {
// 		this.DebugPrint({ msg: "Sub-window unavailable", type: "w" });
// 		return false;
// 	    }
// 
// 	    let html = `
// 		    <div style="
// 		    	border: 0.2em solid #0ff;
// 		    	border-radius:3rem;
// 			background-color: #022;
// 			color: #0ff;
// 			font-family: helvetica, ariel, sans-serif;
// 			padding: 0.8rem;
// 		    ">
// 			${strang}	
// 		    </div>
// 		`
// 
// 	    win.postMessage({ 
// 		type: 'new_chat_msg', 
// 		payload: { html: html } 
// 	    }, "*");
// 
// 	    return true;
// 	}
// }
