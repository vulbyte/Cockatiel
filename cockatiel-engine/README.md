# cockatiel local server
cockatiel is a chat framework a self hosted tts platform designed to run locally (or remotely depending on needs), that is open source and cross platform. 
it is designed to centralize your chat and stream tools in a way that allows for proper extensibilty, flexability and integrations that are not dependant on a platform or third party.

## purpose:
the purpose of this platform is to avoid dependence on external platforms which might fail [rip StreamElements](https://www.reddit.com/r/LivestreamFail/comments/1tdjf52/streamelements_prepares_to_shut_down_website_and/) or [the toxicity/scummy behavoir of streamlabs](https://www.reddit.com/r/Twitch/comments/10a9xww/comment/j43avwf/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button).

it is a firm belief of mine that creators should have autonomy over their tools and community, and needing to rely on an unstable third party, frustratings tools, or platform lock (where the tool can be ripped away from you) is not sustainable or stable for ones career.

## random notes:
serde is a very strict json parser.
```
{
    "value": "key",
    value: "key", <- this will be invalid because the key doesn't have quotes
    "value": key, <- lack of quotes around key only works if the key is a number.
    "value": "key", <- this will break because of the trailing comma (dumb choise i know)
}
```

## roadmap for v1.0.0
### protocol:
[x] - standardize timeline objects
> note, using json as a placeholder, this will be abstracted in the database.
```json
    uuid7: {
        c: "!tts",                                  // if a command flag is attempted
        d: dataBlob,                                // things like mp3 file for tts
        e: errMsg,                                  // error if any
        f: ""                                       // flags (if any)
        i: "01a00c6f-d76d-77ea-84df-969be2e1dfac",  // timeline id#, includes timecode within it
        o: originLocation,                          // origin of message (system, youtube, twitch, etc)
        p: "hello! how are you today ****?",        // processed message
        r: "hello! how are you today bish?",        // raw message
        s: stream origin,                           // the specific stream (if any) the mesage came from
        t: messageType,                             // log, warning, error, system, usermessage, etc
        u: user_id,                                 // user_id of who owns it
        v: 1,                                       // version
    }
```
[ ] - standardize websocket protocol for connecting
> this is the general route and path of of how it would work:
1. module reqest connection with; ip, port, pin, and pubKey for connection using protobufs
```json
{
    type: connection_new,
    pubName: tts, // whatever the module is called, all lower case, will be formatted to snakecase
    ip: [192, 0, 0, 1],
    port: 65536,
    pin: 123456,
    pubKey: asdf, // for rsa e to e encryption
}
```
2. cockatiel returns the following
```json
{
    type: verify,
    newPort: 65535, //this is changed because the inital port is an open port listeneing for new connections
    pubKey: hjkl, 
    jwt: qwer.asdf.zxcv,
}
```
3. communication protocol:
send (module): generate -> encode -> send
> payload example
if you're using js here's an example how how to encode using the lib-cockatiel:
``
Cockatiel.send(dataAsBase64);
``
and with std js if you want to do something custom:
``
// Source - https://stackoverflow.com/a/33787603
// Posted by dimo414, modified by community. See post 'Timeline' for change history
// Retrieved 2026-08-16, License - CC BY-SA 4.0
String asBase64 = BaseEncoding.base64().encode(proto.toByteArray());
``

receive (module): decode -> verify -> awk
##### here are valid objects cockatiel will send:
msg:
```JSON
{
    type: message,
    newOrOldJWT: qwer.asdf.zxcv,
    message: "here's a message from chat",
    command: "!tts",
    flags: {
        "p": "1.0",
        "r": "1.0",
        "v": "128",
    },
    errMessage: "errMsg",
}
```
```JSON 
{
    type: user,
    newOrOldJWT: qwer.asdf.zxcv,
    userObject: {/*refer to the objects section for how this looks*/},
}
```
> cockatiel will not provide any other forms of data

closing connection:
```JSON
{
    type: connection_termination,
}
```

4. async update
due to the general nature of the program, we want security to be maximized, so your program will receive a JWT, that jwt must be ready to be updated randomly. updates will generally happen every 5-15 minutes and will only ever be issued by cockatiel. if your program communicates frequently enough with cockatiel then cockatiel will provide a new jwt at the same time so it will be best to check if the jwt has been updated or not with each message. 
> there will be a grace period but after that period decided by cockatiel at runtime the program will terminate the connection and move forward

##### 5 - data objects:
commands:
```JSON
    commands: {
      version: 1,
      commandType: null,
      flags: {}, // ie: e: {value, type, description,}
      func: null, // function to call when triggered
      //will check the highest perm first, the first to return true will be assumed. if none true assumed to be public
      AuthNeeded: {
        owner: false,
        admin: false,
        mod: false,
        // trusted users are users who have a certain amount of lifetime score or time since first appearance.
        trusted: false,
      },
      cost: 0,
    },
```
error:
```JSON
    errored_data: {
      version: 1,
      data: null, // raw data that errored
      hardware: null, // hardware info of the system that failed
      erroredAt: null, // unixTime of when the error happened
      errorMessage: null, // err.message for quick reference
      stackTrace: null, // err.stack: captures the full path of the failure
      processingStage: null, // identifies which function/.valueblock was running
      retryCount: 0, // increments if you attempt to re-process
    },
```
raw_message:
```JSON
    unprocessed_message: {
      version: 1,
      apiVersion: 3, // youtube,
      data: null, // the raw data from the platform
      dateTime: null,
      platform: null,
      failedProcessingAt: null,
    },
```
processed_message:
```JSON
    messages: {
      //originalData: {},
      commands: [/*eac command being a messageCommandObject],
      version: 1,
      channelOrigin: null,
      donationAmount: 0,
      donationCurrency: null,
      messageId: null,
      processedMessage: null,
      platform: null,
      rawMessage: null,
      receivedAt: null,
      score: null,
      state: {},
      streamOrigin: null, //what streamid via the platform the message came from
      type: null, //must be selected from: templates.message_types[i]
      username: null,
      userUuid: null,
    },
```
user:
```JSON
 user: {
      version: 1,
      username: null,
      channels: {
        facebook: [],
        kick: [],
        tiktok: [],
        twitch: [],
        youtube: [],
      },
      uuid: null,
      ttsBans: [], // times they've been restricted from using tts (ie non-english, spam, etc)
      channelBans: [], // when banned and why
      conduct_score: 0, // -5 is the worst, 5 is the best, calculated at init or when a commendment or misconduct is added. ranks are in the following order (worst to best):
      /*	opal		- 1.5x score multiplier
				obsidian	- can send gifs
				diamond 	- 1.2x score multiplier
				platinum	- no more negative points -- here and above is trusted
				gold		- 1.1x score multiplier
				silver		- ...
				bronze		- 0.85x
				copper		- 0.75x score multiplier
				concrete	- user now automatically hidden from chat (not dashboard tho)
				dirt		- no chat customization perms
				trash		- 0.5x score multiplier */
      commendments: {
        community: [], // welcoming, helpful, inclusivity, etc
        engagement: [], // hype, constructive feedback, good chatting, etc
        support: [], //the only thing one can buy
        rep: [], // low support, no real value on scoring but can be fun for chat
      },
      misconduct: {
        discrimination: [], // racism, sexism, etc
        harassment: [], // bullying, hate speech, etc
        spam: [], // self-promo, asdl;fknfrtn, links, etc
        integrity: [], // language, spoilers, trolling/rage, bypassing filters
      },
      icon: null, //only allow icons from yt/twitch/etc
      isSponser: false, // is a paying memeber/has payed money this stream
      isChatModerator: false, // can remove messages or but users on timeout
      isChatAdmin: false, // can manage blocked words, change chat modes, and some other things
      isVerified: false, // if they have been verified by the platform
      firstSeen: null, //Date.now()
      points: 0,
      totalPoints: 0,
      styling: {
        // ONLY CUSTOMIZABLE PROPERTIES ARE HERE, styles are whiteliste'd
        chatMessageContainer: {
          styling: null,
          chatUserBubble: {
            styling: null,
            chatBubbleTailContainer: {
              styling: null,
              chatBubbleTailContainer: {
                styling: null,
                chatBubbleTail: { styling: null },
              },
            },
            chatUserInfo: {
              styling: {
                backgroundColor: "#ff8",
                borderRadius: "3rem",
                color: "black",
              },
              chatUserImageContainer: {
                styling: {
                  backgroundColor: "#000",
                  borderRadius: "100%",
                },
                chatUserImage: { styling: null },
              },
              chatUserStats: {
                styling: null,
                chatUsername: { styling: null },
                chatUserCommendations: { styling: null },
              },
            },
          },
          chatMessageBubble: {
            styling: {
              backgroundColor: "#111",
              borderRadius: "1.3rem",
              color: "white",
            },
            chatCommandContainer: {
              styling: {
                height: "1rem",
                paddingBottom: "1rem",
              },
              chatCommand: {
                styling: {
                  backgroundColor: "#222",
                  borderRadius: "1rem",
                  color: "cyan",
                },
              },
            },

            chatMessage: { styling: null },
          },
        },
      }, //end of styling
      totalMessages: 0,
    }
```

[ ] - standardize websocket protocol for creating and adding commands from remote service
> note: 100,000 "credits" will convert to 1.00$USD, and the rates can be set from their. the goal is to set pay scale based on minimum wage per country, 
ie: 
usa: 750k -> 7.50usd 
lebanese: 750k -> 161,600 LBP per hour OR 1.81$USD 
this would require payment locking, but would allow a more fair way to enguage with cockatiel. 
this also would set an equivelant rate for messages.  such as a message after scoring being about 1.5k/good message.
```JSON
{
    "t": "register_command",                                        // [t]ype of websocket action
    "jwt": "qwer.asdf.zxcv",                                        // [j]wt security token for authentication
    "d": {                                                          // [d]ata payload containing command definition
        "c": "tts",                                                 // [c]ommand name/identifier (e.g., tts)
        "d": "Text-to-speech engine wrapper",                       // [d]escription of what the command does
        "v": 1,                                                     // [v]ersion of the command schema
        "f": {                                                      // [f]lags or parameters accepted by the command
            "r": { "t": "float", "d": "Rate/Speed", "def": 1.0 },   // [t]ype, [d]escription, [def]ault value
            "p": { "t": "float", "d": "Pitch", "def": 1.0 },        // [t]ype, [d]escription, [def]ault value
            "v": { "t": "int", "d": "Volume", "def": 100 }          // [t]ype, [d]escription, [def]ault value
        },
        "auth": {                                                   // permission required: stream owner
            "trusted": false                                    
            "mod": false,                                       
            "admin": false,                                     
            "owner": false,                                                 
        },
        "cost": 100,000                                             // points cost to execute the command
    }
}
```

### COCKATIEL CORE PROCESSESS:
#### users mgmt:
[ ] - reading to local user database
[ ] - writing to local user database
[ ] - readingto remote user database
[ ] - writing to remote user database
[ ] - add user profile
[ ] - merge profiles
[ ] - remove user profile (dataprivacy reasons)
[ ] - user rep

#### platforms:
[ ] - youtube grpc support
[ ] - twitch rpc support

#### timeline (will not support deleting):
[ ] - local timeline creation ([ ] - push, [ ] - get)
[ ] - remote timeline connection
[ ] - timeline for events using [turso's limbo](https://github.com/olliehcrook/limbo)
[ ] - fallback for sqlite3 using [rusqlite](https://github.com/rusqlite/rusqlite)

#### message modules (chrono-dependant):
[ ] - Banned Words handler
    [ ] - add words
    [ ] - remove words
    [ ] - on detect replace word with char
    [ ] - on detect replace whole word with another word
    [ ] - on detect replace whole sentance 
[ ] - Score message
    [ ] - reward capitalization
    [ ] - reward punctuation
    [ ] - punish spam/gerble
    [ ] - spacing ratio 
    [ ] - morse code detection

### ui:
[x] - timeline print formatting
[ ] - web frontend [hosted locally like a router] for displaying chat and configuring cockatiel.

### lib-cockatiel: 
[ ] - .c11 module (c11 forward)
[ ] - .cpp11 module (cpp11 forward)
[ ] - .rs module
[ ] - .cs module (c# 8.0 forward (8+ for async streams))
[ ] - .mjs module (no typescript for compatability)
[ ] - .gdscript
[ ] - .lua (5.1+)
[ ] - .py (just incase)

### async modules (chrono-independant):
[ ] - !help (print all commands, tree maybe?)
[ ] - !tts 
    [ ] - connect to llm
    [ ] - call llm
    [ ] - send request to eSpeak NG running locally
    [ ] - return audio file from eSpeak NG
    [ ] - return audio file
    [ ] - play audio file
    [ ] - send audio file
    [ ] - attach audiofile to timeline
[ ] - !clip
    [ ] - detect when stream starts
    [ ] - create reference timestamp
    (stretch goals:)
    [ ] - pass timestampt into ffmpeg
    [ ] - auto edit the clips

### chat display:
[ ] - html/css/js based display
[ ] - terminal display (for instances there's a lacking GUI):

### moderation
[ ] - add user notes
[ ] - timeout user
[ ] - un-timeout user
[ ] - ban user
[ ] - un-ban user
[ ] - add/edit notes on user
[ ] - whisper to user (last used platform)

### strech features (if the project catches on):
[ ] - vst support for speech synthesis (is it even possible to pass strings to vst's?)
[ ] - integrated png-tuber esc "chat mascot" support
[ ] - soundboard for users
[ ] - soundboard for streamer
[ ] - !poll commands
[ ] - events display for displaying graphics for polls and what not

### platforms to add  only if there's strong community desire:
[ ] - BilliBilli support
[ ] - Discord    support
[ ] - Facebook   support
[ ] - Instagram  support
[ ] - Kick       support
[ ] - Odysee     support
[ ] - Picarto    support
[ ] - Pixiv      support
[ ] - Rumble     support
[ ] - Trovo      support
[ ] - TikTok     support
[ ] - Twitter    support


> note: other platforms will be added as vulbyte wants to add them. IF this tool becomes more popular that is subject to change but for v1 youtube and twitch are the only ones on the roadmap. 

## Getting started

### pre-requisits:
1. [cargo and the rustc](https://rust-lang.org/tools/install/)

### recommendations:
1. enable terminal colors for easier reading [here's a stackexchange of suggestions]{https://unix.stackexchange.com/questions/148/colorizing-your-terminal-and-shell-environment}

### permission requirements:
1. a 32 or 64 bit operating system (might compile on either systems, but those are our targets)
2. UTF-8 support
3. read/write to local storage
4. network to access modules

### to build:
1. download the project
2. go to your terminal of choice
3. run ```bash cargo build```

### contribution rules:
1. you must clearly state what you're updating and why
> ie: updated user scoring because there was a bug where morsecode was a "hack" to farm points
2. you must clearly declare if AI was used and where (including code completion suggestions)
> ie: /*AI code start*/ [code] /*AI code end*/
3. be willing to accept feedback and revisions
> ie: this loop has a flaw where if with x condition it will never exit, please add an incriment to exit after y tried to prevent a forever loop
