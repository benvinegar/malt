var Malt = {};

(function(Malt) {

  // Script bodies that have been fetched via XHR, but haven't yet
  // been evaled.
  var _queuedScripts = [];
  
  // Keeps track of already loaded (or loading) resources
  var _resourceMap = {};
  
  // A map of all available modules
  var _modules = {};
  
  // A log of resources downloaded; used for testing
  var _log = [];
  
  //-----------------------------------------------------
  // Private Utility Methods
  //=====================================================

  // A clone of jQuery's $.each utility method
  var each = function(arr, callback) {
    for (var i = 0; i < arr.length; i++) {
      callback(i, arr[i]);
    }
  };

  // A clone of jQuery's $.makeArray utility method
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
    var link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    link.setAttribute('href', file);
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(link);
    callback();
  };

  var loadImage = function(file, callback) {
    var image = new Image();
    image.src = file;
    callback();
  };

  // Generic resource getter - hands off to one of the methods above

  var getGeneric = function(file, callback) {
    var loader = null;
    var extension = file.match(/\.([^\.]+)$/)[1];

    if (extension == 'js') {
      loader = loadScript;
    } else if (extension == 'css') {
      loader = loadCSS;
    } else if (/png|jpg|jpeg|gif/.test(extension)) {
      loader = loadImage;
    }

    loader(file, callback);
  };


   // Class to encapsulate a resource. A resource can be a single file (leaf node),
   // or it can be a collection of many resources.

  var Resource = function(url, callback) {
    var self = this;
    
    self.name = url;          // Symbolic name, if one exists
    self.status = null;       // Loading status: null, 'loading', or 'loaded'
    self.parents = [];        // Resources that are "watching" this resource (parents)
    self.callback = callback; // Callback to execute once resource is done loading
    self.children = null;     // Child resources (if they exist)

    // If we're passed an array for url, that means this resource is composed
    // of many resources
    if (typeof url === 'object') {
      self.children = [];
      // For each child resource ...
      each(url, function(k, u) {
        var resource;
        
        // Check the _resourceMap to see if we're already tracking this
        // resource (we've seen it before)
        if (_resourceMap[u]) {
          resource = _resourceMap[u];
        } 
        else {
          // Nope - this is a new resource.
          
          // Second, see if there's a module defined for any of these
          // resources.
          if (_modules[u]) {
            resource = _modules[u];
          } else {
            resource = new Resource(u);
          }
          
          // Add it to the resource map. So we don't repeat ourselves later.
          _resourceMap[u] = resource;
        }
        self.children.push(resource);
      });
    }
  };
  
  Resource.prototype.load = function() {
    var self = this;
    
    if (self.status != null) {
      // If this resource is 'loading' or 'loaded' -- do nothing. The loading
      // process will handle all the work once it finishes.
      return;
    }

    // Otherwise this is a brand new resource we haven't seen yet.
    self.status = 'loading';
       
    // If this is a leaf node, then we're dealing with an individual file,
    // so just fetch the file.
    if (!self.children) {
      getGeneric(self.name, function() {
        self.status = 'loaded';
        _log.push(self.name);

        // Walk up the tree and find out if any parent resources have
        // been satisfied
        self.updateParents();
      });
    } else {
      // This resource has further children. Execute #load for each of them.
      each(self.children, function(k, resource) {
        resource.parents.push(self);
        resource.load();
      });
    }
  };
    
  // Walk up the tree, and for each parent resource, see if it has become
  // satisfied as a result of whatever loaded resource triggered this function.
  Resource.prototype.updateParents = function() {
    each(this.parents, function(k, parent) {
      if (parent.isLoaded()) {
        
        // Mark as loaded so we don't have to look *down* the tree again.
        parent.status = 'loaded';
        parent.insertQueuedScripts();
        parent.callback && parent.callback();
        parent.updateParents();
      }
    });
  };

  // Take all of the deferred scripts that belong to this
  // dependency and inject them into the page.
  Resource.prototype.insertQueuedScripts = function() {
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
    
  // Returns true if a resource is loaded.  
  Resource.prototype.isLoaded = function() {
    if (this.status == 'loaded') {
      return true;
    }
    
    if (!this.children) {
      return this.status == 'loaded'; 
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
    
    // If a sole parameter was passed
    if (typeof callback === 'string') {
      urls = [callback];
      callback = null;
    }

    var resource = new Resource(urls, callback);
    resource.load();
  };

  Malt.reset = function() {
    _queuedScripts = {};
    _resourceMap = {};
    _modules = {};
    _log = [];
  };
  
  Malt.getLog = function() {
    return _log;
  };
})(Malt);
