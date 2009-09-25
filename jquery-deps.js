/**
 * jQuery Deps: Non-blocking Javascript Dependency Manager
 */
(function($) {
	_deps    = {}; // file -> dependency map
	_loaded  = {}; // loaded files
	_modules = {};
	
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
		}
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
	}
	
	var getFile = function(file, callback) {
		var getter = null;
		var extension = file.match(/\.([A-Za-z]+)$/)[1];
		
		if (extension == 'js') {
			getter = $.getScript;
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
