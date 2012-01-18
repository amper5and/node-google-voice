var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

// Retrieve a maximum of 5 of the latest recorded calls and download them to files of the format id.mp3

client.get('recorded', {limit:5}, function(error, response){
	if(error){
		console.log('Error: ', error);
		return;
	}
	
	if(!response.messages.length){
		return;
	}
	
	response.messages.forEach(function(msg){
		var fileName = msg.id + '.mp3';
		client.download({id: msg.id, file: fileName}, function(err, httpResponse, body){
			if(err){
				console.log('Error downloading message ', msg.id,':',err);
			}else{
				console.log('Downloaded ', fileName);
			}
		});
	})
});