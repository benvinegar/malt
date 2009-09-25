/**
 * jQuery Deps: Non-blocking Javascript Dependency Manager
 */
(function($) {
	_deps   = {}; // file -> dependency map
	_loaded = {}; // loaded files
	
	var Dependency = function(files, callback) {
		this.files = files;
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
	}
	$.require = function(files, callback) {
		var dependency = new Dependency(files, callback);

		$.each(files, function(k, file) {
			
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
			$.getScript(file, function() {

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
	}
})(jQuery);
