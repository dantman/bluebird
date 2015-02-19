"use strict";
module.exports =
function(Promise, INTERNAL, tryConvertToPromise, apiRejection, debug) {
var util = require("./util.js");
var ASSERT = require("./assert.js");
var tryCatch = util.tryCatch;

Promise.method = function (fn) {
    if (typeof fn !== "function") {
        throw new Promise.TypeError(FUNCTION_ERROR + util.classString(fn));
    }
    return function () {
        var ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._pushContext();
        var value = tryCatch(fn).apply(this, arguments);
        ret._popContext();
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function (fn) {
    if (typeof fn !== "function") {
        return apiRejection(FUNCTION_ERROR + util.classString(fn));
    }
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._pushContext();
    var value;
    if (arguments.length > 1) {
        debug.deprecated("calling Promise.try with more than 1 argument");
        var arg = arguments[1];
        var ctx = arguments[2];
        value = util.isArray(arg) ? tryCatch(fn).apply(ctx, arg)
                                  : tryCatch(fn).call(ctx, arg);
    } else {
        value = tryCatch(fn)();
    }
    ret._popContext();
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.prototype._resolveFromSyncValue = function (value) {
    ASSERT(!this._isFollowing());
    if (value === util.errorObj) {
        this._rejectCallback(value.e, false);
    } else {
        this._resolveCallback(value, true);
    }
};
};
