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

  //-----------------------------------------------------
  // Private Utility Methods
  //=====================================================

  /**
   * A clone of jQuery's $.each utility method
   */
  var each = function(arr, callback) {
    for (var i = 0; i < arr.length; i++) {
      callback(i, arr[i]);
    }
  };

  /**
   * A clone of jQuery's $.makeArray utility method
   */
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

  var loadScript = function(url, onload) {
    loadScriptXhrInjection(url, onload);
  };

  var loadScriptXhrInjection = function(url, onload) {
    var xhrObj = getXHRObject();
    xhrObj.onreadystatechange = function() {
      if (xhrObj.readyState == 4) {
        _queuedScripts[url] = xhrObj.responseText;
        onload();
      }
    };
    xhrObj.open('GET', url, true);
    xhrObj.send('');
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

  var loadCSS = function(file, callback) {
    $('head').append('<link rel="stylesheet" type="text/css" href="' + file + '"/>');
    callback();
  };

  var loadImage = function(file, callback) {
    $("<img>").attr("src", file);
    callback();
  };

  /**
   * Generic resource getter - hands off to one of the methods above
   */
  var getGeneric = function(file, callback) {
    var loader = null;
    var extension = file.match(/\.([A-Za-z]+)$/)[1];

    if (extension == 'js') {
      loader = loadScript;
    } else if (extension == 'css') {
      loader = loadCSS;
    } else if (/png|jpg|jpeg|gif/.test(extension)) {
      loader = loadImage;
    }

    loader(file, callback);
  };

  /**
   * Class to encapsulate a dependency. A dependency is a callback method,
   * and a list of resources upon which that dependency relies.
   */
  var _resourceMap = {};

  var Resource = function(url, callback) {
    var self = this;
    self.name = url;
    self.status = null;
    self.watchers = [];
    self.callback = callback;
    self.children = null;

    if (typeof url === 'object') {
      self.children = [];
      each(url, function(k, u) {
        var resource;
        if (_resourceMap[u]) {
          // We're already tracking this resource
          resource = _resourceMap[u];
        } else {
          if (_modules[u]) {
            resource = _modules[u];
          } else {
            resource = new Resource(u);
          }
          _resourceMap[u] = resource;
        }
        self.children.push(resource);
      });
    }

    self.load = function() {
      if (self.status == null) {
        self.status = 'loading';
        // This is a brand new self that we haven't done anything with yet
      } else {
        return;
      }
      
      if (!self.children) {
        getGeneric(self.name, function() {
          self.status = 'loaded';

          // Iterate through each associated dependency, and if that
          // dependency has been satisfied (all resources loaded), then
          // launch the associated callback.
          self.refreshWatchers();
        });
      } else {
        each(self.children, function(k, resource) {
          resource.watchers.push(self);
          resource.load();
        });
      }
    };
    
    this.refreshWatchers = function() {
      each(self.watchers, function(k, watcher) {
        if (watcher.status == 'loaded' || watcher.isLoaded()) {
          watcher.status = 'loaded';
          watcher.insertQueuedScripts();
          watcher.callback && watcher.callback();
          watcher.refreshWatchers();
        }
      });
    };
    
    this.isLoaded = function() {
      if (!this.children) {
        return self.status == 'loaded';
      } else {
        var allLoaded = true;
        each(this.children, function(k, child) {
          if (!child.isLoaded()) {
            allLoaded = false;
          }
        });
        return allLoaded;
      }
    };
    
    /**
     * Take all of the deferred scripts that belong to this
     * dependency and inject them into the page.
     */
    this.insertQueuedScripts = function() {
      each(this.children, function(k, resource) {
        if (!_queuedScripts[resource.name]) {
          return;
        }

        var response = _queuedScripts[resource.name];
        var se = document.createElement('script');
        document.getElementsByTagName('head')[0].appendChild(se);
        se.text = response;

        // No longer queued
        _queuedScripts[resource.name] = null;
      });
    };
  };

  //-----------------------------------------------------
  // Public Methods
  //=====================================================

  Malt.module = function() {
    var name      = arguments[0];
    var urls      = [];
    var callback  = arguments[arguments.length - 1];

    if (typeof callback !== 'function') {
      callback = null;
      urls = makeArray(arguments).slice(1);
    } else {
      urls = makeArray(arguments).slice(1, -1);
    }

    _modules[name] = new Resource(urls, callback);
  };

  Malt.require = function() {
    var urls      = makeArray(arguments).slice(0, -1);
    var callback  = arguments[arguments.length - 1];

    var resource = new Resource(urls, callback);
    resource.load();
  };

  Malt.require.reset = function() {
    _queuedScripts = {};
    _resourceMap = {};
    _modules = {};
  };
})(Malt);
