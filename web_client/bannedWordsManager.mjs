import {BaseClass} from "./baseClass.mjs";
import {DebugPrint} from "./DebugPrint.mjs";
import {TrieTree} from "./trie_tree.mjs";
import {Result} from "./result.mjs";

export class BannedWordsManager extends BaseClass {
    static extraConfig = {
        color: `#ff00ff`,
        title: `banned Words Manager`,
        bannedWordsArray: [],
        censorshipOptions: [
            "censorByErasingEverything",
            "censorWordWithChar",
            "censorSentenceWithRandomSentence",
        ],
        censorType: 1, // index of censorshipOptions
        censorChar: "*",
        randomCensorWords: ["apple", "banana", "pear"], 
        randomSentences: ["i shoved a whole bag of jelly beans up my ass."],
    };

    constructor() {
        super({
            childClassName: new.target.name,
            extraConfig: new.target.extraConfig,
        });

        this.BannedWordsTrie = new TrieTree();
        this.UpdateBannedWordsTrie();
    }

    SafeGetBannedWordsArray() {
        let bwa;
        try {
            bwa = this.GetConfigValue("bannedWordsArray");
            if (bwa.isFailure) {
                return Result.err(`could not get banned words array ${bwa}`);
            }
            bwa = bwa.value;
            
            if (bwa.constructor != Array) {
                console.error(`BANNED WORDS ARRAY IS NOT AN ARRAY, SORRY BE WE NEED TO FORMAT THIS:  ${bwa}`);
                bwa = new Array();
            }
            return Result.ok(bwa);
        } catch(err) {
            return Result.err(`error while trying to validate banned words array`);
        }
    }

    DebugPrint(input) {
        if (window.Cockatiel && window.Cockatiel.DebugPrint) {
            window.Cockatiel.DebugPrint(input);
        }
    }

