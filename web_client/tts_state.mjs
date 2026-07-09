import {BaseClass} from "./baseClass.mjs";

import {DebugPrint} from "./DebugPrint.mjs";
import {IntTimer} from  "./intTimer.mjs";
import {Result} from "./result.mjs";

export class TtsManager extends BaseClass {
	static extraConfig = {
		useAi: true,
		aiEndpoint: "http://127.0.0.1:5002/api/tts", 
		volume: 1.0,
		rate: 1.0,  
		pitch: 1.0,
		color: "#0ff",
		title: "tts manager",
	    };
    constructor(configMap = null) {

	super({
		childClassName: new.target.name,
		extraConfig: new.target.extraConfig,
	});
 
        // Pre-load voices for the fallback to ensure they are ready
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }
    }

    #isBusy = false;
    #queue = [];

    isBusy(){
	return this.#isBusy;
    }



    // ==========================================
    // LISTENERS
    // ==========================================
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

    // ==========================================
    // TTS LOGIC
    // ==========================================
    isAiReady() {
        return this.GetConfigValue('useAi').value && this.GetConfigValue('aiEndpoint').value;
    }

    // Public method to add text to the speaking queue
    Speak(text) {
        if (!text || text.trim() === "") return;
        this.#queue.push(text);
        this.#ProcessQueue();
    }

	// Extracted the WebTTS logic to keep CallTts clean
	async FallbackToWebTTS(message, textToSpeak, ttsCmd) {
	    const voices = await new Promise((resolve) => {
		let v = window.speechSynthesis.getVoices();
		if (v.length > 0) resolve(v);
		else window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
	    });

	    const utterance = new SpeechSynthesisUtterance(textToSpeak);
	    const flags = ttsCmd.flags || {};
	    
	    utterance.rate = Number(flags.r) || 1;
	    utterance.pitch = Number(flags.p) || 1;
	    if (flags.v !== undefined && voices[flags.v]) utterance.voice = voices[flags.v];

	    return new Promise((resolve, reject) => {
		utterance.onstart = () => {
		    ttsCmd.readAt = Date.now();
		    if (message.state) message.state.isRead = true;
		};
		utterance.onend = () => resolve("SUCCESS");
		utterance.onerror = (e) => {
		    ttsCmd.readAt = "ERROR";
		    reject(e);
		};
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(utterance);
	    });
	}	

	async CallTts(message) {
	    this.DebugPrint({ msg: "CallTts: Starting TTS for message:", val: message });

	    if (!message) return;
	    const ttsCmd = message.commands?.tts;
	    if (!ttsCmd || !ttsCmd.isValid) return;

	    const textToSpeak = ttsCmd.message || "No text";

	    // 1. Attempt to use local Rust Microservice
	    try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for probe

		const response = await fetch('http://127.0.0.1:5002/api/tts', {
		    method: 'POST',
		    headers: { 'Content-Type': 'application/json' },
		    body: JSON.stringify({ text: textToSpeak }),
		    signal: controller.signal
		});

		if (response.ok) {
		    this.DebugPrint({ msg: "TTS: Using Rust Microservice" });
		    const audioBlob = await response.blob();
		    const audio = new Audio(URL.createObjectURL(audioBlob));
		    
		    // Mark state as read
		    ttsCmd.readAt = Date.now();
		    if (message.state) message.state.isRead = true;
		    
		    return audio.play();
		}
		throw new Error("Service returned error");
	    } catch (err) {
		this.DebugPrint({ msg: "TTS: Microservice unavailable, falling back to WebTTS", type: "w" });
		return this.FallbackToWebTTS(message, textToSpeak, ttsCmd);
	    }
	}

	async FindOldestUnreadTtsAndCall() {
	    this.DebugPrint({ msg: "find and call tts called" });

	    const returnObj = await this.GetOldestUnreadTtsAndMarkRead();
	    this.DebugPrint({msg: "alleged oldest unread tts message:", val: returnObj});

	    if (returnObj == null) {
		this.DebugPrint({msg: "no tts messages found, queue is empty"});
		return false;
	    }

	    const message = returnObj.message;

	    if (!message) {
		this.DebugPrint({ msg: "no tts message found, returning", val: message });
		return false;
	    }

	    // 2. IMMEDIATE LOCK — find the real index in event_timeline by messageId
	    const timelineIndex = this.GetEventTimelineIndexByMessageId(message.messageId);

	    if (timelineIndex == -1) {
		this.DebugPrint({ msg: "could not find message in event_timeline by messageId", val: message.messageId, type: 'e' });
	    } else {
		this.DebugPrint({ msg: "FOUND MATCHING MESSAGE ID, MARKING READ", val: timelineIndex });
		this.event_timeline[timelineIndex].commands.tts.state.readAt = Date.now();
	    }

	    this.DebugPrint({ msg: "oldest message found, calling tts", val: message });

	    // FIX: Delegate to your robust CallTts implementation instead of a missing global object
	    return await this.CallTts(message);
	}

	async GetOldestUnreadTtsAndMarkRead() { // TODO:this needs to be redone so that way it can look up messages by messageId
		let messages = await this.GetMessages();
		let currentTime = Date.now();
		    for (let i = 0; i < messages.length; i++) {
			    if(
				    messages[i].commands.tts != undefined
				    && typeof(messages[i].commands.tts.state.readAt) != "number"
			    ){
				    try{
						    this.DebugPrint({msg: "found tts with null readAt", val: messages[i]});
						    messages[i].commands.tts.state.readAt = Date.now(); // ✅
						    this.DebugPrint({msg: "updated value so is now read", val: messages[i]});
						return {message: messages[i], index: i}
					    }
				    catch(err){
					this.DebugPrint({msg: `message at i(${i}) does not have a tts command`});
				    }
			    }
			}

		    return null;
	}

	/**
	 * Generates a TTS Voice Tester UI that interfaces with window.Cockatiel.CallTts.
	 * @returns {HTMLElement} The container element.
	 */
	CreateTtsUI() {
	    const container = document.createElement("div");
	    let state = window.Cockatiel.GetState();
		
	    container.style = `
		font-family: sans-serif; 
		padding: 20px; 
		background: #1a1a1a; 
		color: #eee; 
		border-radius: 12px; 
		border: 1px solid #333; 
		max-width: 90%;
		margin:auto;
	    `;

	    // --- 1. Top Controls (Text, Pitch, Rate) ---
	    const controlsGrid = document.createElement("div");
	    controlsGrid.style = `
		display: grid; 
		grid-template-columns: 2fr 1fr 1fr; 
		gap: 15px;
		margin-bottom: 20px; 
		align-items: end;
	    `;

	    const textGroup = document.createElement("div");
	    textGroup.innerHTML = `<label style="
		display:block; 
		margin-bottom:5px; 
		font-size:0.8rem; 
		color:#888;
	    ">Test Message</label>`;
	    const testInput = document.createElement("input");
	    testInput.value = "Testing the Cockatiel TTS system.";
	    testInput.style = `
		width:100%; 
		padding:8px; 
		/*background:#222; */
		border:1px solid #444; 
		/*color:#fff;*/
		border-radius:4px; 
		box-sizing: border-box;
	    `;
	    textGroup.appendChild(testInput);

	// --- Pitch Group ---
	const pitchGroup = document.createElement("div");
	pitchGroup.innerHTML = `<label id="p-val" style="
		display:block; 
		margin-bottom:5px; 
		font-size:0.8rem;
		color:#888;
	">Pitch: ${state.commands.tts.flags.p.value}</label>`;

	const pitchInput = document.createElement("input");
	pitchInput.type = "range"; 
	pitchInput.min = "0"; 
	pitchInput.max = "2"; 
	pitchInput.step = "0.1"; 
	pitchInput.value = state.commands.tts.flags.p.value;

	pitchInput.oninput = () => {
	    // 1. Update the UI Label
	    document.getElementById("p-val").innerText = `Pitch: ${pitchInput.value}`;
	    // 2. Update the Config State
	    state.commands.tts.flags.p.value = Number(pitchInput.value);
	};
	pitchGroup.appendChild(pitchInput);


	// --- Rate Group ---
	const rateGroup = document.createElement("div");
	rateGroup.innerHTML = `<label id="r-val" style="
		display:block; 
		margin-bottom:5px;
		font-size:0.8rem;
		color:#888;
	">Rate: ${state.commands.tts.flags.r.value}</label>`;

	const rateInput = document.createElement("input");
	rateInput.type = "range"; 
	rateInput.min = "0.1"; 
	rateInput.max = "3"; 
	rateInput.step = "0.1"; 
	rateInput.value = state.commands.tts.flags.r.value;

	rateInput.oninput = () => {
	    // 1. Update the UI Label
	    document.getElementById("r-val").innerText = `Rate: ${rateInput.value}`;
	    // 2. Update the Config State
	    state.commands.tts.flags.r.value = Number(rateInput.value);
	};
	rateGroup.appendChild(rateInput);

	    controlsGrid.append(textGroup, pitchGroup, rateGroup);
	    container.appendChild(controlsGrid);

	    // --- 2. Table Setup ---
	    const tableContainer = document.createElement("div");
	    tableContainer.style = `
		max-height: 400px;
		overflow-y: auto;
		border: 1px solid #333;
		border-radius: 6px;
	    `;
	    const table = document.createElement("table");
	    table.style = `
		width: 100%; 
		border-collapse: collapse;
		background: #252525;
		font-size: 0.9rem;
	    `;
	    
	    const tbody = document.createElement("tbody");
	    table.innerHTML = `
	    <thead style="
		background:#333;
		position:sticky;
		top:0;
		z-index:1;
	    ">
	        <tr>
		    <th style="
			padding:10px;
			text-align:left
			;">ID
		    </th>
		    <th style="
		    	text-align:left;
		    ">
		    	Voice
		    </th>
		    <th>
		    	Lang
		    </th>
		    <th style="
		    	text-align:center;
		    ">
			Action
		    </th>
		</tr>
	    </thead>`;

	    // --- 3. Voice Loading Logic ---
	    const refreshVoices = () => {
		let state = window.Cockatiel.GetState();
		const voices = window.speechSynthesis.getVoices();
		const currentDefaultIdx = state.commands.tts.flags.v.value;
		tbody.innerHTML = "";

		voices.forEach((voice, index) => {
		    const isDefault = index === currentDefaultIdx;
		    const row = document.createElement("tr");
		    row.style.borderBottom = "1px solid #333";
		    
		    // Highlight logic
		    if (isDefault) {
			row.style.backgroundColor = "rgba(255, 0, 100, 0.15)";
		    }

		    row.innerHTML = `
			<td style="padding:10px; color:${isDefault ? '#ff0064' : '#666'}; font-weight:${isDefault ? 'bold' : 'normal'};">${index}</td>
			<td style="color:${isDefault ? '#ff0064' : '#4db8ff'}; font-weight:bold;">${voice.name} ${isDefault ? '(DEFAULT)' : ''}</td>
			<td style="color:#888;">${voice.lang}</td>
			<td style="padding:10px; text-align:center; display:flex; gap:5px; justify-content:center;"></td>
		    `;

		    // Test Button
		    const btnTest = document.createElement("button");
		    btnTest.innerText = "▶ Test";
		    btnTest.style = "cursor:pointer; background:#28a745; color:#fff; border:none; padding:5px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;";
		    
		    btnTest.onclick = async () => {
			const mockMessage = {
			    commands: {
				tts: {
				    isValid: true,
				    message: testInput.value,
				    flags: { v: index, p: pitchInput.value, r: rateInput.value }
				}
			    },
			    state: { isRead: false }
			};
			if (window.Cockatiel?.CallTts) await window.Cockatiel.CallTts(mockMessage);
		    };

		    // Set Default Button
		    const btnDefault = document.createElement("button");
		    btnDefault.innerText = "Set Default";
		    btnDefault.style = `cursor:pointer; background:${isDefault ? '#666' : '#ff0064'}; color:#fff; border:none; padding:5px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;`;
		    btnDefault.disabled = isDefault;

		    btnDefault.onclick = () => {
			// Update your class state
			state.commands.tts.flags.v.value = index;
			state.commands.tts.flags.p.value = pitchInput.value;
			state.commands.tts.flags.r.value = rateInput.value;
			
			// Refresh table to move highlight
			refreshVoices();
			console.log(`Default set to: ${voice.name} (Index: ${index})`);
		    };

		    const actionCell = row.querySelector('td:last-child');
		    actionCell.appendChild(btnTest);
		    actionCell.appendChild(btnDefault);
		    tbody.appendChild(row);
		});
	    };

	    window.speechSynthesis.onvoiceschanged = refreshVoices;
	    refreshVoices();

	    table.appendChild(tbody);
	    tableContainer.appendChild(table);
	    container.appendChild(tableContainer);

	    return container;
	}


    async #ProcessQueue() {
        // Prevent overlapping audio
        if (this.#isBusy || this.#queue.length === 0) return;

        this.#isBusy = true;
        this.EmitStart("Starting TTS playback");
        const textToSpeak = this.#queue.shift();

        try {
            if (this.isAiReady()) {
                this.EmitStatus("Attempting AI TTS...");
                const aiSuccess = await this.#PlayAiTts(textToSpeak);
                if (!aiSuccess) {
                    this.EmitWarn({ msg: "AI TTS failed. Falling back to Web TTS." });
                    DebugPrint({ msg: "AI TTS failed. Falling back to Web TTS." });
                    await this.#PlayWebTts(textToSpeak);
                }
            } else {
                this.EmitStatus("Using Web TTS...");
                await this.#PlayWebTts(textToSpeak);
            }
        } catch (error) {
            this.EmitError(`TTS Pipeline Error: ${error}`);
            console.error("TTS Pipeline Error:", error);
            // Hard fallback just in case the AI pipeline throws an unhandled exception
            await this.#PlayWebTts(textToSpeak).catch(e => {
                this.EmitError(`Total TTS Failure: ${e}`);
                console.error("Total TTS Failure:", e);
            });
        } finally {
            this.#isBusy = false;
            this.EmitStop("TTS playback finished");
            this.#ProcessQueue(); // Check if more messages arrived while speaking
        }
    }

    async #PlayAiTts(text) {
        return new Promise(async (resolve) => {
            try {
                const url = `${this.GetConfigValue("aiEndpoint").value}?text=${encodeURIComponent(text)}`;
                const response = await fetch(url);

                if (!response.ok) {
                    this.EmitWarn(`AI Server responded with status: ${response.status}`);
                    return resolve(false);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                audio.volume = this.GetConfigValue("volume").value;

                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl); // Clean up memory
                    resolve(true);
                };

                audio.onerror = (e) => {
                    this.EmitError("AI Audio playback error");
                    console.error("AI Audio playback error", e);
                    URL.revokeObjectURL(audioUrl);
                    resolve(false);
                };

                await audio.play();
            } catch (err) {
                // Network error, AI server is down, etc.
                this.EmitWarn(`AI Fetch Error: ${err}`);
                console.error("AI Fetch Error:", err);
                resolve(false); 
            }
        });
    }

    async #PlayWebTts(text) {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) {
                this.EmitError("Web Speech API not supported in this browser.");
                DebugPrint({ msg: "Web Speech API not supported in this browser." });
                return resolve(false);
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = this.GetConfigValue("volume").value;
            utterance.rate =   this.GetConfigValue("rate").value;
            utterance.pitch =  this.GetConfigValue("pitch").value;

            utterance.onend = () => resolve(true);
            utterance.onerror = (e) => {
                this.EmitError("Web TTS Error");
                console.error("Web TTS Error:", e);
                resolve(false);
            };

            window.speechSynthesis.speak(utterance);
        });
    }

    // ==========================================
    // UI GENERATION
    // ==========================================
    GenerateUI() {
        const container = document.createElement("div");
        container.className = "tts-config-container";
        container.style.border = "1px solid #444"; // Generic dark border, adjust as needed
        container.style.padding = "10px";
        container.style.margin = "10px 0";
        container.style.borderRadius = "4px";

        const header = document.createElement("h3");
        header.innerText = "TTS Model Configuration";
        header.style.marginTop = "0";
        container.appendChild(header);

        // Helper function to build uniform rows
        const createRow = (labelText, inputElement) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.marginBottom = "8px";

            const label = document.createElement("label");
            label.innerText = labelText;
            label.style.flex = "1";

            inputElement.style.flex = "2";
            
            row.appendChild(label);
            row.appendChild(inputElement);
            return row;
        };

	    let config = this.GetConfigValue("*").value;
	    

        // 1. Checkbox: Use AI
        const useAiInput = document.createElement("input");
        useAiInput.type = "checkbox";
        useAiInput.checked = config.useAi;
        useAiInput.style.flex = "0"; // Override flex for checkbox
        useAiInput.onchange = (e) => {
            this.SetConfigValue('useAi', e.target.checked);
            this.EmitStatus(`Config updated: useAi = ${this.SetConfigValue('useAi')}`);
        };
        
        const checkboxRow = document.createElement("div");
        checkboxRow.style.display = "flex";
        checkboxRow.style.alignItems = "center";
        checkboxRow.style.marginBottom = "10px";
        const checkboxLabel = document.createElement("label");
        checkboxLabel.innerText = "Enable Custom AI Model";
        checkboxLabel.style.marginRight = "10px";
        checkboxRow.appendChild(checkboxLabel);
        checkboxRow.appendChild(useAiInput);
        container.appendChild(checkboxRow);

        // 2. Input: AI Endpoint
        const endpointInput = document.createElement("input");
        endpointInput.type = "text";
        endpointInput.value = this.GetConfigValue("aiEndpoint").value;
        endpointInput.placeholder = "http://127.0.0.1:5002/api/tts";
        endpointInput.onchange = (e) => {
            this.SetConfigValue("aiEndpoint", e.target.value);
            this.EmitStatus(`Config updated: aiEndpoint = ${this.GetConfigValue("aiEndpoint").value}`);
        };
        container.appendChild(createRow("API Endpoint URL:", endpointInput));

        // 3. Slider: Volume
        const volumeInput = document.createElement("input");
        volumeInput.type = "range";
        volumeInput.min = "0";
        volumeInput.max = "1";
        volumeInput.step = "0.05";
        volumeInput.value = config.volume;
        volumeInput.onchange = (e) => {
            config.volume = parseFloat(e.target.value);
            this.EmitStatus(`Config updated: volume = ${config.volume}`);
        };
        container.appendChild(createRow("Master Volume:", volumeInput));

        // 4. Slider: Web Fallback Rate
        const rateInput = document.createElement("input");
        rateInput.type = "range";
        rateInput.min = "0.1";
        rateInput.max = "2";
        rateInput.step = "0.1";
        rateInput.value = config.rate;
        rateInput.onchange = (e) => {
            config.rate = parseFloat(e.target.value);
            this.EmitStatus(`Config updated: rate = ${config.rate}`);
        };
        container.appendChild(createRow("Fallback Rate:", rateInput));

        // 5. Slider: Web Fallback Pitch
        const pitchInput = document.createElement("input");
        pitchInput.type = "range";
        pitchInput.min = "0";
        pitchInput.max = "2";
        pitchInput.step = "0.1";
        pitchInput.value = config.pitch;
        pitchInput.onchange = (e) => {
            config.pitch = parseFloat(e.target.value);
            this.EmitStatus(`Config updated: pitch = ${config.pitch}`);
        };
        container.appendChild(createRow("Fallback Pitch:", pitchInput));

        return container;
    }
}
