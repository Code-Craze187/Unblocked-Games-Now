define(function(require) {
    var Events = require('minivents.min');

    window.gameEvents = new Events();
    window.debug = {
        wind: true,
        death: true,
        player: true
    };
    window.SceneManager = require('sceneManager');
    var gameScene = new SceneManager();
    document.ontouchmove = function(event) {
        event.preventDefault();
    };
});