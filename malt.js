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
  var getResource = function(file, callback) {
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
    
    /**
     * Take all of the deferred scripts that belong to this
     * dependency and inject them into the page.
     */
    this.insertQueuedScripts = function() {
      each(this.resources, function(k, resource) {
        if (!_queuedScripts[resource]) {
          return;
        }
        
        var response = _queuedScripts[resource];
        var se = document.createElement('script');
        document.getElementsByTagName('head')[0].appendChild(se);
        se.text = response;
        
        // No longer queued
        _queuedScripts[resource] = null;
      });
    };
  };
  
  /**
   * Class to encapsulate a module declaration, which ties a string/key
   * to a list of resources.
   */
  var Module = function(resources) {
    this.resources = resources;
    
    /**
     * Returns a flattened array of resources (including sub-modules)
     */
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
  
  //-----------------------------------------------------
  // Public Methods
  //=====================================================
  
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
            dependency.insertQueuedScripts();
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
