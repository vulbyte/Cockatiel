import {Result} from "./result.mjs";

export class ScoreHandler{
	Init(){
	}

	CalcUserConductScore(user = undefined){
		unixTimes = {"month1": 2648400,"year1": 31536000,}
		
		let minDuration = unixTimes.month1;
		let maxDuration = unixTimes.year1*2; 

		if(user == undefined){throw new Error("could not calculate user conduct score, input is null")}
		let conduct_score, misconduct_score = 0;	

		const now = Date.now();
		let eventTime; // = user.commendations[Object.keys(user.commendations)[i]][j].happenedAt;
		let age; // = now - eventTime;

		let commendment;
		for(let i = 0; i < Object.keys(user.commendments.length); ++i){
			for(let j = 0; j < user.commendments[i].length; ++j){
				// conduct_score += Number(
				// 	this.clamp(Object.keys(user.commendations)[i][j].happenedAt-(Date.now()-maxDuration), 0, 1)
				// 	/ (maxDuration-minDuration)
				// )
				let timeWeight = (maxDuration - age) / (maxDuration - minDuration);
				eventTime = user.commendations[Object.keys(user.commendations)[i]][j].happenedAt;
				age = now - eventTime;
				conduct_score += Number(this.Clamp({
						val: timeWeight, 
						min: 0, 
						max: 1
					}));
			}
		}
	}

	async ScoreMessage(message) { // TODO: MORSE CODE BREAKS THE SCORE: "..-. ..- -.-. -.- / -- --.- / .-.. .. ..-. ." == 440
	    if(
		    message == undefined 
		    || message == null 
		    || message == ""
		    || message.length < 1
		    || typeof(message) == "number"
	    ){
		this.DebugPrint({msg: "message is null, cannot score, returning 0", message});

		    return 0;
	    }
	  // 1. DEFINE ALL SCORING FUNCTIONS (using arrow functions for
	  // 'this' context)
	this.DebugPrint({msg: "attempting to score message:", message});
	  const CheckPunctuation = (message) => {
	    let score = 0;

	    // Long messages without basic punctuation get penalized
	    if (message.length > 75) {
	      if (!(message.includes(",") || message.includes(".") ||
		    message.includes("?") || message.includes("!"))) {
		score += 150;
	      }
	    }

	    // Reward for proper spacing after end-of-sentence
	    // punctuation
	    for (let i = 0; i < message.length; ++i) {
	      let char = message[i];

	      if (char == "." || char == "?" || char == "!") {
		// Check if the next 1, 2, or 3 characters contain a
		// space (handles single space, double space, etc.)
		const nextChar = message[i + 1];
		const nextNextChar = message[i + 2];
		const nextNextNextChar = message[i + 3];

		if (nextChar == " " || nextNextChar == " " || nextNextNextChar == " ") {
		  score += 30;
		}
	      }
	    }
	    this.DebugPrint({msg: `score CheckPunctuation(}) : ${score}`});
	    return score;
	  };

		const CheckTrigrams = async (message) => {
		  let score = 0;
		  try {
		    // Corrected Regex: \s+ (one or more whitespace characters)
		    const words = message.trim().toLowerCase().split(/\s+/);

		    // Ensure 'trigrams' exists or use this.#trigrams if it's a class property
		    const trigramList = typeof trigrams !== 'undefined' ? trigrams : [];

		    for (const word of words) {
		      if (word.length >= 3) {
			const currentTrigram = word.slice(0, 3);
			
			if (trigramList.includes(currentTrigram)) {
			  score += 50;
			} else {
			  //score -= 50;
			}
		      }
		    }
		    return score;
		  } catch (err) {
		    // Log the actual error to your internal logs so you can see if it was a ReferenceError
		    this.DebugPrint({ msg: "Trigram Fatal Error:", error: err.message });
		    this.DebugPrint({msg: "Error processing trigrams logic.", type: "error",});
		  }
		};

	  const CheckForRepeats = (message) => {
	    let score = 0;
	    // Safety: Stop 2 chars before the end to safely check i+1
	    // and i+2
	    for (let i = 0; i < message.length - 2; ++i) {
	      let char = message[i];
	      if (message[i + 1] == char &&message[i + 2] == char) {
		score += 50;
	      }
	    }
	    this.DebugPrint({msg: `score CheckForRepeats() : ${score}`});
	    return score;
	  };

	  const CheckForCaps = (message) => {
	    let score = 0;
	    if (message[0] == message.charAt(0).toUpperCase()) {
	      score += 20;
	    } else {
	      //score -= 10;
	    }
	    //this.DebugPrint(`score CheckForCaps() : ${score}`);
	    return score;
	  };

	  const CheckForSpaces = (message) => {
	    let scoreSe = 0;
	    let spaceCount = 0;
	    for (let i = 0; i < message.length; ++i) {
	      if (message[i] == " ") {
		spaceCount += 1;
	      }
	    }
	    const nonSpaceLength = message.length - spaceCount;

	    // Avoid division by zero if the message is only spaces
	    // (though unlikely after cleaning)
	    if (nonSpaceLength > 0 &&
		(spaceCount * 100) / nonSpaceLength < 20) {
	      //score -= 20;
	    } else if (nonSpaceLength > 0) {
	      score += 20;
	    }

	    this.DebugPrint({msg: `score CheckForSpaces() : ${score}`});
	    return score;
	  };

	  const CheckForSpaceInChunk = (message) => {
	    let score = 0;
	    for (let i = 0; i < message.length; i += 32) {
	      let chunk = message.slice(i, i + 32);
	      if (!chunk.includes(" ")) {
		//score -= 20;
	      }
	    }
	    this.DebugPrint({msg: `score CheckForSpaceInChunk : ${score}`});
	    return score;
	  };

	  // 2. SCORING EXECUTION

	  let score = 0;

	  const funcs = [
	    CheckPunctuation,
	    CheckTrigrams,
	    //CheckForRepeats,
	    CheckForCaps,
	    CheckForSpaces,
	    CheckForSpaceInChunk,
	  ];

	  for (const func of funcs) {
	    let funcScore;

	    if (func.constructor.name == 'AsyncFunction') {
	      funcScore = await func(message);
	    } else {
	      funcScore = func(message);
	    }

	    score += funcScore;

	    //if (this.#state.config.debug == true) {
	    //  this.DebugPrint({msg: `score eval at function call : ${score}`});
	    // }
	  }

	  return score;
	}
}
