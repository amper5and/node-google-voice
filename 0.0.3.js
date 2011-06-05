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

function isFunction(variable){
	return variable.name == 'Function' ? true : false ;
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
	var gv = this;
	var host = 'www.google.com';
	var POST = '',
		GET = '';
		
	var thisRequest={
		method:method,
		auth: auth,
		path:path,
		post_data: post_data,
		callback:callback
	};
		
	if(isObject(path)){
		host = path.host;
		path = path.path || '';
	}
	
	if(post_data){
		for(obj in post_data){
			POST += obj + '=' +post_data[obj] + '&';
		}
		POST = POST.substr(0,POST.length-1);
	}
	if(method == 'POST'){
		POST += '&_rnr_se='+gv.RNR_SE;
	}else if(method == 'GET' && POST.length){
		path = path + '?' + POST;
		POST = '';
	}
	
	var options={
		host: host,
		path: path,
		method: method,
		headers: { 'Authorization': 'GoogleLogin auth=' + auth.getAuthId() }
	};
	if(method == 'POST'){
		options.headers['Content-Length']=POST.length;
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
	if(method == 'POST'){
		req.write(POST);
	}
	req.end();
};


var ERROR_CODES={
	0: 'No errors',
	1: 'Connection method not specified',
	2: 'Invalid connection method',
	3: 'Outgoing number not specified',
	4: 'Invalid outgoing number',
	5: 'Forwarding number not specified',
	6: 'Forwarding number phone type not specified',
	9: 'Event time preceeds current time',
	10: 'Overwrote another scheduled event',
	11: 'Cannot overwrite another scheduled event',
	15: 'Invalid get request',
	16: 'Limit below -1',
	20: 'Parse error',
	600: 'HTTP error'
}

exports.Client.prototype.STATUS_CODES = {
	NO_ERRORS: 0,
	NO_CONNECTION_METHOD: 1,
	INVALID_CONNECTION_METHOD: 2,
	NO_OUTGOINGNUM: 3,
	INVALID_OUTGOINGNUM: 4,
	NO_FORWARDINGNUM: 5,
	NO_PHONETYPE: 6,
	INVALID_EVENTTIME: 9,
	OVERWROTE_EVENT: 10,
	CANNOT_OVERWRITE_EVENT: 11,
	INVALID_GET: 15,
	INVALID_LIMIT: 16,
	PARSE_ERROR: 20,
	HTTP_ERROR: 600
};

var CONNECT_METHODS=['sms','call','cancel'];

function validateConnection( method,options,callback){
	if(!method){ callback(1); return 1;}
	if(!~CONNECT_METHODS.indexOf(method))	{ callback(2); return 2;}
	var outgoingNumber = method!='cancel' ? (options.outgoingNumber || null) : 'undefined';
	if(!outgoingNumber){ callback(3); return 3};
	if(method == 'call'){
		if(!options.forwardingNumber){ callback(5); return 5; }
		if(!options.phoneType){ callback(6); return 6; }
	}
	return 0;
	
}
exports.Client.prototype.connect=function(method,options,callback){
	var gv = this;
	callback = callback || ( isFunction(options) ? options : noop);
	
	var check = validateConnection(method,options,callback);
	var status = check == 0 ? (options.status || 0) : check;
	
	if(options.date){
		var date = options.date,
			overwrite = options.overwrite == false ? false : true ,
			currentTime = new Date(),
			eventTime = (isArray(date) && date[0])? new Date(date[0], date[1]-1 || null, date[2] || null, date[3] || null, date[4] || null, date[5] || null, date[6] || null) : ( isDate(date) ? date : currentTime ),
			eventTimeString = eventTime.toISOString(),
			delay = eventTime-currentTime;
		if(eventTime < currentTime){ callback(9); return 9;}
		
		if(gv.schedule[eventTimeString]){
			if(overwrite){
				gv.unscheduler(eventTimeString);
				var status = 10;
			}else{
				callback(11); return 11;
			}	
		}
		
		var newCallback= function(stat, body, response){
			gv.unscheduler(eventTimeString);
			try{body = JSON.parse(body); }catch(e){}
			callback(stat, body, response);
		};
		delete options.date;
		options.status = status;
		options.method = method;
		options.timer = setTimeout(function(){
				gv.connect(method,options,newCallback);
		},delay);
		gv.schedule[eventTimeString] = options;
		return status; // successfully scheduled an event: 0: no errors, 10: overwrote another scheduled event
	}
	
	switch(method){
		case 'sms':
			if(isArray(options.outgoingNumber)){  options.outgoingNumber = outgoingNumber.join(',');}
			var post_data = {
				phoneNumber: options.outgoingNumber,
				id: '',
				text: options.text || ' '
			};
			gv.request('POST',gv.auth_voice,'/voice/sms/send/',post_data,function(body, response){
				try{body = JSON.parse(body)}catch(e){}
				status = response.statusCode != 200 ? 600 : status;
				callback(status, body, response);
			});
			
			break;
		case 'call':
			if(isArray(options.outgoingNumber)){  options.outgoingNumber = options.outgoingNumber[0];}
			var post_data = {
				outgoingNumber: options.outgoingNumber,
				forwardingNumber: options.forwardingNumber,
				phoneType: options.phoneType,
				remember: '0',
				subscriberNumber: 'undefined'
			};

			gv.request('POST',gv.auth_voice,'/voice/call/connect/',post_data,function(body, response){
				try{body = JSON.parse(body)}catch(e){}
				status = response.statusCode != 200 ? 600 : status;
				callback(status, body, response);
			});
			break;
		case 'cancel':
			gv.request('POST',gv.auth_voice,'/voice/call/cancel/',{outgoingNumber:'undefined',forwardingNumber:'undefined',cancelType:'C2C'},function(body,response){
				try{body = JSON.parse(body); }catch(e){}
				status = response.statusCode != 200 ? 600 : status;
				callback(status, body, response);
			})
			break;
	}
};


exports.Client.prototype.unschedule=function(date){
	var gv = this;
	if(isString(date) && date.trim() == 'all'){
		for (evt in gv.schedule){
			gv.unscheduler(evt);
		}
		return true;
	}else{
		var eventTime = (isArray(date) && date[0] ) ? new Date(date[0], date[1]-1 || null, date[2] || null, date[3] || null, date[4] || null, date[5] || null, date[6] || null).toISOString() : ( isDate(date) ? date.toISOString() : (isString(date) ? date : null) );
		if(gv.schedule[eventTime]){
			clearTimeout(gv.schedule[eventTime].timer);
			delete gv.schedule[eventTime];
			return true;
		}else{
			return false;
		}
	}
};

//TODO: fix this to work with the new scheduling method
exports.Client.prototype.scheduleCallsFromCalendar=function(calendarLabel,forwardingNum,phoneType,eventCallback,scheduleCallback, completedScheduling){
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
	history: 	{url: '/voice/inbox/recent/all/',			json:false},
	inbox: 		{url: '/voice/inbox/recent/inbox/',			json:false},
	spam: 		{url: '/voice/inbox/recent/spam/'			json:false},
	trash: 		{url: '/voice/inbox/recent/trash/',			json:false},
	starred: 	{url: '/voice/inbox/recent/starred/',		json:false},
	sms: 		{url: '/voice/inbox/recent/sms/', 			json:false},
	voicemail: 	{url: '/voice/inbox/recent/voicemail/', 	json:false},
	placed: 	{url: '/voice/inbox/recent/placed/',		json:false},
	missed: 	{url: '/voice/inbox/recent/missed/',		json:false},
	received: 	{url: '/voice/inbox/recent/received/',		json:false},
	recorded: 	{url: '/voice/inbox/recent/recorded/',		json:false},
	search: 	{url: '/voice/inbox/search/',				json:false}
};

//TODO: implement these functions:
exports.Client.prototype.settingsURLs = {
	billing: 		{url: '/voice/settings/tab/billing/',		json: false},
	billingCredit: 	{url: '/voice/settings/billingCredit/', 	json: false},
	phones: 		{url: '/voice/settings/tab/phones/', 		json: true},
	getDND: 		{url: '/voice/settings/getDoNotDisturb/', 	json: true}
};

exports.Client.prototype.get=function(options, callback){
	var gv = this;
	var callback = callback || noop,
		post_data = {};
	var limit = (options.limit || options.limit == 0) ? options.limit : -1;
	
	if(options.query){
		post_data.q = options.query;
		var type = 'search';
	}else if(isObject(options)){
		var type = options.type;
	}else if(options == 'counts'){
		var type = 'inbox';
		limit = 0;
	}else{
		var type = options;
	}
	
	if(!gv.getURLs[type] ){ callback(15); return 15;}
	var path = gv.getURLs[type].url;
	if(limit<-1){ callback(16); return 16;}
	
	var response  = {
		messages:[],
		pageCount:1,
		totalSize:-1
	};
	var parser = new xml2js.Parser();
	
	function call_cb(status){	callback(status,response.messages);	}
	
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
		}catch(err){ call_cb(20); return; }
		if(enough()){ call_cb(0); return; }
		
		var document=jsdom.jsdom(result.html);
		for(var msgID in json.messages){
			var currentMessage=json.messages[msgID];
			if(!!~json.messages[msgID].labels.indexOf('sms')){
				var thread=document.getElementById(msgID).getElementsByClassName('gc-message-sms-row');
				currentMessage.lastText=thread[thread.length-1].getElementsByClassName('gc-message-sms-text')[0].innerHTML;
				currentMessage.thread = thread;
			}
			response.messages.push(currentMessage);
			if(enough()){ call_cb(0); return; }
		}
		
		if(enough()){ 
			call_cb(0); 
			return;
		}else{
			response.pageCount++;
			post_data.page = 'p'+response.pageCount;
			gv.request('GET',gv.auth_voice,path,post_data,function(body){
				parser.parseString(body);	
			});
		}
	}
	
	parser.addListener('end', parse);
	gv.request('GET',gv.auth_voice,path,post_data,function(body){
		parser.parseString(body);
	});
};

