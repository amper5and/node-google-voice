var clientLogin = require('googleclientlogin'),
	jsdom = require('jsdom'),
	xml2js = require('xml2js'),
	request = require('request'),
	https = require('https'),
	querystring = require('querystring'),
	fs = require('fs');
	
	
clientLogin.GoogleClientLogin.prototype.loginWithCB = function(callback){
	var clogin=this;
	var fullCallback=function(err){
		callback(err);
		clogin.removeListener('login',fullCallback);
		clogin.removeListener('error',fullCallback)
	};
	clogin.on('login', fullCallback);
	clogin.on('error', fullCallback);
	clogin.login();
};

var STATUSES = {
	NO_ERROR: 0,
	AUTHENTICATION_ERROR: 1,
	GET_RNRSE_ERROR: 2,
	INIT_ERROR: 3,
	MISSING_REQUIRED_PARAMETER: 4,
	INVALID_METHOD: 5,
	GOOGLE_CLIENTLOGIN_ERROR: 10,
	REQUEST_ERROR: 11,
	XML2JS_ERROR: 12,
	JSDOM_ERROR: 13,
	OUT_OF_BOUND_LIMIT: 31,
	PARSE_ERROR: 39,
	CANNOT_SET_MULTIPLE_MSGS: 41,
	INVALID_MESSAGE_ID: 50,
	FILE_ERROR: 51,
	HTTP_ERROR: 200
};

var statusMap = {};
Object.keys(STATUSES).forEach(function (key) {
  var val = STATUSES[key];
  statusMap[val] = key;
});

function GoogleVoiceError(code) {
  this.name = 'GvError';
  this.code = code;
  this.message = statusMap[code];
  this.stack = (new Error()).stack;
};

GoogleVoiceError.prototype = new Error();
GoogleVoiceError.prototype.name = 'GoogleVoiceError';

function getError(code) {
  if (!code) {
    return null;
  }
  return new GoogleVoiceError(code);
};

function noop(){};

function is(variable,type){
	if(!variable){
		return false;
	}
	return variable.constructor.name.toLowerCase() == type.toLowerCase() || typeof variable == type.toLowerCase();
};

function getRnrse(gv, callback){ //callback(error, rnrse, httpResponse, body)
	gvrequest(gv, null, function(error, httpResponse, body){
		if(error){
			callback(getError(STATUSES.GET_RNRSE_ERROR), null, httpResponse, body);
		}else{
			try{
				var doc = jsdom.jsdom(body);
				var rnrse = doc.getElementsByName('_rnr_se')[0].value;
			}catch(e){
				var rnrse = null;
			}
			callback(rnrse ? getError(STATUSES.NO_ERROR) : getError(STATUSES.GET_RNRSE_ERROR), rnrse, httpResponse, body);
		}
	});
};

var maxAuthAttempts = 2;
var default_ = {
	maxAuthAttempts: maxAuthAttempts,
	authAttempts: 0
};

function get_(gv){
	gv._ = gv._ || default_;
	gv._.maxAuthAttempts = gv._.maxAuthAttempts || default_.maxAuthAttempts;
	gv._.authAttempts = gv._.authAttempts || default_.authAttempts;
};

