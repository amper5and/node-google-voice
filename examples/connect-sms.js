var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

client.connect('sms',{outgoingNumber:['18005551212','1234567890'], text:'Guys, come over for dinner tomorrow!'}, function(error, response, body){
	var data = JSON.parse(body);
	if(error || !data.ok){
		console.log('Error: ', error, ', response: ', body);
	}else{
		console.log('Text sent succesfully.');
	}
});