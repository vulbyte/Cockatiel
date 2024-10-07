export class IntTimer {
	constructor(
		args = {
			timerName: "",
			tick: 1,
			timeoutDuration: 60,
			killOnTimeout: true
		}
	) {
		this.timerName = args.timerName;
		this.tick = args.tick;
		this.timeoutDuration = args.timeoutDuration;
		this.killOnTimeout = args.killOnTimeout;
		this.time = 0;

		this.listeners = [];

		console.log(`IntTimer: Starting timer with interval of: ${this.timeoutDuration}`);
		this.timer = setInterval(() => {
			this.Tick();
		}, 1000);

	}


	Restart() {
		this.time = 0;
	}

	Tick() {
		console.log(`timer ${this.timerName}: tick`);

		this.time += 1;

		if (this.time % this.timeoutDuration == 0) {
			this.Timeout();
		}
	}

	Timeout() {
		console.log(`timer ${this.timerName} Has Timeout'd`);

		this.Emit();

		if (this.killOnTimeout == true) {
			this.Kill();
		}
	}

	Kill() {
		console.log(`timer ${this.timerName} Has been killed`);
		this.killOnTimeout = true;

		this.listeners = [];

		clearInterval(this.timer);
	}

	// signal stuff
	Connect(listener) {
		this.listeners.push(listener);
	}

	Emit(data) {
		this.listeners.forEach(listener => listener(data));
	}

	Disconnect(listener) {
		this.listeners = this.listeners.filter(l => l !== listener);
	}
}
