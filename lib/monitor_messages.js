import { IntTimer } from "./IntTimer.js";
import { YoutubeStuff } from "./youtubeStuff.js";
import { PopUp } from './popup.js';

let yt_config = new YoutubeStuff;
// twitch stuff to come
function puc() { document.getElementById('popup').remove(); };

export class Monitor_Messages {
	constructor(
		args = {
			'updateYoutube': () => {/*this should take in a closure for run time checking*/ },
			'yt_config': this.yt_config
		}
	) {
		this.args = {
			'updateYoutube': false,
			'yt_config': this.yt_config,
		}
	}

	Start_Monitor() {
		//{{{3 attempt to fill the blanks
		if (
			this.yt_config.arg == undefined ||
			this.yt_config.args == null ||
			this.yt_config.args == ''
		) {
			const googleCloudLink = 'https://cloud.google.com/docs/authentication/api-keys';

			PopUp({
				'title': 'no api key given!',
				'message': `we need an api key to stream, you can get one here: ${googleCloudLink}`,
				'prompt': 'click here to get api key',
				'onAccept': () => {
					try {
						require('shell').openExternal(googleCloudLink);
					}
					catch (err) {
						console.log(err);
						puc();
						PopUp({
							'title': 'system error',
							'message': 'cannot open with default system browser',
							'prompt': 'click here to open in a new sub window',
							'onAccept': () => { window.open(googleCloudLink, '_blank'); },
						});
					}
				}
			});
		}
		//}}}3
	}


	End_Monitor() {

	}

	Update_Loop() {

	}

	Save_Messages() {

	}

	Load_Messages() {

	}
}
