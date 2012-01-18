var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

// Set a note for message with id ############
client.set('saveNote',{id: '############', note: 'a test note for this message'}, function(error, httpResponse, body){
	var ok = JSON.parse(body).ok;
	if(error || !ok){
		console.log('Error: ', error);
		return;
	}
	
	console.log('Note saved.');
});