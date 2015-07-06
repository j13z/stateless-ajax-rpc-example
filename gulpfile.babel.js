import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import del from 'del';

const $ = gulpLoadPlugins();


const paths = {
	es6: 'src/**/*.js',
	es5: 'dist'
};



gulp.task('transpile', () => {
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
