import {DebugPrint} from "./DebugPrint.mjs"
import {TrieTree} from  "./trie_tree.mjs";
import {Result} from "./result.mjs";

export class BannedWordsManager{
	//array is for archivalness
	bannedWordsArray = [];
	//trie is for quick lookups
	BannedWordsTrie = new TrieTree();

	Init(){
		
	}

	DebugPrint(input){
		window.Cockatiel.DebugPrint(input);
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

	GenerateUI() {
		this.DebugPrint({msg: "GENERATING BLACKLIST UI"});
		
		let container = this.CHE({
		    type: 'div', 
		    id: "blacklist-config",
		    style: "border: var(--tib_border); border-radius: var(--tib_border-radius); padding: 0.5rem;"
		});

		let fileInputLabel = this.CHE({type:'label', innerText:"add banned words as a .csv or .json, feel free to drag and drop"});
		fileInputLabel.style.color = "white";
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
		    style: "font-size: 0.8rem; color: white; font-weight: bold;"
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


	UpdateBannedWordsTrie(){
		this.BannedWordsTrie = new TrieTree();
		for(let i = 0; i < this.BannedWordsArray; ++i){
			this.BannedWordsTrie.Add(this.bannedWordsArray[i]);
		}
	}
	AddBannedWord(word = undefined){
		this.DebugPrint({msg: "attepting to add banned word:", word});
		if(word == undefined){throw new Error("word is undefined");}		
		for(let i = 0; i < this.bannedWordsArray; ++i){
			if(this.bannedWordsArray[i] == word){
				this.DebugPrint({msg: "not adding word, word already in array"});
				return
			}
		}
		this.bannedWordsArray.push(word);
		this.UpdateBannedWordsTrie();
	}
	RemoveBannedWord(word = undefined) {
	    this.DebugPrint({msg: "attepting to add banned word:", word});
	    if (word === undefined) { 
		throw new Error("word is undefined"); 
	    }

	    // Ensure we are working with an array (fixes the += string bug)
	    if (!Array.isArray(this.bannedWordsArray)) {
		console.error("State Error: bannedWordsArray is not an array. Resetting...");
		return;
	    }

	    for (let i = 0; i < this.bannedWordsArray.length; ++i) {
		if (this.bannedWordsArray[i] === word) {
		    this.DebugPrint({msg: `Word "${word}" found, removing.`});
		    
		    // USE SPLICE TO MUTATE THE ARRAY
		    this.bannedWordsArray.splice(i, 1);
		    
		    // Sync your TrieTree and UI
		    this.UpdateBannedWordsTrie();
		    this.UpdateBannedWordsList(); 
		    return;
		}
	    }
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

	    this().bannedWordsArray = [...this.bannedWordsArray, ...data];

	    // Initialize the tree if it doesn't exist
	    if (!this.bannedWordsTrie || method === "replace") {
		this.DebugPrint({msg: method === "replace" ? "Replacing tree" : "Initializing new tree"});
		this.bannedWordsTrie = new TrieTree();
	    }

	    this.DebugPrint({msg: `Adding ${data.length} words to the Trie`}); 
	    // Fill the tree with the new data
	    this.UpdateBannedWordsTrie()

	    this.DebugPrint({msg: "Banned words Trie updated.", val: this.bannedWordsArray});

	    this.UpdateBannedWordsList();
	    return this.bannedWordsArray;;
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

	    const words = this.bannedWordsArray; 
	    
	    // Safety check: if words isn't iterable, exit early
	    if (!words) return;

	    this.DebugPrint("updating banned words display from banned words array", this.bannedWordsArray);
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
}
