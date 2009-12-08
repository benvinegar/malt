/**
 * jQuery Dependencies: Non-blocking Javascript Dependency Manager
 *
 * Usage: 
 *
 * // Define a module
 * $.module('moduleName', 'file1.js', 'file2.js');
 *
 * // Require a module asynchronously:
 * $.require('moduleName', function() {
 *   doSomethingAfterFilesLoaded();
 * });
 *
 * This work is distributed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright 2009 Ben Vinegar [ ben ! freshbooks dot com ]
 */

(function($) {
	_deps    = {}; // file -> dependency map
	_loaded  = {}; // loaded files
	_modules = {};
	
	var addHandler = function(elem, type, func) {
		if (elem.addEventListener) {
			elem.addEventListener(type, func, false);
		}
		else if (elem.attachEvent) {
			elem.attachEvent("on" + type, func);
		}
	};

	var loadScript = function(url, onload) {
		// pick the best loading function
		var loadFunc = loadScriptXhrInjection;
		if (isDifferentDomain(url)) {
			if (-1 != navigator.userAgent.indexOf('Firefox') || 
				-1 != navigator.userAgent.indexOf('Opera')) {
				loadFunc = loadScriptDomElement;
			}
			else {
				loadFunc = loadScriptDocWrite;
			}
		}
		loadFunc(url, onload);
	};

	var isDifferentDomain = function(url) {
		if (0 === url.indexOf('http://') || 0 === url.indexOf('https://')) {
			var mainDomain = document.location.protocol + "://" + document.location.host + "/";
			return (0 !== url.indexOf(mainDomain));
		}
		return false;
	};

	var loadScriptDomElement = function(url, onload) {
		var domscript = document.createElement('script');
		domscript.src = url;
		if (onload) {
			domscript.onloadDone = false;
			domscript.onload = function() { 
				if (!domscript.onloadDone) {
					domscript.onloadDone = true; 
					onload(); 
				}
			};
			domscript.onreadystatechange = function() {
				if (( "loaded" === domscript.readyState || "complete" === domscript.readyState ) && !domscript.onloadDone) {
					domscript.onloadDone = true;
					domscript.onload();
				}
			}
		}
		document.getElementsByTagName('head')[0].appendChild(domscript);
	};
	
	var loadScriptDocWrite = function(url, onload) {
		document.write('<scr' + 'ipt src="' + url + 
					   '" type="text/javascript"></scr' + 'ipt>');
		if (onload) {
			// we can't tie it to the script's onload, so use window
			// thus, it doesn't fire as early as it might have
			addHandler(window, "load", onload);
		}
	};

	var queuedScripts = [];

	loadScriptXhrInjection = function(url, onload) {

		var xhrObj = getXHRObject();
		xhrObj.onreadystatechange = function() { 
			if (xhrObj.readyState == 4) {
				var se = document.createElement('script');
				document.getElementsByTagName('head')[0].appendChild(se);
				se.text = xhrObj.responseText;
				if ( onload ) {
					onload();
				}
			}
		};
		xhrObj.open('GET', url, true);
		xhrObj.send('');
	};

	getXHRObject = function() {
		var xhrObj = false;
		try {
			xhrObj = new XMLHttpRequest();
		}
		catch (e) {
			var aTypes = ["Msxml2.XMLHTTP.6.0", 
						  "Msxml2.XMLHTTP.3.0", 
						  "Msxml2.XMLHTTP", 
						  "Microsoft.XMLHTTP"];
			var len = aTypes.length;
			for (var i = 0; i < len; i++) {
				try {
					xhrObj = new ActiveXObject(aTypes[i]);
				}
				catch (e) {
					continue;
				}
				break;
			}
		}
		finally {
			return xhrObj;
		}
	};

	var Dependency = function(resources, callback) {
		this.files = (new Module(resources)).flatten();
		this.callback = callback;
		
		/**
		 * Returns true if this dependency has been met
		 */
		this.allLoaded = function() {
			var allLoaded = true;
			$.each(this.files, function(k, file) {
				if (_loaded[file] === false) {
					allLoaded = false;
				}
			});
			return allLoaded;
		};
	};
	
	var Module = function(resources) {
		this.resources = resources;
		this.flatten = function() {
			var out = [];
			$.each(this.resources, function(k, resource) {
				if (typeof _modules[resource] === 'object' ) {
					$.merge(out, _modules[resource].flatten());
				} else {
					out.push(resource);
				}
			});
			return out;
		};
	};
	
	var getCSS = function(file, callback) {
		$('head').append('<link rel="stylesheet" type="text/css" href="' + file + '"/>');
		callback();
	};
	
	var getImage = function(file, callback) {
		$("<img>").attr("src", file);
		callback();
	};
	
	var getFile = function(file, callback) {
		var getter = null;
		var extension = file.match(/\.([A-Za-z]+)$/)[1];
		
		if (extension == 'js') {
			getter = loadScript;
		} else if (extension == 'css') {
			getter = getCSS;
		} else if (/png|jpg|jpeg|gif/.test(extension)) {
			getter = getImage;
		}

		getter(file, callback);
	};
	
	$.module = function() {
		var name      = arguments[0];
		var resources = $.makeArray(arguments).slice(1);

		_modules[name] = new Module(resources);
	};
	
	$.require = function() {
		var resources = $.makeArray(arguments).slice(0, -1);
		var callback  = arguments[arguments.length - 1];

		var dependency = new Dependency(resources, callback);

		$.each(dependency.files, function(k, file) {
			
			if (typeof _loaded[file] === 'undefined') 
			{
				// This is a brand new file we haven't seen yet.
				_deps[file] = [dependency];
				_loaded[file] = false;
			} 
			else if (typeof _deps[file] === 'object') 
			{
				// We've already seen this file. We don't need to add it to
				// the "load-this-file" queue, but the file now has a new
				// dependency it needs to be associated with.
				_deps[file].push(dependency);
				return;
			} 
			else 
			{
				// This file has already been loaded.
				return;
			}

			// Attempt to fetch this file.
			getFile(file, function() {

				_loaded[file] = true;
				
				// Get the list of dependencies associated with this file.
				var dependencies = _deps[file];
				
				// Iterate through each associated dependency, and if that
				// dependency has been satisfied (all files loaded), then
				// launch the associated callback.
				
				$.each(dependencies, function(k, dependency) {

					if (dependency.allLoaded()) {
						dependency.callback();
					}
				});
			});
		});
	};
	

	$.require.reset = function() {
		_deps    = {}; // file -> dependency map
		_loaded  = {}; // loaded files
		_modules = {};
	};
})(jQuery);
