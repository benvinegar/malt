function setup() {
  // Delete loaded js file globals, so they can be reloadd
  delete a;
  delete b;
  delete c;
  
  // Clean up artifacts
  $('link[href=inc/style.css]').remove();
  Malt.reset();
}

asyncTest("require one js file", function() {
  expect(1);
  setup();
  Malt.require('inc/a.js', function() {
    equals(a, 'a', 'a.js was loaded');
    start();
  });
});

asyncTest("require one js file without a callback", function() {
  expect(1);
  setup();
  Malt.require('inc/a.js');

  // Give us enough time to include a.js ... since there's no callback.
  // This is a total guesstimate, and *could* fail.
  setTimeout(function() {
    equals(a, 'a', 'a.js was loaded');
    start();
  }, 100);
});

asyncTest("require one css file", function() {
  expect(1);
  setup();
  Malt.require('inc/style.css', function() {
    equals($('link[href=inc/style.css]').length, 1, 'style.css link tag added');
    start();
  });
});

asyncTest("request one image file", function() {
  expect(1);
  setup();
  Malt.require('inc/image.png', function() {
    // There's nothing we can do here besides make sure the
    // callback fired, because the pre-loading mechanism doesn't
    // actually append any <img> tags to the document.
    ok(true, "callback fired");
    start();
  });
});

asyncTest("require one js file and one css file", function() {
  expect(2);
  setup();
  Malt.require('inc/a.js', 'inc/style.css', function() {
    equals(a, 'a', 'a.js was loaded');
    equals($('link[href=inc/style.css]').length, 1, 'style.css link tag added');
    start();
  });
});

asyncTest("require one js file, one css file, and one image file", function() {
  expect(2);
  setup();
  Malt.require('inc/a.js', 'inc/style.css', 'inc/image.png', function() {
    equals(a, 'a', 'a.js was loaded');
    equals($('link[href=inc/style.css]').length, 1, 'style.css link tag was added');
    start();
  });
});

asyncTest("require two js files", function() {
  expect(3);
  setup();
  Malt.require('inc/a.js', 'inc/b.js', function() {
    equals(a, 'a', 'a.js was loaded');
    equals(b, 'b', 'b.js was loaded');
    equals(Malt.getLog().length, 2, 'no further files were loaded');
    start();
  });
});

asyncTest("require two identical js files, back-to-back", function() {
  expect(3);
  setup();
  Malt.require('inc/a.js', function() {
    start();
    equals(a, 'a', 'a.js was loaded');
  });

  Malt.require('inc/a.js', function() {
    // Just want to make sure this callback actually hits
    // and we didn't actually load another file
    ok(true, "second callback hit");
    equals(Malt.getLog().length, 1, 'no further files were loaded');
  });
});

asyncTest("require one js file, and on success, request the same js file", function() {
  expect(3);
  setup();
  Malt.require('inc/a.js', function() {
    equals(a, 'a', 'a.js was loaded');
    Malt.require('inc/a.js', function() {
      ok(true, "second callback hit")

      // Make sure we didn't actually fetch the file twice
      equals(Malt.getLog().length, 1, 'no further files were loaded');

      start();
    });
  });
});

asyncTest("require a module containing one js file", function() {
  expect(1);
  setup();
  Malt.module('package', 'inc/a.js');
  Malt.require('package', function() {
    start();
    equals(a, 'a', 'a.js was loaded');
  });
});

asyncTest("require a module containing one js file and another module", function() {
  expect(2);
  setup();

  Malt.module('package1', 'inc/a.js');
  Malt.module('package2', 'package1', 'inc/b.js');

  Malt.require('package2', function() {
    start();
    equals(a, 'a', 'a.js was loaded');
    equals(b, 'b', 'b.js was loaded');
  });
});

asyncTest("require a module that has its own callback function", function() {
  expect(1);
  setup();
  Malt.module('package', 'inc/a.js', function() {
    start();
    equals(a, 'a', 'a.js was loaded');
  });
  Malt.require('package');
});

asyncTest('require a module that has its own callback function, followed by another callback', function () {
  expect(2);
  setup();
  Malt.module('package', 'inc/a.js', function() {
    equals(a, 'a', 'a.js was loaded');
  });
  Malt.require('package', function() {
    ok(true, "second callback hit");
    start();
  });
});