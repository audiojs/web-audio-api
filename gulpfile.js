var gulp = require('gulp')
  , gutil = require('gulp-util')
  , contribs = require('gulp-contribs')
  , babel = require('gulp-babel')

gulp.task('default', function () {
    return gulp.src('lib/**/*.js')
      .pipe(babel({ presets: ['es2015'] }))
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
