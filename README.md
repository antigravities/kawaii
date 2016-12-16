# kawaii

Basic LINE client using unofficial Thrift API

### WARNING
kawaii-based clients have been banned in the past. As long as you aren't
a moron (like me) and not straying too far from the protocol, you should be
fine. However, you probably shouldn't link your main account and your
bot's account just to be safe.

I accept no responsibility for anything that happens to you for using
kawaii. If you get banned, that's 100% your fault.

That being said, have fun!

## Installing
1. Install Apache Thrift from [here](http://thrift.apache.org/).
2. Download line.thrift from [here](http://altrepo.eu/git/line-protocol/).
3. `npm install`
4. `thrift -r --gen js:node line.thrift`
5. `require('./kawaii')`

## What kawaii can do
1. Log in (and emulate a desktop LINE client)
2. Interact using an EventEmitter
3. Read non-letter-sealing messages
4. Send messages

## What kawaii can't do
1. Pretty much everything else.

## Example
````
var Kawaii = require("./kawaii");
var bot = new Kawaii("email", "password", cert);

bot.emitter.on("certificate", function(cert){
  // Save our certificate for easier, mobile-free log-ons in the future
  require("fs").writeFileSync("cert.private", cert);
});

bot.emitter.on("messageReceived", function(message){
  bot.sendMessage(message.mFrom, message.text);
});

bot.connect();
````

## Special thanks
[Matti Virkkunen](http://altrepo.eu/git/line-protocol/) for his research and
documentation on the LINE protocol; without it, this wouldn't have been possible

## License
GPL v3
