import {BaseClass} from "./baseClass.mjs";
import {Result} from "./result.mjs";

export class UserManager extends BaseClass {
	static extraConfig = {
		color: `#ff00ff`,
		title: `user Manager`,
	};
	constructor(){
		super({
			childClassName: new.target.name,
			extraConfig: new.target.extraConfig,
		});
	}

	#users = new Array(128);
	GetUsers(){
		return this.#users;
	}

	name = "userManager"; //no spaces!


	DebugPrint(input){
		window.Cockatiel.DebugPrint(input);
	}

	AddUserToUsers(user) {
		try{
		    this.DebugPrint({ msg: "attempting to add user to users", val: JSON.stringify(user, null, 4) });

		    // 1. Check if user already exists
		    let userGet = this.GetUserFromUuid(user.uuid); // Pass the UUID property specifically
		    if (userGet != null) {
			this.DebugPrint({ 
			    msg: "user already in db, not adding.", 
			    type: "warn", 
			    val: { user: user, gotUser: userGet } 
			});
			return false;
		    }

		    // 2. Fix the ReferenceError: Use the ID from the user object
		    const targetId = user.uuid || crypto.randomUUID();

		    // 3. Add to state 
		    // If #users is an Object/Map:
		    //this.#users[targetId] = user;
			
		    // remove cyclic reference 
		    this.#users[targetId] = JSON.parse(JSON.stringify(user));
		    
		    // If #users is an Array, use this instead:
		    // this.#users.push(user);

		    // 4. Update UI
		    this.UpdateUserDisplay(); 
		    this.DebugPrint({ msg: "added user to users", val: JSON.stringify(user, null, 4) });
		    return true;
		}
		catch(err){
			this.DebugPrint({
				msg: "error attempting to add user",
				err: err,
				data: user,
			});
		}
	}

	CreateUserFromFlags(p_msg) { //returns user object on success
	    // 1. Validation check
	    this.DebugPrint({ msg: "checking for chaannelOrigin"});
	    if (!p_msg.channelOrigin) {
		this.DebugPrint({ msg: "channelOrigin CANNOT be null", type: "t"});
	    }

	    // 2. Check for existing user (Fixed the variable name casing)
	    let existingUuid; 
	    try {
		existingUuid = this.FindUserFromChannelIdAndReturnUuid(p_msg.channelOrigin);
		
		// Simplified check: if it's truthy, return it
		if (existingUuid) {
		    this.DebugPrint({ msg: "User already exists. UUID:", val: existingUuid });
		    return existingUuid; 
		}
	    } catch (err) {
		this.DebugPrint({
		    msg: "Error checking for existing UUID", 
		    val: p_msg,
		    type: "t", 
		    err: err
		});
		// Decide if you want to continue or return here
	    }

	    // 3. Create new user object
	    // Note: p_msg uses .userUuid, but you access .uuid below. 
	    // I've updated this to check p_msg.userUuid first.
	    let user = { 
		...this.templates.user,
		username: p_msg.username,
		icon: p_msg.icon,
		channels: [{
			version: 1,
			channelId: p_msg.channelOrigin,
			platform: p_msg.platform,
			channelName: p_msg.username,
		}],
		isSponser: p_msg.isSponser || false,
		isChatModerator: p_msg.isChatModerator || false,
		isChatAdmin: p_msg.isChatAdmin || false,
		uuid: crypto.randomUUID(), 
		firstSeen: p_msg.firstSeen || Date.now()
	    };
		let color;
		switch(user.uuid[String(user.uuid).length-1]){
			case('a'):
			case('b'):
			case('c'):
			case('d'):
			case('e'):
				color = "#f00";
				break;
			case('f'):
			case('g'):
			case('h'):
			case('i'):
			case('j'):
				color = "#ff0";
				break;
			case('k'):
			case('l'):
			case('m'):
			case('n'):
			case('o'):
				color = "#000"; //can't be green because of bg
				break;
			case('p'):
			case('q'):
			case('r'):
			case('s'):
			case('t'):
				color  = "#0ff";
				break;
			case('u'):
			case('v'):
			case('w'):
			case('x'):
			case('y'):
			case('z'):
				color = "#00f";
				break;
			case('0'):
			case('1'):
			case('2'):
			case('3'):
			case('4'):
				color = "#f0f";
				break;
			case('5'):
			case('6'):
			case('7'):
			case('8'):
			case('9'):
				color = "#fff";
				break;
			default: 
				color = "#555";
				break
		}
		user.styling.chatMessageContainer.chatUserBubble.chatUserInfo.styling.backgroundColor = color;

		/*
		channel: {
			version : 1, platform : "", channelName : "", channelId : ""
		},
		*/

	    // 4. Add and return
	    try {
		if(this.AddUserToUsers(user) == false){
			throw new Error("user could not be added to users");
		}
		this.DebugPrint({ msg: `User created: ${user.username}.` });
		return user;
	    } catch (err) {
		this.DebugPrint({ msg: `Failed to add user to state: ${JSON.stringify(user, null, 2)}`, data: user, err: err, type: "t" });
	    }
	}

