## What is it?
It's the Google Voice API for [node.js](http://nodejs.org/). Except there is no official "Google Voice API", so node-google-voice is also the only Google Voice API. It allows you to 

* place calls
* send SMS's
* schedule calls and SMS's from inside node or with Google Calendar
* access & manipulate GV data

## Installation
First install node-google-voice in the usual manner for node:
	
	npm install google-voice

See [npm](https://github.com/isaacs/npm) for information on installing npm, the Node Package Manager.

### Dependencies
node-google-voice depends on:

* [googleclientlogin](https://github.com/Ajnasz/GoogleClientLogin)
* [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js/)
* [jsdom](https://github.com/tmpvar/jsdom)

[npm](https://github.com/isaacs/npm) should take care of dependencies, but in case it fails to do so, try installing those modules (and *their* dependencies) independently.

### Node.js version
I've only tested google-voice in Node 0.4.7. Theoretically, it should work fine in older versions, as long as:

* those versions are supported by the dependencies and 
* the particular Node version's `https` is not much different from v0.4.7's. This is the only major core Node module used by node-google-voice.

## Instantiate a Google Voice client

Google Voice client instances are made by calling 

	voiceClient = new require('google-voice').Client(options)
	
where `options` is an Object with the following properties:

* `email` (String) - your Google Voice login email
* `password` (String) - your Google Voice password
* `rnr_se` (String)
    * This last item is a unique identifier for each Google Voice account. You can get it by logging into Google Voice web front-end and running the following javascript bookmarklet in the browser window:
	
		` javascript:alert('Your rnr_se is:\n\n'+_gcData._rnr_se); `
    
	* You only have to do this once, because the `_rnr_se` doesn't change. (...at least it hasn't changed for me since I have become aware of it. If something doesn't work in your GV.Client, first check that your `_rnr_se` hasn't changed.)

#### Example:  Create a GV client instance
	var GV = require('google-voice');
	var voiceClient = new GV.Client({
		email: 'username@gmail.com',
		password: 'password',
		rnr_se: '_rnr_se from Google Voice web page'
	});
	
## Preliminaries
In the examples below:

* `textMessage` (String) is the SMS to send
* `outgoingNumber` (String) is the number to which the forwardingNumber will be connected to or the number(s) to which an SMS will be sent. For SMS's, outgoingNumber can be an Array of Strings, to send the SMS to multiple phone numbers.
* `forwardingNumber` (String) is one of the forwarding numbers set up in your GV account. This is the number that will ring on YOUR end.
* `phoneType` (Integer) is the phone type of the forwardingNumber set up in your GV account. It can be one of the following values:
    * 1 - Home
    * 2 - Mobile
    * 3 - Work
    * 7 - Gizmo		
* `body` is either:
    * an Object formed from the JSON response from Google Voice (typically something like `{ ok: true, data: { code: 0 } }` or `{ ok: false, error: 'Cannot complete call.' }` or `{ ok: false, data: { code: 20 } }`
    * a String containing the HTML response from Google Voice (for cases when the body of the response doesn't contain JSON)

	The body object/string can change as Google makes changes to how Google Voice works. You can attempt to map the different codes to different events, but this is unreliable due to the undocumented and unofficial nature of the GV 'api'.
* `response` (http.ClientResponse) is an instance of Node's [http.ClientResponse](http://nodejs.org/docs/v0.4.7/api/http.html#http.ClientResponse). This is the given response for that particular request. It is provided for cases where you would like to get more information about what went wrong (or right!) and act on it. 

## Calling and Texting
#### Example:  Place a call:
	voiceClient.placeCall(outgoingNumber,forwardingNumber,phoneType,function(body,response){
		console.log(body);
	});
	
or
	
	voiceClient.placeCall(outgoingNumber,forwardingNumber,phoneType);

#### Example:  Send an SMS to one number:
	voiceClient.sendSMS(outgoingNumber,textMessage,function(body,response){
		console.log(body);
	});
	
or

	voiceClient.sendSMS(outgoingNumber,textMessage);

#### Example:  Send an SMS to multiple numbers:
	voiceClient.sendSMS([outgoingNumber1,outgoingNumber2],textMessage,function(body,response){
		console.log(body);
	});

Note that the `callbacks` are optional.


## Schedule calls and SMS's

### The schedule
Calls and SMSs can be scheduled to take place in the future. The GV.Client instance contains a `schedule` object that is populated with event details when events are scheduled successfully. After the events execute (i.e a call is made or an SMS is sent), that event will be removed from the schedule object. 
The name of each event object in the `schedule` object is the ISO String representation of the Date of the event (using ` Date.toISOString() `). So, for the example events below, set to take place on 12/25/2011 at 8:00 AM,  `voiceClient.schedule` will contain an object with the name `2011-12-25T13:00:00.000Z`: `voiceClient.schedule['2011-12-25T13:00:00.000Z']` 

Each scheduled event ( `voiceClient.schedule[ISOdateString]` ) will contain at least the following properties:

* `type` (String): will be either 'call' or 'sms' indicating the event type
* `timer` (timeoutId): the timer object (http://nodejs.org/docs/v0.4.7/api/timers.html) created by setTimeout()

The other properties of `voiceClient.schedule[ISOdateString]` will be event-specific items such as `outgoingNumber`, `forwardingNumber`, `text`, etc...

### Scheduling events
Events are scheduled with `voiceClient.scheduler(type,date,...,eventCallback,scheduleCallback)` where

* `type` (String) is either 'sms' or 'call'
* `date` (Array or Date) is the time of the event. Events can be scheduled using an array of the form [YEAR,MONTH,DAY,HOUR (24-hr format),MINUTE] or with a Date object.
* `...` represents the normal variables associated with the event (such as outgoingNumber, textMessage, etc...see above)
* `eventCallback` (Function) is of the form `function(body,response), where `body` and `response` are the same Objects as described earlier in the Preliminaries section. This callback is called AT THE TIME OF THE EVENT.
* `scheduleCallback` (Function) is of the form `function(schedulingID, scheduledEvent)`. This callback is called after the event has been successfully SCHEDULED. The parameters are: 
    * `schedulingID` (String) is the ISO string representation of the date of the event. 
    * `sheduledEvent` (Object) is the event object from `voiceClient.schedule` corresponding to the scheduled event.
	
NOTE: If the date & time of an event is before the current system time, the event will not be scheduled. The scheduling request will fail silently. (I plan to change this soon so that the `scheduleCallback` will be notified of a failed scheduling request.)

NOTE: Only one event can be scheduled for a particular time, regardless of event type. If the date & time of an event you are trying to add to the schedule matches the date & time of another event already on the schedule, the new event will silently replace the old event. The old event will be unscheduled.

#### Example:  Schedule a call for 12/25/2011 at 8:00 AM using an array of the form [YEAR,MONTH,DAY,HOUR,MINUTE] to represent the date:
	voiceClient.scheduler('call',[2011,12,25,8,00],outgoingNumber,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		},
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+new Date(Date.parse(schedulingID)));
		});

#### Example:  Schedule a call for 12/25/2011 at 8:00 AM using a Date object to represent the date:
	voiceClient.scheduler('call',new Date(2011,11,25,8,00),outgoingNumber,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		});
	
#### Example:  Schedule an sms to be sent on 12/25/2011 at 8:00 AM using an array of the form [YEAR,MONTH,DAY,HOUR,MINUTE] to represent the date:
	voiceClient.scheduler('sms',[2011,12,25,8,00],outgoingNumber,'Merry Christmas!',null,
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+ new Date(Date.parse(schedulingID)));
		});

#### Example:  Schedule an sms to be sent on 12/25/2011 at 10:00 PM using a Date object to represent the date:
	voiceClient.scheduler('sms',new Date(2011,11,25,22,00),outgoingNumber,'Hope you had a wonderful Christmas!');

Note that all of the above requests are valid: you can include both callbacks, just one of the callbacks, or no callbacks.

### Schedule calls from your Google Calendars
Schedule calls from your Google Calendars with: `voiceClient.scheduleCallsFromCalendar(callLabel,forwardingNumber,phoneType,eventCallback,scheduleCallback)` where

* `callLabel` (String) is the string used in Calendar event title/details in the format `callLabel=outgoingNumber` where `outgoingNumber` is the number you will be connected to.
* `forwardingNumber` (String) is the number on YOUR end that will ring
* `phoneType` (Integer) is the phone type of `forwardingNumber` (see above)
* `eventCallback` (Function(body,response)) is the callback called at the time of the event (see above)
* `scheduleCallback` (Function(scheduleID,evt)) is the callback called when the event is scheduled (see above)

This searches your Google Calendars for events with `callLabel` (String) in the event title or event description, and schedules calls for the `outgoingNumber` at that event time.
The format in the event title/details should be: `callLabel=outgoingNumber`. Note the absence of spaces in that string. 

For example, if `callLabel='GVCall'`, then the event title or description in Google Calendar can contain `GVCall=18005551212` to schedule a call to 18005551212.

NOTE: If the `callLabel=outgoingNumber` is in both the event title and description, the one in the title will be used.

Use case: Using this inside `setInterval()` is an easy way to periodically add new events to the schedule as they are added in Google Calendar.

#### Example: Schedule calls from Google Calendar:
	voiceClient.scheduleCallsFromCalendar(callLabel,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		},
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+ new Date(Date.parse(schedulingID)));
		});

or

	voiceClient.scheduleCallsFromCalendar(callLabel,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		});
		
or

	voiceClient.scheduleCallsFromCalendar(callLabel,forwardingNumber,phoneType,null,
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+ new Date(Date.parse(schedulingID)));
		});
		
or

	voiceClient.scheduleCallsFromCalendar(callLabel,forwardingNumber,phoneType);
 
Note that all of the above requests are valid: you can include both callbacks, just one of the callbacks, or no callbacks.

### Remove individual scheduled events:
To remove one event from the schedule, call `voiceClient.unscheduler(date)` where `date` is the dateTime of the event and is one of the following types:

* Array (in the format discussed above)
* Date 
* String (in the ISO format)

`voiceClient.unscheduler(date)` returns `true` if an event was unscheduled, `false` if not (it may be `false` simply because no event was scheduled at that time).

#### Example:  Unschedule whatever event is scheduled for 12/25/2011 at 8:00 AM:

	voiceClient.unscheduler([2011,12,25,8,00]);
	
or

	voiceClient.unscheduler(new Date(2011,11,25,8,00));

or

	voiceClient.unscheduler('2011-12-25T13:00:00.000Z');

### Unschedule all scheduled events
To unschedule all scheduled events, use `voiceClient.unscheduleAll(callback)`. The `callback` is optional. This was added in `v0.0.2`.
#### Example:  Unschedule all scheduled events:
	voiceClient.unscheduleAll(function(){
		console.log('The schedule has been cleared.');
	})


## Retrieving GV Data
All data requests are of the following form: 
	
	voiceClient.get(request,limit,callback) 

where:

* `request` (String or Object) is one of the following Strings:

		'history'
		'inbox'
		'spam'
		'trash'
		'starred'
		'sms'
		'voicemail'
		'placed'
		'missed'
		'received'
		'recorded'	
OR

		{query: searchString}
This last form retrieves messages that match the given searchString (String) in some way. The search function is entirely implemented by Google Voice, so the search results are the same as would be returned by searching from in the Google Voice web interface.
* `limit` (Integer) limits the number of returned messages to a certain number, ordered by time. So `limit=1` will return the most recent message of the given request and `limit=10` will return the 10 most recent messages. If `limit = -1`, ALL messages will be returned (can be slow for very large message lists).
* `callback` (Function) is of the form `function(error,messages)` where `messages` is an array of message objects. Each message object is formed from the JSON response from Google Voice; the format is therefore subject to change. At the time of this writing, an example message looked like this:
		
		{ id: 'someStringIdentifier',
		  phoneNumber: '+18005551212',
		  displayNumber: '(800) 555-1212',
		  startTime: '1305138033000',
		  displayStartDateTime: '5/11/11 2:20 PM',
		  displayStartTime: '2:20 PM',
		  relativeStartTime: '3 weeks ago',
		  note: '',
		  isRead: true,
		  isSpam: false,
		  isTrash: false,
		  star: false,
		  labels: [ 'missed', 'all' ],
		  type: 0,
		  children: '' 
		}
NOTE: SMS messages are grouped under one message ID by Google Voice. In order to present all text messages in an SMS thread, an extra processing step occurs for SMS messages which attaches two properties to the message object:

* `lastText` (String) is the most recent text in the thread
* `thread` (Array) is the collection of text messages in the SMS thread. Each item in this Array is a DOM element (made with jsdom!) that has three children, corresponding to the time, from, and text of the SMS. 
   A convenience method is provided to extract this information from text message DOM elements:
	
		voiceClient.parseSMS(param,msgDomElement)
	
	This returns the requested parameter of the text message where
    * `param` (String) is one of 'time', 'from', or 'text'
    * `msgDomElement` is the DOM element from the thread Array


#### Example:  retrieve and display the last missed call:
	voiceClient.get('missed',1,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		console.log('missed call from ' + msgs[0].phoneNumber + ' at ' + msgs[0].displayStartDateTime);
	});

#### Example:  retrieve all sms messages:
	voiceClient.get('sms',-1,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		console.log(msgs.length + ' SMSs found.');
	});

#### Example:  retrieve the 10 most recent items from the inbox:
	voiceClient.get('inbox',10,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		for(var i=0; i<msgs.length; i++){
			console.log(msgs[i]);
		}
	});

#### Example:  display the most recent SMS thread:
	voiceClient.get('sms',1,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		console.log('latest SMS thread:');
		for(var i=0;i<msgs[0].thread.length;i++){
			var currentMsg = msgs[0].thread[i];
			console.log(voiceClient.parseSMS('time',currentMsg)+' '+voiceClient.parseSMS('from',currentMsg)+voiceClient.parseSMS('text',currentMsg) );
		}
	});

#### Example:  find all texts/calls from 'mom' or that mention 'mom':
	voiceClient.get({query: 'mom'},-1,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		console.log(msgs.length + ' messages found.');
	});

## Unread counts
Every time a `voiceClient.get()` request is made, the voice client's `unreadCounts` property is updated with the most current information from Google Voice. At the time of this writing, an example `voiceClient.unreadCounts` object looked like this:

			{ all: 3,
			  inbox: 3,
			  missed: 0,
			  placed: 0,
			  received: 0,
			  recorded: 0,
			  sms: 1,
			  starred: 0,
			  trash: 4,
			  unread: 3,
			  voicemail: 2
			}


## Manipulating GV Data
All data manipulation requests are of the following form: 
	
	voiceClient.set(param,messageID,callback) 

where:

* `param` (String) is one of the following Strings:

		'markRead'
		'markUnread'
		'archive'
		'unarchive'
		'star'
		'unstar'
		'deleteForever'
		'toggleTrash' - calling this on a message will move it to the inbox if it is in the trash OR will move it to the trash if it is somewhere else

* `messageID` (String or Array) is the String/Array of unique Google Voice message id(s). This ID can be had from the message objects returned by `voiceClient.get()` (discussed earlier)
* `callback` (Function) is of the form function(body, response) where `body` and `response` are described above in the Preliminaries section

#### Example:  star a message:
	voiceClient.set('star',messageID,function(body,reponse){
		console.log(body);
	})

#### Example:  archive a bunch of messages:
	voiceClient.set('archive',[messageID1,messageID2,messageID3],function(body,reponse){
		console.log(body);
	})


## TODO
* Schedule SMS's with Google Calendar
* Detect removed scheduling events in Google Calendar
* Get and set Google Voice settings
* Retrieve contacts
* Download/stream voicemail MP3ss

## Conclusion
Google does not have an official Google Voice API. Therefore, the nature of the requests and returned data can change without notice. It is unlikely to change often or soon, but I will make all efforts to keep up with the most current implementation. If you have any issues, please give me a shout, and I'll do my best to address them. I have not trained as a developer (I code only as a hobby), so I'm also open to any constructive criticism on best coding practices and the like. 
Enjoy!
