## Installation
First install node-google-voice in the usual manner for node:
	
	npm install google-voice

## Instantiate a Google Voice client

Google Voice client instances are made by calling 

	voiceClient = new require('google-voice').Client(options), 
	
where `options` is an Object with the following properties:

* `email` (String) - your Google Voice login email
* `password` (String)
* `rnr_se` (String)
    * This last item is a unique identifier for each Google Voice account. You can get it by logging into Google Voice web front-end and running the following javascript bookmarklet in the browser window:
	
		`javascript:alert('Your rnr_se is:\n\n'+_gcData._rnr_se);`
    
	* You only have to do this once, because the rnr_se doesn't change. (...at least it hasn't changed for me since I have become aware of it. If something doesn't work in your GV.Client, first check that the rnr_se hasn't changed.)

#### Example:  Create a GV client instance
	var GV = require('google-voice');
	var voiceClient = new GV.Client({
		email: 'username@gmail.com',
		password: 'password',
		rnr_se: '_rnr_se from Google Voice web page'
	});
	
## Intro
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
* `response` (http.ClientResponse) is an instance of Node's http.ClientResponse. This is the response from the particular request. It is provided for cases where you would like to get more information about what went wrong (or right!) and act on it. 

## Calling and Texting
#### Example:  Place a call:
	voiceClient.placeCall(outgoingNumber,forwardingNumber,phoneType,function(body,response){
		console.log(body);
	});

#### Example:  Send an SMS to one number:
	voiceClient.sendSMS(outgoingNumber,textMessage,function(body,response){
		console.log(body);
	});

#### Example:  Send an SMS to multiple numbers:
	voiceClient.sendSMS([outgoingNumber1,outgoingNumber2],textMessage,function(body,response){
		console.log(body);
	});


## Schedule calls and SMS's
Calls and SMSs can be scheduled to take place in the future. The GV.Client instance contains a `schedule` object that is populated with event details when events are scheduled successfully. After the events execute (i.e a call is made or an SMS is sent), that event wil be removed from the schedule object. 
The key of each event in the schedule object is the ISO String representation of the Date of the event. So, for the example events below, set to take place on 12/25/2011 at 8:00 AM, the `schedule` Object will contain an object with the name `2011-12-25T13:00:00.000Z`:

`voiceClient.schedule['2011-12-25T13:00:00.000Z']` will contain at least the following properties:

* `type` (String): will be either 'call' or 'sms' indicating the event type
* `timer` (timeoutId): the timer object (http://nodejs.org/docs/v0.4.7/api/timers.html) created by setTimeout()

The other properties of `voiceClient.schedule[ISOdateString]` will be event-specific items such as `outgoingNumber`, `forwardingNumber`, `text`, etc...

Events are scheduled with 
`voiceClient.scheduler(type,date,...,eventCallback,scheduleCallback)` 
where

* `type` (String) is either 'sms' or 'call'
* `date` (Array or Date) is the time of the event. Events can be scheduled using an array of the form [YEAR,MONTH,DAY,HOUR (24-hr format),MINUTE] or with a Date object.
* `...` represents the normal variables associated with the event (such as outgoingNumber, textMessage, etc...see above)
* `eventCallback` (Function) is of the form `function(body,response), where` body and response are the same Objects as described earlier in the INTRO. 
  This callback is called AT THE TIME OF THE EVENT.
* `scheduleCallback` (Function) is of the form `function(schedulingID, scheduledEvent)`, where 
    * `schedulingID` (String) is the ISO string representation of the date of the event. 
    * `sheduledEvent` (Object) is the event object from `voiceClient.schedule` corresponding to the scheduled event.
   This callback is called after the event has been succesfully SCHEDULED.
	
NOTE: If the date & time of an event is before the current system time, the event will not be scheduled. The scheduling request will fail silently.

NOTE: Only one event can be scheduled for a particular time, regardless of event type. If the date & time of an event you are trying to add to the schedule matches the date & time of another event already on the schedule, the new event will silently replace the old event. The old event will be unscheduled.

#### Example:  Schedule a call for 12/25/2011 at 8:00 AM using an array of the form [YEAR,MONTH,DAY,HOUR,MINUTE] to represent the date
	voiceClient.scheduler('call',[2011,12,25,8,00],outgoingNumber,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		},
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+new Date(Date.parse(schedulingID)));
		});