function gvrequest(gv,options,callback){
	options = options || {};
	var query = options.query || {};
	var method = options.method || 'GET';
	var uri = options.uri || ( (options.host || 'https://www.google.com/voice') + (options.path || '') ); 
	var headers = options.headers || {} ;
	headers.Authorization = 'GoogleLogin auth=' + gv.auth.getAuthId() ;
	
	if(method === 'POST'){
		if(!gv.config.rnr_se){
			getRnrse(gv, function(error, rnrse, httpResponse, body, err){
				if(error){
					callback(getError(STATUSES.GET_RNRSE_ERROR), httpResponse, body);
				}else{
					gv.config = gv.config || {};
					gv.config.rnr_se = rnrse;
					gvrequest(gv, options, callback);
				}
			});
			return;
		}
		
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
		query['_rnr_se'] = gv.config.rnr_se;
	}
	
	query = querystring.stringify(query) || '';
	
	if(method === 'GET' && query){
		uri = uri + '?' + query;
		query = '';
	}
	
	var requestOptions = {
		uri: uri,
		method: method,
		headers: headers,
		body: query,
	};
	
	if(options.hasOwnProperty('encoding')){
		requestOptions.encoding = options.encoding;
	}
	
	get_(gv);
	
	request(requestOptions,function(error,response,body){
		if(error){
			callback(getError(STATUSES.REQUEST_ERROR), response, body, error);
		}else if(response.statusCode === 401){
			if(gv._.authAttempts < gv._.maxAuthAttempts){
				gv.auth.loginWithCB(function(err){
					if(err){
						callback(getError(STATUSES.GOOGLE_CLIENTLOGIN_ERROR), response, body, err);
					}else{
						gvrequest(gv,options,callback);
					}
				});
				gv._.authAttempts++;
			}else{
				callback(getError(STATUSES.AUTHENTICATION_ERROR), response,body);
			}
		}else if(response.statusCode != 200){
			callback(getError(STATUSES.HTTP_ERROR), response, body);
		}else{
			callback(getError(STATUSES.NO_ERROR), response, body);
		}
	});
};

function validateRequest(methods, method, options){
	if(!is(method,'string') || !methods[method]){ return getError(STATUSES.INVALID_METHOD); }
	
	var method = methods[method];
	for(var opt in method.options){
		if(!options.hasOwnProperty(opt)){
			if(method.options[opt].demand){
				return getError(STATUSES.MISSING_REQUIRED_PARAMETER) ;
			}else if(method.options[opt].default){
				options[opt] = method.options[opt].default;
			}
		}
	}
	return getError(STATUSES.NO_ERROR);
};

exports.Client=function(options,callback){
	callback = callback || noop;
	this.auth = new clientLogin.GoogleClientLogin({email:options.email,password:options.password,service:'voice'});
	this.config = {
		email: options.email,
		password: options.password,
	};
	if(options.rnr_se){
		this.config.rnr_se = options.rnr_se;
	};
	this._ = {
		maxAuthAttempts: 2,
		authAttempts: 0
	};
};

// CONNECT METHODS =============================================================
var methods = {};
methods.sms = {
	options:{
		outgoingNumber: { demand:true },
		text: { demand: false}
	},
	handler: function(options){
		if(is(options.outgoingNumber,'array')){  options.outgoingNumber = options.outgoingNumber.join(',');}
		
		return {
			method: 'POST',
			path: '/sms/send/',
			query: {
				phoneNumber: options.outgoingNumber,
				id: '',
				text: options.text || ''
			}
		};
	}
};

methods.call = {
	options: {
		outgoingNumber: { demand: true },
		forwardingNumber: { demand: true },
		phoneType: { demand: true }
	},
	handler: function(options){
		if(is(options.outgoingNumber,'array')){  options.outgoingNumber = options.outgoingNumber[0];}
		return {
			method: 'POST',
			path: '/call/connect/',
			query: {
				outgoingNumber: options.outgoingNumber,
				forwardingNumber: options.forwardingNumber,
				phoneType: options.phoneType,
				remember: '0',
				subscriberNumber: 'undefined'
			}
		};
		
	}
};

methods.cancel = {
	handler: function(options){
		return {
			method: 'POST',
			path: '/call/cancel/',
			query: {
				outgoingNumber: 'undefined',
				forwardingNumber: 'undefined',
				cancelType: 'C2C'
			}
		};
	}
};


exports.Client.prototype.connect=function(method,options,callback){
	var gv = this;	
	callback = callback || ( options && is(options,'function') ? options : noop);
	
	var status = validateRequest(methods, method, options);
	if(status){ callback(status,null,null); return; }
	
	var requestOptions = methods[method].handler.call(methods[method],options);
	gvrequest(gv,requestOptions,callback);
};

// GET METHODS =================================================================

