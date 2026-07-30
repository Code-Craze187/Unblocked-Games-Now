define(function(require) {
    var Vector = require('vector');
    var Physics = function() {
        this.physicsObjects = [];
        gameEvents.on('update', this.update, this);
        gameEvents.on('registerPhysics', this.registerObject, this);
        gameEvents.on('destroy', this.removeObject, this);
        gameEvents.on('accelerate', this.addAcceleration, this);
    },
        friction = 0.9;

    Physics.prototype = {
        registerObject: function(object, x, y, startPhysics) {
            this.physicsObjects.push(object);
            object.velocity = startPhysics && startPhysics.velocity || new Vector(0, 0);
            object.acceleration = startPhysics && startPhysics.acceleration || new Vector(0, 0);
            object.position = new Vector(x, y);
        },
        removeObject: function(object) {
            var index = this.physicsObjects.indexOf(object);
            if (index > -1) {
                this.physicsObjects.splice(index, 1);
            }
        },
        update: function(data) {
            for (var i = 0; i < this.physicsObjects.length; i++) {
                this.updatePhysics(this.physicsObjects[i], data.windVector);
            }
        },
        updatePhysics: function(object, windVector) {
            var wind = new Vector(windVector.x, windVector.y);
            wind.scale(0.05);
            if (debug.wind) object.acceleration.add(wind);
            object.velocity.add(object.acceleration);
            object.acceleration = new Vector(0, 0);
            object.position.add(object.velocity);
            object.velocity.scale(friction);
        },
        addAcceleration: function(object, acceleration) {
            object.acceleration.add(acceleration);
        }
    };

    return Physics;
});