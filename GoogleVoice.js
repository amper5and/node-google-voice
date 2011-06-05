var clientLogin = require('googleclientlogin'),
	https = require('https'),
	jsdom = require('jsdom'),
	xml2js = require('xml2js');

clientLogin.GoogleClientLogin.prototype.loginWithCB=function(callback){
	var clogin=this;
	var fullCallback=function(){
		callback();
		clogin.removeListener('login',fullCallback)
	};
	clogin.on('login',fullCallback);
	clogin.login();
}

function noop(){};

function isArray(variable){
	return variable.constructor.name == 'Array' ? true : false;
};

function isString(variable){
	return variable.constructor.name == 'String' ? true : false;
};

function isDate(variable){
	return variable.constructor.name == 'Date' ? true : false;
};

function isObject(variable){
	return variable.constructor.name == 'Object' ? true : false;
}

function convertRFC3339(dString){
	var idx = dString.lastIndexOf('-');
	var fixedDateString = dString.substr(0,idx)+'-'+ (dString.substr(idx+1)[0] == '0' ? dString.substr(idx+2) : dString.substr(idx+1) );
	return new Date(Date.parse(fixedDateString));
};

exports.Client=function(options){
	this.auth_voice=new clientLogin.GoogleClientLogin({email:options.email,password:options.password,service:'voice'});
	this.auth_calendar=new clientLogin.GoogleClientLogin({email:options.email,password:options.password,service:'calendar'});
	this.NUMBER=options.number || null;
	this.RNR_SE=options.rnr_se || null;
	this.schedule = {};
};

exports.Client.prototype.request = function(method,auth,path,post_data,callback){
	var gv=this;
	var host = 'www.google.com';
	
	if(isObject(path)){
		host = path.host,
		path = path.path
	}
	var options={
		host: host,
		path: path,
		method: method,
		headers: { 'Authorization': 'GoogleLogin auth=' + auth.getAuthId() }
	};
	var thisRequest={
		method:method,
		auth: auth,
		path:path,
		post_data:post_data,
		callback:callback
	};
	if(method=='POST'){
		post_data+='&_rnr_se='+gv.RNR_SE;
		options.headers['Content-Length']=post_data.length;
		options.headers['Content-Type']='application/x-www-form-urlencoded';
	}
	var req = https.request(options,function(response){
		if(response.statusCode==401){
			auth.loginWithCB(function(){
				gv.request(thisRequest.method,thisRequest.auth,thisRequest.path,thisRequest.post_data,thisRequest.callback);
			});
		}else if(response.statusCode==302){
			var newPath=response.headers.location.replace('https://www.google.com','');
			gv.request(thisRequest.method,thisRequest.auth,newPath,thisRequest.post_data,thisRequest.callback);
		}else{
			response.chunks=[];
			response.on("data", function(chunk) {
					response.chunks.push(chunk);
			});
			response.on("end", function() {
				var body = response.chunks.join('');
				callback(body,response);
			});
		}
	});
	req.write(post_data);
	req.end();
};

exports.Client.prototype.sendSMS=function(numbers,text,callback){
	var number = '';
	var callback = callback || noop;
	if(isArray(numbers)){
		for(var i=0;i<numbers.length;i++){
			number+=numbers[i]+', ' ;
		}	
	}else if(isString(number)){
		number = numbers;
	}else{
		return;
	}
	var post_data='phoneNumber='+number+'&id='+'&text='+text;
	this.request('POST',this.auth_voice,'/voice/sms/send/',post_data,function(body, response){
		try{body = JSON.parse(body)}catch(e){}
		callback(body, response);
	});
};

exports.Client.prototype.placeCall=function(outgoingNum,forwardingNum,phoneType,callback){
	var callback = callback || noop;
	var post_data='outgoingNumber='+outgoingNum+'&forwardingNumber='+forwardingNum+'&subscriberNumber=undefined&remember=0&phoneType='+phoneType;
	this.request('POST',this.auth_voice,'/voice/call/connect/',post_data,function(body, response){
		try{body = JSON.parse(body)}catch(e){}
		callback(body, response);
	});
};

