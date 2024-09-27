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
	if (branch == "" || branch == undefined || branch == "*") {
		console.log("no branch given for reload, reloading all");

		await SaveBadWords();
		await SaveGlobalConfig();
		await SaveUserConfig();

		console.log(config);
	}
	else {
		if (
			branch.toLowerCase().includes("bad") ||
			branch.toLowerCase().includes("words") ||
			branch.toLowerCase().includes("bad_words") ||
			branch.toLowerCase().includes("badwords")
		) {
			SaveBadWords();
		}
		if (
			branch.toLowerCase().includes("global") ||
			branch.toLowerCase().includes("global_config") ||
			branch.toLowerCase().includes("globalconfig")
		) {
			SaveGlobalConfig();
		}
		if (
			branch.toLowerCase().includes("user") ||
			branch.toLowerCase().includes("user_config") ||
			branch.toLowerCase().includes("userconfig")
		) {
			SaveUserConfig();
		}
	}

	///{{{3 load things
	async function SaveBadWords() {
		try {
			return (
				config.bad_words = fs.writeFileSync(
					config.bad_words,
					"./configs/BAD_WORDS.json",
					// data ,
					(err) => {
						if (err) {
							console.warn(err);
						}
						else {
							console.log("updated badwords successfully");
						}
					}
				)
			)
		}
		catch (err) {
			console.warn("ERROR LOADING BAD_WORDS", err);
		}
	}

	async function SaveGlobalConfig() {
		try {
			return (
				config.global_config = fs.readFileSync(
					"./configs/GLOBAL_CONFI:.json",
					config.global_config,
					(err) => {
						if (err) {
							console.warn(err);
						}
						else {
							console.log("updated global config successfully");
						}
					}
				)
			)
		}
		catch (err) {
			console.warn("ERROR LOADING GLOBAL_CONFIG", err);
		}
	}

	async function SaveUserConfig() {
		try {
			return (
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
			)
		}
		catch (err) {
			console.warn("ERROR LOADING USER_CONFIG", err);
		}
	}
	///}}}3 save things
}

// }}}3 save things

export { config };
