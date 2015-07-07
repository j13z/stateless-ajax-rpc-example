const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const del = require('del');
const jshintStylish = require('jshint-stylish');


const paths = {
	es6: 'src/**/*.js',
	es5: 'dist'
};


gulp.task('lint', () => {
	return gulp.src(paths.es6)
		.pipe($.jshint())
		.pipe($.jshint.reporter(jshintStylish));
});


gulp.task('transpile', [ 'lint' ], () => {
	const stream = gulp.src(paths.es6)
		.pipe($.babel())
		.on('error', error => {
			console.warn(error.message + '\n' + error.codeFrame);
			stream.emit('end');    // prevent Gulp termination
		})
		.pipe(gulp.dest(paths.es5));

	return stream;
});


gulp.task('clean', del.bind(null, [ paths.es5 ], { dot: true }));


gulp.task('default', [ 'transpile' ]);


gulp.task('watch', [ 'default' ], () => {
	gulp.watch(paths.es6, [ 'default' ]);
});