exports.Client.prototype.unscheduler=function(date){
	var gv = this;
	var eventTime = isArray(date) ? new Date(date[0], date[1]-1, date[2], date[3], date[4]).toISOString() : ( isDate(date) ? date.toISOString() : (isString(date) ? date : null) );
	var evt = gv.schedule[eventTime] || null;
	
	if(evt){
		clearTimeout(evt.timer);
		delete gv.schedule[eventTime];
		return true;
	}else{
		return false;
	}
};

exports.Client.prototype.unscheduleAll=function(callback){
	var gv = this;
	for (evt in gv.schedule){
		gv.unscheduler(evt);
	}
	if(callback){	callback(); }
};


exports.Client.prototype.scheduler=function(type,date){
	var gv = this;
	var currentTime = new Date(),
		eventTime = isArray(date) ? new Date(date[0], date[1]-1, date[2], date[3], date[4]) : ( isDate(date) ? date : currentTime ),
		eventTimeString = eventTime.toISOString(),
		delay = eventTime-currentTime;
	
	if((type!='call' && type!='sms') || eventTime<currentTime){return;}
	if(gv.schedule[eventTimeString]){
		gv.unscheduler(date)
	}
	var eventCallback = type=='call' ? (arguments[5] || null) : (arguments[4] || null);
	var scheduleCallback = type=='call' ? (arguments[6] || null) : (arguments[5] || null);
	var newCallback= function(body, response){
		delete gv.schedule[eventTimeString];
		if(eventCallback){eventCallback(body, response);}
	}
	
	switch(type){
		case 'call':
			var outgoingNum = arguments[2],
				forwardingNum = arguments[3],
				phoneType = arguments[4],
				timerID = setTimeout(function(){
					gv.placeCall(outgoingNum,forwardingNum,phoneType,newCallback);
				},delay);
			gv.schedule[eventTimeString]={
				type:'call',
				outgoingNumber: outgoingNum,
				forwardingNumber: forwardingNum,
				phoneType: phoneType,
				timer:timerID
			};
			break;
		case 'sms':
			var outgoingNum = arguments[2],
				text = arguments[3],
				timerID = setTimeout(function(){
					gv.sendSMS(number,text,newCallback);
				},delay);
			gv.schedule[eventTimeString]={
				type:'sms',
				outgoingNumber: outgoingNum,
				text:text,
				timer:timerID
			};
			break;
		default:
			break;
	};
	if(scheduleCallback){	scheduleCallback(eventTimeString, gv.schedule[eventTimeString]);	}
};

exports.Client.prototype.scheduleCallsFromCalendar=function(calendarLabel,forwardingNum,phoneType,eventCallback,scheduleCallback){
	var gv = this;
	gv.request('GET',gv.auth_calendar,'/calendar/feeds/default/private/full?q='+calendarLabel+'&alt=jsonc','',function(body){
		var items=JSON.parse(body).data.items;
		if(!items){ return; }
		
		var regx = new RegExp(calendarLabel+'=\\d{1,}');
		for(var i=0;i<items.length;i++){
			var number = items[i].title.match(regx) || items[i].details.match(regx);
			number = number ? number[0].replace(calendarLabel+'=','') : null;
			if(number){
				gv.scheduler('call',convertRFC3339(items[i].when[0].start),number,forwardingNum,phoneType,eventCallback,scheduleCallback);
			}
		}
	});	
};

exports.Client.prototype.getURLs= {
	history: 	'/voice/inbox/recent/all/',
	inbox: 		'/voice/inbox/recent/inbox/',
	spam: 		'/voice/inbox/recent/spam/',
	trash: 		'/voice/inbox/recent/trash/',
	starred: 	'/voice/inbox/recent/starred/',
	sms: 		'/voice/inbox/recent/sms/',
	voicemail: 	'/voice/inbox/recent/voicemail/',
	placed: 	'/voice/inbox/recent/placed/',
	missed: 	'/voice/inbox/recent/missed/',
	received: 	'/voice/inbox/recent/received/',
	recorded: 	'/voice/inbox/recent/recorded/',
	search: 	'/voice/inbox/search/'
};

