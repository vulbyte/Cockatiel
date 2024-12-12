const noteMidiMapping = {
	'0': 'A',
	'1': 'A#',
	'2': 'B',
	'3': 'C',
	'4': 'C#',
	'5': 'D',
	'6': 'D#',
	'7': 'E',
	'8': 'F',
	'9': 'F#',
	'10': 'G',
	'11': 'G#',
}

window.onload(() => {
	console.log('begun loading the sampler');


});

// function AddMidiListeners(){}
// midi reading (root should be c1 due to standards)

function CreateAndAddSampler(args = {
	'samplerParentId': 'body',
	'samplerHeight': '4',
	'samplerWidth': '4',
}) {
	let sampler = document.createElement('div');

	for (let i = 0; i < width * height; ++i) {
		// add container 
		let node = document.createElement('div');
		node.style.border = 'var(--border)';
		node.style.display = 'grid';
		let mouse_info = {
			'init_pos': [undefined, undefined],
			'cur_pos': [undefined, undefined],
			'mouse_down': 0,
		}


		// add click n drag listener
		node.addEventListener('mouseleave', ((e) => {

		}));
		node.addEventListener('mouseenter', ((e) => {

		}));

		node.addEventListener('mousemove', ((e) => {

		}))

		node.addEventListener('mousedown', ((e) => {

		}))
		node.addEventListener('mouseup', ((e) => {

		}))

		// add label
		let label = document.createElement('div');
		label.font_size = 12;
		label.innerText = 'drag sample here'

		// add button container
		let btn_container = document.createElementById('div');
		btn_container.style.width = '100%';
		btn_container.style.height = '1.5em';

		// add play button
		let play = document.createElement('div');
		play.innerText = '▶️';

		// add mute button
		let mute = document.createElement('div');
		mute.innerText = '🔇';


		// add mouse down listener (adjust vol)

	}

	document.getElementById(args.samplerParentId).appendChild(sampler);
}
