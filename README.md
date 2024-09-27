# Cockatiel

an electron app that monitors stream for cmds, then uses tts to read message

## important notes:

this is built and made for macOS, it should work on linux with minimal issue/debugging but it has not been tested their yet.
as for windows i have 0 idea thuogh it depends on some shell commands so you likely will need to to a lot of work to make it work.

everything here will be written from the perspective of macOS, at the moment if you're on a different platform you're on your own.

## needs:

- node ```brew install node```
- gcloud sdk ```brew install --cask google-cloud-sdk```

## todo:

lots and lots of things

- [x] basic ui
- [x] add links to header
- [x] stream parser for youtube
- [x] load config from files
- [x] test tts window

- [ ] get youtube api messages 
- [ ] stop current message
- [ ] skip next message


### stretch goals:
- [ ] get twitch api messages 

- [ ] play next message in queue
- [ ] preview queue
- [ ] set message index
- [ ] play button per message

- [ ] message history
- [ ] message removal

- [ ] click and drag sorting

- [ ] save list of urls with index number so on reload you can snap back to where was

###### project by vulbyte
