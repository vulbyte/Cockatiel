import { Result} from "./result.mjs";

export class BaseClass {
	// INIT STUFF
	name;
	#config = {
		...structuredClone(window.Cockatiel.templates.config),
	};

	constructor(input = {
		childClassName: null,
		extraConfig: null,
	}){
		if(input.childClassName == null){
			throw new Error("no child class name given, needed to prevent collisions/debugging");
		}
		this.name = input.childClassName;

		if(input.extraConfig == null){
			console.warn(`input.extraConfig is null for ${new.target.name}, are you really really sure you want this?`);
		}
		else{
			this.#config = {...this.#config, ...input.extraConfig}
		}

		this.Init();
	}

	// FUNCTIONS

	GetConfigValue(key) {
	    const string = String(key);

		if(key == "*"){
			let conf = structuredClone(this.#config);
			for(let i = 0; i < Object.keys(conf); ++i){
				if(
					String(Object.keys(conf)).toLowerCase().includes("api")
					|| String(Object.keys(conf)).toLowerCase().includes("key")
					|| String(Object.keys(conf)).toLowerCase().includes("pas")
					|| String(Object.keys(conf)).toLowerCase().includes("tok")
				){
					conf[Object.Keys(conf)[i]] = "nuh uh";
				}
			}

			return Result.ok(conf);
		}

	    // Check if the key exists in the object
	    if (Object.prototype.hasOwnProperty.call(this.#config, string)) {
		return Result.ok(this.#config[string]);
	    } else {
		return Result.ok(undefined);
	    }
	}
	SetConfigValue(key, value = null) {
		try{
			if(typeof(key) == "object" && value == null){ //for mass updating
				let curKey = String();
				for(let i = 0; i < this.#config.length; ++i){
					this.#config[Object.keys(key)[i]] = key[Object.keys(key)[i]];
				}
				return Result.ok("completed successfully");
			}

			//for specific updating
			if(key == null || value == null){
				return Result.err(`cannot set key (${key}) or value (${value}), one is null`);
			}

			const string = String(key);

			// Check if the key exists in the config before setting
			if (string in this.#config) {
			    this.#config[string] = value;
			    return Result.ok(`Value "${key}" updated successfully to ${value}`);
			} else {
			    // Prevent setting undefined/unauthorized keys
			    return Result.err(`Cannot set value: "${key}" does not exist in config ${new.target.name}`);
			}
		}
		catch(err){
			return Result.err(`error trying to set config value ${JSON.stringify(err)}`);
		}
	    }

	SaveConfig(){
		try{
		console.log(`attempting to save config for ${this.name}`);
	    localStorage.setItem(
		    `${this.name}_config`, 
		    JSON.stringify(structuredClone(this.#config))
	    );
		console.log(`saved ${this.name}`);
		}
		catch(err){
			console.err(`could not save cockatiel item: ${this.name}`);
		}
	}

	UpdateConfig(input){
		if(typeof(input) != "object"){
			this.DPrint({msg:"could not update config, type is not an object", type: "e"});
		}	
		this.DPrint({msg: `updating twitch config values: ${JSON.stringify(input, null, 2)}`});

		let inputKeys = Object.keys(input);
		for(let i = 0; i < inputKeys.length; ++i){
			if(this.#config[inputKeys[i]] != undefined){
				this.DPrint({msg: `updating value ${input[inputKeys[i]]} for key: ${inputKeys[i]}`});
				this.#config[inputKeys[i]] = input[inputKeys[i]];
			}
		}
	}

	Init(){
		if(this.name == null){
			Result.err("name was not assigned!!!");
		}
		const savedData = localStorage.getItem(`${this.name}_config`);	
		if (savedData) {
		    try {
			// Parse the string back into an object
			const parsed = JSON.parse(savedData);	
			// Merge the loaded data into the existing config
			// This preserves defaults if new settings are added later
			this.#config = { ...this.#config, ...parsed };	
			console.log(`${this.name} config loaded successfully`);
		    } catch (err) {
			console.error(`Failed to parse ${this.name} config:`, err);
		    }
		}
		window.Cockatiel.addSaveListener(() => {this.SaveConfig()});
		window.addEventListener('beforeunload', () => {this.SaveConfig()});	
		return Result.ok(`${this.name} was successfully inited`)
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
}
