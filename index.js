const EventEmitter = require("events");

module.exports = function(email, password, certificate){
  var Thrift = require("thrift-http");
  var Request = require("request");

  var TalkService = require("./gen-nodejs/TalkService.js");
  var ttypes = require("./gen-nodejs/line_types.js");

  var Mockery = require("Mockery");

  const LineAppVersion = "DESKTOPWIN\t4.10.0.1237\tWINDOWS\t5.1.2600-XP-x64";

  this.info = {};
  this.info.email = email;
  this.info.password = password;
  this.info.certificate = certificate;

  this.authCode = null;
  this.opRevision = null;

  var circ = this;

  this.emitter = new EventEmitter();

  Mockery.mock("conn_opts", {
    transport: Thrift.TBufferedTransport,
    protocol: Thrift.TCompactProtocol,
    path: "/S4",
    headers: {
      "X-Line-Application": LineAppVersion, // emulate winxp
      "Connection": "keep-alive"
    }
  });

  Mockery.variant("conn_initialsignon", function(connopts){
    connopts.path = "/api/v4/TalkService.do";
    return connopts;
  });

  Mockery.variant("conn_wait", function(connopts){
    connopts.path = "/P4";
    return connopts;
  });

  Mockery.variant("conn_authorized", function(connopts){
    connopts.headers["X-Line-Access"] = circ.authCode;
    return connopts;
  })

  function createConnection(connopts){
    return Thrift.createHttpConnection("gd2.line.naver.jp", 443, connopts);
  }

  this._connect = function(email, password, certificate, verifier){
    if( ! certificate && ! verifier ){
      var client = Thrift.createHttpClient(TalkService, createConnection(Mockery.ofA("conn_opts").with("conn_initialsignon").fetch()));
      client.loginWithIdentityCredentialForCertificate(ttypes.IdentityProvider.LINE, email, password, true, "127.0.0.1", "kawaii", "", function(error, result){
        if( result ){
          if( result.type == 3 ){
            var vParam = result.verifier;
            circ.emitter.emit("pinCodeRequired", result.pinCode);
            Request({url: "https://gd2.line.naver.jp/Q", headers: { "X-Line-Application": LineAppVersion, "X-Line-Access": vParam }, timeout: 180000 }, function(e,r,b){
              if( e && e.code == "ESOCKETTIMEDOUT" ){
                circ.emitter.emit("error", "Timed out waiting for code entry");
              }
              else{
                var data = JSON.parse(b);
                circ._connect(email, password, null, data.result.verifier);
              }
            });
          }
        } else {
          circ.emitter.emit("error", error.reason);
        }
      });
    } else if( ! certificate ){
      var client = Thrift.createHttpClient(TalkService, createConnection(Mockery.ofA("conn_opts").with("conn_initialsignon").fetch()));
      client.loginWithVerifierForCertificate(verifier, function(error, result){
        circ.emitter.emit("loggedOn", result.authToken, result.certificate);
        circ.authCode = result.authToken;
        circ._prepareWait();
      });
    } else {
      var client = Thrift.createHttpClient(TalkService, createConnection(Mockery.ofA("conn_opts").with("conn_initialsignon").fetch()));
      client.loginWithIdentityCredentialForCertificate(ttypes.IdentityProvider.LINE, email, password, true, "127.0.0.1", "kawaii", certificate, function(error, result){
        if( result && result.type == 1 ){
          circ.emitter.emit("loggedOn", result.authToken, certificate);
          circ.authCode = result.authToken;
          circ._prepareWait();
        } else {
          circ.emitter.emit("error", error.reason);
        }
      });
    }
  }

  this.connect = function(){
    circ._connect(circ.info.email, circ.info.password, circ.info.certificate, null);
  }

  this._wait = function(){
    var client = Thrift.createHttpClient(TalkService, createConnection(Mockery.ofA("conn_opts").with("conn_wait").with("conn_authorized").fetch()));
    client.fetchOperations(circ.opRevision, 50, function(error, something){
      something.forEach(function(v,k){
        if( v.type != ttypes.OpType.END_OF_OPERATION ){
          circ.emitter.emit("opRevision", v.revision);
          circ.opRevision = v.revision;
          if( v.type == ttypes.OpType.RECEIVE_MESSAGE) circ.emitter.emit("messageReceived", v.message);
          else if( v.type == ttypes.OpType.NOTIFIED_ADD_CONTACT ) circ.emitter.emit("contactRequestReceived", v.param0);
          else circ.emitter.emit("rawEvent", v);
        } else {
            circ.emitter.emit("endOpList");
        }
      });
      circ._wait();
    });
  }

  this._prepareWait = function(){
    this._wait();
    setInterval(this._wait, 120000);
  }

  this.sendMessage = function(id, message, callback){
    var msg = new ttypes.Message({text: message, to: id});
    var client = Thrift.createHttpClient(TalkService, createConnection(Mockery.ofA("conn_opts").with("conn_authorized").fetch()));
    client.sendMessage(0, msg, function(error, something){
      if( error ) return circ.emitter.emit("error", error);
      if( callback ) callback(something);
    });
  }

  this.getContact = function(id, callback){
      var client = Thrift.createHttpClient(TalkService, createConnection(Mockery.ofA("conn_opts").with("conn_authorized").fetch()));
      client.getContact(id, function(error, result){
        if( error ) return circ.emitter.emit("error", error);
        callback(result);
      });
  }
}