var getMethods = {
	unread: {
		path: '/inbox/recent/unread/'
	},
	all: {
		path: '/inbox/recent/all/'
	},
	inbox: {
		path: '/inbox/recent/'
	},
	spam: {
		path: '/inbox/recent/spam/'
	},
	trash: {
		path: '/inbox/recent/trash/'
	},
	starred: {
		path: '/inbox/recent/starred/'
	},
	sms: {
		path: '/inbox/recent/sms/'
	},
	voicemail: {
		path: '/inbox/recent/voicemail/'
	},
	placed: {
		path: '/inbox/recent/placed/'
	},
	missed: {
		path: '/inbox/recent/missed/'
	},
	received: {
		path: '/inbox/recent/received/'
	},
	recorded: {
		path: '/inbox/recent/recorded/'
	},
	search: {
		path: '/inbox/search/',
		options: {query: {demand: true}},
		handler: function(options, callback){
			options.path = this.path;
			options.query = {q: options.query};
			return getError(STATUSES.NO_ERROR);
		}
	}
};

var defaultStart = 1;
exports.Client.prototype.get = function(type, options, callback){
	var gv = this;
	callback = callback || noop;
	options = options || {};
	
	var status = validateRequest(getMethods, type, options);
	if(status){ callback(status,null,null); return; }
	
	if(getMethods[type].handler){
		var error = getMethods[type].handler.call(getMethods[type],options,callback);
		if(error){ callback(error); return; }
	}else{
		options.path = getMethods[type].path;
	}
	
	options.start = options.start && options.start>0 ? options.start : defaultStart;
	options.limit = options.limit && options.limit>-1 ? options.limit : null;
	getMessages(gv, options, callback);
};

function getMessages(gv,options,callback){
	getXMLPage(gv,options,function(status, json, httpResponse, body, xml2jsResult, err){
		if(status){ callback(status, null, json, httpResponse, body, xml2jsResult, err); return; }
		
		gv.unreadCounts = json.unreadCounts;
		options.limit = options.limit || json.resultsPerPage;
		
		var totalPages = Math.ceil(json.totalSize/json.resultsPerPage);
		if(totalPages === 0){
			callback(status, {messages: [], total: 0}, json, httpResponse, body, xml2jsResult);
			return;
		}	
		var startPage = Math.ceil(options.start/json.resultsPerPage);
		var endPage = Math.ceil((options.start + options.limit)/json.resultsPerPage);
		if(endPage === Infinity){ endPage = totalPages; }
		var pagesToGet = endPage - startPage + 1;
		var pagesGot = 0;
		
		var firstIndex = (startPage-1)*json.resultsPerPage + 1;
		var startIndex = options.start - firstIndex;
		
		if(options.start > json.totalSize){
			callback(getError(STATUSES.OUT_OF_BOUND_LIMIT), null, json, httpResponse, body, xml2jsResult);
			return;
		}
		
		options.query = options.query || {};
		var messages = [];
		for(var i=startPage; i<=endPage; i++){
			options.query.page = 'p' + i;
			getXMLPage(gv, options, function(status2, json2, httpResponse2, body2, xml2jsResult2, err2){
				pagesGot++;
				if(status2){ callback(status2, null, json2, httpResponse2, body2, xml2jsResult2, err2); return; }
				
				messages = messages.concat(processMessages(json2.messages, xml2jsResult2.html));
				
				if(pagesGot===pagesToGet){
					messages.sort(sortMessages);
					messages = options.limit === Infinity ? messages.splice(startIndex) : messages.splice(startIndex,options.limit);
					callback(getError(STATUSES.NO_ERROR), {messages: messages, total: json2.totalSize});
				}
			});
		}
	});
};

function getXMLPage(gv,options,callback){
	var requestOptions = {
		path: options.path,
		query: options.query
	};
	
	gvrequest(gv,requestOptions,function(status,httpResponse,body, error){
		if(status){
			callback(status, null, httpResponse, body, error);
		}else{
			var parser = new xml2js.Parser();
			parser.parseString(body,function(err,xml){
				if(err){
					callback(getError(STATUSES.XML2JS_ERROR), null, httpResponse, body, xml, err)
				}else{
					var json = getJSONfromXML(xml);
					if(json){
						callback(getError(STATUSES.NO_ERROR), json, httpResponse, body, xml);
					}else{
						callback(getError(STATUSES.PARSE_ERROR), null, httpResponse, body, xml);
					}
				}
			});
		}
	});
};

