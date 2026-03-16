
export function DebugPrint(msg, value, type="log", style="background-color:#550;"){
	if(window.debug == false){return;}
	switch(type){
		case("error"):
		case("err"):
		case("e"):
			console.error(`%c ${msg}`, style, value);
			break;
		case("warning"):
		case("warn"):
		case("war"):
		case("w"):
			console.warn(`%c ${msg}`, style, value);
			break;
		case("log"):
		default:
			console.log(`%c ${msg}`, style, value);
			break;
	}
	return;
}
