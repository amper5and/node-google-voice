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

## Allow [YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, MILLISECOND] in the scheduler
Right now, the short-hand date Array uses `[YEAR, MONTH, DAY, HOUR, MINUTE]` in `GVClient.scheduler` and `GVClient.unschedule`. I think it would be good to allow drilling all the way down to the millisecond to be consistent with the level of control that the native `Date` object provides. 

Each of those entries in the date Array should be optional and default to `null` if not set. So if someone just specifies `[YEAR]` it would schedule the event for Jan 01 12:00AM of that year, and if someone gives `[YEAR,MONTH,DAY]` it would schedule the event for YEAR/MONTH/DAY 12:00AM