function getJSONfromXML(XMLobject){
	try{
		var json = JSON.parse(XMLobject.json);
		return json;
	}catch(err){  
		return null; 
	}
};

function sortMessages(msg1, msg2){
	return msg2.startTime - msg1.startTime;
};

function processMessages(messages, html){
	var msgArray = [];
	var document = jsdom.jsdom(html);
	
	for(var msgId in messages){
		var msg = messages[msgId];
		if(isMessage(msg,'sms')){
			msg.thread = [];
			var thread = document.getElementById(msgId).getElementsByClassName('gc-message-sms-row');
			thread.forEach = Array.prototype.forEach;
			thread.forEach(function(text){
				msg.thread.push({
					time: getField('time', text),
					from: getField('from', text),
					text: getField('text', text)
				});
			});
		}
		if(isMessage(msg,'voicemail') || isMessage(msg,'recorded')){
			msg.url = voicemailMp3BaseUrl + msgId;
		}
		
		msgArray.push(msg);
	}
	return msgArray;
};

function isMessage(msg,type){
	return !!~msg.labels.indexOf(type);
};

var SMSfields = {
		time: 'gc-message-sms-time',
		from: 'gc-message-sms-from',
		text: 'gc-message-sms-text'
};

function getField(field,message){
	var msg = message || this;
	var f=msg.getElementsByClassName(SMSfields[field])[0].innerHTML || '' ;
	return f.trim();
};

// DOWNLOAD VOICEMAIL  =================================================================
var voicemailMp3BaseUrl = 'https://www.google.com/voice/media/send_voicemail/';

exports.Client.prototype.download = function(options, callback){
	var gv = this;
	callback = callback || noop;
	var id = options.id || options || null;
	
	if(!id){ callback(getError(STATUSES.MISSING_REQUIRED_PARAMETER)); return; }
	if(!is(id,'string')){  callback(getError(STATUSES.INVALID_MESSAGE_ID)); return; }
	
	var requestOptions = {
		uri: voicemailMp3BaseUrl + id,
		encoding: null
	};
	
	gvrequest(gv, requestOptions, function(error, httpResponse, body){
		if(error){
			callback(error, httpResponse, body);
		}else{
			if(options.hasOwnProperty('file')){
				fs.writeFile(new String(options.file), body, function(err){
					callback(err ? getError(STATUSES.FILE_ERROR) : getError(STATUSES.NO_ERROR), httpResponse, body, err);
				});
			}else{
				callback(getError(STATUSES.NO_ERROR), httpResponse, body)
			}
		}
	})
};

