// new obj
let speech = new SpeechSynthesisUtterance();
// set lang
speech.lang = "en";

let voices = window.speechSynthesis.getVoices(); //array of choices
speech.voice = voices[3];
speech.volume = 0.6;
speech.pitch = 1.2;
speech.rate = 0.2;

document.getElementById("play_tts").addEventListener('click', () => ReadMessage());

// in html file document.getElementById("play_tts").addEventListener('click', () => ReadMessage(tts_messages[tts_index]));
async function ReadMessage(tts_message) {
	if (!tts_message) {
		console.error("No message to read");
		return;
	}

	try {
		speech.text = tts_message;
		window.speechSynthesis.speak(speech);
		//LightTTS.say(text[tts_message, callback]);
		console.log('successfully read message');
	} catch (e) {
		console.error("An error occurred:", e);
	}
}

// If you need to export the function for use in other modules
export default ReadMessage;
