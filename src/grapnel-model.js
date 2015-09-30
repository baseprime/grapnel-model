/****
 * Grapnel Collection
 * https://github.com/bytecipher/grapnel-model
 *
 * @author Greg Sabia Tucker <greg@bytecipher.io>
 * @link http://artificer.io
 * @version 0.1.0
 *
 * Released under MIT License. See LICENSE or http://opensource.org/licenses/MIT
 */

!(function(root) {
    "use strict";

    function Collection(attrs) {
        _util.merge(this, _events, attrs);
        this.collection = [];

        if (_util.isFunction(this.persist)) {
            this.adapter(this.persist);
        }

        if (this.url) {
            this.routerWithContext = this.router.context(this.url, this.middleware.oneOrMany(this));
            this.routerWithContext.get('/', this.middleware.getAll);
            this.routerWithContext.get('/:id', this.middleware.getOne);
            this.routerWithContext.post('/', this.middleware.create);
            this.routerWithContext.put('/:id', this.middleware.update);
        }

        if (_util.isFunction(this.initialize)) {
            this.initialize.call(this);
        }
    }

    function Instance() {
        return function(attributes) {
            this.attributes = _util.merge({}, this.constructor.defaults || {}, attributes || {});
            this.changes = {};
            this.errors = new ErrorHandler(this);
            this.uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

            _util.merge(this, _events, _util.modelContext(this))

            if (_util.isFunction(this.initialize)) this.initialize();
        }
    }

    Collection.prototype.middleware = {
        oneOrMany: function(Module) {
            return function(req, res, next) {
                req.class = Module;

                if (req.params.id) {
                    var query = {};

                    query[Module.unique_key] = req.params.id;

                    req.model = Module.find(query) || {};
                }

                next();
            }
        },
        getOne: function(req, res, next) {
            res.end(JSON.stringify(req.model.toJSON()));
        },
        getAll: function(req, res, next) {
            res.end(JSON.stringify(req.class.toJSON()));
        }
    }

    Collection.prototype.add = function(obj) {
        var self = this;

        if (obj instanceof self) {
            var model = obj;
        } else if (_util.isArray(obj)) {
            for (var key in obj) {
                self.add(obj[key]);
            }

            return this;
        } else {
            var model = new self(obj);
        }

        var id = model.id();

        if (_util.inArray(this.collection, model) === -1 && !(id && this.find(id))) {
            this.collection.push(model);
            this.trigger("add", [model]);
        }

        return this;
    }

    Collection.prototype.all = function() {
        return this.collection.slice();
    }

    Collection.prototype.chain = function(collection) {
        return _util.merge({}, this, {
            collection: collection || []
        });
    }

    Collection.prototype.count = function() {
        return this.all().length;
    }

    Collection.prototype.detect = function(iterator) {
        var all = this.all(),
            model;

        for (var i = 0, length = all.length; i < length; i++) {
            model = all[i]
            if (iterator.call(model, model, i)) return model
        }
    }

    Collection.prototype.each = function(iterator, context) {
        var all = this.all()

        for (var i = 0, length = all.length; i < length; i++) {
            iterator.call(context || all[i], all[i], i, all)
        }

        return this;
    }

    Collection.prototype.find = function(id) {
        return this.detect(function() {
            return this.id() == id;
        })
    }

    Collection.prototype.filter = function(fn) {
        return this.collection.filter(fn);
    }

    Collection.prototype.first = function() {
        return this.all()[0]
    }

    Collection.prototype.load = function(callback) {
        if (this._persist) {
            var self = this;

            this._persist.read(function(models) {
                for (var i = 0, length = models.length; i < length; i++) {
                    self.add(models[i]);
                }

                if (callback) callback.call(self, models);
            })
        }

        return this;
    }

    Collection.prototype.last = function() {
        var all = this.all();
        return all[all.length - 1]
    }

    Collection.prototype.map = function(func, context) {
        var all = this.all()
        var values = []

        for (var i = 0, length = all.length; i < length; i++) {
            values.push(func.call(context || all[i], all[i], i, all))
        }

        return values
    }

    Collection.prototype.adapter = function(adapter) {
        if (arguments.length == 0) {
            return this._persist;
        } else {
            var options = Array.prototype.slice.call(arguments, 1);
            options.unshift(this);
            this._persist = adapter.apply(this, options);
            return this;
        }
    }

    Collection.prototype.pluck = function(attribute) {
        var all = this.all()
        var plucked = []

        for (var i = 0, length = all.length; i < length; i++) {
            plucked.push(all[i].attr(attribute))
        }

        return plucked
    }

    Collection.prototype.remove = function(model) {
        var index

        for (var i = 0, length = this.collection.length; i < length; i++) {
            if (this.collection[i] === model) {
                index = i
                break
            }
        }

        if (index != undefined) {
            this.collection.splice(index, 1);
            this.trigger("remove", [model]);
            return true;
        } else {
            return false;
        }
    }

    Collection.prototype.reverse = function() {
        return this.chain(this.all().reverse())
    }

    Collection.prototype.select = function(func, context) {
        var all = this.all(),
            selected = [],
            model

        for (var i = 0, length = all.length; i < length; i++) {
            model = all[i]
            if (func.call(context || model, model, i, all)) selected.push(model)
        }

        return this.chain(selected);
    }

    Collection.prototype.sort = function(func) {
        var sorted = this.all().sort(func)
        return this.chain(sorted);
    }

    Collection.prototype.sortBy = function(attribute_or_func) {
        var is_func = _util.isFunction(attribute_or_func)
        var extract = function(model) {
            return attribute_or_func.call(model)
        }

        return this.sort(function(a, b) {
            var a_attr = is_func ? extract(a) : a.attr(attribute_or_func)
            var b_attr = is_func ? extract(b) : b.attr(attribute_or_func)

            if (a_attr < b_attr) {
                return -1
            } else if (a_attr > b_attr) {
                return 1
            } else {
                return 0
            }
        })
    }

    Collection.prototype.toJSON = function() {
        return this.map(function(model) {
            return model.attributes;
        });
    }

    Collection.prototype.use = function(plugin) {
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift(this);
        plugin.apply(this, args);

        return this;
    }

    Collection.prototype.extend = function(attrs) {
        var copy = _util.merge({}, this, attrs);

        return _util.merge(new Instance(), new Collection(copy));
    }

    Collection.prototype.merge = function(obj) {
        _util.merge(this, obj)
        return this
    }

    Collection.prototype.include = function(obj) {
        _util.merge(this.prototype, obj)
        return this
    }

    Collection.prototype.parent = function() {
        return this.prototype._parent || {};
    }

    function ErrorHandler(model) {
        this.errors = {};
        this.model = model;
    };

    ErrorHandler.prototype = {
        add: function(attribute, message) {
            if (!this.errors[attribute]) this.errors[attribute] = [];
            this.errors[attribute].push(message);
            return this
        },

        all: function() {
            return this.errors;
        },

        clear: function() {
            this.errors = {};
            return this
        },

        each: function(func) {
            for (var attribute in this.errors) {
                for (var i = 0; i < this.errors[attribute].length; i++) {
                    func.call(this, attribute, this.errors[attribute][i]);
                }
            }
            return this
        },

        on: function(attribute) {
            return this.errors[attribute] || [];
        },

        size: function() {
            var count = 0;
            this.each(function() {
                count++;
            });
            return count;
        }
    };

    //////////////////////////////

    var _util = {
        create: function(router) {
            return (new Collection()).extend({
                router: router
            });
        },
        modelContext: function(proto){
            return _util.merge(_instance_proto, { __proto__: proto });
        },
        merge: function(receiver) {
            var objs = Array.prototype.slice.call(arguments, 1);

            for (var i = 0, length = objs.length; i < length; i++) {
                for (var property in objs[i]) {
                    receiver[property] = objs[i][property];
                }
            }

            return receiver;
        },

        inArray: function(array, obj) {
            if (array.indexOf) return array.indexOf(obj);

            for (var i = 0, length = array.length; i < length; i++) {
                if (array[i] === obj) return i;
            }

            return -1;
        },

        isArray: function(arr) {
            return Array.isArray(arr);
        },

        isFunction: function(obj) {
            return Object.prototype.toString.call(obj) === "[object Function]";
        },

        isPlainObject: function(obj) {
            return Object.prototype.toString.call(obj) === '[object Object]';
        }
    }

    var _events = {
        bind: function(event, callback) {
            this.events = this.events || {};
            this.events[event] = this.events[event] || [];
            this.events[event].push(callback);

            return this;
        },
        trigger: function(name, data) {
            this.events = this.events || {};

            var events = this.events[name];

            if (events) {
                for (var i = 0; i < events.length; i++) {
                    events[i].apply(this, data || []);
                }
            }

            return this;
        },
        unbind: function(event, callback) {
            this.events = this.events || {};

            if (callback) {
                var events = this.events[event] || [];

                for (var i = 0; i < events.length; i++) {
                    if (events[i] === callback) {
                        this.events[event].splice(i, 1);
                    }
                }
            } else {
                delete this.events[event];
            }

            return this;
        },
        once: function(event, callback) {
            var ran = false;

            return this.bind(event, function() {
                if (ran) return false;
                ran = true;
                callback.apply(this, arguments);
                callback = null;
                return true;
            });
        }
    }

    var _instance_proto = {
        attr: function(name, value) {
            if (arguments.length === 0) {
                // Combined attributes/changes object.
                return _util.merge({}, this.attributes, this.changes);
            } else if (arguments.length === 2) {
                // Don't write to attributes yet, store in changes for now.
                if (this.attributes[name] === value) {
                    // Clean up any stale changes.
                    delete this.changes[name];
                } else {
                    this.changes[name] = value;
                }
                this.trigger("change:" + name, [this])
                return this;
            } else if (typeof name === "object") {
                // Mass-assign attributes.
                for (var key in name) {
                    this.attr(key, name[key]);
                }
                this.trigger("change", [this])
                return this;
            } else {
                // Changes take precedent over attributes.
                return (name in this.changes) ?
                    this.changes[name] :
                    this.attributes[name];
            }
        },

        callPersistMethod: function(method, callback) {
            var self = this;

            // Automatically manage adding and removing from the model's Collection.
            var manageCollection = function() {
                if (method === "destroy") {
                    self.constructor.remove(self)
                } else {
                    self.constructor.add(self)
                }
            };

            // Wrap the existing callback in this function so we always manage the
            // collection and trigger events from here rather than relying on the
            // persist adapter to do it for us. The persist adapter is
            // only required to execute the callback with a single argument - a
            // boolean to indicate whether the call was a success - though any
            // other arguments will also be forwarded to the original callback.
            function wrappedCallback(success) {
                if (success) {
                    // Merge any changes into attributes and clear changes.
                    self.merge(self.changes).reset();

                    // Add/remove from collection if persist was successful.
                    manageCollection();

                    // Trigger the event before executing the callback.
                    self.trigger(method);
                }

                // Store the return value of the callback.
                var value;

                // Run the supplied callback.
                if (callback) value = callback.apply(self, arguments);

                return value;
            };

            if (this.constructor._persist) {
                this.constructor._persist[method](this, wrappedCallback);
            } else {
                wrappedCallback.call(this, true);
            }
        },

        destroy: function(callback) {
            this.callPersistMethod("destroy", callback);
            return this;
        },

        id: function() {
            return this.attributes[this.constructor.unique_key];
        },

        merge: function(attributes) {
            _util.merge(this.attributes, attributes);
            return this;
        },

        isNew: function() {
            return this.id() === undefined
        },

        reset: function() {
            this.errors.clear();
            this.changes = {};
            return this;
        },

        save: function(callback) {
            if (this.valid()) {
                var method = this.isNew() ? "create" : "update";
                this.callPersistMethod(method, callback);
            } else if (callback) {
                callback(false);
            }

            return this;
        },

        toJSON: function() {
            return this.attr();
        },

        valid: function() {
            this.errors.clear();
            this.validate();
            return this.errors.size() === 0;
        },

        validate: function() {
            return this;
        }

    }

    _util.merge(_events, {
        on: _events.bind,
        off: _events.unbind
    });

    if ('function' === typeof root.define && !root.define.amd['grapnel-model']) {
        root.define(function(require, exports, module) {
            root.define.amd['grapnel-model'] = true;
            return _util.create;
        });
    } else if ('object' === typeof module && 'object' === typeof module.exports) {
        module.exports = exports = _util.create;
    } else {
        root._util.create = _util.create;
    }

}).call({}, ('object' === typeof window) ? window : this);
