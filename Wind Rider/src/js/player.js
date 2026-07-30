define(function(require) {
    var Vector = require('vector'),
        gravity = new Vector(0, 0.1);
        Bike = require('bike');
        Player = function() {
            gameEvents.emit('registerPhysics', this, 480, 265);
            this.radius = 25;
            this.useRight = false;
            this.bike = new Bike(this.position.clone());
            bornTime = Date.now();
            if (debug.player) gameEvents.on('update', this.update, this);
            if (debug.player) gameEvents.on('render', this.render, this);
            if (debug.player) gameEvents.on('press', this.onPress, this);
            if (debug.player) gameEvents.on('keyup', this.onKeyUp, this);
        };
    Player.prototype = {
        update: function() {
            var edge = {
                left: -this.radius,
                right: canvas.width + this.radius
            };
            if (!debug.death) {
                if (this.position.x > edge.right) {
                    this.position.x = edge.left;
                } else if (this.position.x < edge.left) {
                    this.position.x = edge.right;
                }
            } else {
                if (this.position.x < edge.left || this.position.x > edge.right) {
                    gameEvents.emit('gameover');
                }
            }
            this.bike.update({
                position: this.position,
                velocity: this.velocity
            });
            this.useRight = (this.bike.rotation > (Math.PI / 2) * 3 || this.bike.rotation <= Math.PI / 2);
        },
        render: function(context) {
            context.save();
            context.font = "48px CourierNew, Courier, sans-serif";
            context.textBaseline = 'middle';
            if (this.useRight) {
                context.fillStyle = '#f00';
                context.textAlign = 'right';
                context.fillText("Tap right!", 890, 500);
            } else {
                context.fillStyle = '#0f0';
                context.textAlign = 'left';
                context.fillText("Tap left!", 50, 500);
            }
            context.restore();
        },
        onPress: function(press) {
            if ((this.useRight && press.x > 480) || (!this.useRight && press.x <= 480)) {
                this.accelerate();
            }
        },
        onKeyUp: function(key) {
            if ((this.useRight && key === 39) || (!this.useRight && key === 37)) {
                this.accelerate();
            }
        },
        accelerate: function() {
            gameEvents.emit('accelerate', this, new Vector(10,0));
        },
        getLifeSpan: function() {
            return Math.round((Date.now() - bornTime) / 1000);
        },
        destroy: function() {
            gameEvents.off('update', this.update, this);
            gameEvents.off('render', this.render, this);
            gameEvents.off('press', this.onPress, this);
        }
    };

    return Player;
});