var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

// Star all messages to/from/mentioning 'mom' 
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
	});
});


// A more efficient approach, issuing one 'star' request for all the messages at once, instead of individual requests as above.
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
	});
	
	client.set('star',{id:idArray}); // this sends a request to star all the messages at once
});