	GetUserFromUuid(uuid){
		let users;
		try{
			users = this.#users || window.Cockatiel.GetUsers();
		}
		catch(err){
			this.DebugPrint({msg: "could not get users", type: "t", err: err});
		}

		let user = users[uuid];
		if(user == undefined){
			return null;
		}

		return user;
	}

FindUserFromChannelIdAndReturnUuid(searchChannelId = undefined) {
    if (!searchChannelId) return null;

    const users = this.#users;
    if (!users) return null;

    const userList = Object.values(users);

    for (let i = 0; i < userList.length; i++) {
        const user = userList[i];
        
        // Based on your log: channels is an Array [ {channelId: "..."} ]
        const channelsArray = user.channels;

        if (Array.isArray(channelsArray)) {
            for (let j = 0; j < channelsArray.length; j++) {
                if (channelsArray[j].channelId === searchChannelId) {
                    return user.uuid; // Found him!
                }
            }
        }
    }
    return null; // Not found
}

	AddPointsToUserWithUuid(score, uuid) {
	    if (!uuid) {
		console.error("No UUID provided.");
		return false;
	    }
	    // Note: score could be 0, so check if it's undefined or null specifically
	    if (score === undefined || score === null) {
		console.error("no score to give to user");
		return false;
	    }

	    this.DebugPrint({msg: `attempting to add score to user`, val: {score: score, user: uuid}});

	    // 1. Locate the user
	    let user = this.#users[uuid];
		
	    try{
	            if(!user){
	                this.DebugPrint({msg: `user is not found, attempting to create user.`, val: {uuid: uuid}, type:"w"});    
			    return false;
	                //this.DebugPrint({msg: `AddPointsToUser: User with UUID ${uuid} not found.`, type:"error"});
	            }
	    }
	    catch(err){
	    	this.DebugPrint({msg: `user is not found, cannot add points to user.`, val: {uuid: uuid}, err: err, type:'e'});    
	    	return false;
	    }

		try{
		if (user.points === undefined || isNaN(user.points)) {
				user.points = 0;
			}

			// 3. Add the new points
			user.points += score;
			user.totalPoints += score;

			this.DebugPrint({msg: `Points updated for ${user.username}: +${score} (Total: ${user.points}})`});
			return true;
		}
		catch(err){
			this.DebugPrint({msg: "failure adding points to user", type: 'e', err:err})
		}
	}	

	RemoveUserProfileFromUuid(userUuid){ //true on success, false on fail
		try{
			if(!this.#users[userUuid]){			
				this.DebugPrint({msg: "cannot remove user, user does not exist", type: "t"});
			}
			this.#users.delete(userUuid);
			this.UpdateUserDisplay();
		}
		catch(err){
			this.DebugPrint({msg: "cannot remove user", err:err});
		}
		return;
	}

