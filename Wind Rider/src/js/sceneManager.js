define(function(require){
    var requestAnimFrame = (function(){
        return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            function( callback ){
                window.setTimeout(callback, 1000 / 60);
            };
    })(),
    touchListener = function(event) {
        // debugger
        var contentDiv = document.getElementById('content');
        var stageX = Math.round((event.pageX - contentDiv.offsetLeft - contentDiv.clientLeft) * scale);
        var stageY = Math.round((event.pageY - contentDiv.offsetTop - contentDiv.clientTop) * scale);
        gameEvents.emit('press', new Vector(stageX, stageY));
    },
    paused = false,
    keyListener = function(event) {
        if (event.which === 27) {
            paused = !paused;
        }
        gameEvents.emit('keyup', event.which);
    },
    Physics = require('physics'),
    Player = require('player'),
    Wind = require('wind');

    window.canvas = document.getElementById('gameCanvas');
    window.context = canvas.getContext('2d');
    if ('ontouchstart' in canvas) {
        canvas.addEventListener('touchstart', touchListener);
    } else {
        canvas.addEventListener('mousedown', touchListener);
    }
    document.addEventListener('keyup', keyListener);

    function GameScene() {
        var physics = new Physics(),
            player = new Player(),
            wind = new Wind(),
            timeNow = Date.now(),
            startTime = Date.now(),
            lastUpdateTime = Date.now(),
            difficulty = 0,
            gameOver = false,
            gameTime = startTime,
            timeOfDeath = 0,
            crashTime = 3,
            endText = "";

        gameEvents.on('gameover', endGame);
        function restartGame() {
            gameEvents.off();
            gameEvents.on('gameover', endGame);
            physics = new Physics();
            player = new Player();
            wind = new Wind();
            timeNow = Date.now();
            startTime = Date.now();
            lastUpdateTime = Date.now();
            difficulty = 0;
            gameOver = false;
            gameTime = startTime;
            timeOfDeath = 0;
            crashTime = 3;
            endText = "";
            canvas.width = canvas.width;
            toggleTwitterButton();
        }
        function endGame() {
            gameOver = true;
        }

        function animLoop() {
            requestAnimFrame(animLoop);
            update();
            if (!gameOver) {
                if (!paused) {
                    drawnPausedText = false;
                    renderGame();
                } else {
                    lastUpdateTime = Date.now();
                    if (!drawnPausedText) {
                        drawnPausedText = true;
                        context.font = "72px CourierNew, Courier, sans-serif";
                        context.fillStyle = "#000000";
                        context.textAlign = 'center';
                        context.textBaseLine = 'middle';
                        context.fillText("Paused", 480, 270);
                    }
                }
            } else {
                gameEvents.off('gameover', endGame);
                if (player) {
                    finalLifeSpan = player.getLifeSpan();
                    player.destroy();
                    player = null;
                    timeOfDeath = Date.now();
                    playCrashSound();
                    endText = "You survived " + finalLifeSpan + " seconds in winds of up to " + wind.getHighestWindSpeed() + "mph!";
                    var twitterText = "I survived " + finalLifeSpan + " seconds in winds of up to " + wind.getHighestWindSpeed() + "mph!";
                    var twitterButton = document.getElementById('twitBtn');
                    twitterButton.innerHTML = "";
                    twttr.widgets.createShareButton(
                        'http://www.kev-adsett.co.uk/js13k2014/src',
                        twitterButton,
                        {
                            text: twitterText,
                            hashtags: 'js13k, windRider'
                        }
                    );
                    toggleTwitterButton();
                    gameEvents.on('press', onGameOverPress);
                }
                if (wind) {
                    wind.destroy();
                    wind = null;
                }
                renderGameOver();
            }
        }

        function onGameOverPress(press) {
            if (press.x >= 600 && press.x < 725 && press.y >= 410 && press.y < 475) {
                restartGame();
            }
        }

        function update() {
            timeNow = Date.now();
            var dt = (timeNow - lastUpdateTime) / 1000;
            if (!gameOver) {
                gameTime = Math.round((Date.now() - startTime) / 1000);
                lastUpdateTime = timeNow;
                difficulty += dt;
                gameEvents.emit("update", {
                    dt: dt,
                    windVector: wind.getVector(),
                    difficulty: difficulty
                });
            } else {
                crashTime = Math.max(1 - (Date.now() - timeOfDeath) / 1000, 0);
            }
        }

        function renderGame() {
            canvas.width = canvas.width;
            context.font = "48px CourierNew, Courier, sans-serif";
            if (gameTime < 6) {
                context.fillStyle = gameTime % 2 === 0 ? '#000' : '#fff';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText("Avoid both sides!", 480, 270);
            }

            context.fillStyle = '#000';
            context.textAlign = 'left';
            context.textBaseline = 'top';
            context.fillText(gameTime, 10, 10);
            gameEvents.emit("render", context);
        }

        function renderGameOver() {
            var crashAmount = crashTime / 3 * 20;
            var xOffset = ((Math.random() * 2) - 1) * crashAmount,
                yOffset = ((Math.random() * 2) - 1) * crashAmount;
            canvas.width = canvas.width;
            context.font = "72px CourierNew, Courier, sans-serif";
            context.fillStyle = "#000000";
            context.textAlign = 'center';
            context.textBaseLine = 'middle';
            context.fillText("Game over", 480 + xOffset, 270 + yOffset);
            context.font = "20px CourierNew, Courier, sans-serif";
            context.fillText(endText, 480, 370);
            context.fillStyle = "#fff";
            context.fillRect(600, 410, 125, 65);
            context.fillStyle = "#000";
            context.fillText("Retry", 660, 450);
        }

        function setPixel(imageData, x, y, r, g, b, a) {
            var index = (x + y * imageData.width) * 4;
            imageData.data[index+0] = r;
            imageData.data[index+1] = g;
            imageData.data[index+2] = b;
            imageData.data[index+3] = a;
        }

        function playCrashSound() {
            var crash = document.getElementById('crash');
            crash.load();
            crash.play();
        }

        function toggleTwitterButton() {
            document.getElementById('twitBtn').classList.toggle('hidden');
        }

        animLoop();
    }

    return GameScene;
});