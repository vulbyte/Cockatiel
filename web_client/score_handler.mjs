import { BaseClass } from "./baseClass.mjs";
import { Result } from "./result.mjs";

export class ScoreHandler extends BaseClass {
    static extraConfig = {
        scoring: {
            punctuationPenalty: 150,
            spacingReward: 30,
            trigramReward: 50,
            repeatPenalty: 50,
            capsReward: 20,
            spaceReward: 20,
            minWordLengthForTrigram: 3,
            messageLengthThreshold: 75
        },
	color: "#ff0",
	title: "score handler",
    };
	constructor(){
		super({
			childClassName: new.target.name,
			extraConfig: new.target.extraConfig,
		});
	}

	unixTimes = {
		month1: 2648400,
		year1: 31536000,
	}


    #constructUpdate(path, val) {
        const keys = path.split('.');
        const update = {};
        let temp = update;
        for (let i = 0; i < keys.length - 1; i++) {
            temp[keys[i]] = {};
            temp = temp[keys[i]];
        }
        temp[keys[keys.length - 1]] = val;
        return update;
    }

    GenerateUI() {
        const descriptions = {
            "scoring": {
                "punctuationPenalty": "Points deducted if long messages lack basic punctuation.",
                "spacingReward": "Points awarded for proper spacing after punctuation.",
                "trigramReward": "Points awarded for using recognized 3-letter word patterns.",
                "repeatPenalty": "Points deducted for repeating the same character three times.",
                "capsReward": "Points awarded if the message starts with a capital letter.",
                "spaceReward": "Points awarded for proper word-to-space ratio.",
                "minWordLengthForTrigram": "Minimum length a word must have for trigram checks.",
                "messageLengthThreshold": "Character count threshold for 'long' message checks."
            },
        };

        const container = document.createElement("div");
        container.style.cssText = "padding: 1rem; border: 0.1rem solid #444; border-radius: 0.4rem; width: 90%; margin: 1rem auto;";

        const title = document.createElement("h3");
        title.innerText = "Score Configuration";
        container.appendChild(title);

        const buildUI = (obj, path = "") => {
            const fragment = document.createDocumentFragment();
            for (const key in obj) {
		if(
			key == "title"
			|| key == "color"
		){
			break;
		}
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const group = document.createElement("div");
                    group.innerHTML = `<strong style="display:block; margin-top:0.5rem;">${key.toUpperCase()}</strong>`;
                    group.appendChild(buildUI(obj[key], currentPath));
                    fragment.appendChild(group);
                } else {
                    const wrapper = document.createElement("div");
                    wrapper.style.margin = "0.5rem 0";
                    const label = document.createElement("label");
                    label.innerText = `${key}: `;
                    label.title = descriptions[path.split('.')[0]]?.[key] || "No description.";
                    label.style.cursor = "help";
                    label.style.borderBottom = "0.1rem dotted #888";
                    
                    const input = document.createElement("input");
                    input.type = "number";
                    input.value = obj[key];
                    input.onchange = (e) => {
                        const update = this.#constructUpdate(currentPath, Number(e.target.value));
                        this.SetConfigValue(update);
                    };
                    wrapper.append(label, input);
                    fragment.appendChild(wrapper);
                }
            }
            return fragment;
        };

        const scorerContainer = document.createElement("div");
        scorerContainer.style.cssText = "margin-top: 2rem; border-top: 0.1rem solid #666; padding-top: 1rem;";
        
        const scoreDisplay = document.createElement("div");
        scoreDisplay.innerHTML = "<strong>Live Score:</strong> 0";
        scoreDisplay.style.fontSize = "1.5rem";

        const editor = document.createElement("div");
        editor.contentEditable = true;
        editor.style.cssText = "width: 100%; min-height: 5rem; border: 0.1rem solid #888; padding: 0.5rem; white-space: pre-wrap; outline: none; margin-top: 0.5rem;";

        const getDynamicColor = (intensity) => `hsl(${intensity * 300}, 100%, 75%)`;

        let timeout = null;
        editor.oninput = () => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const text = editor.innerText;
                const score = await this.ScoreMessage(text);
                scoreDisplay.innerHTML = `<strong>Live Score:</strong> ${score}`;
            }, 300);
        };

        scorerContainer.append(scoreDisplay, editor);
	let config = this.GetConfigValue("*").value;
        container.appendChild(buildUI(config.value));
        container.appendChild(scorerContainer);
        return Result.ok(container);
    }

    CalcUserConductScore(user = undefined) {
        if (user == undefined) throw new Error("could not calculate user conduct score, input is null");
        const { month1, year1 } = this.unixTimes;
        let conduct_score = 0;
        const now = Date.now();
        for (let i = 0; i < user.commendments.length; ++i) {
            for (let j = 0; j < user.commendments[i].length; ++j) {
                let age = now - user.commendments[i][j].happenedAt;
                conduct_score += this.Clamp({ val: (year1 * 2 - age) / (year1 * 2 - month1), min: 0, max: 1 });
            }
        }
        return conduct_score;
    }

    async ScoreMessage(message) {
        if (!message || message.length < 1 || typeof message !== "string") return 0;
        const s = this.GetConfigValue("scoring").value;
        let score = 0;
        
        if (message.length > s.messageLengthThreshold && !/[.,?!]/.test(message)) score += s.punctuationPenalty;
        for (let i = 0; i < message.length; ++i) {
            if (/[.?!]/.test(message[i]) && /[\s]/.test(message.slice(i + 1, i + 4))) score += s.spacingReward;
        }
        const words = message.trim().toLowerCase().split(/\s+/);
        for (const w of words) if (w.length >= s.minWordLengthForTrigram && (typeof trigrams !== 'undefined' ? trigrams.includes(w.slice(0, 3)) : false)) score += s.trigramReward;
        
        for (let i = 0; i < message.length - 2; ++i) if (message[i+1] == message[i] && message[i+2] == message[i]) score += s.repeatPenalty;
        if (message[0] === message.charAt(0).toUpperCase()) score += s.capsReward;
        
        let spaceCount = (message.match(/ /g) || []).length;
        if ((message.length - spaceCount > 0) && (spaceCount * 100) / (message.length - spaceCount) >= 20) score += s.spaceReward;
        
        return score;
    }

    Clamp({ val, min, max }) { return Math.min(Math.max(val, min), max); }
    DebugPrint(obj) { console.log(obj); }
}