// SET METHODS =================================================================
var setMethods = {
	read:{
		path: '/inbox/mark/',
		post: {read:'1'}
	},
	unread: {
		path: '/inbox/mark/',
		post: {read:'0'}
	},
	toggleTrash: {
		path: '/inbox/deleteMessages/',
		post: {trash:'1'}
	},
	deleteForever: {
		path: '/inbox/deleteForeverMessages/',
		post: {trash:'1'}
	},
	archive: {
		path: '/inbox/archiveMessages/',
		post: {archive:'1'}
	},
	unarchive: {
		path: '/inbox/archiveMessages/',
		post: {archive:'0'}
	},
	star: {
		path: '/inbox/star/',
		post: {star:'1'}
	},
	unstar: {
		path: '/inbox/star/',
		post: {star:'0'}
	},
	block: {
		path: '/inbox/block/',
		post: {blocked:'1'}
	},
	unblock: {
		path: '/inbox/block/',
		post: {blocked:'0'}
	},
	spam: {
		path: '/inbox/spam/', 
		post: {spam:'1'}
	},
	unspam: {
		path: '/inbox/spam/',
		post: {spam:'0'}
	},
	donate: {
		path: '/inbox/donate/',
		post: {donate: '1'}
	},
	undonate: {
		path: '/inbox/donate/',
		post: {donate: '0'}
	},
	saveNote:{
		path: '/inbox/savenote/',
		options: { note: {demand: true}},
		handler: function(options, requestOptions){
			if(is(options.id,'array')){
				return getError(STATUSES.CANNOT_SET_MULTIPLE_MSGS);
			}
			requestOptions.query = {
				id: options.id,
				note: options.note
			};
			return getError(STATUSES.NO_ERROR);
		}
	},
	deleteNote: {
		path: '/inbox/deletenote/',
		handler: function(options, requestOptions){
			if(is(options.id,'array')){
				return getError(STATUSES.CANNOT_SET_MULTIPLE_MSGS);
			}
			requestOptions.query = {id: options.id };
			return getError(STATUSES.NO_ERROR);
		}
	},
	saveTranscript: {
		path: '/inbox/saveTranscript/',
		options: { transcript: { demand: true}},
		handler: function(options, requestOptions){
			if(is(options.id,'array')){
				return getError(STATUSES.CANNOT_SET_MULTIPLE_MSGS);
			}
			requestOptions.query =  {
				callId: options.id,
				trans: options.transcript
			};
			return getError(STATUSES.NO_ERROR);
		}
	},
	restoreTranscript: {
		path: '/inbox/restoreTranscript/',
		handler: function(options, requestOptions){
			if(is(options.id,'array')){
				return getError(STATUSES.CANNOT_SET_MULTIPLE_MSGS);
			}
			requestOptions.query =  { callId: options.id };
			return getError(STATUSES.NO_ERROR);
		}
	},
	forward: {
		path: '/inbox/reply/',
		options: {
			email: { demand: true},
			subject: { demand: false},
			body: { demand: false},
			link: { demand: false}
		},
		handler: function(options, requestOptions){
			if(is(options.id,'array')){
				return getError(STATUSES.CANNOT_SET_MULTIPLE_MSGS);
			}
			requestOptions.query =  {
				id: options.id,
				toAddress: is(options.email,'array') ? options.email.join(',') : options.email,
				subject: options.subject || '',
				body: options.body || '',
				includeLink: options.link ? '1' : '0'
			};
			return getError(STATUSES.NO_ERROR);
		}
	}
};

exports.Client.prototype.set = function(type, options, callback){
	var gv = this;
	callback = callback || noop;
	if(!options.id){
		callback(getError(STATUSES.MISSING_REQUIRED_PARAMETER));
		return;
	}
	var status = validateRequest(setMethods, type, options);
	if(status){ callback(status,null,null); return; }
	
	if(setMethods[type].handler){ 
		var requestOptions = {}; // handlers make necessary modifications to the requestOptions object
		var error = setMethods[type].handler.call(setMethods[type],options,requestOptions);
		if(error){ callback(error); return; }
	}else{
		var requestOptions = {
			method: 'POST',
			path: setMethods[type].path,
			query: {
				messages: is(options.id, 'array') ? options.id.join('&messages=') : options.id
			}
		};
		for(var variable in setMethods[type].post){
			requestOptions.query[variable] = setMethods[type].post[variable];
		}
	}
	
	requestOptions.path = requestOptions.path || setMethods[type].path;
	requestOptions.method = requestOptions.method || 'POST';

	gvrequest(gv, requestOptions, callback);
};


// UPDATE COUNTS =================================================================
exports.Client.prototype.getCounts = function(callback){
	var gv = this;
	callback = callback || noop;
	getXMLPage(gv,{path:'/inbox/recent/'},function(error, json, httpResponse, body, xmlObject, err){
		if(error){
			callback(error, null, httpResponse, body, xmlObject, err);
		}else{
			gv.unreadCounts = json.unreadCounts;
			callback(error, json.unreadCounts || null, httpResponse, body, xmlObject, err);
		}
	});
};

// SETTINGS =================================================================
exports.Client.prototype.getSettings = function(callback){
	var gv = this;
	callback = callback || noop;
	getXMLPage(gv,{path:'/settings/tab/settings'},callback);
};