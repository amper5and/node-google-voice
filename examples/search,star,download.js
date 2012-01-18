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
	
	if(!response.messages.length){ // quit if no messages were returned
		return;
	}
	
	response.messages.forEach(function(msg){
		// star each message
		client.set('star',{id: msg.id});
		
		// if the message is a voicemail, download the audio to id.mp3
		if(!!~msg.labels.indexOf('voicemail')){ // check if 'voicemail' is one of the message's labels
			var fileName = msg.id + '.mp3';
			
			// The `file` property holds the filename to which the audio will be saved. Ommitting  `file`  would only pass the audio data buffer to the callback in `body`. No saving to the filesystem would occur.
			client.download({id: msg.id, file: fileName}, function(error, httpResponse, body){
				console.log(error ? 'Error downloading message ' + msg.id +'\nError: '+error : 'Downloaded '+fileName);
			});
		}
	});
});


// A more efficient approach, issuing one 'star' request for all the messages at once, instead of individual requests as above.
// (Note that downloading cannot be achieved with one request. It will fail if the `id` property is an Array)

client.get('search',{query: 'mom', limit:Infinity}, function(error, response){
	if(error){
		console.log('Error: ', error);
		return;
	}
	
	if(!response.messages.length){ // quit if no messages were returned
		return;
	}
	
	var idArray = [];
	
	response.messages.forEach(function(msg){
		
		// this Array aggregates our message ids
		var idArray.push(msg.id);
		
		// if the message is a voicemail, download the audio to id.mp3
		if(!!~msg.labels.indexOf('voicemail')){ // check if 'voicemail' is one of the message's labels
			var fileName = msg.id + '.mp3';
			
			// The `file` property holds the filename to which the audio will be saved. Ommitting  `file`  would only pass the audio data buffer to the callback in `body`. No saving to the filesystem would occur.
			client.download({id: msg.id, file: fileName}, function(error, httpResponse, body){
				console.log(error ? 'Error downloading message ' + msg.id : 'Downloaded '+fileName);
			});
		}
	});
	
	client.set('star',{id:idArray}); // this sends a request to star all the messages at once
});