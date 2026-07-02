import {Result} from "./result.mjs";


// DO NOT REMOVE ANYTHING FROM THE TIMELINE EVER, THE TIMELINE SHOULD BE CONSIDERED A SOURCE OF TRUTH
export class Timeline{
	// never access directly, use the get/add functions to ensure timeline state
	#timeline = new Array(1024); //a good small size for testing, let GC take over after

	timelineObjects = [
		{
			d /* data */: null,
			e /* error*/: null,
			t /* type */: [ //all types are 3 chars
				"cmd", //command, ie tts.
				"msg", //message, a standard message, [tts is the exception]
				"evt", //event, ie predition
				"err", //error
				"sys", //system notification, ie youtube chat turned off
			],
			v /* version */: null,
			z /* zulu time*/: null,
		},
		/* if there's any revisions, add them to the array, arr.last() will always be the newest object */
	];

	Get( //ie: Get("last", 100);
		direction = null,
		amount = null,
	){
		//quick return all
		if(
			direction == null 
			&& amount == null
		){
			// get all 
			try{
				return Result.ok(structuredClone(this.#timeline));
			}
			catch(err){
				return Result.err(`could not duplicate timeline ${err}`);
			}
		}

		// verify direciton is valid
		const validForwardDirections = [
			"f",
			"forwards",
			"front",
			"bottom",
			"first",
			"old",
			"oldest",
		];
		const validBackwardsDirections = [
			"b",
			"backwards",
			"rear",
			"top",
			"last",
			"new",
			"newest",
		];
		if(direction == null){
			direction = 'f';
		}
		else{
			if(typeof(direction) != "string"){
				try{
					direction = String(direction);
				}
				catch(err){
					return Result.err(`direction type is not a string, cannot use. valid inputs are: ${[...validForwardsDirections, ...validBackwardsDirections]} ${err}`);
				}
			}
			for(let i = 0; i < validForwardDirections; ++i){
				if (
					String(direction).toLowerCase() == String(validForwardDirections[i]).toLowerCase()
				){
					direction = "f";	
					break;
				}
			}
			if(directionValid == false){
				for(let i = 0; i < validBackwardsDirections; ++i){
					if (
						String(direction).toLowerCase() == String(validBackwarsdDirections[i]).toLowerCase()
					){
						direction = "b";
						break;
					}
				}
			}
			if(
				direction != 'f' 
				&& direction != 'b'
			){
				return Result.err("direction is not valid, cannot return")
			}
		}

		// verify amount is valid
		if(
			typeof(amount) != "number"
			&& amount != null
		){
			try{
				amount = Number(amount);
			}
			catch(err){	
				return Result.err(`direction type is not a string, cannot use. valid inputs are: ${err}`);
			}
		}
		
		if(amount == null){
			amount = this.#timeline.length;
		}

		// return full list forward or backwards
		let tl = structuredClone(this.#timeline);
		if(
			tl.length <= amount
		){
			if(direction == 'b'){
				return Result.ok(tl.reverse().slice(0, amount));
			}
			return Result.ok(tl).slice(0, amount);
		}
	}

	Push(type, data) {
		const tlo = structuredClone(this.timelineObjects.at(-1));
		try {	
			// verify compatibility by attempting a test clone
			const safeCopy = structuredClone(data);

			tlo.d = safeCopy;
			tlo.e = null;

			if(type == null){
				throw new Error("input type is null");
			}
			let types = tlo.t;
			let typeFound = false;
			for(let i = 0; i < types.length; ++i){
				if(types[i] == type){
					tlo.t = type;
					break;
				}
				if(i == types.length){throw new Error(`input type (${type}) is does not match current object types (${types})`);}
			}

			version = this.timelineObjects.length;
			z = new Date().toISOString();

			return Result.ok(true);
		}
		catch(err) {
			return Result.err(`could not push object to timeline: ${err}`);
		}
	}
}
