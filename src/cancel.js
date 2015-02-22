"use strict";
module.exports = function(Promise, apiRejection, debug) {
var ASSERT = require("./assert.js");
var util = require("./util.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var async = Promise._async;

Promise.prototype._cancel = function() {
    if (!this.isCancellable()) return;
    ASSERT(!this._isFollowing());
    this._setCancelled();
    this._cleanValues();
    if (this._length() > 0) {
        async.invoke(this._cancelPromises, this, undefined);
    }
};

Promise.prototype._cancelPromises = function() {
    if (this._length() > 0) this._settlePromises();
};

Promise.prototype._unsetOnCancel = function() {
    ASSERT(this.isCancellable() || this.isCancelled());
    this._settledValue = undefined;
};

Promise.prototype._setOnCancel = function(onCancel) {
    ASSERT(this.isCancellable());
    this._settledValue = onCancel;
};

Promise.prototype._onCancel = function() {
    ASSERT(this.isCancellable());
    return this._settledValue;
};

Promise.prototype.isCancellable = function() {
    return this.isPending() && !this.isCancelled();
};

Promise.prototype._attachCancellationCallback = function(onCancel, ctx) {
    if (!this.isCancellable()) {
        if (this.isCancelled()) {
            async.invoke(this._invokeOnCancel, this, onCancel);
        }
        return this;
    }
    var target = this._target();
    if (target._onCancel() !== undefined) {
        var newOnCancel = onCancel;
        var oldOnCancel = target._onCancel();
        if (ctx === undefined) ctx = this;
        onCancel = function() {
            ctx._invokeOnCancel(oldOnCancel);
            ctx._invokeOnCancel(newOnCancel);
            target._unsetOnCancel();
        };
    }
    target._setOnCancel(onCancel);
};

Promise.prototype.onCancel = function(onCancel) {
    if (typeof onCancel !== "function") {
        return apiRejection("onCancel must be a function, got: "
            + util.toString(onCancel));
    }
    this._attachCancellationCallback(onCancel);
    return this;
};

Promise.prototype._doInvokeOnCancel = function(callback) {
    if (callback !== undefined) {
        if (typeof callback === "function") {
            var e = tryCatch(callback).call(this._boundTo);
            if (e === errorObj) {
                this._attachExtraTrace(e.e);
                async.throwLater(e.e);
            }
        } else if (callback instanceof Promise) {
            callback.cancel();
        } else {
            callback._resultCancelled(this);
        }
        this._unsetOnCancel();
    }
};

Promise.prototype._invokeOnCancel = function(callback) {
    async.invoke(this._doInvokeOnCancel, this, callback);
};

Promise.prototype.cancelAfter = function(ms) {
    var self = this;
    setTimeout(function() {
        self.cancel();
    }, ms);
};

Promise.prototype["break"] = Promise.prototype.cancel = function() {
    if (!debug.cancellation()) return this._warn("cancellation is disabled");

    var promise = this;
    while (promise.isCancellable()) {
        promise._invokeOnCancel(promise._onCancel());
        var parent = promise._cancellationParent;
        if (parent == null || !parent.isCancellable()) {
            if (promise._isFollowing()) {
                promise._followee().cancel();
            } else {
                promise._cancel();
            }
            break;
        } else {
            if (promise._isFollowing()) promise._followee().cancel();
            promise = parent;
        }
    }
};

};