exports.Client.prototype.setURLs={
	markRead: 		{url: '/voice/inbox/mark/', 					post: {read:'1'}},
	markUnread: 	{url: '/voice/inbox/mark/', 					post: {read:'0'}},
	toggleTrash: 	{url: '/voice/inbox/deleteMessages/',			post: {trash:'1'}},
	deleteForever: 	{url: '/voice/inbox/deleteForeverMessages/',	post: {trash:'1'}},
	archive: 		{url: '/voice/inbox/archiveMessages/', 			post: {archive:'1'}},
	unarchive: 		{url: '/voice/inbox/archiveMessages/', 			post: {archive:'0'}},
	star: 			{url: '/voice/inbox/star/', 					post: {star:'1'}},
	unstar: 		{url: '/voice/inbox/star/',						post: {star:'0'}},
	block: 			{url: '/voice/inbox/block/', 					post: {blocked:'0'}},
	unblock: 		{url: '/voice/inbox/block/', 					post: {blocked:'1'}},
	savenote: 		{url: '/voice/inbox/savenote/'},
	forward: 		{url: '/voice/inbox/reply/'}
};

exports.Client.prototype.set=function(options, msgIDs,callback){
	var gv = this;
	var callback = callback || noop;
	
	if(isObject(options)){
		if(options.note){
			var post_data = {
				id: isArray(msgIDs) ? msgIDs[0] : msgIDs,
				note: options.note || ' '
			};
			var options = 'savenote';
		}else if(options.forward){
			var post_data = {
				id: isArray(msgIDs) ? msgIDs[0] : msgIDs,
				toAddress: isArray(options.forward) ? options.forward.join(',') : options.forward,
				subject: options.subject || '',
				body: options.body || '',
				includeLink: options.link ? '1' : '0'
			}
			var options = 'forward';
		}else{
			return;
		}
	}else{
		var post_data = {
			messages: isArray(msgIDs) ? msgIDs.join('&messages=') : msgIDs
		}		
	}
	
	if(!gv.setURLs[options] ){ callback(15); return;}
	for(variable in gv.setURLs[options].post){
		post_data[variable] = gv.setURLs[options].post[variable];
	}
	var path = gv.setURLs[options].url;
	gv.request('POST',gv.auth_voice,path,post_data,function(body, response){
		var status = response.statusCode != 200 ? 600 : 0;
		callback(status,JSON.parse(body),response);
	});
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

ErrorCodes={
	1: 'improper connection method',
	2: ''
}