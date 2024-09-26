let client_session = {
	banned_words: null, // defined with rn
	config: null,
	get_api() {
		config.APIs.gcloud_key
	},
	chat_url: function get_chat_url() {
		return (
			toString(
				`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=` +
				`${this.videoId}` +
				`&key=` +
				`${config.APIs.gcloud_key}`));
	},
	messages: null,
	platform: "youtube",
	tts_messages: null,
	videoId: "",
};

export default { client_session };
