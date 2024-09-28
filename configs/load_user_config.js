// import { fs } from 'fs';
let fs = require('fs');

let config = {
	"bad_words": null,
	"global_config": null,
	"user_config": null,
};

LoadConfig();

export async function LoadConfig(branch) {
	if (branch == "" || branch == undefined || branch == "*") {
		console.log("no branch given for reload, reloading all");

		await LoadBadWords();
		await LoadGlobalConfig();
		await LoadUserConfig();

		console.log("full config reload: ", config);
	}
	else {
		if (
			branch.toLowerCase().includes("bad") ||
			branch.toLowerCase().includes("words") ||
			branch.toLowerCase().includes("bad_words") ||
			branch.toLowerCase().includes("badwords")
		) {
			LoadBadWords();
		}
		if (
			branch.toLowerCase().includes("global") ||
			branch.toLowerCase().includes("global_config") ||
			branch.toLowerCase().includes("globalconfig")
		) {
			LoadGlobalConfig();
		}
		if (
			branch.toLowerCase().includes("user") ||
			branch.toLowerCase().includes("user_config") ||
			branch.toLowerCase().includes("userconfig")
		) {
			LoadUserConfig();
		}
	}

	///{{{3 load things
	async function LoadBadWords() {
		try {
			const fileContent = fs.readFileSync('./configs/BAD_WORDS.json', { encoding: 'utf8' });
			config.bad_words = JSON.parse(fileContent);
			return (config.bad_words);
		}
		catch (err) {
			console.warn("ERROR LOADING BAD_WORDS", err);
		}
	}

	async function LoadGlobalConfig() {
		try {
			const fileContent = fs.readFileSync('./configs/GLOBAL_CONFIG.json', { encoding: 'utf8' });
			config.global_config = JSON.parse(fileContent);
			return (config.global_config);
		}
		catch (err) {
			console.warn("ERROR LOADING GLOBAL_CONFIG", err);
		}
	}

	async function LoadUserConfig() {
		try {
			const fileContent = fs.readFileSync('./configs/USER_CONFIG.json', { encoding: 'utf8' });
			config.user_config = JSON.parse(fileContent);
			return (config.user_config);
		}
		catch (err) {
			console.warn("ERROR LOADING USER_CONFIG", err);
		}
	}
	///}}}3 load things

	console.log(
		"finished_loading config", "\n",
		"    ", "bw: ", config.bad_words.length, "\n",
		"    ", "gc: ", config.global_config.length, "\n",
		"    ", "uc: ", config.user_config.length, "\n"
	);
};

// {{{3 save things
export async function SaveConfig(branch) {
	console.log("saving begun");
	if (branch == "" || branch == undefined || branch == "*") {
		console.log("no branch given for reload, reloading all");

		await SaveBadWords();
		await SaveGlobalConfig();
		await SaveUserConfig();

		console.log(config);
	}
	else {
		console.log("branch is not null, attempting to save unique");
		let save_triggered = false;
		if (
			branch.toLowerCase().includes("bad") ||
			branch.toLowerCase().includes("words") ||
			branch.toLowerCase().includes("bad_words") ||
			branch.toLowerCase().includes("badwords")
		) {
			console.log("branch matches bad_words, saving");
			SaveBadWords();
			save_triggered = true;
		}
		if (
			branch.toLowerCase().includes("global") ||
			branch.toLowerCase().includes("global_config") ||
			branch.toLowerCase().includes("globalconfig")
		) {
			console.log("branch matches global_config, saving");
			SaveGlobalConfig();
			save_triggered = true;
		}
		if (
			branch.toLowerCase().includes("user") ||
			branch.toLowerCase().includes("user_config") ||
			branch.toLowerCase().includes("userconfig")
		) {
			console.log("branch matches user_config, saving");
			SaveUserConfig();
			save_triggered = true;
		}

		if (save_triggered == false) {
			console.warn("ERROR, no save made when called! attempting to save all");
			SaveBadWords();
			SaveGlobalConfig();
			SaveUserConfig();
		}
	}

	///{{{3 load things
	function SaveBadWords() {
		console.log("begin saving bad words");
		try {
			fs.writeFileSync(
				"./configs/BAD_WORDS.json",
				JSON.stringify(config.bad_words, null, 2),
				{ encoding: 'utf8' }
				// data ,
			)
		}
		catch (err) {
			console.warn("ERROR SAVING BAD_WORDS", err);
		}

		console.log("saved bad_words");
		LoadConfig("words");
	}

	function SaveGlobalConfig() {
		console.log("begin saving global_config", config.global_config);
		try {
			fs.writeFileSync(
				"./configs/GLOBAL_CONFIG.json",
				JSON.stringify(config.global_config, null, 2),
				{ encoding: 'utf8' }
			)
		}
		catch (err) {
			console.warn("ERROR SAVING GLOBAL_CONFIG", err);
		}

		console.log("saved global stuff");
		LoadConfig("global")
	}

	function SaveUserConfig() {
		console.log("begun saving user_config");
		try {
			fs.writeFileSync(
				'./configs/USER_CONFIG.json',
				config.user_config,
				(err) => {
					if (err) {
						console.warn(err);
					}
					else {
						console.log("updated user_config successfully");
					}
				}
			)
		}
		catch (err) {
			console.warn("ERROR LOADING USER_CONFIG", err);
		}

		console.log("saved user stuff");
		LoadConfig("user");
	}
	///}}}3 save things

	console.log("saving complete");
}

// }}}3 save things

export { config };
