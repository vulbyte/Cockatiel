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
(lots and lots of things)

### URGENT: 

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
- [ ] update tts_queue_length manually
- [x] fix interger underflow
- [ ] add banner telling users they can use tts

- [ ] get only latest message not whole f*ing chat you idiot
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

### core:
- [x] basic ui
- [x] add links to header
- [x] stream parser for youtube
- [x] load config from files
- [x] test tts window
- [x] get youtube api messages 
- [ ] get livestream url via api (so no more manual entry [but manual can still override])
- [ ] stop current message
- [ ] skip next message
- [ ] on/off light for when message is playing or not (for chat pets)
- [ ] add stream url to cache so that chatId can be cached
- [ ] above but with messages
- [ ] make text in message list wrap on overflow

### quality of life:
- [ ] create db/backup for all messages / stream history
- [ ] add reminder: if api key isn't blank, add reminder to save
- [ ] add info: about networking

### stretch goals:
- [ ] get twitch api messages 

- [ ] play next message in queue
- [x] preview queue
- [ ] set message index
- [ ] play button per message

- [x] message history
- [ ] message removal

- [ ] save list of urls with index number so on reload you can snap back to where was

## weird things to look into / of note:
- at time of writing, youtubes api seems to block mild bad words such as "fugg", so if some messages are appearing but others are not, that is a likely reason why


###### project by vulbyte