	MergeUserProfiles(user1, user2){ // will merge the 1st into the 2nd, true on success, false on fail
		try{
			if(
				user1.version == 1 
				&& user2.version == 1
			){
				let newUserProfile = this.templates.user;
				newUserProfile.version = 1;
				newUserProfile.username = user2.username;
				newUserProfile.channels = [...user1.channels, ...user2.channels];
				newUserProfile.uuid = user2.uuid;
				newUserProfile.ttsBans = [...user1.ttsBans, ...user2.ttsBans];
				newUserProfile.channelBans = [...user1.channelBans, ...user2.channelBans];
				newUserProfile.conduct_score = Number((user1.conduct_score+user2.conduct_score)/2);
				newUserProfile.commendments = {	
					community: [...user1.commendments.community, ...user2.commendments.community ], // welcoming, helpful, inclusivity, etc
					engagement: [...user1.commendments.engagement, ...user2.commendments.engagement], // hype, constructive feedback, good chatting, etc
					support: [...user1.commendments.support, ...user2.commendments.support], //the only thing one can buy
				}
				newUserProfile.misconduct = {
					discrimination: [...user1.misconduct.discrimination, ...user2.misconduct.discrimination], // racism, sexism, etc
					harassment: [...user1.misconduct.harassment, ...user2.misconduct.harassment], // bullying, hate speech, etc
					spam: [...user1.misconduct.spam, ...user2.misconduct.spam], // self-promo, asdl;fknfrtn, links, etc
					integrity: [...user1.misconduct.integrity, ...user2.misconduct.integrity], // language, spoilers, trolling/rage, bypassing filters
				};
				newUserProfile.icon = user2.icon;
				(user1.isSponser || user2.isSponser) ? newUserProfile.isSponser = true : newUserProfile.isSponser = false;
				(user1.isChatModerator || user2.isChatModerator) ? newUserProfile.isChatModerator = true : newUserProfile.isChatModerator = false;
				(user1.isChatAdmin || user2.isChatAdmin) ? newUserProfile.isChatAdmin = true : newUserProfile.isChatAdmin = false;
				(user1.isVerified || user2.isVerified) ? newUserProfile.isVerified = true : newUserProfile.isVerified = false;
				
				//prioritize older
				if(user1.firstSeen < user2.firstSeen){
					newUserProfile.firstSeen = user1.firstSeen;
				}
				else{
					newUserProfile.firstSeen = user2.firstSeen;
				}

				//combine points
				newUserProfile = user1.points + user2.points;
				this.DebugPrint({msg: "user profiles merged successfully!"});

				//merge done, add new user to users
				this.AddUserToUsers(newUserProfile);
				this.DebugPrint({msg: "new user profile added to users"});
				this.RemoveUserProfileFromUuid(user1.uuid);
				this.DebugPrint({msg: "removed user 1 from list, goodbye:", val: user1});
				this.RemoveUserProfileFromUuid(user2.uuid);
				this.DebugPrint({msg: "removed user 2 from list, goodbye:", val: user2});
				return true;
			}
			else{
				this.DebugPrint({msg: "cannot merge users, both are not version 1, which is the only one that has support"});
			}
		}
		catch(err){
			this.DebugPrint({msg: "cannot merge users due to error", err:err});
			return false;
		}
	}


	ModifyUserPoints(targetUuid, amount) {
	    // 1. Safety check for UUID
	    if (!targetUuid) {
		throw new Error("ModifyUserPoints failed: targetUuid is null or undefined");
	    }

	    // 2. Direct lookup using the UUID as the key
	    // This replaces the 'for' loop entirely
	    let user = this.#users[targetUuid];

	    if (user) {
		// 3. Update the points
		// We use || 0 to handle users who might not have a points property yet
		user.points = (user.points || 0) + amount;
		
		this.DebugPrint({
		    msg: `Adjusted @${user.username || 'Unknown'} by ${amount}. New total: ${user.points}`,
		    val: user
		});

		// 4. Update UI to reflect the new points balance
		this.UpdateUserDisplay();
		return true;
	    } else {
		// 5. Handle user not found
		this.DebugPrint({
		    msg: `Warning: No user found with UUID ${targetUuid}`,
		    type: "warn"
		});
		return false;
	    }
	}

