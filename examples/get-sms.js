var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

// Retrieve the most recent SMS and display its message thread
	
client.get('sms',{limit:1},function(error, response){
	if(error){
		console.log('Error: ',error);
	}else{
		var latest = response.messages[0];
		
		if(!latest){ 
			console.log('No texts found.');
			return; 
		}
		
		console.log('Latest text: From %s at %s', latest.displayNumber,latest.displayStartDateTime);
		
		// display the message thread
		latest.thread.forEach(function(sms){
			console.log(sms.time, sms.from, sms.text);
		});
	}
});