var Malt = (function() {
  // Constants
  var LOADING  = 1;
  var FINISHED = 2;
  
  // Script bodies that have been fetched via XHR, but haven't yet
  // been evaled.
  var _deferredScripts = [];
  
  // Resource map. Tracks both user-named modules, and resources that
  // are loading/loaded.
  var _resourceMap = {};
  
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
        _deferredScripts[url] = xhrObj.responseText;
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

  var Resource = function(name, dependencies, callback) {
    var self = this;

    self.name     = name;     // Symbolic name (can be null)
    self.status   = null;     // Loading status: null, LOADING, or FINISHED
    self.parents  = [];       // Resources that are "watching" this resource (parents)
    self.callback = callback; // Callback to execute once resource is done loading
    self.children = null;     // Child resources (if they exist)

    // If this is a named resource (declared module or leaf node / file), register it
    // for later retrieval
    if (self.name !== null) {
      _resourceMap[self.name] = self;
    }

    if (typeof dependencies === 'object')
    {
      // If we're passed an array for names, that means this resource is composed
      // of many resources (can also be an array of just ONE resource)
      self.children = [];
      
      // For each child resource ...
      each(dependencies, function(k, dep) {
        // Check our resourceMap to see if we're already tracking this
        // resource name, otherwise create a new object
        self.children.push(_resourceMap[dep] ? _resourceMap[dep] : new Resource(dep));
      });
    }
  };
  
  Resource.prototype.load = function() {
    var self = this;
    
    if (self.status !== null) {
      // If this resource is LOADING or FINISHED -- do nothing. The loading
      // process will handle all the work once it finishes.
      return;
    }

    // Otherwise this is a brand new resource we haven't seen yet.
    self.status = LOADING;
       
    // If this is a leaf node, then we're dealing with an individual file,
    // so just fetch the file.
    if (!self.children) {
      getGeneric(self.name, function() {
        
        self.status = FINISHED;
        
        _log.push(self.name);

        // Walk up the tree and find out if any parent resources have
        // been satisfied.
        self.updateParents();
      });
    } else {
      // This resource has further children. Execute #load for each of them.
      each(self.children, function(k, child) {
        child.parents.push(self);
        child.load();
      });
    }
  };
    
  // Walk up the tree, and for each parent resource, see if it has become
  // satisfied as a result of whatever loaded resource triggered this function.
  Resource.prototype.updateParents = function() {
    each(this.parents, function(k, parent) {
      if (parent.isLoaded()) {
        
        // Mark as finished so we don't have to traverse down the tree again.
        parent.status = FINISHED;
        parent.insertDeferredScripts();
        parent.callback && parent.callback();
        parent.updateParents();
      }
    });
  };
  
  // Returns true if a resource is loaded.  
  Resource.prototype.isLoaded = function() {
    if (this.status === FINISHED) {
      return true;
    }
    
    if (!this.children) {
      return this.status === FINISHED;
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

  // Take all of the deferred scripts that belong to this
  // dependency and inject them into the page.
  Resource.prototype.insertDeferredScripts = function() {
    each(this.children, function(k, resource) {
      if (!_deferredScripts[resource.name]) {
        return;
      }

      var response = _deferredScripts[resource.name];
      var se = document.createElement('script');
      document.getElementsByTagName('head')[0].appendChild(se);
      se.text = response;

      // No longer queued
      _deferredScripts[resource.name] = null;
    });
  };

  //-----------------------------------------------------
  // Public Methods
  //=====================================================
  var Malt = {};
  
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

    // Just need to create a resource with the given name. It will
    // register itself for later retrieval.
    new Resource(name, urls, callback);
  };

  Malt.require = function() {
    var urls      = makeArray(arguments).slice(0, -1);
    var callback  = arguments[arguments.length - 1];
    
    // If a sole parameter was passed
    if (typeof callback === 'string') {
      urls = [callback];
      callback = null;
    }

    (new Resource(null, urls, callback)).load();
  };

  Malt.reset = function() {
    _deferredScripts = {};
    _resourceMap = {};
    _log = [];
  };
  
  Malt.getLog = function() {
    return _log;
  };
  
  return Malt;
})();
