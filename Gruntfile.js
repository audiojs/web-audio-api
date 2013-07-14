module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify2: {
      AudioParam: {
        entry: './build/AudioParam-index.js',
        compile: './build/AudioParam-client.js'
      }
    },

    simplemocha: {
      options: {
        globals: ['should'],
        timeout: 3000,
        ignoreLeaks: false,
        ui: 'bdd',
        reporter: 'tap'
      },

      all: { src: ['test/**/*.js'] }
    }

  })

  grunt.loadNpmTasks('grunt-browserify2')
  grunt.loadNpmTasks('grunt-simple-mocha')

  grunt.registerTask('test', ['browserify2:AudioParam', 'simplemocha'])

}