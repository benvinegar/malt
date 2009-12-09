/**
 * Malt: Non-blocking Javascript Dependency Manager
 *
 * Usage: 
 *
 * // Define a module
 * Malt.module('moduleName', 'file1.js', 'file2.js');
 *
 * // Require a module asynchronously:
 * Malt.require('moduleName', function() {
 *   doSomethingAfterFilesLoaded();
 * });
 *
 * This work is distributed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright 2009 Ben Vinegar [ ben ! freshbooks dot com ]
 */

var Malt = {};

(function(Malt) {
	var _deps    = {}; // file -> dependency map
	var _modules = {}; // module -> file map
	var _loaded  = {}; // loaded resources
		
	var _queuedScripts = [];
		
	var loadScript = function(url, onload) {
		loadScriptXhrInjection(url, onload);
	};
		
	var loadScriptXhrInjection = function(url, onload) {
		var queueIndex = _queuedScripts.length;
		_queuedScripts[queueIndex] = null;
		
		var xhrObj = getXHRObject();
		xhrObj.onreadystatechange = function() { 
			if (xhrObj.readyState == 4) {
				_queuedScripts[queueIndex] = xhrObj.responseText;
				onload();
			}
		};
		xhrObj.open('GET', url, true);
		xhrObj.send('');
	};
	
	var injectQueuedScripts = function() {
		var len = _queuedScripts.length;
		for (var i = 0; i < len; i++) {
			var response = _queuedScripts[i];
			var se = document.createElement('script');
			document.getElementsByTagName('head')[0].appendChild(se);
			se.text = response;
		}
	};

	var getXHRObject = function() {
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
		this.resources = (new Module(resources)).flatten();
		this.callback = callback;
		
		/**
		 * Returns true if this dependency has been met
		 */
		this.allLoaded = function() {
			var allLoaded = true;
			each(this.resources, function(k, resource) {
				if (_loaded[resource] === false) {
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
			var resource;
			each(this.resources, function(k, resource) {
				if (typeof _modules[resource] === 'object' ) {
					out = out.concat(_modules[resource].flatten());
				} else {
					out.push(resource);
				}
			});
			return out;
		};
	};
	
	var each = function(arr, callback) {
		for (var i = 0; i < arr.length; i++) {
			callback(i, arr[i]);
		}
	};
	
	var makeArray = function(array) {
		var ret = [];
		if (array != null) {
			var i = array.length;
			while (i) {
				ret[--i] = array[i];
			}
		}
		return ret;
	};
	
	var getCSS = function(file, callback) {
		$('head').append('<link rel="stylesheet" type="text/css" href="' + file + '"/>');
		callback();
	};
	
	var getImage = function(file, callback) {
		$("<img>").attr("src", file);
		callback();
	};
	
	var getResource = function(file, callback) {
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
	
	Malt.module = function() {
		var name      = arguments[0];
		var resources = makeArray(arguments).slice(1);

		_modules[name] = new Module(resources);
	};
	
	Malt.require = function() {
		var resources = makeArray(arguments).slice(0, -1);
		var callback  = arguments[arguments.length - 1];

		var dependency = new Dependency(resources, callback);

		each(dependency.resources, function(k, resource) {
			
			if (typeof _loaded[resource] === 'undefined') 
			{
				// This is a brand new resource we haven't seen yet.
				_deps[resource] = [dependency];
				_loaded[resource] = false;
			} 
			else if (typeof _deps[resource] === 'object') 
			{
				// We've already seen this resource. We don't need to add it to
				// the "load-this-resource" queue, but the resource now has a new
				// dependency it needs to be associated with.
				_deps[resource].push(dependency);
				return;
			} 
			else 
			{
				// This resource has already been loaded.
				return;
			}

			// Attempt to fetch this resource.
			getResource(resource, function() {

				_loaded[resource] = true;
				
				// Get the list of dependencies associated with this resource.
				var dependencies = _deps[resource];
				
				// Iterate through each associated dependency, and if that
				// dependency has been satisfied (all resources loaded), then
				// launch the associated callback.
				
				each(dependencies, function(k, dependency) {

					if (dependency.allLoaded()) {
						injectQueuedScripts();
						dependency.callback();
					}
				});
			});
		});
	};
	

	Malt.require.reset = function() {
		_deps    = {}; // file -> dependency map
		_loaded  = {}; // loaded files
		_modules = {};
	};
})(Malt);
