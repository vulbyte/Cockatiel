import {IntTimer} from  "./intTimer.mjs";

export class EventsManager {
	constructor(){}

	Init(){}

	config = {
		cycle_rate: 7,
		window: {
			key: "eventDisplay",
			height: 300,
			width: 400, 
			background: "#000",
			color: undefined,	
			defaultStylesheet: "",
		}
	};

	stateSettingsTemplate = {
			audioQueue: null,
			audioEnableLoop: false,
			video: null,	
			videoEnableLoop: false,
			videoHold: 0, //amount of seconds to hold before concluding
			startListeners: [],
			resetListeners: [],
			runningListeners: [],
			endListeners: [],
			killedListeners: [],
	};
	#listeners = {
		start: 		{...structuredClone(this.stateSettingsTempate)},
		restart: 	{...structuredClone(this.stateSettingsTempate)},
		running: 	{...structuredClone(this.stateSettingsTempate)},
		end: 		{...structuredClone(this.stateSettingsTempate)},
		killed: 	{...structuredClone(this.stateSettingsTempate)},
	};

	#eventChangeListeners = [];
	#eventClosedListeners = [];
	#eventOpenedListeners = [];

	GenerateEventHandlerControls(){

	}
	GenerateEventHandleWindow(){

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

	/*
GenerateEventsWindow(){
		try{
			//this.PushToSubWindow("chatMonitor", this.RenderStandbyHTML());
			let eventWindowSettings = structuredClone(this.#state.windows.events);
// Inside GenerateEventsWindow() function, focusing on the 'script' string:
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

	    const existingWin = this.subWindows[args.key];
	    if (existingWin && !existingWin.closed) {
		existingWin.focus();
		return;
	    }

	    const features = `width=${args.width},height=${args.height},popup=yes`;
	    const newWin = window.open("", `win_${args.key}`, features);
	    this.subWindows[args.key] = newWin;

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
	if(args.html != undefined){	
		doc.body.innerHTML = args.html;
	}
	else{
		doc.body.innerHTML = `
	<div id="${args.key}-viewport" style="
	    width: 100%; 
	    height: 100vh; 
	    overflow-y: auto; 
	    overflow-x: hidden; 
	    display: flex; 
	    flex-direction: column; /* Normal flow: top to bottom */
	/*
	    justify-content: flex-start; 
	    gap: 12px;
	    padding: 1rem;
	    box-sizing: border-box;
	    scroll-behavior: smooth; /* Makes the auto-scroll look nice */
	/*
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
	}

this.CreateSubWindow({
    ...eventWindowSettings,
    script: `
        window.addEventListener("htmlUpdate", (event) => {
            console.log("html update received!!!");
            const { type, payload } = event.data;

            if(event.type !== "htmlUpdate"){ // Use strict comparison for strings
                console.log({msg: "invalid event passed", val: event});
                return;
            }
            
            // *** THE FIX IS HERE ***
            // You must specify WHICH element to update. 
            // Assuming you want to target an element with the ID 'monitor-content'
            const targetElement = document.getElementById('monitor-content');
            
            if(targetElement){
                targetElement.innerHTML = payload; // Use innerHTML correctly
            } else {
                console.error("Error: Target element for HTML update not found.");
            }
        });
    `,
    html: `
        <div id="monitor-content">
            <div style="display: flex; justify-content:space-evenly; flex-direction:column; height: 100%; margin: auto; font-family: helvetica, sans-serif, ariel;">
                <div style="max-width:60rem; width:80%; color:white; padding: 2rem;">event monitor has yet to be started, do so to turn cockatiel on</div>
                <img style="max-width:60%; margin:auto;" src="../assets/off_tib.png">
            </div>
        </div>
    `,
});

/**
	 * Processes a validated vote command into the state.
	 * @param {Object} commandObj - The messageCommand object (isValid: true)
	 * @param {string} userUuid - The UUID of the voter
	 * @returns {boolean} - Success or failure
	 */
	/*
	async HandleVoteStateUpdate(commandObj, userUuid) { //TODO: rework this carp
	    // 1. Safety Check: Only process if the command itself is valid 
	    if (!commandObj || !commandObj.isValid) return false;

	    let eventsArr = await this.GetEvents();
	    // 2. Locate the active prediction event
	    const activePrediction = eventsArr(e => 
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
		    // TODO: add stuff here
	    });

	    // 4. Finalize
	    newPred.state.timeRemainingUntilLockout.Start();
	    this.AddEventToEventQueue(newPred);

	    return newPred;
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

	async UpdateEventDisplayWindowWithNewHTML(html){ //returns 0 on success, other on fail
		if(html == null || html == undefined){
			//this.DebugPrint({msg: "cannot update event display, no html given"});
			return 1;
		}

		//let w /*window*//* = this.subWindows[this.#state.windows.events.key];
		
		    const win = this.subWindows[this.#state.windows.events.key];
		    if (!win || win.closed) {
			//this.DebugPrint({ msg: "Sub-window unavailable", type: "w" });
			return;
		    }

		    /*win.postMessage({ 
			type: 'newHtml', 
			payload: html,
		    }, "*");*/
	/*
		win.document.body.innerHTML = html;
		return 0;
	}

	async EventDisplayManager() {
		console.log({msg: "eventDisplayManagerCalled"});
		let events = await this.GetActiveEvents();
		console.log({msg: "got events:", val: events});
		let html;
		if(events.length < 1 || events == null || events == undefined){
			html = await this.GetStandbyEventHtml();
			console.log({
				msg: "no events, adding placeholder html", 
				// val: JSON.stringify(html)
			});
			let result = await this.UpdateEventDisplayWindowWithNewHTML(html);	
			switch(result){
				case(0):
					//this.DebugPrint({msg: "event display without error"});
				default:
					console.log({
						msg: "event display errored with value:", 
						val: result, 
						type:"e"
					});
			}
			return;
		}

		//logic for multiple events
		console.log({
			msg: "at least one active event found!", 
			//val: JSON.stringify(html),
		});

		return;
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

	async GetStandbyEventHtml() {
	    let id = crypto.randomUUID();
	    // Assuming updateDelay is your starting number (e.g., 10 seconds)
	    const startCount = (this.#state.windows.events.updateDelay);

	    const GetRandomColor = () => {
		// Corrected: Math.random() is a function call
		const colors = ["#f00", "#0f0", "#00f", "#f0f", "#0ff", "#ff0", /*"#000"*//*, /*"#fff"*//*];
		const index = Math.floor(Math.random() * colors.length-1);
		return colors[index];
	    };

	    const backgroundColor = GetRandomColor();
	    
	    const GetUniqueRandomColor = (existing) => {
		let newColor = GetRandomColor();
		// Keep picking until it's different
		while (newColor === existing) {
		    newColor = GetRandomColor();
		}
		return newColor;
	    };

	    //const color = GetUniqueRandomColor(backgroundColor);

	    const html = `
	    <div style="
		background-color: ${backgroundColor}; 
		border-radius: 2rem;
		border: 0.1rem transparent #ccc; 
		color: ${backgroundColor};
		display: flex;
		font-family:helvetica, ariel, sans-serif;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		font-size: 2rem;
		/*font-family: sans-serif;*/
/*
		font-variant-numeric: tabular-nums;
		padding: 0.5rem; 
		margin: 1rem;
		position: absolute; 
		bottom: 10px; 
		right: 10px; 
		height: 3rem;
		width: 3rem;
		z-index: 1000;
	    ">
		<span id="${id}" style="mix-blend-mode:difference;">${startCount}</span>
		
		<img src="" style="display:none;" onerror="(function(){
		    const targetId = '${id}';
		    const interval = setInterval(() => {
			const elem = document.getElementById(targetId);
			if (elem) {
			    const current = parseInt(elem.innerText);
			    if (current > 0) {
				elem.innerText = current - 1;
			    } else {
				clearInterval(interval);
				// Optional: Hide the timer when it hits 0
				elem.parentElement.style.display = 'none';
			    }
			} else {
			    clearInterval(interval); 
			}
		    }, 1000); // 1000ms = 1 second ticks
		})()">
	    </div>
	    
	    <div style="width:400px; height:300px; background-color:pink; position: relative;">
		<div style="display:flex; flex-direction:column; justify-content:space-evenly; background-color:black; width:100%; height:100%;">
		    <div style="display:flex; flex-direction:row; justify-content:space-evenly; width:100%;">
			<p style="color:#ddd">No Events Happening Right Now!</p>
		    </div>
		    <div style="display:flex; flex-direction:row; justify-content:space-evenly; width:100%;">
			<div>
			    <img style="color:#aaa" src="./assets/sleepi_tib.png" alt="new events probably happening soon!">
			</div>
		    </div>
		</div>
	    </div>
	    `;    
	    return html;
	}

			this.#state.timers.EventDisplayTimer.AddTickListener((()=>{console.log("tick from event display manager")}));
			this.#state.timers.EventDisplayTimer.AddTimeoutListener((()=>{console.log("time'd out eventdisplaytimer")}));
			this.#state.timers.EventDisplayTimer.AddTimeoutListener((()=>{this.EventDisplayManager()}));
		}
		catch(err){
			this.DebugPrint({msg: "could not add test messages", type: "err", err: err});
		}
	}

	async EndPrediction(eventId, winningSide) {
	    this.DebugPrint({msg: `Ending prediction: ${eventId} with outcome: ${winningSide}`});
	    let events = await this.GetEvents();
	    const event = events.find(e => e.id === eventId);
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

	RenderPredictionHtml(event) {
	    const { id, type, state } = event;
	    let eventsWin;
		try{
			eventsWin = this.subWindows["events"];
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
/*
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
		    
		    <img src="" onload="(function(){ /* particle logic *//* })();" style="display:none;">
		</div>`;
	}

	~EventHandler(){}
}
*/