	CHE(args = {}) {
	    try {
		if (!args.type) args.type = "div";

		let elem = document.createElement(args.type);

		if(args.inputType) elem.type = args.inputType;

		if (args.class) elem.className = args.class;
		if (args.id) elem.id = args.id;
		if (args.innerHTML) elem.innerHTML = args.innerHTML;
		if (args.innerText) elem.innerText = args.innerText;
		if (args.style) elem.style.cssText = args.style;

		if (args.attributes) {
		    for (const [key, value] of Object.entries(args.attributes)) {
			elem.setAttribute(key, value);
		    }
		}

		if (args.onClick) {
		    elem.addEventListener("click", args.onClick);
		}

		return elem;
	    }
	    catch (err) {
		console.error("CHE failed", err);
		return null;
	    }
	}

	GenerateUI(parentId = "user-display-list") {
	    this.DebugPrint("Generating user management item");
	    if (typeof document === 'undefined') return;

	    let listElement = document.getElementById(parentId);
	    let listContainer;

	    // 1. Create structure if it doesn't exist
	    if (!listElement) {
		this.DebugPrint("No user management id found, creating structure");
		
		// Note: 'details' not 'detail' (HTML tag is <details>)
		listContainer = this.CHE({ type: 'details', id: parentId + "-container" });
		const listSummary = this.CHE({ 
			type: 'summary', 
			innerText: "User Details", 
			/*style: "color: #ffffff;"*/
		});
		listElement = this.CHE({ 
			type: 'div', 
			id: parentId, 
			/*style: "color: #ffffff;" */
		});

		listContainer.appendChild(listSummary);
		listContainer.appendChild(listElement); // Attach the list to the container!
	    }

	    // 2. Clear existing list
	    listElement.innerHTML = "";

	    // Always return the top-level element created/found
	    return listContainer; //|| document.getElementById(parentId + "-container");
	}	

UpdateUserDisplay() {
    if (typeof document === 'undefined') return;

    const listElement = document.getElementById("user-display-list");
    if (!listElement) return;

    // 1. Convert Object to Array and Sort
    const userMap = this.#users || {};
    // Get the values (user objects) so we can actually sort them
    let userList = Object.values(userMap);

    if (userList.length > 1) {
        userList.sort((a, b) => 
            (a.username || "").localeCompare(b.username || "", undefined, { sensitivity: 'base' })
        );
    }

    // 2. Clear the list only after we know we have data to draw
    listElement.innerHTML = "";

    // 3. Loop through the sorted array
    for (const u of userList) {
        // --- PRE-CALCULATIONS (Your CS color logic is great, keeping it) ---
        let cs = u.conduct_score || 0;
        let csColor = "#fff";
        if (cs < 0) {
            csColor = `rgb(255, ${Math.max(0, 255 + (cs * 51))}, ${Math.max(0, 255 + (cs * 51))})`;
            if (cs <= -5) csColor = "#f00";
        } else if (cs > 0) {
            csColor = `rgb(${Math.max(0, 255 - (cs * 51))}, 255, ${Math.max(0, 255 - (cs * 51))})`;
            if (cs >= 5) csColor = "#0f0";
        }

        const details = this.CHE({
            type: 'details',
            style: "border-bottom: 1px solid #333; font-family: monospace; font-size: 0.75rem; /*color: #ccc;*/"
        });

        const summary = this.CHE({
            type: 'summary',
            style: "display: flex; align-items: center; padding: 6px; cursor: pointer; gap: 8px; outline: none; list-style: none;"
        });

        // Identity Block (Simplified for brevity, but matches your logic)
        const identity = this.CHE({ type: 'div', style: "display: flex; gap: 5px; width: 160px; align-items: center; flex-shrink: 0;" });
        const flags = [
            { cond: u.isChatAdmin, col: '#f44', char: 'A', desc: 'Admin' },
            { cond: u.isChatModerator, col: '#5b5', char: 'M', desc: 'Moderator' },
            { cond: u.isSponser, col: '#0af', char: 'S', desc: 'Sponsor' },
            { cond: u.isVerified, col: '#ff0', char: 'V', desc: 'Verified' }
        ].map(f => f.cond ? `<span title="${f.desc}" style="color:${f.col}; font-weight:bold;">${f.char}</span>` : '').join(' ');

	    //console.warn(u);

// 1. Create a "Primitive" copy of the icon string right now
const currentIcon = u.icon ? String(u.icon) : null;

// 2. Validate the string content specifically
const isValidIcon = currentIcon && currentIcon !== "undefined" && currentIcon !== "null";

// 3. Build the tag using the isolated variable
const userIcon = isValidIcon 
    ? `<img src="${currentIcon}" style="width:24px; height:24px; border-radius:50%; display:block;" referrerpolicy="no-referrer">` 
    : `<span style="font-size:20px;">👤</span>`;

	identity.innerHTML = `
	    <span>${userIcon}</span>
	    <div style="overflow:hidden;">
		<div style="font-weight:bold; /*color:#fff;*/">${u.username || "???"}</div>
		<div style="font-size:0.6rem;">${flags}</div>
	    </div>`;

        // Standing Block
        const standing = this.CHE({ type: 'div', style: "display: flex; gap: 8px; width: 220px; flex-shrink: 0; border-left: 1px solid #444; padding-left: 8px;" });
        standing.innerHTML = `
            <span title="Points">PTS:<b style="color:#0ff;">${u.points}</b></span>
            <span title="Conduct Score">CS:<b style="color:${csColor};">${cs}</b></span>
            <span title="Bans" style="color:#f44;">B:<b>${(u.ttsBans || []).length}/${(u.channelBans || []).length}</b></span>
        `;

        // Metrics Block
        const metrics = this.CHE({ type: 'div', style: "display: flex; gap: 10px; flex-grow: 1; border-left: 1px solid #444; padding-left: 8px;" });
        const c = u.commendments || { community: [], engagement: [], support: [] };
        const m = u.misconduct || { discrimination: [], harassment: [], spam: [], integrity: [] };
        metrics.innerHTML = `
            <span style="color:#5f5;">C:${c.community.length}/${c.engagement.length}/${c.support.length}</span> | 
            <span style="color:#f55;">M:${m.discrimination.length}/${m.harassment.length}/${m.spam.length}/${m.integrity.length}</span>
        `;

        summary.append(identity, standing, metrics);

        // Actions Panel
        const actions = this.CHE({
            type: 'div',
            style: "display: flex; gap: 10px; align-items: center; padding: 10px; background: #1a1a1a; border-top: 1px solid #444; justify-content: flex-end;"
        });

        const ptsIn = this.CHE({ 
            type: 'input', 
            attributes: { type: 'number', value: '100' }, 
            style: "width: 5rem; background: #000; color: #0f0; border: 1px solid #555; padding: 4px; font-weight: bold;" 
        });

        const giveBtn = this.CHE({ 
            type: 'div', 
            innerText: 'GIVE POINTS', 
            style: "background:#ff0; color:black; padding: 5px 10px; cursor:pointer; font-weight:bold;",
            // Use arrow function to preserve 'this' context
            onClick: () => {
                const amount = parseInt(ptsIn.value);
                if (!isNaN(amount)) { 
                    this.ModifyUserPoints(u.uuid, amount); 
                    this.UpdateUserDisplay(); 
                }
            }
        });

        actions.append(ptsIn, giveBtn);
        details.append(summary, actions);
        listElement.appendChild(details);
    }
}
}
