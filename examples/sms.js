(function () {
  "use strict";

  // If you `npm install google-voice`
  // then change this to just 'google-voice'
  var GV= require('../google-voice')
    , gvClient
    ;

  //
  // Login
  // Set username and password
  //
  gvClient = new GV.Client({
      email: "john.doe@gmail.com"
    , password: "secret"
  })

  //
  // SMS
  // Send an sms to one or more numbers
  //
  gvClient.connect('sms', {
      outgoingNumber: ['(555) 555-5555', '777-777-7777']
    , text: 'testing sending text messages from google voice with nodejs'
  }, function (err, res, body) {
    if (err) {
      console.error('[Google Voice Example]');
      console.error(err.message);
      console.error(err.stack);
      return;
    }

    console.log(body);
  });
  
}());