exports.Client.prototype.get=function(type, limit, callback){
	var gv = this;
	var callback = callback || noop;
	limit = limit || -1;
	
	if(isObject(type)){
		var searchQuery = type.query;
		type = 'search';
	}
	if(!gv.getURLs[type] ){ callback('improper GET type'); return;}
	if(limit<-1){ callback('limit cannot be < -1'); return;}
	
	var path = type=='search' ? (gv.getURLs[type]+'?q='+searchQuery) : gv.getURLs[type];
	var response  = {
		messages:[],
		pageCount:1,
		totalSize:-1
	};
	var page;
	var parser = new xml2js.Parser();
	
	function call_cb(err){	callback(err,response.messages);	}
	
	function enough(){
		if(response.messages.length == response.totalSize || (limit!=-1 && response.messages.length >= limit) ){
			return true;
		}else{
			return false;
		}
	}
	
	function parse(result){
		try{
			var json = JSON.parse(result.json);
			response.totalSize = json.totalSize;
			response.resultsPerPage = json.resultsPerPage;
			gv.unreadCounts = json.unreadCounts;
		}catch(err){ call_cb(err); return; }
		if(enough()){ call_cb(null); return; }
		
		var document=jsdom.jsdom(result.html);
		for(var msgID in json.messages){
			var currentMessage=json.messages[msgID];
			if(!!~json.messages[msgID].labels.indexOf('sms')){
				var thread=document.getElementById(msgID).getElementsByClassName('gc-message-sms-row');
				currentMessage.lastText=thread[thread.length-1].getElementsByClassName('gc-message-sms-text')[0].innerHTML;
				currentMessage.thread = thread;
			}
			response.messages.push(currentMessage);
			if(enough()){ call_cb(null); return; }
		}
		
		if(enough()){ 
			call_cb(null); 
			return;
		}else{
			response.pageCount++;
			page = type=='search' ? ('&page=p'+response.pageCount) : ('?page=p'+response.pageCount);
			gv.request('GET',gv.auth_voice,path+page,'',function(body){
				parser.parseString(body);	
			});
		}
	}
	
	parser.addListener('end', parse);
	gv.request('GET',gv.auth_voice,path,'',function(body){
		parser.parseString(body);
	});
};

exports.Client.prototype.setURLs={
	markRead: 		{url: '/voice/inbox/mark/', 					post: 'read=1'},
	markUnread: 	{url: '/voice/inbox/mark/', 					post: 'read=0'},
	toggleTrash: 	{url: '/voice/inbox/deleteMessages/',			post: 'trash=1'},
	deleteForever: 	{url: '/voice/inbox/deleteForeverMessages/',	post: 'trash=1'},
	archive: 		{url: '/voice/inbox/archiveMessages/', 			post: 'archive=1'},
	unarchive: 		{url: '/voice/inbox/archiveMessages/', 			post: 'archive=0'},
	star: 			{url: '/voice/inbox/star/', 					post: 'star=1'},
	unstar: 		{url: '/voice/inbox/star/',						post: 'star=0'},
};

exports.Client.prototype.set=function(type, msgIDs,callback){
	var gv = this;
	var callback = callback || noop;
	if(!gv.setURLs[type] ){ callback('improper GET type'); return;}
	
	var setURL = gv.setURLs[type],
		post_data = '';
		
	if(isString(msgIDs)){
		post_data+='messages='+msgIDs;
	}else if(isArray(msgIDs)){
		for(var i=0; i<msgIDs.length; i++){
			post_data+='messages='+msgIDs[i]+'&'
		}
	}else{
		return;
	}

	post_data += setURL.post;
	this.request('POST',this.auth_voice,setURL.url,post_data,function(body, response){
		callback(JSON.parse(body));
	});
};

//TODO: implement these functions:
exports.Client.prototype.settingsURLs = {
	billing: 		{url: '/voice/settings/tab/billing/',		json: false},
	billingCredit: 	{url: '/voice/settings/billingCredit/', 	json: false},
	phones: 		{url: '/voice/settings/tab/phones/', 		json: true},
	getDND: 		{url: '/voice/settings/getDoNotDisturb/', 	json: true}
};


exports.Client.prototype.parseSMS=function(param,currentMsg){
	switch(param){
		case 'time':
			return currentMsg.getElementsByClassName('gc-message-sms-time')[0].innerHTML;
			break;
		case 'from':
			return currentMsg.getElementsByClassName('gc-message-sms-from')[0].innerHTML;
			break;
		case 'text':
			return currentMsg.getElementsByClassName('gc-message-sms-text')[0].innerHTML;
			break;
		default:
			return '';
			break;
	}
};