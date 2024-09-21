// GET https://www.googleapis.com/youtube/v3/liveChat/messages

function HTTP(url) {
	const https = require('https');

	//const url = 'https://jsonplaceholder.typicode.com/posts/1';  // Example URL

	https.get(url, (res) => {
		let data = '';

		// A chunk of data has been received
		res.on('data', (chunk) => {
			data += chunk;
		});

		// The whole response has been received
		res.on('end', () => {
			console.log(JSON.parse(data));  // Parsing the response to JSON
		});

	}).on('error', (err) => {
		console.log('Error: ' + err.message);
	});
}
