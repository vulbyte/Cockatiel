export function PopUp(args = {
	'title': 'Hey!',
	'message': 'no message provided',
	'details': 'no details to share',
	'prompt': 'close',
	'onAccept': (() => { console.log('closing popup'); document.getElementById('popup').remove }),
}) {
	function Close() {
		document.getElementById('popup').remove();
	}

	console.log('making popup with input:', args);

	if (document.getElementById('popup') != null) {
		console.log('not making another popup as theres already one to worry about');
		return;
	}

	let defaultColor = document.body.style.color;
	document.body.style.color = '#999999';

	let popup = document.createElement('div');
	popup.id = 'popup';
	popup.style.width = '30em';
	popup.style.maxHeight = '28em';
	popup.style.backgroundColor = '#ffffff';
	popup.style.color = '#000000';
	popup.style.borderRadius = '-1em';
	popup.style.position = 'fixed';
	popup.style.boxShadow = '000px 000px 300px 300px #00000099';
	popup.style.zIndex = 999;

	let container = document.createElement('div');
	container.style.width = '90%';
	container.style.margin = 'auto';

	popup.appendChild(container);

	//container.style.

	let close = document.createElement('button');
	close.innerText = 'close';
	close.style.color = '#ffffff';
	close.style.backgroundColor = '#bb0000'
	close.style.borderRadius = '1em';
	close.style.paddingBottom = '0.8em';
	close.style.position = 'relative';
	close.style.left = '1em';
	close.style.top = '1em';
	close.style.height = '3em';
	close.style.aspectRatio = '1/1';

	close.addEventListener('click', (e) => {
		document.getElementById('popup').remove();
		document.body.style.color = defaultColor;
	});

	container.appendChild(close);

	let title = document.createElement('h3');
	title.style.padding = '1em';
	title.style.margin = '0px';
	if (args.title != null) {
		title.innerText = args.title;
	}
	else {
		title.innerText = 'Squawk!';
	}
	container.appendChild(title);

	let msg = document.createElement('p');
	msg.style.color = '#000000';
	msg.style.paddingTop = '0px';
	msg.style.marginTop = '0px';
	msg.style.maxHeight = '5em';
	msg.style.overflowX = 'scroll';
	if (args.message != null) {

		msg.innerText = args.message.trim();
	}
	container.appendChild(msg);

	let info = document.createElement('code');
	info.style.overflowX = 'none';
	info.style.overflowY = 'scroll';
	info.style.maxHeight = '3em';
	info.style.wordBreak = 'break-all';

	if (
		args.details != null ||
		args.details != undefined ||
		args.details != ''
	) {
		let tab = `\f\v`;
		let tabAmnt = 0;
		for (let i = 0; i < String(args.details).length; ++i) {
			switch (args.details[i]) {
				case ('{'):
					tabAmnt += 1;
					args.details = (
						args.details.slice(0, i + 1) +
						`\n ${tab.repeat(tabAmnt * 4)}` +
						args.details.slice(i + 1, args.details.length)
					);
					break;
				case ('}'):
					tabAmnt -= 1;
					args.details = (
						args.details.slice(0, i) +
						'\n' +
						args.details.slice(i, args.details.length)
					);
					i += 1;
					break;
				case (','):
					args.details = (
						args.details.slice(0, i + 1) +
						`\n ${tab.repeat(tabAmnt * 4)}` +
						args.details.slice(i + 1, args.details.length)
					);
					break;

			}


		}
		info.innerText = args.details;
		container.appendChild(info);
	}

	let cb = document.createElement('button');
	cb.innerText = '📋';
	cb.style.position = 'absolute';
	cb.style.right = '1em';
	cb.style.top = '1em';
	cb.style.backgroundColor = 'var(--color_secondary)';
	cb.style.borderRadius = '0.25em';
	cb.addEventListener('click', (e) => {
		console.log('copied popup details!');
		navigator.clipboard.writeText(
			'from vulbytes cockatiel:' + '\n' +
			'## ' + title.innerText + ' \n' +
			msg.innerText + ' \n' +
			'```js \n' + info.innerText + ' \n```'
		);
	});
	cb.addEventListener('mousedown', () => {
		cb.style.backgroundColor = 'var(--color_primary)';
	})
	cb.addEventListener('mouseup', () => {
		cb.style.backgroundColor = 'var(--color_secondary)';
	})
	cb.addEventListener('mouseleave', () => {
		cb.style.backgroundColor = 'var(--color_secondary)';
	})

	info.appendChild(cb);

	let prompt = document.createElement('button');
	if (args.prompt == null || args.prompt == undefined) {
		prompt.innerText = 'close';
	}
	else {
		prompt.innerText = args.prompt;
	}
	prompt.style.width = '100%';
	prompt.style.margin = 'auto';
	container.appendChild(prompt);

	if (args.onAccept == null || args.onAccept == undefined) {
		prompt.addEventListener('click', (e) => { Close(); });
	}
	else {
		prompt.addEventListener('click', (e) => { args.onAccept(); });
	}

	document.body.prepend(popup);

	console.log(((window.innerWidth - container.getBoundingClientRect().width) / 2) + 'px');

	document.getElementById('popup').style.left =
		((window.innerWidth - container.getBoundingClientRect().width) / 2) + 'px';
	document.getElementById('popup').style.bottom =
		((window.innerHeight - 400) / 2) + 'px';

	console.log('popup made');
	return;
}
