/**
 * jQuery Deps: Non-blocking Javascript Dependency Manager
 */
(function($) {
	_deps   = {};
	_loaded = {};
	_globs  = {};
	
	var _index = 0;
	$.deps = function(files, callback) {
		var count = 0;

		var glob = {
			files: files,
			callback : callback
		}
		_globs[_index] = glob;

		$.each(files, function(k, file) {
			if (typeof _loaded[file] === 'undefined') {
				_deps[file] = [_index];
				_loaded[file] = false;
			} else if (typeof _deps[file] === 'object') {
				_deps[file].push(_index);
				return;
			} else {
				return;
			}

			$.getScript(file, function() {
				_loaded[file] = true;
				var globIndexes = _deps[file];
				$.each(globIndexes, function(k, globIdx) {
					var glob = _globs[globIdx];

					var allLoaded = true;
					$.each(glob.files, function(k, file) {
						if (_loaded[file] === false) {
							allLoaded = false;
						}
					});

					if (allLoaded) {
						glob.callback();
					}
				});
			});
		});
		_index += 1;
	}
})(jQuery);
