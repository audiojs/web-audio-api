import gulp from 'gulp'
import gutil from 'gulp-util'
import contribs from 'gulp-contribs'
import babel from 'gulp-babel'

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
    gulp.watch('./src/*.js', ['default'])
})
