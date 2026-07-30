define(function(require) {
    var Vector = function(x, y) {
        this.x = x;
        this.y = y;
    };
    function pythag(a, b) {
        return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));
    }
    Vector.prototype = {
        add: function(vector) {
            this.x += vector.x;
            this.y += vector.y;
            return this;
        },
        subtract: function(vector) {
            this.x -= vector.x;
            this.y -= vector.y;
            return this;
        },
        mag: function() {
            return pythag(this.x, this.y);
        },
        scale: function(scalar) {
            this.x *= scalar;
            this.y *= scalar;
            return this;
        },
        normalise: function() {
            var biggest = Math.max(Math.abs(this.x), Math.abs(this.y));
            this.x /= biggest;
            this.y /= biggest;
            return this;
        },
        limit: function(limit) {
            if (typeof limit === 'number') {
                this.x = Math.min(limit, Math.max(-limit, this.x));
                this.y = Math.min(limit, Math.max(-limit, this.y));
            } else {
                this.x = Math.min(limit.hiX, Math.max(limit.loX, this.x));
                this.y = Math.min(limit.hiY, Math.max(limit.loY, this.y));
            }
        },
        getDist: function(vector) {
            var xDist = Math.abs(this.x - vector.x),
                yDist = Math.abs(this.y - vector.y);
            return pythag(xDist, yDist);
        },
        getAngle: function() {
            return Math.atan2(this.y, this.x);
        },
        getScaled: function(scalar) {
            return new Vector(this.x * scalar, this.y * scalar);
        },
        clone: function() {
            return new Vector(this.x, this.y);
        },
        toString: function() {
            return "Vector: [" + this.x + ", " + this.y + "]";
        }
    };
    Vector.fromPolar = function(radius, angle) {
        return new Vector(radius * Math.cos(angle), radius * Math.sin(angle));
    };
    Vector.dist = function(v1, v2) {
        return v1.getDist(v2);
    };
    window.Vector = Vector;
    return Vector;
});