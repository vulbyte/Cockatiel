export class IntTimer {
	constructor(
		timerName = "",
		tick = 1,
		timeoutDuration = 5,
		killOnTimeout = true
	) {
		this.timerName = timerName;
		this.tick = tick;
		this.timeoutDuration = timeoutDuration;
		this.killOnTimeout = killOnTimeout;
		this.time = 0;

		this.listeners = [];

		this.timer = setInterval(Tick(), (timeoutDuration * 1000));
	}


	Restart() {
		time = 0;
	}

	Tick() {
		console.log("timer ${timerName}: tick");
		if (time % timeoutDuration == 0) {
			Timeout();
		}
	}

	Timeout() {
		console.log(`timer ${timerName} Has Timeout'd`);
		if (killOnTimeout == true) {
			Kill();
		}
	}

	Kill() {
		console.log(`timer ${timerName} Has been killed`);

		this.listeners = [];

		clearInterval(this.timer);
	}

	// signal stuff
	Connect(listener) {
		this.listeners.push(listener);
	}

	emit(data) {
		this.listeners.forEach(listener => listener(data));
	}

	Disconnect(listener) {
		this.listeners = this.listeners.filter(l => l !== listener);
	}
}
