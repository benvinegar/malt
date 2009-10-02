function setup() {
	delete a;
	delete b;
	delete c;
	$('link[href=inc/style.css]').remove();
	$('img[href=inc/image.png]').remove();
	$.require.reset();
}

test("require one js file", function() {
	setup();
	stop();
	$.require('inc/a.js', function() {
		start();
		equals(a, 'a');
	});
});

test("require one css file", function() {
	setup();
	stop();
	$.require('inc/style.css', function() {
		start();
		equals($('link[href=inc/style.css]').length, 1);
	});
});

test("request one image file", function() {
	setup();
	stop();
	$.require('inc/image.png', function() {
		start();
		// There's nothing we can do here besides make sure the
		// callback fired, because the pre-loading mechanism doesn't
		// actually append any <img> tags to the document.
		ok("callback fired");
	});
});

test("require one js file and one css file", function() {
	setup();
	stop();
	$.require('inc/a.js', 'inc/style.css', function() {
		start();
		equals(a, 'a');
		equals($('link[href=inc/style.css]').length, 1);
	});
});

test("require one javascript file, one css file, and one image", function() {
	setup();
	stop();
	$.require('inc/a.js', 'inc/style.css', 'inc/image.png', function() {
		start();
		equals(a, 'a');
		equals($('link[href=inc/style.css]').length, 1);
	});
});

test("require two js files", function() {
	setup();
	stop();
	$.require('inc/a.js', 'inc/b.js', function() {
		start();
		equals(a, 'a');
		equals(b, 'b');
	});
});

test("require the same js file back-to-back", function() {
	setup();
	stop();
	$.require('inc/a.js', function() {
		start();
		equals(a, 'a');
	});
	
	$.require('inc/a.js', function() {
		// Just want to make sure this callback actually hits
		equals(a, 'a');
	});
});

test("require a js file, and on success, request the same js file", function() {
	setup();
	stop();
	$.require('inc/a.js', function() {
		start();
		equals(a, 'a');
		stop();
		$.require('inc/a.js', function() {
			start();
			equals(a, 'a');
		});
	});
});

test("require a module containing one js file", function() {
	setup();
	stop();
	$.module('package', 'inc/a.js');
	$.require('package', function() {
		start();
		equals(a, 'a');
	});
});

test("require a module containing one js file and another module", function() {
	setup();

	$.module('package1', 'inc/a.js');
	$.module('package2', 'package1', 'inc/b.js');

	stop();
	$.require('package2', function() {
		start();
		equals(a, 'a');
		equals(b, 'b');
	});
});