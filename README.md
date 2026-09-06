# Cockatiel


## roadmap for v1:
tests: 
- [ ] - [private] universal test markup using an iml or something to generate tests for multiple languages
- [ ] - [private] expanded atomic tests for JS
- [ ] - [private] expanded macro tests for JS
- [ ] - [private] expanded atomic tests for RUST
- [ ] - [private] expanded macro tests for RUST
events:
- [ ] - stream state object for referencing (ie for the clip command)
- [ ] - prediction command
    - [ ] - vote command
- [ ] - (n)x points multiplier event
commands:
- [ ] - clip command with relative positioning
customization:
- [ ] - global calling cards
misc:
- [ ] - proper import/exporting of state
- [ ] - call local tts model [ie models from hugging face](https://huggingface.co/models?pipeline_tag=text-to-speech&sort=trending)
- [ ] - impliment something where you can set your mic input, then if you stop talking for x amount of seconds, it'll play the next tts message instead of just going off on a timer

## tldr:
tts and chat management for streamers

> why make this?
i don't find there's a good open standard for chat interactions, and the ones that do offer this sorta functionality are an absolute pain to use or expand, and instead of making a service where the entire mentality is "oh, well i'll just keep stitching these disconnected tools together", i wanted to make something more cohesive.

i also find that most of the alternatives favor a specific platform far too much, so i want a truely agnostic platform so anyone on any platform can stream and **give the viewers the best experience possible**.

i have also found that other programs are just really hard and annoying to work with and aren't very extensible. this project instead uses a queue's and signals based system which is [from my experience] far easier to extend and customize.

to keep it simple, here's the general loop:
- the program inits and verifys the config to make sure there are no issues,
- after that the main loop for the program is:
> main loop
- check/listen for an update
- add data to an unprocessed queue (this is to capture the data as fast as possible and allow for differed processing in case of performance issues or simply wanting to differ processing until a later point)
- process a message based on the platform and the data captured into the platform [cockatiel's] specific format,
- add messages to the messages_queue on success
> if there is an error at any point the error will be added to the errored_queue and can be view'd later.

while the main loop is running, there is seperate loops for each process happening aswell, 

### FAQ:
> why are you locking global syncing behind a paid cost?
because servers cost money, and i'm barley able to sustain myself. if i had affluent amounts of welth maybe, but unless you want another platform like [discord and their palantir scandal](https://www.bbc.com/news/articles/cn4g8ynpwl8o), it's best to make sure the platform is sustainable but decoupled to ensure users rights aren't violated.

> why is there no blacklist for bad works by default?
1. i have no faith my account wont get instabanned for just having a bunch of bad words and slurs due to ai moderation,
2. i'm not trying to tell you how to police your community or how it should be ran/managed. i'm not your mom and i don't know what your standards are, so i'll leave it upto you and your community to form and build how it wants.

> why are the tests private?
AI companies and what not training off the data, tests have been semi-consistently a major key point for AI companies, and although i'm not completely against AI [see my ethics on AI here](https://vulbyte.com/policies/AI), as outlined in the link, AI companies right now are what i consider to be largely immoral right now, and for that i refuse to support them as is.

> why js for the ui?
it's universal, i don't want to fluff around with using various libraries and what now when you already have a web-browser. also makes it easier to integrate in more niche ways. 
ontop of that due to personally having much more experience with css and not actually finding css that bad, aswell as finding css to be very easy for a new user to customize i think it's the best middle road for all that.
i understand a native app would be more performant, but if you're worried about performance run the local client or subscribe to [vulbyte.com](https://vulbyte.com/) where the performance is our problem not yours.

> why rust for the backend?
Although i [vulbyte] prefer c, cpp, or even odin over rust, due to rust being an application being focused on frontend interactions from multiple sources, want to use the maximal balance of saftey and performance.

> why use a gplv2 license?
because i don't want this project to become some thing obfuscated/highjacked by a larger company and although companies might be able to rip off this, i want this project to be something owned by the community and something everyone can benefit from, not just me.
[cough](https://www.reddit.com/r/OutOfTheLoop/comments/qw5e2u/comment/hl0wsv6/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button),
[cough](https://x.com/OBSProject/status/1460782968633499651),
i

---

side research scratchpad because yurr:
billi-billi: `scaping?` [scraping option](https://github.com/mistgc/bili-live-chat),
facebook: curl [docs](https://developers.facebook.com/docs/live-video-api/),
instagram: no idea [i think this is not it but worth a shot](https://developers.facebook.com/docs/messenger-platform/instagram/),
kick: curl [docs](https://docs.kick.com/apis/livestreams),
picarto: curl-http [docs](https://api.picarto.tv/),
tiktok: `scraping?` [scraping option for now](https://github.com/jpw142/rscraperTikTokLive),
twitch: curl-http [docs](https://dev.twitch.tv/docs/chat/send-receive-messages/),
twitter: curl-http/webhook [docs i think](https://docs.x.com/x-api/introduction?search=livestream+messages),
vimeo: no idea [i beleive these are the docs](https://help.vimeo.com/hc/en-us/articles/12427783601937-How-to-use-the-Vimeo-Live-API),
youtube connection standard: [curl-http](https://developers.google.com/youtube/v3/live/docs/liveChatMessages)/[grpc](https://developers.google.com/youtube/v3/live/streaming-live-chat) ,


---

new readme.md (need to reformat, so this is a work in progress)

# Cockatiel - chat automation engine

## bluhbluhbluh

### creating a module

to connect with the engine all you need to do is attempt to connect to the engine with a given ip/port/pin, HOWEVER if you want the user to be able to start/stop/whatever else with the module, you'll need to create a `cockatiel_module_info.json` within your module to tell cockatiel how to interact with it. here's an example, and you will have to infer how to create your module from it. 
> NOTE: if your module is being ran remotely (ie on a different computer), or is managed by a different application (ie for in game communication) this will be ignored and is not needed. however if a user imports it into their ./modules/<your_module> folder, then this is crutial or else your module will be "invisable" to cockatiel.
```json
{
    // This is the name presented to Cockatiel.
    "name": "example-module", // REQUIRED, no spaces, name is concerted to all lowercase for standardization 

    // Human-readable description of what this module does.
    "description": "An example Cockatiel module.", // optional

    // Version of this module.
    "version": "0.1.0", // optional, just a string, no formatting is enforeced

    // What this module is responsivle for
    "capabilities" = (if you're unfamiliar with json, the value should be something like: `"capabilities": "postprocess",` )
        "input"         // for modules that provide chats that need to be processed. cockatiel_expects: Authmessages,Log,Err,
        "preprocess"    // mainly for archival modules
        "inprocess"     // for modules that wish to modify the chat in flight, ie: censoring, swapping words, telling cockatiel to drop the mesasge due to a flag etc
        "postprocess"   // THIS IS PROBABLY WHAT YOU WANT, used for after the message has been processed, ie for chatbots, sending message to a chat display application, passing a processed command to a game engine, etc

    "root_file" = "./main.rs" //whatever file the launcher needs to run 
    "launch_command" = "cargo", // make this whatever your program needs, such as: node, python3, cargo, etc. IF IS A COMPILED PROGRAM, THEN THE VALUE MUST BE ""
    "command_flags" = [
        "--flag value",
        "--flag value",
        "--flag value"
    ];

    // Whether Cockatiel should consider this module safe to automatically launch when configured.
    "autostart": true | false
}
```