    GenerateUI() {
        this.DebugPrint({msg: "GENERATING BLACKLIST UI"});
        
        let container = this.CHE({
            type: 'div', 
            id: "blacklist-config",
            style: "border: var(--tib_border); border-radius: var(--tib_border-radius); padding: 0.5rem;"
        });

        // 1. File Upload Section
        let fileInputLabel = this.CHE({type:'label', innerText:"Add banned words as a .csv or .json, feel free to drag and drop"});
        fileInputLabel.style.color = "white";
        container.append(fileInputLabel);
        let fileInput = this.CHE({type:"input", inputType:"file"});
        fileInput.addEventListener('change', (event) => {
            this.LoadBannedWords(event);
        });
        container.append(fileInput);

        // 2. Add New Banned Word Section
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
            attributes: { type: 'button' },
            onClick: () => {
                const val = wordInput.value.trim();
                if (val) {
                    this.AddBannedWord(val);
                    wordInput.value = "";
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

        // 4. Replacement Words Section
        let replacementContainer = this.CHE({ type: 'div', style: "margin-top: 15px; padding: 10px; border: 1px solid #444;" });
        let replaceTitle = this.CHE({ type: 'h4', innerText: "Replacement Words (Pool)" });
        
        let replaceInput = this.CHE({ type: 'input', placeholder: "New replacement word..." });
        let addReplaceBtn = this.CHE({ type: 'button', innerText: "Add", onClick: () => {
            if (replaceInput.value.trim()) {
                this.AddRandomWord(replaceInput.value.trim());
                replaceInput.value = "";
            }
        }});

        let replaceList = this.CHE({ type: 'ul', id: 'replacement-words-list' });
        replacementContainer.append(replaceTitle, replaceInput, addReplaceBtn, replaceList);
        container.append(replacementContainer);
        
        // 5. Random Sentences Section
        let sentenceContainer = this.CHE({ type: 'div', style: "margin-top: 15px; padding: 10px; border: 1px solid #444;" });
        let sentenceTitle = this.CHE({ type: 'h4', innerText: "Random Sentences Pool" });

        let sentenceInput = this.CHE({ type: 'input', placeholder: "New random sentence...", style: "width: 70%;" });
        let addSentenceBtn = this.CHE({ type: 'button', innerText: "Add", onClick: () => {
            if(sentenceInput.value.trim()){
                this.AddRandomSentence(sentenceInput.value.trim());
                sentenceInput.value = "";
            }
        }});

        let sentenceList = this.CHE({ type: 'ul', id: 'sentence-pool-list' });
        sentenceContainer.append(sentenceTitle, sentenceInput, addSentenceBtn, sentenceList);
        container.append(sentenceContainer);

        // 6. Settings Section (Censor Type & Char)
        let settingsContainer = this.CHE({ type: 'div', style: "margin-top: 15px; padding: 10px; border: 1px solid #444;" });
        
        let typeLabel = this.CHE({ type: 'label', innerText: "Censor Mode: " });
        let typeSelect = this.CHE({ type: 'select' });

        const options = this.GetConfigValue("censorshipOptions").value;
        let currentType = this.GetConfigValue("censorType").value;
        
        // Read fallback
        if (currentType === null || typeof currentType !== 'number' || isNaN(currentType)) {
            currentType = 1;
        }

        // Fix: Explicitly force the numeric value onto the HTML element
        options.forEach((opt, index) => {
            let el = this.CHE({ type: 'option', innerText: opt });
            el.value = index; // Explicitly set numeric string
            if (currentType === index) el.selected = true;
            typeSelect.append(el);
        });

        // Fix: Use addEventListener and fetch value directly from the select element
        typeSelect.addEventListener("change", () => {
            const selectedIndex = parseInt(typeSelect.value, 10);
            if (!isNaN(selectedIndex)) {
                this.SetConfigValue("censorType", selectedIndex);
                this.DebugPrint({msg: "Saved new Censor Mode: " + selectedIndex});
            }
        });

        let charLabel = this.CHE({ type: 'label', innerText: " Replace Char: " });
        let charInput = this.CHE({ type: 'input', style: "width: 30px;" });
        
        // Fix: Explicitly bind the input value and event
        const currentChar = this.GetConfigValue("censorChar").value;
        charInput.value = currentChar || "*";
        
        charInput.addEventListener("input", (e) => {
            this.SetConfigValue("censorChar", e.target.value);
        });

        settingsContainer.append(typeLabel, typeSelect, charLabel, charInput);
        container.append(settingsContainer);

        // Initial Populates
        setTimeout(() => {
            this.UpdateBannedWordsList();
            this.UpdateReplacementList();
            this.UpdateSentenceList();
        }, 0); 
        
        return Result.ok(container);
    }

    UpdateGenericList(listElementId, dataArray, onRemoveCallback) {
        const listElement = document.getElementById(listElementId);
        if (!listElement) return;

        listElement.innerHTML = "";

        dataArray.forEach(item => {
            const li = this.CHE({
                type: 'li',
                style: "display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid #333;"
            });

            const span = this.CHE({ type: 'span', innerText: item });
            const removeBtn = this.CHE({
                type: 'span',
                innerText: "❌",
                style: "cursor: pointer; color: #ff5555;",
                onClick: () => {
                    onRemoveCallback(item);
                }
            });

            li.append(span, removeBtn);
            listElement.append(li);
        });
    }

    UpdateBannedWordsList() {
        const result = this.SafeGetBannedWordsArray();
        if (result.isFailure) return;

        this.UpdateGenericList(
            "banned-words-display-list",
            result.value,
            (word) => this.RemoveBannedWord(word)
        );
    }

    UpdateReplacementList() {
        const config = this.GetConfigValue("*").value;
        const list = config.randomCensorWords || [];
        
        this.UpdateGenericList(
            "replacement-words-list", 
            list, 
            (word) => this.RemoveRandomWord(word)
        );
    }

    UpdateSentenceList() {
        const config = this.GetConfigValue("*").value;
        const list = config.randomSentences || [];
        
        this.UpdateGenericList(
            "sentence-pool-list", 
            list, 
            (sentence) => this.RemoveRandomSentence(sentence)
        );
    }

    UpdateBannedWordsTrie() {
        let result = this.SafeGetBannedWordsArray();
        if (result.isFailure) {
            this.DebugPrint({ msg: "Update failed: could not get array" });
            return;
        }
        
        this.BannedWordsTrie = new TrieTree();
        
        let arr = result.value;
        for (let i = 0; i < arr.length; i++) {
            if (typeof arr[i] === 'string') {
                this.BannedWordsTrie.Add(arr[i].toLowerCase());
            }
        }
        this.DebugPrint({ msg: `Trie rebuilt with ${arr.length} words.` });
    }

    AddBannedWord(word = undefined){
        let bannedWordsArray = this.SafeGetBannedWordsArray();
        if(bannedWordsArray.isFailure) return Result.err(`could not get bannedWordsArray ${bannedWordsArray}`);
        
        let arr = bannedWordsArray.value;
        this.DebugPrint({msg: "attempting to add banned word:", word});
        if(word == undefined) throw new Error("word is undefined");        
        
        if (arr.includes(word)) {
            this.DebugPrint({msg: "not adding word, word already in array"});
            return;
        }
        
        arr.push(word);
        this.SetConfigValue("bannedWordsArray", arr);
        this.UpdateBannedWordsTrie();
        this.UpdateBannedWordsList();
    }

    RemoveBannedWord(word = undefined) {
        let result = this.SafeGetBannedWordsArray();
        if (result.isFailure) return result;
        
        let arr = result.value;
        if (word === undefined) throw new Error("word is undefined");

        const index = arr.indexOf(word);
        if (index > -1) {
            this.DebugPrint({ msg: `Word "${word}" found, removing.` });
            arr.splice(index, 1);
            this.SetConfigValue("bannedWordsArray", arr);
            this.UpdateBannedWordsTrie();
            this.UpdateBannedWordsList();
        }
    }

    async LoadBannedWords(event = undefined, method = "add") {
        this.DebugPrint({msg: "LoadBannedWords() called"});
        if (!event) throw new Error("event is null");

        let file = event.target.files[0];
        if (!file) {
            this.DebugPrint({msg: "No file detected"});
            return;
        }

        let fileType = file.name.split(".").pop().toLowerCase(); 
        let data = []; 
        const text = await file.text(); 

        if (fileType === "json") {
            this.DebugPrint({msg: ".json found, attempting to parse"});
            data = JSON.parse(text);
        } else if (fileType === "csv") {
            this.DebugPrint({msg: ".csv found, attempting to parse"});
            data = text.split(/[,\n\r]+/).map(w => w.trim()).filter(w => w !== "");
        }

        this.SetConfigValue(
            "bannedWordsArray",  
            [...this.GetConfigValue("bannedWordsArray").value, ...data]
        );

        if (!this.BannedWordsTrie || method === "replace") {
            this.DebugPrint({msg: method === "replace" ? "Replacing tree" : "Initializing new tree"});
            this.BannedWordsTrie = new TrieTree();
        }

        this.DebugPrint({msg: `Adding ${data.length} words to the Trie`}); 
        this.UpdateBannedWordsTrie();
        this.UpdateBannedWordsList();
        return this.SafeGetBannedWordsArray().value;
    }

    AddRandomWord(word) {
        let config = this.GetConfigValue("*").value;
        let list = config.randomCensorWords || [];
        if (!list.includes(word)) {
            list.push(word);
            this.SetConfigValue("randomCensorWords", list);
            this.UpdateReplacementList();
        }
    }

    RemoveRandomWord(word) {
        let config = this.GetConfigValue("*").value;
        let list = config.randomCensorWords || [];
        this.SetConfigValue("randomCensorWords", list.filter(w => w !== word));
        this.UpdateReplacementList();
    }

    AddRandomSentence(sentence) {
        let config = this.GetConfigValue("*").value;
        let list = config.randomSentences || [];
        if (!list.includes(sentence)) {
            list.push(sentence);
            this.SetConfigValue("randomSentences", list);
            this.UpdateSentenceList();
        }
    }

    RemoveRandomSentence(sentence) {
        let config = this.GetConfigValue("*").value;
        let list = config.randomSentences || [];
        this.SetConfigValue("randomSentences", list.filter(s => s !== sentence));
        this.UpdateSentenceList(); 
    }

    GetBannedRanges(input) {
        const ranges = [];
        const lowerInput = input.toLowerCase();
        
        for (let i = 0; i < input.length; i++) {
            let matchLength = this.BannedWordsTrie.FindLongestMatch(lowerInput, i);
            if (matchLength > 0) {
                ranges.push([i, i + matchLength - 1]);
                i += matchLength - 1; 
            }
        }
        return ranges;
    }

    PerformWordCensorship(input, config) {
        const ranges = this.GetBannedRanges(input);
        if (ranges.length === 0) return Result.ok(input);

        // Fallback for censorChar if it was deleted
        const cChar = config.censorChar || "*";
        
        let output = "";
        let lastIndex = 0;
        for (const [start, end] of ranges) {
            output += input.substring(lastIndex, start);
            const match = input.substring(start, end + 1);
            output += cChar.repeat(match.length);
            lastIndex = end + 1;
        }
        output += input.substring(lastIndex);
        return Result.ok(output);
    }

PerformSentenceCensorship(input, config) {
        // Split by punctuation to separate sentences and keep the punctuation delimiters
        const sentences = input.split(/([.!?]+(?:\s+|$))/);
        
        const processed = sentences.map((part, i) => {
            if (i % 2 !== 0) return part; // This is the punctuation/spacing, skip checking
            
            // Use the same robust sub-string range checking as word censorship
            const ranges = this.GetBannedRanges(part);

            // If we found any banned ranges in this sentence, replace the whole thing
            if (ranges.length > 0) {
                const list = config.randomSentences || [];
                return list.length > 0 ? list[Math.floor(Math.random() * list.length)] : part;
            }
            return part;
        });
        
        return Result.ok(processed.join(""));
    }

    CensorString(input) {
        if (!input || typeof input !== 'string') return Result.ok(input);
        
        const configResult = this.GetConfigValue("*");
        if (configResult.isFailure) return Result.ok(input);
        
        const config = configResult.value;
        
        // Actively pull the latest censorType
        const typeResult = this.GetConfigValue("censorType");
        let rawType = typeResult.isSuccess ? typeResult.value : config.censorType;

        let modeIndex = parseInt(rawType, 10);
        
        // Strict fallback to prevent errors
        if (isNaN(modeIndex) || modeIndex < 0 || modeIndex >= config.censorshipOptions.length) {
            modeIndex = 1; // Default to censorWordWithChar
        }

        const currentMode = config.censorshipOptions[modeIndex];

        switch (currentMode) {
            case "censorByErasingEverything":
                return Result.ok("");

            case "censorWordWithChar":
                return this.PerformWordCensorship(input, config);

            case "censorSentenceWithRandomSentence":
                return this.PerformSentenceCensorship(input, config);

            default:
                return Result.ok(input);
        }
    }
}
