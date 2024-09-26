import { config } from "../configs/load_user_config.js";

//import user_config from "../config/load_user_config"

export async function CallTTS(message) {
	let speech = new SpeechSynthesisUtterance(message);
	let voices = window.speechSynthesis.getVoices(); //array of choices

	if (message == "" || message == undefined || message == null || message == " ") {
		message = "nah, i aint reading that... i'm sorry or congratulations";
	}

	speech.text = message;

	try {
		console.log("call_tts, reading config: ", config);
		speech.lang = config.tts.lang;
		speech.voice = await (() => { return (voices[config.tss.voice_index]) });
		speech.volume = config.tts.volume;
		speech.pitch = config.tts.pitch;
		speech.rate = config.tts.rate;
	}
	catch (err) {
		speech.lang = "en";
		speech.pitch = 1.1;
		speech.rate = 1.1;
		speech.voice = voices[18]; // WARN: there is only one voice for whatever reason // 18 is the reddit voice
		speech.volume = 0.6;
		console.warn("error loading settings: ", err);
		console.log(err);
	}


	// set lang
	await emit_voice(speech);
}

async function emit_voice(speech) {
	await window.speechSynthesis.speak(speech);
}
