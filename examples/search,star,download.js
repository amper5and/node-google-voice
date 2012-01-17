var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

// Star all messages to/from/mentioning 'mom' and download any that are voicemails
	
client.get('search',{query: 'mom', limit:Infinity}, function(error,response){
	if(error){
		console.log('Error: ', error);
		return;
	}
	response.messages.forEach(function(msg){
		// star each message
		client.set('star',{id: msg.id});
		
		// if the message is a voicemail, download the audio to id.mp3
		if(!!~msg.labels.indexOf('voicemail')){
			var fileName = msg.id + '.mp3';
			client.download({id: msg.id, file: fileName}, function(error, httpResponse, body){
				console.log(error ? 'Error downloading message ' + msg.id +'\nError: '+error : 'Downloaded '+fileName);
			});
		}
	});
});