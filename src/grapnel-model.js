/****
 * Grapnel Model
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
    }

    function Model() {
        return function(attributes) {
            this.attributes = _util.merge({}, this.constructor.defaults || {}, attributes || {});
            this.changes = {};
            this.errors = new ErrorHandler(this);
            this.uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

            _util.merge(this, _events, _util.modelContext(this));

            if (_util.isFunction(this.constructor.initialize)) this.constructor.initialize.call(this);
        }
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

    Collection.prototype.add = function(obj) {
        var self = this;

        if (obj.constructor === this) {
            var model = obj;
        } else if (_util.isArray(obj)) {
            for (var key in obj) {
                self.add(obj[key]);
            }

            return this;
        } else {
            var model = new self(obj);
        }

        var id = model.id(),
            exists = this.get(id);

        if (!exists) {
            this.collection.push(model);
            this.trigger('add', [model]);
        } else {
            exists.attr(model.attr());
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

    Collection.prototype.filter = function(iterator) {
        return this.collection.filter(iterator);
    }

    Collection.prototype.first = function() {
        return this.all()[0];
    }

    Collection.prototype.get = function(id) {
        return this.detect(function() {
            return this.id() == id;
        });
    }

    Collection.prototype.last = function() {
        var all = this.all();

        return all[all.length - 1];
    }

    Collection.prototype.load = function(callback) {
        if (this._persist && this._persist.read) {
            var self = this;

            this._persist.read(function(models) {
                for (var i = 0, length = models.length; i < length; i++) {
                    self.add(models[i]);
                }

                if (callback) callback.call(self, models);
            });
        }

        return this;
    }

    Collection.prototype.map = function(func, context) {
        var all = this.all();
        var values = [];

        for (var i = 0, length = all.length; i < length; i++) {
            values.push(func.call(context || all[i], all[i], i, all));
        }

        return values;
    }

    Collection.prototype.detailroute = function() {
        return [this.path, '/:', this.unique_key].reduce(function(left, right) {
            return ((left.lastIndexOf('/') === left.length - 1) ? left.substr(0, left.length - 1) : left) + right;
        });
    }

    Collection.prototype.depth = function() {
        var paths = {
                list: {},
                detail: {}
            },
            depth = 0,
            context = this.parent();

        if (!this.path || this.path === context.path) return false;

        while (context) {
            var parentPath = context.depth();

            if (parentPath) {
                _util.merge(paths, parentPath);
                depth++;
            }

            context = context.parent();
        }

        return paths;
    }

    Collection.prototype.pluck = function(attribute) {
        var all = this.all(),
            plucked = [];

        for (var i = 0, length = all.length; i < length; i++) {
            plucked.push(all[i].attr(attribute));
        }

        return plucked;
    }

    Collection.prototype.remove = function(model) {
        var index;

        for (var i = 0, length = this.collection.length; i < length; i++) {
            if (this.collection[i] === model) {
                index = i;
                break;
            }
        }

        if (index !== undefined) {
            this.collection.splice(index, 1);
            this.trigger('remove', [model]);

            return true;
        } else {
            return false;
        }
    }

    Collection.prototype.reverse = function() {
        return this.chain(this.all().reverse());
    }

    Collection.prototype.select = function(fn, context) {
        var all = this.all(),
            selected = [],
            model;

        for (var i = 0, length = all.length; i < length; i++) {
            model = all[i];
            if (fn.call(context || model, model, i, all)) selected.push(model);
        }

        return this.chain(selected);
    }

    Collection.prototype.sort = function(fn) {
        var sorted = this.all().sort(fn);

        return this.chain(sorted);
    }

    Collection.prototype.sortBy = function(attribute_or_func) {
        var is_func = _util.isFunction(attribute_or_func);
        var extract = function(model) {
            return attribute_or_func.call(model);
        }

        return this.sort(function(a, b) {
            var a_attr = is_func ? extract(a) : a.attr(attribute_or_func),
                b_attr = is_func ? extract(b) : b.attr(attribute_or_func);

            if (a_attr < b_attr) {
                return -1;
            } else if (a_attr > b_attr) {
                return 1;
            } else {
                return 0;
            }
        });
    }

    Collection.prototype.toJSON = function() {
        return this.map(function(model) {
            return model.toJSON();
        });
    }

    Collection.prototype.unique_key = 'id';

    Collection.prototype.use = function(plugin) {
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift(this);
        plugin.apply(this, args);

        return this;
    }

    Collection.prototype.extend = function(attrs) {
        var copy = _util.merge({}, this, attrs),
            Extended = _util.merge(new Model(), new Collection(copy));

        return Extended.use(_watcher(this));
    }

    Collection.prototype.merge = function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(this);

        return _util.merge.apply(this, args);
    }

    Collection.prototype.include = function(obj) {
        _util.merge(this.prototype, obj);

        return this;
    }

    Collection.prototype.parent = function() {
        return this._parent;
    }

    function ErrorHandler(model) {
        this.errors = {};
        this.model = model;
    };

    ErrorHandler.prototype = {
        add: function(attribute, message) {
            if (!this.errors[attribute]) this.errors[attribute] = [];
            this.errors[attribute].push(message);
            return this;
        },
        all: function() {
            return this.errors;
        },
        clear: function() {
            this.errors = {};
            return this;
        },
        each: function(fn) {
            for (var attribute in this.errors) {
                for (var i = 0; i < this.errors[attribute].length; i++) {
                    fn.call(this, attribute, this.errors[attribute][i]);
                }
            }
            return this;
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

    var _util = {
        modelContext: function(proto) {
            return _util.merge(_model_proto, {
                __proto__: proto
            });
        },
        merge: function(receiver) {
            var args = Array.prototype.slice.call(arguments, 1);

            for (var i = 0, length = args.length; i < length; i++) {
                for (var property in args[i]) {
                    receiver[property] = args[i][property];
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
            return Object.prototype.toString.call(obj) === '[object Function]';
        },
        isPlainObject: function(obj) {
            return Object.prototype.toString.call(obj) === '[object Object]';
        }
    }

    var _events = {
        on: function(event, callback) {
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
        off: function(event, callback) {
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

            return this.on(event, function() {
                if (ran) return false;
                ran = true;
                callback.apply(this, arguments);
                callback = null;
                return true;
            });
        }
    }

    var _watcher = function(context) {
        return function() {
            this._parent = context;
            var self = this;

            if (_util.isFunction(this.persist)) {
                this.adapter(this.persist);
            }

            if (this.path) {

                this.contextRouter = this.parent().contextRouter || this.router.context(this.path, function(req, res, next) {
                    req.collection = self;
                    next();
                });

                var addRoute = function(path, handler, method) {
                    if (Module.middleware.hasOwnProperty(handler)) {
                        self.contextRouter[method || 'get'](path, Module.middleware[handler]);
                    }
                }

                for (var path in this.routes) {
                    if (_util.isPlainObject(this.routes[path])) {
                        for (var method in this.routes[path]) {
                            addRoute(path, this.routes[path][method], method);
                        }
                    } else {
                        addRoute(path, this.routes[path]);
                    }
                }

            }

        }
    }

    var _model_proto = {
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

                this.trigger('change:' + name, [this]);

                return this;
            } else if (typeof name === 'object') {
                // Mass-assign attributes.
                for (var key in name) {
                    this.attr(key, name[key]);
                }

                this.trigger('change', [this]);

                return this;
            } else {
                // Changes take precedent over attributes.
                return (name in this.changes) ? this.changes[name] : this.attributes[name];
            }
        },
        callPersistMethod: function(method, callback) {
            var self = this;

            // Automatically manage adding and removing from the model's Collection.
            var manageCollection = function() {
                if (method === 'destroy') {
                    self.constructor.remove(self)
                } else {
                    self.constructor.add(self)
                }
            };

            /****
             * Wrap the existing callback in this function so we always manage the
             * collection and trigger events from here rather than relying on the
             * persist adapter to do it for us. The persist adapter is
             * only required to execute the callback with a single argument - a
             * boolean to indicate whether the call was a success - though any
             * other arguments will also be forwarded to the original callback.
             */
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
            this.callPersistMethod('destroy', callback);
            return this;
        },
        id: function() {
            return this.attributes[this.constructor.unique_key];
        },
        merge: function(attributes) {
            _util.merge(this.attributes, attributes);

            return this;
        },
        get: function(prop) {
            return this.attr.call(this, prop);
        },
        set: function(prop, value) {
            return this.attr.call(this, prop, value);
        },
        isNew: function() {
            return this.id() === undefined;
        },
        pick: function(keys) {
            var result = {},
                attrs = this.attr();

            for (var prop in keys) {
                var key = keys[prop];
                result[key] = attrs[key];
            }

            return result;
        },
        reset: function() {
            this.errors.clear();
            this.changes = {};

            return this;
        },
        save: function(callback) {
            if (this.valid()) {
                var method = (this.isNew()) ? 'create' : 'update';
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

    function Module(router){
        return (new Collection()).extend({
            router: router
        });
    }

    Module.middleware = {
        index: function(req, res, next) {
            res.statusCode = 200;
            res.end(JSON.stringify(req.collection.toJSON()));
        },
        details: function(req, res, next) {
            var model = req.collection.get(req.params.id);

            if (model) {
                res.statusCode = 200;
                res.end(JSON.stringify(model.toJSON()));
            } else {
                Module.middleware.notfound(req, res, next);
            }
        },
        create: function(req, res, next) {
            var Model = req.collection,
                model = new Model(req.body).save();

            res.statusCode = 201;
            res.end(JSON.stringify(model.toJSON()));
        },
        update: function(req, res, next) {
            var model = req.collection.get(req.params.id);

            if (model) {
                model.attr(req.body).save();
                res.statusCode = 204;
                res.end(JSON.stringify(model.toJSON()));
            } else {
                Module.middleware.notfound(req, res, next);
            }
        },
        notfound: function(req, res, next) {
            res.statusCode = 404;
            res.end(JSON.stringify({
                error: true,
                message: 'Cannot find resource'
            }));
        }
    }

    if ('function' === typeof root.define && !root.define.amd['grapnel-model']) {
        root.define(function(require, exports, module) {
            root.define.amd['grapnel-model'] = true;
            return Module;
        });
    } else if ('object' === typeof module && 'object' === typeof module.exports) {
        module.exports = exports = Module;
    } else {
        root.Model = Module;
    }

}).call({}, ('object' === typeof window) ? window : this);
