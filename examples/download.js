var GV = require('google-voice');
var fs = require('fs');

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
		console.log('No messages found.');
		return;
	}
	
	response.messages.forEach(function(msg){
		client.download(msg.id, function(err, httpResponse, body){
			if(err){
				console.log('Error downloading message ', msg.id,':',err);
			}else{
				var fileName = msg.id + '.mp3';
				fs.writeFile(fileName, body, function(error){
					if(error){
						console.log('Error saving file ', fileName);
					}else{
						console.log('Saved ', fileName);
					}
				});
			}
		});
	})
});