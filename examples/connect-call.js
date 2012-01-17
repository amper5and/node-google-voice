var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

//Place a call to 18005551212 using the MOBILE phone number 1234567890 associated with the GV account
	
client.connect('call',{outgoingNumber:'18005551212', forwardingNumber:'1234567890', phoneType:2}, function(error, response, body){
	var data = JSON.parse(body);
	if(error || !data.ok){
		console.log('Error: ', error, ', response: ', body);
	}else{
		console.log('Call placed.');
	}
});