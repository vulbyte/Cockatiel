import {BaseClass} from "./baseclass.mjs";
import {Result} from "./result.mjs";

export class MessageManager extends BaseClass {
	#listeners = new Array();

	constructor(){
		super({
			childClassName: new.target.name,
		});
	}

	addListener(){}
	removeListener(){}



	Emit(message){
		try{
			if (typeof(message) != "string"){
				message = String(message.value)
			}
			if (typeof(message) != "string"){
				message = String(message);
			}
			let messageObject = message;
			for(let i = 0; i < this.#listeners.length;  ++i){
				
			}
			Result.ok("message emmited successfully");
		}
		catch(err){
			Result.err(`could not emit message: ${err}`);
		}
	}
	/**
	 * Generates a drag-and-drop list for listeners.
	 * @param {Array} listeners - The array from your MessageHandler
	 * @param {HTMLElement} container - The DOM element to hold the list
	 * @param {Function} onOrderChange - Callback to update the actual data array
	 */
	GenerateUI(listeners = this.#listeners, container, onOrderChange) {
	    container = document.createElement("div")// Clear existing

	    listeners.forEach((listener, index) => {
		const item = document.createElement('div');
		item.className = 'listener-item';
		item.draggable = true; // Make item draggable [1.2.1]
		item.dataset.index = index;
		
		// Label/Content (Click to rename logic could be added here)
		item.innerHTML = `<span>${listener.config.title}</span>`;
		item.style.borderLeft = `5px solid ${listener.config.color}`;

		// Drag events
		item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', index));
		
		item.addEventListener('dragover', (e) => e.preventDefault());
		
		item.addEventListener('drop', (e) => {
		    e.preventDefault();
		    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
		    const toIndex = parseInt(item.dataset.index);
		    
		    // Reorder the underlying array
		    const movedItem = listeners.splice(fromIndex, 1)[0];
		    listeners.splice(toIndex, 0, movedItem);
		    
		    // Update the data order property for each
		    listeners.forEach((l, i) => l.config.messageManagerOrder = i);
		    
		    // Re-render and trigger callback
		    GenerateListenerUI(listeners, container, onOrderChange);
		    onOrderChange(listeners);
		});

		Result.ok(item);
	    });
	}
}
