var GV = require('google-voice');

var client = new GV.Client({
	email: 'email@gmail.com',
	password: 'password'
});

// Display messages in the inbox, with an asterisk in front of unread messages
client.get('inbox',null,function(error, response){
	if(error){
		console.log('Error: ',error);
	}else{
		console.log('There are %s messages in the inbox. The last %s are: ',response.total, response.messages.length);
		response.messages.forEach(function(msg, index){
			console.log(msg.isRead ? ' ' : '*', (index+1)+'.', msg.displayStartDateTime, msg.displayNumber);
		});
	}
});