#### Example:  Schedule a call for 12/25/2011 at 8:00 AM using a Date object to represent the date
	voiceClient.scheduler('call',new Date(2011,11,25,8,00),outgoingNumber,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		},
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+new Date(Date.parse(schedulingID)));
		});
	
#### Example:  Schedule an sms to be sent on 12/25/2011 at 8:00 AM using an array of the form [YEAR,MONTH,DAY,HOUR,MINUTE] to represent the date
	voiceClient.scheduler('sms',[2011,12,25,8,00],outgoingNumber,'Merry Christmas!',
		function(body,response){
			console.log(body);
		},
		function(schedulingID, evt){
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+ new Date(Date.parse(schedulingID)));
		});

#### Example:  Schedule an sms to be sent on 12/25/2011 at 8:00 AM using a Date object to represent the date
	voiceClient.scheduler('sms',new Date(2011,11,25,8,00),outgoingNumber,'Merry Christmas!',
		function(body,response){
			console.log(body);
		},
		function(schedulingID){
			var evt = voiceClient.schedule[schedulingID];
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+ new Date(Date.parse(schedulingID)));
		});
		
## Remove scheduled events
To remove an event from the schedule, call `voiceClient.unscheduler(date)` where `date` is the dateTime of the event and is one of the following types:

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


## Schedule calls from your Google Calendars
This searches your Google Calendars for events with `callLabel` (String) in the event title or event description and schedules calls for the `outgoingNumber` at that event time.
The format in the event title/details should be: `callLabel=outgoingNumber`.
For example, if `callLabel='GVCall'`, then the event title or description in Google Calendar can contain `GVCall=18005551212` to schedule a call to 18005551212. Note the absence of spaces in that string. 

NOTE: If the `callLabel=outgoingNumber` is in both the event title and description, the one in the title will be used.
#### Example: Schedule calls from Google Calendar
	voiceClient.scheduleCallsFromCalendar(callLabel,forwardingNumber,phoneType,
		function(body,response){
			console.log(body);
		},
		function(schedulingID){
			var evt = voiceClient.schedule[schedulingID];
			console.log('scheduled '+evt.type+' to '+evt.outgoingNumber+' on '+ new Date(Date.parse(schedulingID)));
		});



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

#### Example:  retrieve all sms messages
	voiceClient.get('sms',-1,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		console.log(msgs.length + ' SMSs found.');
	});

#### Example:  retrieve the 10 most recent items from the inbox
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

#### Example:  find all messages related to 'mom' (texts/calls from 'mom' or that mention 'mom')
	voiceClient.get({query: 'mom'},-1,function(err,msgs){
		if(err){ console.log('error on request: '+err); return; }
		console.log(msgs.length + ' messages found.');
	});



## Manipulating GV Data
All data manipulation requests are of the following form: 
	
	voiceClient.set(param,messageID,callback) 

where:

* `param` (String) on of the following Strings:

		'markRead'
		'markUnread'
		'archive'
		'unarchive'
		'star'
		'unstar'
		'deleteForever'
		'toggleTrash' - calling this on a message will move it to the inbox if it is in the trash OR will move it to the trash if it is somewhere else

* `messageID` (String or Array) is the String/Array of unique message id(s). This ID can be had from the message objects returned by voiceClient.get() (discussed earlier)
* `callback` (Function) is of the form function(body, response) where body and response are described above in the Intro

#### Example:  star a message
	voiceClient.set('star',messageID,function(body,reponse){
		console.log(body);
	})

#### Example:  archive a bunch of messages
	voiceClient.set('archive',[messageID1,messageID2,messageID3],function(body,reponse){
		console.log(body);
	})


## Unread counts
Every time a get or set request is made, the voice client object's `unreadCounts` object is updated with the most current information from Google Voice. At the time of this writing, an example unreadCounts object looked like this:
	
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




Enjoy!
