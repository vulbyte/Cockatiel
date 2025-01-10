import { PopUp } from './popup.js';
import { assert } from './assert.js';
import { VulbyteMath } from './VulbyteMath.js';

let vulbyteMath = new VulbyteMath;

//{{{1 YoutubeStuff
export class YoutubeStuff {
	//{{{2
	constructor(args = {
		"apiKey": undefined,
		"channelName": undefined,
		"channelId": undefined,
		"broadcastId": undefined,
		"maxResults": 20,
		"updateFreq": 30,
	}) {
		this.args = {
			apiKey: args.apiKey,
			broadcastId: args.liveChatId,
			channelName: args.channelName,
			maxResults: args.maxResults,

			isReady: false,
		}

		console.log(args);
	}
	//}}}2

	//{{{2 GetYoutubeChannelId
	async GetYoutubeChannelId(
		args = {
			"api_key": "",
			"channel_name": undefined,
			"timeout": 5000,
		}
	) {

		let request = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${args.channel_name}&type=channel&key=${args.api_key}&maxResults=${args.maxResults}`;


		let broadcasts = new Promise(resolve, reject, (() => {
			fetch(request)
			setInterval(() => {
				reject("could not connect within expected time\nthe issue is likely with your internet, or googles servers");
			}, args.timeout)
		}))
			.then((data) => {
				if (res.items.length > 1) {
					console.warn('might not be the channel');
				}
				if (res.items.length <= 0) {
					console.warn('no channel found');
				}

				//TODO: add option for selection here

				data = JSON.parse(data);

				switch (data.items[0].id.channelId) {
					case (""):
					case (null):
					case (undefined):
						console.loz()
						return (-1);
						break;
					default:
						break;
				}

				return (data.items[0].id.channelId);
			});

		return (broadcasts);
	}
	//}}}2

	//{{{2 GetBroadcastId
	GetBroadcastId(args = {
		'channelName': this.args.channelName,
		'channelId': this.args.channelId,
		'broadcastId': this.args.broadcastId
	}) {
		// check if can load config
		if (args.channelName == undefined && args.channelId == undefined && args.broadcastId) {
			PopUp({
				'title:': 'no youtubechannel name given or id in cache',
				'message': 'please enter youtube chanel name'
			})
			this.args.channelName = this.GetYoutubeChannelId
			if (this.args.channelName == -1) {
				this.args.channelName = undefined;
				return 0;
			}
		}

		// get the broadcasts
		//https://www.googleapis.com/youtube/v3/search?part=snippet&q=vulbyte&type=channel&key=	
		let result = new Promsie(resolved, reject, () => {
			let fetch_domain = 'https://www.googleapis.com/youtube/v3/';
			try {
				//https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=<CHANNEL_ID>&eventType=live&type=video&key=<YOUR_API_KEY>

				fetch(				// WARN: POT API ACCESS ISSUE
					`${fetch_domain}` +
					`/search?part=snippit` +
					`&channelId=${this.args.channelId}` +
					`?part=id` +
					//`${/*&forUsername=<USERNAME>*/}`
					+ `&key=${this.args.apiKey}`
				).then((data) => {
					console.log(data);
				})
			}
			catch (err) {
				console.error(err);
				PopUp({
					"title": 'error getting youtube broadcast id',
					"message": "hey, are you sure the channel name is correct?\n if this isn't your channel you can't get the broadcast information from it properly!",
					"details": err,
				})
			}
		});


	}
	//}}}2

	//{{{2 GetMessages()
	async GetMessages(apiKey = this.args.apiKey) {
		let new_messages;

		await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${args.liveChatId}&part=snippet,authorDetails&key=${args.apiKey}`)
			.then(response => response.json()) //??????????????????????????????????????????????????
			.then(data => {
				console.log("DATA FROM FETCH: ", data);
				new_messages = data.items.map(item => ({
					author: item.authorDetails.displayName,
					message: item.snippet.displayMessage,
					time: item.snippet.publishedAt,
				}));
			})
			.catch(err => console.error(err));
		return (new_messages);
	}
	//}}}2{}

	//{{{2 GetConfig()
	GetConfig() {
		console.log('loading config');

		let yt_config;

		try {
			yt_config = localStorage.getItem('yt_config');
			console.log('Raw yt_config from localStorage:', yt_config);
		} catch (err) {
			console.log(err);
			PopUp({
				'title': 'Error getting config!',
				'message': `idk why this is happening, go say hi to @vulbyte lol`,
				'details': err,
			});
			return;
		}

		if (yt_config === null || yt_config === undefined) {
			PopUp({
				'title': 'No existing config found!',
				'message': `You'll need to save one first`,
				'details': 'If you renamed the file, then name it back!',
			});
			return;
		}

		try {
			yt_config = JSON.parse(yt_config);
			console.log('Parsed yt_config:', yt_config);
		} catch (err) {
			console.log('JSON parsing error:', err);
			PopUp({
				'title': 'Error parsing config!',
				'message': `The config data is corrupted or invalid JSON.`,
				'details': err,
			});
			return;
		}

		console.log('💾 Loaded yt_config:', yt_config);
		return yt_config;
	}


	//{{{2 SaveConfig()
	SaveConfig(args = this.args) {
		console.log('yt.args to save', args);

		function unexpectedType(valName, varible) {
			PopUp({
				'title': `${valName} in yt config is unexpected type!`,
				'message': `idk why this is happening, go say hi to @vulbyte lol (copy the error btw)`,
				'details': () => {
					return (typeof varible);
				},
			});
		}


		if (typeof args.apiKey != 'string') {
			unexpectedType('args.maxResults', args.maxResults);
		}
		if (typeof args.channelName != 'string') {
			unexpectedType('args.channelName', args.channeName);
		}

		// it's results dumbass
		args.maxResults = Number(args.maxResults);
		if (typeof args.maxResults != 'number') {
			console.log('Args.mr', args.maxResults)
			unexpectedType('args.maxResults', args.maxResults);
		}
		else {
			args.maxResults = vulbyteMath.Clamp(args.maxResults, 1, 50);
		}

		args.updateFreq = Number(args.updateFreq);
		if (typeof Number(args.updateFreq) != 'number') {
			unexpectedType('args.updateFreq', args.maxRequests);
		}
		else {
			args.updateFreq = vulbyteMath.Clamp(args.updateFreq, 1, 180);
		}
		console.log(args.updateFreq)

		localStorage.setItem('yt_config', JSON.stringify(args));
		return;
	}
	//}}}2
}
//}}}1
