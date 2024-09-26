// // // // import client_session from "../client_session.js";
// import getLiveChatMessages from "./get_live_chat_messages.js";
// 
// document.getElementById("stream_link").addEventListener("change", ((e) => { console.log("adding event listener"); update_stream_link() }))
// 
// export function update_stream_link() {
// 	console.log("updating stream link");
// 
// 	client_session.videoId = document.getElementById("stream_link").value;
// 
// 	//{{{2 parsing logic
// 	if (client_session.videoId.includes("=")) {
// 		client_session.videoId = client_session.videoId.slice(
// 			client_session.videoId.indexOf("=") + 1,
// 			client_session.videoId.length
// 		);
// 	}
// 	else if (client_session.videoId.lastIndexOf("/") != -1) {
// 		client_session.videoId = client_session.videoId.slice(
// 			client_session.videoId.lastIndexOf("/") + 1,
// 			client_session.videoId.length
// 		);
// 	}
// 	else {
// 		document.getElementById("formatted_stream_link").innerText = "video id is invalid! try another!";
// 		return;
// 	}
// 	//}}}2 parsing logic end
// 
// 	client_session.liveChatId = client_session.videoId;
// 
// 	document.getElementById("formatted_stream_link").innerText = client_session.videoId;
// 
// 	getLiveChatMessages();
// }
