// import { fs } from 'fs';
let fs = require('fs');

export let config = () => {
	let bad_words;
	try {
		bad_words = fs.readFile('./BAD_WORDS.json', 'utf8', (err, data) => {
			if (err) {
				console.error(err);
				return;
			}
			console.log(data);
		});
	}
	catch (err) {
		console.warn(err);
	}

	let global_config;

	try {
		global_conf = fs.readFile('./GLOBAL_CONFIG.json', 'utf8', (err, data) => {
			if (err) {
				console.error(err);
				return;
			}
			console.log(data);
		});
	}
	catch (err) {
		console.warn(err)
	}

	let user_conf
	try {
		user_conf = fs.readFile('./USER_CONFIG.json', 'utf8', (err, data) => {
			if (err) {
				console.error(err);
				return;
			}
			console.log(data);
		});
	}
	catch (err) {
		console.warn(err);
	}


	return ({
		bad_words,
		global_config,
		user_conf
	});
};
