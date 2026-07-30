define(function(require) {
    var Vector = require('vector');
        Wind = function() {
            this.windVector = new Vector(0, 0);
            this.angle = 0;
            this.speed = 0;
            this.size = 12;
            this.xScale = 0;
            this.highestWind = 0;
            gameEvents.on('update', this.update, this);
            gameEvents.on('render', this.render, this);
        };
    Wind.prototype = {
        update: function(data) {
            this.speed += ((Math.random() * 2) - 1);
            this.speed = Math.max(this.speed, 0);
            this.speed = Math.min(this.speed, data.difficulty);
            this.mph = Math.round(this.speed);
            if (this.highestWind < this.mph) {
                this.highestWind = this.mph;
            }
        },
        render: function(ctx) {
            context.font = "50px CourierNew, Courier, sans-serif";
            context.textAlign = "right";
            context.fillStyle = "#000000";
            ctx.fillText(this.mph + " MPH winds", 950, 50);
        },
        destroy: function() {
            gameEvents.off('update', this.update, this);
            gameEvents.off('render', this.render, this);
        },
        getVector: function() {
            return new Vector(-this.speed, 0);
        },
        getHighestWindSpeed: function() {
            return this.highestWind;
        }
    };
    return Wind;
});