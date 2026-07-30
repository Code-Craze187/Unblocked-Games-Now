/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    exec: {
      buildJs: {
        cmd: "node r.js -o baseUrl=src/js name=almond include=main out=build/main-build.js wrap=true insertRequire=main"
      },
      buildCss: {
        cmd: "node r.js -o cssIn=src/css/style.css out=build/css-build.css optimizeCss=standard"
      }
    },
    watch: {
      js: {
        files: 'src/js/**/*.*',
        tasks: 'exec:buildJs'
      },
      css: {
        files: 'src/css/**/*.*',
        tasks: 'exec:buildCss'
      }
    }
  });

  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask('default', ['exec', 'watch']);

};
