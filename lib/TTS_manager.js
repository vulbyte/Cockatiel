import { config } from "../configs/load_user_config.js";
import { IntTimer } from "./IntTimer.js";
import { messages } from "./get_livestream_messages.js";
import { CallTTS } from "./call_tts.js";

export class TTS_Manager {
	constructor(
		args = {
			tts_gap: 300, //~5 mintues
		}
	) {
		console.log("new tts manager created");

		this.TTS_Timer = new IntTimer(args = {
			timerName: "tts_manager_timer",
			tick: 1,
			timeoutDuration: 5,
			killOnTimeout: false,
		})

		this.looper = (data) => {
			console.log("reading new tts message");

			this.filtered_messages = document.getElementsByClassName("ml_item");
			for (let i = 0; i < this.filtered_messages.length; ++i) {
				if (
					document.getElementById(`ml_li${i}`).getAttribute("isTTS") == "true" &&
					document.getElementById(`ml_li${i}`).getAttribute("TTSPlayed") == "false"
				) {
					document.getElementById(`ml_li${i}`).setAttribute("TTSPlayed") = "true";
					CallTTS(document.getElementById(`mesage${i}`));
				}
				else {
					break;
				}
			}
		};
	}

	Kill() {
		this.TTS_Timer.Kill();
	}
} 
