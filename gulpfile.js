var gulp = require('gulp')
  , gutil = require('gulp-util')
  , contribs = require('gulp-contribs')
  , es6transpiler = require('gulp-es6-transpiler')

gulp.task('default', function () {
    return gulp.src('lib/*.js')
      .pipe(es6transpiler({ disallowDuplicated: false }))
      .on('error', gutil.log)
      .pipe(gulp.dest('build'))
})

gulp.task('contribs', function () {
    gulp.src('README.md')
      .pipe(contribs('Contributors\n-------------', 'Changelog\n-----------'))
      .pipe(gulp.dest('./'))
})


gulp.task('watch', function() {
    gulp.watch('./lib/*.js', ['default'])
})
