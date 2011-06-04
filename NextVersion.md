# Some thoughts on the next version of node-google-voice
Here, I'm including some ideas and thoughts about what I want to change/add/improve in the next update:

## A common call/text method
I think it would be useful to rework the way calls/sms are initiated to use a common function and specify the details in some kind of options object.

I think I will do away with `GVClient.placeCall` and `GVClient.sendSMS` and instead have a common method, such as `GVClient.connect(options,callback)`. This will allow a more modular approach to programming with node-google-voice, and will also make it more extendable/pluggable.

`options` could have the following attributes:

* `method` (String, required): `'call'` or `'sms`
* `outgoingNumber` (String/Array, required): A String for `method='call'`, a String or Array for `method='sms'` 
* `text` (String): for `method='sms'`. Defaults to `''`.
* `forwardingNumber` (String): required for `method='call'`. 
* `phoneType` (Integer): required for `method='call'`
* `remember` (True/False): for `method='call'` - specifies whether this call should be registered in the call history of Google Voice (texts are stored no matter what). Defaults to `false`.

This would also mean a change for the way scheduling works: It could be `GVClient.scheduler(options,eventCallback,scheduleCallback)` instead of the current `GVClient.scheduler(type, date, ..., eventCallback, scheduleCallback)`.  `options` would be the same type of object that is used in `GVClient.connect`

Perhaps it should even be `GVClient.scheduler(options)`, where the callbacks are all given in the options object.
## Allow [YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, MILLISECOND] in the scheduler
Right now, the short-hand date Array uses `[YEAR, MONTH, DAY, HOUR, MINUTE]` in `GVClient.scheduler` and `GVClient.unschedule`. I think it would be good to allow drilling all the way down to the millisecond to be consistent with the level of control that the native `Date` object provides. 

Each of those entries in the date Array should be optional and default to `null` if not set. So if someone just specifies `[YEAR]` it would schedule the event for Jan 01 12:00AM of that year, and if someone gives `[YEAR,MONTH,DAY]` it would schedule the event for YEAR/MONTH/DAY 12:00AM

## Proper error handling
Each callback should follow the Node convention of having `error` as the first parameter. Right now, callbacks are not consistent in node-google-voice. I think it would be useful to provide an error code in `error` that can then be matched in an `ERROR_CODES` array to see what went wrong. For example:

```javascript
var ERROR_CODES={
	1: 'Connection method not specified',
	2: 'Invalid connection method',
	3: 'Outgoing number not specified',
	4: 'Invalid outgoing number',
	5: 'Forwarding number not specified',
	6: 'Forwarding number phone type not specified'
}
```

I don't really know much about how this type of stuff is usually done, so I'm open to any input on what would be the best/standard way to do this.

## GVClient.parseSMS(param,msgDOMelement) --> msgDOMelement.getValue(param)
The current `GVClient.parseSMS(param,msgDOMelement)` is awkward. I think it would be better to give the SMS DOM element a `getValue()` method that can be called to get the `time`, `from`, or `text` of the SMS:

So, the example of displaying the SMS thread, which is currently:

```javascript

voiceClient.get('sms',1,function(err,msgs){
        if(err){ console.log('error on request: '+err); return; }
        console.log('latest SMS thread:');
        for(var i=0;i<msgs[0].thread.length;i++){
            var currentMsg = msgs[0].thread[i];
            console.log(voiceClient.parseSMS('time',currentMsg)+' '+voiceClient.parseSMS('from',currentMsg)+voiceClient.parseSMS('text',currentMsg) );
        }
    });
```

would be

```javascript
voiceClient.get('sms',1,function(err,msgs){
        if(err){ console.log('error on request: '+err); return; }
        console.log('latest SMS thread:');
        for(var i=0;i<msgs[0].thread.length;i++){
            var currentMsg = msgs[0].thread[i];
            console.log(currentMsg.getValue('time') +' '+ currentMsg.getValue('from') + currentMsg.getValue('text');
        }
    });
```