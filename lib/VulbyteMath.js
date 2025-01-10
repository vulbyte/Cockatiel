import { assert } from './assert.js';

export class VulbyteMath {
	constructor() { console.log('VulbMath instance made') };

	Clamp(arg, min, max) {
		if (
			arg == undefined ||
			min == undefined ||
			max == undefined
		) {
			throw new Error(message || 'cannot clamp without arg, min, or max being undefined');
		}

		assert(typeof arg === 'number');
		assert(typeof min === 'number');
		assert(typeof max === 'number');

		if (arg < min) {
			arg == min;
		}
		else if (arg > max) {
			arg == max;
		}

		return (arg);
	}
}
