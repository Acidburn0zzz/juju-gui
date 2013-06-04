/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012-2013 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

var spinner;

/**
 * Provide the main App class, based on the YUI App framework. Also provide
 * the routing definitions, which map the request paths to the top-level
 * views defined by the App class.
 *
 * @module app
 */

// Create a global for debug console access to YUI context.
var yui;

YUI.add('juju-gui', function(Y) {

  // Assign the global for console access.
  yui = Y;

  var juju = Y.namespace('juju'),
      models = Y.namespace('juju.models'),
      views = Y.namespace('juju.views');

  /**
   * The main app class.
   *
   * @class App
   */
  var JujuGUI = Y.Base.create('juju-gui', Y.App, [
                                                  Y.juju.SubAppRegistration,
                                                  Y.juju.NSRouter], {

    /*
      Extension properties
    */
    subApplications: [],

    defaultNamespace: 'charmstore',
    /*
      End extension properties
    */

    /**
     * Views
     *
     * The views encapsulate the functionality blocks that output
     * the GUI pages. The "parent" attribute defines the hierarchy.
     *
     * @attribute views
     */
    views: {

      login: {
        type: 'juju.views.login',
        preserve: false
      },

      environment: {
        type: 'juju.views.environment',
        preserve: true
      },

      service: {
        type: 'juju.views.service',
        preserve: false,
        parent: 'environment'
      },

      service_config: {
        type: 'juju.views.service_config',
        preserve: false,
        parent: 'service'
      },

      service_constraints: {
        type: 'juju.views.service_constraints',
        preserve: false,
        parent: 'service'
      },

      service_relations: {
        type: 'juju.views.service_relations',
        preserve: false,
        parent: 'service'
      },

      unit: {
        type: 'juju.views.unit',
        preserve: false,
        parent: 'service'
      },

      charm_collection: {
        type: 'juju.views.charm_collection',
        preserve: false,
        parent: 'environment'
      },

      charm: {
        type: 'juju.views.charm',
        preserve: false,
        parent: 'charm_collection'
      },

      notifications: {
        type: 'juju.views.NotificationsView',
        preserve: true
      },

      notifications_overview: {
        type: 'juju.views.NotificationsOverview'
      }

    },

    /**
     * Declarative keybindings on the window object.
     *
     * Prefix supported are:
     *   C - Control
     *   A - Alt
     *   S - Shift
     *
     * Followed by a lowercase letter. For example
     *
     * A-s is the 'Alt + s' keybinding.
     *
     * This maps to an object which has the following behavior.
     *
     * target: {String} CSS selector of one element
     * focus: {Boolean} Focus the element.
     * toggle: {Boolean} Toggle element visibility.
     * fire: {String} Event to fire when triggered. (XXX: Target is topology)
     * condition: {Function} returns Boolean, should method be added to
     *            keybindings.
     * callback: {Function} Taking (event, target).
     * help: {String} Help text to display in popup.
     *
     * All are optional.
     */
    keybindings: {
      'A-s': {
        target: '#charm-search-field',
        focus: true,
        help: 'Select the charm Search'
      },
      '/': {
        target: '#charm-search-field',
        focus: true,
        help: 'Select the charm Search'
      },
      'S-/': {
        target: '#shortcut-help',
        toggle: true,
        callback: function(evt, target) {
          // This could be its own view.
          if (target && !target.getHTML().length) {
            var bindings = [];
            Y.each(this.keybindings, function(v, k) {
              if (v.help && (v.condition === undefined ||
                             v.condition.call(this) === true)) {
                // TODO: translate keybindings to
                // human <Alt> m
                // <Control> <Shift> N (note caps)
                // also 'g then i' style
                bindings.push({key: k, help: v.help});
              }
            }, this);
            target.setHTML(
                views.Templates.shortcuts({bindings: bindings}));
          }
        },
        help: 'Display this help'
      },
      'A-e': {
        callback: function(evt) {
          this.fire('navigateTo', { url: '/:gui:/' });
        },
        help: 'Navigate to the Environment overview.'
      },
      'S-+': {
        fire: 'zoom_in',
        help: 'Zoom In'
      },
      'S--': {
        fire: 'zoom_out',
        help: 'Zoom Out'
      },
      'S-0': {
        fire: 'panToCenter',
        help: 'Center the Environment overview'
      },
      'esc': {
        fire: 'clearState',
        callback: function() {
          // Explicitly hide anything we might care about.
          Y.one('#shortcut-help').hide();
        },
        help: 'Cancel current action'
      },

      'C-s': {
        'condition': function() {
          return this._simulator !== undefined;
        },
        callback: function() {
          this._simulator.toggle();
        },
        help: 'Toggle the simulator'
      },

      'S-d': {
        callback: function(evt) {
          this.env.exportEnvironment(function(r) {
            var exportData = JSON.stringify(r.result, undefined, 2);
            var exportBlob = new Blob([exportData],
                                      {type: 'application/json;charset=utf-8'});
            saveAs(exportBlob, 'export.json');
          });
        },
        help: 'Export the environment'
      },

      'C-S-d': {
        callback: function(evt) {
          Y.fire('saveWebsocketLog');
        },
        help: 'Save the websocket log to a file'
      }


    },

    /**
     * Data driven behaviors.
     *
     * Placeholder for real behaviors associated with DOM Node data-*
     * attributes.
     *
     * @attribute behaviors
     */
    behaviors: {
      timestamp: {
        /**
         * Wait for the DOM to be built before rendering timestamps.
         *
         * @method behaviors.timestamp.callback
         */
        callback: function() {
          var self = this;
          Y.later(6000, this, function(o) {
            Y.one('body')
              .all('[data-timestamp]')
              .each(function(node) {
                  node.setHTML(views.humanizeTimestamp(
                      node.getAttribute('data-timestamp')));
                });
          }, [], true);}
      }
    },

    /**
     * Activate the keyboard listeners. Only called by the main index.html,
     * not by the tests' one.
     *
     * @method activateHotkeys
     */
    activateHotkeys: function() {
      var key_map = {
        '/': 191, '?': 63, '+': 187, '-': 189,
        enter: 13, esc: 27, backspace: 8,
        tab: 9, pageup: 33, pagedown: 34};
      var code_map = {};
      Y.each(key_map, function(v, k) {
        code_map[v] = k;
      });
      this._keybindings = Y.one(window).on('keydown', function(evt) {
        //Normalize key-code
        var source = evt.target.getDOMNode();
        // Target filtering, we want to listen on window
        // but not honor hotkeys when focused on
        // text oriented input fields
        if (['INPUT', 'TEXTAREA'].indexOf(source.tagName) !== -1) {
          return;
        }
        var symbolic = [];
        if (evt.ctrlKey) { symbolic.push('C');}
        if (evt.altKey) { symbolic.push('A');}
        if (evt.shiftKey) { symbolic.push('S');}
        if (code_map[evt.keyCode]) {
          symbolic.push(code_map[evt.which]);
        } else {
          symbolic.push(String.fromCharCode(evt.which).toLowerCase());
        }
        var trigger = symbolic.join('-');
        var spec = this.keybindings[trigger];
        if (spec) {
          if (spec.condition && !spec.condition.call(this)) {
            // Note that when a condition check fails,
            // the event still propagates.
            return;
          }
          var target = Y.one(spec.target);
          if (target) {
            if (spec.toggle) { target.toggleView(); }
            if (spec.focus) { target.focus(); }
          }
          if (spec.callback) { spec.callback.call(this, evt, target); }
          // HACK w/o context/view restriction but right direction
          if (spec.fire) {
            this.views.environment.instance.topo.fire(spec.fire);
          }
          // If we handled the event nothing else has to.
          evt.stopPropagation();
          evt.preventDefault();
        }
      }, this);
    },

    /**
     * @method initializer
     * @param {Object} cfg Application configuration data.
     */
    initializer: function(cfg) {
      // If no cfg is passed in, use a default empty object so we don't blow up
      // getting at things.
      cfg = cfg || {};
      // If this flag is true, start the application with the console activated.
      var consoleEnabled = this.get('consoleEnabled');

      // Concession to testing, they need muck with console, we cannot as well.
      if (window.mochaPhantomJS === undefined) {
        if (consoleEnabled) {
          consoleManager.native();
        } else {
          consoleManager.noop();
        }
      }

      // XXX: #1185002 the charm browser subapp feature flag needs to be
      // removed
      if (window.flags.browser_enabled) {
        this.subApplications.push({
          type: Y.juju.subapps.Browser,
          config: {}
        });
      }

      if (window.flags.websocket_capture) {
        this.websocketLogging = new Y.juju.WebsocketLogging();
      }

      this.renderEnvironment = true;
      // If this property has a value other than '/' then
      // navigate to it after logging in.
      this.redirectPath = '/';

      // This attribute is used by the namespaced URL tracker.
      // _routeSeen is part of a mechanism to prevent non-namespaced routes
      // from being processed multiple times when multiple namespaces are
      // present in the URL.  The data structure is reset for each URL (in
      // _dispatch).  It holds a mapping between route callback uids and a
      // flag to indicate that the callback has been used.
      this._routeSeen = {};

      // Create a client side database to store state.
      this.db = new models.Database();

      // Optional Landscape integration helper.
      this.landscape = new views.Landscape();
      this.landscape.set('db', this.db);

      // Set up a new modelController instance.
      this.modelController = new juju.ModelController({
        db: this.db
      });

      // Update the on-screen environment name provided in the configuration,
      // or a default if none is configured.
      var environment_name = this.get('environment_name') || 'Environment',
          environment_node = Y.one('#environment-name');

      // Some tests do not fully populate the DOM, so we check to be sure.
      if (Y.Lang.isValue(environment_node)) {
        environment_node.set('text', environment_name);
      }
      // Create a charm store.
      if (this.get('charm_store')) {
        // This path is for tests.
        this.charm_store = this.get('charm_store');
      } else {
        this.charm_store = new juju.CharmStore({
          datasource: this.get('charm_store_url')});
      }
      // Create an environment facade to interact with.
      // Allow "env" as an attribute/option to ease testing.
      if (this.get('env')) {
        this.env = this.get('env');
      } else {
        // Calculate the socket_url.
        var socketUrl = this.get('socket_url');
        var socketPort = this.get('socket_port');
        var socketProtocol = this.get('socket_protocol');
        if (socketPort || socketProtocol) {
          // Assemble a socket URL from the Location.
          var loc = Y.getLocation();
          socketPort = socketPort || loc.port;
          socketProtocol = socketProtocol || 'wss';
          socketUrl = socketProtocol + '://' + loc.hostname;
          if (socketPort) {
            socketUrl += ':' + socketPort;
          }
          socketUrl += '/ws';
          this.set('socket_url', socketUrl);
        }
        // Instantiate the environment specified in the configuration, choosing
        // between the available implementations, currently Go and Python.
        var envOptions = {
          socket_url: socketUrl,
          user: this.get('user'),
          password: this.get('password'),
          readOnly: this.get('readOnly'),
          conn: this.get('conn')
        };
        var apiBackend = this.get('apiBackend');
        // The sandbox mode does not support the Go API (yet?).
        if (this.get('sandbox') && apiBackend === 'python') {
          var sandboxModule = Y.namespace('juju.environments.sandbox');
          var State = Y.namespace('juju.environments').FakeBackend;
          var state = new State({charmStore: this.charm_store});
          if (envOptions.user && envOptions.password) {
            var credentials = {};
            credentials[envOptions.user] = envOptions.password;
            state.set('authorizedUsers', credentials);
          }
          envOptions.conn = new sandboxModule.ClientConnection(
              {juju: new sandboxModule.PyJujuAPI({state: state})});
        }
        this.env = juju.newEnvironment(envOptions, apiBackend);
      }

      // Create an event simulator where possible.
      // Starting the simulator is handled by hotkeys
      // and/or the config setting 'simulateEvents'.
      this.simulateEvents();

      // Set the env in the model controller here so
      // that we know that it's been setup.
      this.modelController.set('env', this.env);

      // Create notifications controller
      this.notifications = new juju.NotificationController({
        app: this,
        env: this.env,
        notifications: this.db.notifications});

      this.on('*:navigateTo', function(e) {
        this.navigate(e.url);
      }, this);

      // Notify user attempts to modify the environment without permission.
      this.env.on('permissionDenied', this.onEnvPermissionDenied, this);

      // When the provider type and environment names become available,
      // display them.
      this.env.after('providerTypeChange', this.onProviderTypeChange, this);
      this.env.after('environmentNameChange',
          this.onEnvironmentNameChange, this);

      // Once the user logs in, we need to redraw.
      this.env.after('login', this.onLogin, this);

      // Feed environment changes directly into the database.
      this.env.on('delta', this.db.onDelta, this.db);

      // Feed delta changes to the notifications system.
      this.env.on('delta', this.notifications.generate_notices,
          this.notifications);

      // Handlers for adding and removing services to the service list.
      this.endpointsController = new juju.EndpointsController({
        db: this.db,
        modelController: this.modelController
      });
      this.endpointsController.bind();

      // When the connection resets, reset the db, re-login (a delta will
      // arrive with successful authentication), and redispatch.
      this.env.after('connectedChange', function(ev) {
        if (ev.newVal === true) {
          this.db.reset();
          this.env.userIsAuthenticated = false;
          // Do not attempt environment login without credentials.
          var credentials = this.env.getCredentials();
          if (credentials && credentials.areAvailable) {
            this.env.login();
          } else {
            this.checkUserCredentials();
          }
        }
      }, this);

      // If the database updates, redraw the view (distinct from model updates).
      // TODO: bound views will automatically update this on individual models.
      this.db.on('update', this.on_database_changed, this);

      this.enableBehaviors();

      this.once('ready', function(e) {
        if (this.get('socket_url') || this.get('sandbox')) {
          // Connect to the environment.
          this.env.connect();
        }
        if (this.get('activeView')) {
          this.get('activeView').render();
        } else {
          this.dispatch();
        }
      }, this);

      // Create the CharmPanel instance once the app is initialized.
      this.charmPanel = views.CharmPanel.getInstance({
        charm_store: this.charm_store,
        env: this.env,
        app: this
      });
      this.charmPanel.setDefaultSeries(this.env.get('defaultSeries'));
      this.env.after('defaultSeriesChange', Y.bind(function(ev) {
        this.charmPanel.setDefaultSeries(ev.newVal);
      }, this));

      // Halt the default navigation on the juju logo to allow us to show
      // the real root view without namespaces
      var navNode = Y.one('#nav-brand-env');
      // Tests won't have this node.
      if (navNode) {
        navNode.on('click', function(e) {
          e.halt();
          this.showRootView();
        }, this);
      }

      Y.one('#logout-trigger').on('click', this.logout, this);

      // Attach SubApplications. The subapps should share the same db.
      cfg.db = this.db;
      cfg.deploy = this.charmPanel.deploy;
      this.addSubApplications(cfg);
    },

    /**
    Start the simulator if it can start and it has not already been started.

    @method simulateEvents
    */
    simulateEvents: function() {
      if (!this._simulator && this.env) {
        // Try/Catch this to allow mocks in tests.
        try {
          var conn = this.env.get('conn');
          var juju = conn && conn.get('juju');
          var state = juju && juju.get('state');
          if (state) {
            var Simulator = Y.namespace('juju.environments').Simulator;
            this._simulator = new Simulator({state: state});
            if (this.get('simulateEvents')) {
              this._simulator.start();
            }
          }
        }
        catch (err) {
          // Unable to create simulator, usually due to mocks or an
          // unsupported environment
          console.log('Unable to create simulator: ', err);
        }
      }
    },

    /**
    Release resources and inform subcomponents to do the same.

    @method destructor
    */
    destructor: function() {
      if (this._keybindings) {
        this._keybindings.detach();
      }
      if (this._simulator) {
        this._simulator.stop();
      }
      Y.each(
          [this.env, this.db, this.charm_store, this.notifications,
           this.landscape, this.endpointsController],
          function(o) {
            if (o && o.destroy) {
              o.destroy();
            }
          }
      );
    },

    /**
     * Hook up all of the declared behaviors.
     *
     * @method enableBehaviors
     */
    enableBehaviors: function() {
      Y.each(this.behaviors, function(behavior) {
        behavior.callback.call(this);
      }, this);

    },

    /**
     * On database changes update the view.
     *
     * @method on_database_changed
     */
    on_database_changed: function(evt) {
      Y.log(evt, 'debug', 'App: Database changed');
      // Database changed event is fired when the user logs-in but we deal with
      // that case manually so we don't need to dispatch the whole application.
      // This whole handler can be removed once we go to model bound views.
      if (window.location.pathname.match(/login/)) {
        return;
      }

      // This timeout helps to reduce the number of needless dispatches from
      // upwards of 8 to 2. At least until we can move to the model bound views.
      if (this.dbChangedTimer) {
        this.dbChangedTimer.cancel();
      }
      this.dbChangedTimer = Y.later(100, this, this._dbChangedHandler);
      return;
    },

    /**
      After the db has changed and the timer has timed out to reduce repeat
      calls then this is called to handle the db updates.

      @method _dbChangedHandler
      @private
    */
    _dbChangedHandler: function() {
      var active = this.get('activeView');

      // Update Landscape annotations.
      this.landscape.update();

      // Regardless of which view we are rendering,
      // update the env view on db change.
      if (this.views.environment.instance) {
        this.views.environment.instance.topo.update();
      }
      // Redispatch to current view to update.
      if (active && active.name === 'EnvironmentView') {
        active.rendered();
      } else {
        this.dispatch();
      }
    },

    // Route handlers

    /**
     * @method show_unit
     */
    show_unit: function(req) {
      // This replacement honors service names that have a hyphen in them.
      var unitId = req.params.id.replace(/^(\S+)-(\d+)$/, '$1/$2');
      var serviceId = unitId.split('/')[0];
      var self = this,
          options = {
            getModelURL: Y.bind(this.getModelURL, this),
            db: this.db,
            env: this.env,
            querystring: req.query,
            landscape: this.landscape,
            nsRouter: this.nsRouter
          };
      // Give the page 100 milliseconds to try and load the model
      // before we show a loading screen.
      var handle = setTimeout(function() {
        self.showView('unit', options);
      }, 100);

      var promise = this.modelController.getService(serviceId);
      promise.then(
          // If there is a service available then we need to check if the unit
          // is available.
          function(models) {
            clearTimeout(handle);
            var unit = self.db.units.getById(unitId);
            if (unit) {
              options.unit = unit;
              self.showView('unit', options);
            } else {
              // If there is no unit available in this service then we show
              // a notification and then redirect to the service.
              self.db.notifications.add(
                  new Y.juju.models.Notification({
                    title: 'Unit is not available',
                    message: 'The unit you are trying to view does not exist',
                    level: 'error'
                  })
              );
              self.navigate(self.nsRouter.url(
                  {gui: '/service/' + serviceId}));
            }
          },
          // If there is no service available then there definitely is no unit
          // available, so we create a notification and redirect the user to
          // the environment view.
          function() {
            clearTimeout(handle);
            self.db.notifications.add(
                new Y.juju.models.Notification({
                  title: 'Service is not available',
                  message: 'The service you are trying to view does not exist',
                  level: 'error'
                })
            );
            self.navigate(self.nsRouter.url({gui: '/'}));
          });
    },

    /**
     * @method _buildServiceView
     * @private
     */
    _buildServiceView: function(req, viewName) {
      var self = this,
          options = {
            db: this.db,
            env: this.env,
            landscape: this.landscape,
            getModelURL: Y.bind(self.getModelURL, this),
            nsRouter: this.nsRouter,
            querystring: req.query
          };
      var containerAttached = function(view) {
        // containerAttached handles attaching things like the textarea
        // autosizer after the views have rendered and the view's container
        // has attached to the DOM.
        if (view.containerAttached) {
          view.containerAttached();
        }
      };
      // Give the page 100 milliseconds to try and load the model
      // before we show a loading screen.
      var handle = setTimeout(function() {
        self.showView(viewName, options, containerAttached);
      }, 100);

      var promise = this.modelController.getServiceWithCharm(req.params.id);
      promise.then(
          function(models) {
            clearTimeout(handle);
            options.model = models.service;
            // Calling update allows showView to be called multiple times but
            // only have its config updated, not re-rendered.
            self.showView(
                viewName, options, { update: true }, containerAttached);
          },
          function() {
            clearTimeout(handle);
            self.showView(viewName, options, { update: true },
                function(view) {
                  // At this point the service view could be in loading state
                  // or showing details, but the service has become unavailable
                  // or was never available. This calls a method on the view to
                  // redirect to the environment and to create a notification.
                  if (typeof view.noServiceAvailable === 'function') {
                    view.noServiceAvailable();
                  }
                });
          });
    },

    /**
     * @method show_service
     */
    show_service: function(req) {
      this._buildServiceView(req, 'service');
    },

    /**
     * @method show_service_config
     */
    show_service_config: function(req) {
      this._buildServiceView(req, 'service_config');
    },

    /**
     * @method show_service_relations
     */
    show_service_relations: function(req) {
      this._buildServiceView(req, 'service_relations');
    },

    /**
     * @method show_service_constraints
     */
    show_service_constraints: function(req) {
      this._buildServiceView(req, 'service_constraints');
    },

    /**
     * @method show_charm_collection
     */
    show_charm_collection: function(req) {
      this.showView('charm_collection', {
        query: req.query.q,
        charm_store: this.charm_store
      });
    },

    /**
     * @method show_charm
     */
    show_charm: function(req) {
      var charm_url = req.params.charm_store_path;
      this.showView('charm', {
        charm_data_url: charm_url,
        charm_store: this.charm_store,
        env: this.env
      });
    },

    /**
     * @method show_notifications_overview
     */
    show_notifications_overview: function(req) {
      this.showView('notifications_overview', {
        env: this.env,
        notifications: this.db.notifications,
        nsRouter: this.nsRouter
      });
    },

    /**
     * Show the login screen.
     *
     * @method showLogin
     * @return {undefined} Nothing.
     */
    showLogin: function() {
      this.showView('login', {
        env: this.env,
        help_text: this.get('login_help')
      });
      var passwordField = this.get('container').one('input[type=password]');
      // The password field may not be present in testing context.
      if (passwordField) {
        passwordField.focus();
      }
    },

    /**
     * Log the current user out and show the login screen again.
     *
     * @method logout
     * @param {Object} req The request.
     * @return {undefined} Nothing.
     */
    logout: function(req) {
      // If the environment view is instantiated, clear out the topology local
      // database on log out, because we clear out the environment database as
      // well. The order of these is important because we need to tell
      // the env to log out after it has navigated to make sure that
      // it always shows the login screen.
      var environmentInstance = this.views.environment.instance;
      if (environmentInstance) {
        environmentInstance.topo.update();
      }
      this.env.logout();
      return;
    },

    // Persistent Views

    /**
     * `notifications` is a preserved view that remains rendered on all main
     * views.  We manually create an instance of this view and insert it into
     * the App's view metadata.
     *
     * @method show_notifications_view
     */
    show_notifications_view: function(req, res, next) {
      var view = this.getViewInfo('notifications'),
          instance = view.instance;
      if (!instance) {
        view.instance = new views.NotificationsView(
            {container: Y.one('#notifications'),
              env: this.env,
              notifications: this.db.notifications,
              nsRouter: this.nsRouter
            });
        view.instance.render();
      }
      next();
    },

    /**
     * Ensure that the current user has authenticated.
     *
     * @method checkUserCredentials
     * @param {Object} req The request.
     * @param {Object} res ???
     * @param {Object} next The next route handler.
     *
     */
    checkUserCredentials: function(req, res, next) {
      // If the Juju environment is not connected, exit without letting the
      // route dispatch proceed. On env connection change, the app will
      // re-dispatch and this route callback will be executed again.
      if (!this.env.get('connected')) {
        return;
      }
      var credentials = this.env.getCredentials();
      // After re-arranging the execution order of our routes to support the
      // new :gui: namespace we were unable to log out on prod build in Ubuntu
      // chrome. It appeared to be because credentials was null so the log in
      // form was never shown - this handles that edge case.
      var noCredentials = !(credentials && credentials.areAvailable);
      if (noCredentials) {
        // If there are no stored credentials redirect to the login page
        if (!req || req.path !== '/login/') {
          // Set the original requested path in the event the user has
          // to log in before continuing.
          this.redirectPath = window.location.pathname;
          this.navigate('/login/', { overrideAllNamespaces: true });
          return;
        }
      }
      next();
    },

    /**
     * Notify with an error when the user tries to change the environment
     * without permission.
     *
     * @method onEnvPermissionDenied
     * @private
     * @param {Object} evt An event object (with "title" and "message"
         attributes).
     * @return {undefined} Mutates only.
     */
    onEnvPermissionDenied: function(evt) {
      this.db.notifications.add(
          new models.Notification({
            title: evt.title,
            message: evt.message,
            level: 'error'
          })
      );
    },

    /**
     * Hide the login mask and redispatch the router.
     *
     * When the environment gets a response from a login attempt,
     * it fires a login event, to which this responds.
     *
     * @method onLogin
     * @param {Object} e An event object (with a "data.result" attribute).
     * @private
     */
    onLogin: function(e) {
      if (e.data.result) {
        // We need to save the url to continue on to without redirecting
        // to root if there are extra path details.

        this.hideMask();
        var originalPath = window.location.pathname;
        if (originalPath !== '/' && !originalPath.match(/\/login\//)) {
          this.redirectPath = originalPath;
        }
        if (originalPath.match(/login/) && this.redirectPath === '/') {
          setTimeout(
              Y.bind(this.showRootView, this), 0);
          return;
        } else {
          var nsRouter = this.nsRouter;
          this.navigate(
              nsRouter.url(nsRouter.parse(this.redirectPath)),
              {overrideAllNamespaces: true});
          this.redirectPath = null;
          return;
        }
      } else {
        this.showLogin();
      }
    },

    /**
      Hides the fullscreen mask and stops the spinner.

      @method hideMask
    */
    hideMask: function() {
      var mask = Y.one('#full-screen-mask');
      if (mask) {
        mask.hide();
        // Stop the animated loading spinner.
        if (spinner) {
          spinner.stop();
        }
      }
    },

    /**
     * Display the provider type.
     *
     * The provider type arrives asynchronously.  Instead of updating the
     * display from the environment code (a separation of concerns violation),
     * we update it here.
     *
     * @method onProviderTypeChange
     */
    onProviderTypeChange: function(evt) {
      var providerType = evt.newVal;
      this.db.environment.set('provider', providerType);
      Y.all('.provider-type').set('text', 'on ' + providerType);
    },

    /**
      Display the Environment Name.

      The environment name can arrive asynchronously.  Instead of updating
      the display from the environment view (a separtion of concerns violation),
      we update it here.

      @method onEnvironmentNameChange
    */
    onEnvironmentNameChange: function(evt) {
      var environmentName = evt.newValue;
      this.db.environment.set('name', environmentName);
      Y.all('.environment-name').set('text', environmentName);
    },

    /**
       Determine if the browser or environment should be rendered or not.

       When hitting internal :gui: views, the browser needs to disappear
       entirely from the UX for users. However, when we pop back it needs to
       appear back in the previous state.

       The environment only needs to render when another full page view isn't
       visible.

       @method toggleStaticViews
       @param {Request} req current request object.
       @param {Response} res current response object.
       @param {function} next callable for the next route in the chain.
     */
    toggleStaticViews: function(req, res, next) {
      var url = req.url,
          match = /(logout|:gui:\/(charms|service|unit))/;
      var subapps = this.get('subApps');

      if (subapps && subapps.charmstore) {
        var charmstore = subapps.charmstore;
        if (url.match(match)) {
          charmstore.hidden = true;
          // XXX At some point in the near future we will add the ability to
          // route on root namespaced paths and this check will no longer
          // be needed
          this.renderEnvironment = false;
        } else {
          charmstore.hidden = false;
          this.renderEnvironment = true;
        }
        charmstore.updateVisible();
      }

      next();
    },

    /**
      Shows the root view of the application erasing all namespaces

      @method showRootView
    */
    showRootView: function() {
      this._navigate('/', { overrideAllNamespaces: true });
    },

    /**
     * @method show_environment
     */
    show_environment: function(req, res, next) {
      if (!this.renderEnvironment) {
        next(); return;
      }
      this.hideMask();
      var self = this,
          view = this.getViewInfo('environment'),
          options = {
            getModelURL: Y.bind(this.getModelURL, this),
            nsRouter: this.nsRouter,
            landscape: this.landscape,
            endpointsController: this.endpointsController,
            useDragDropImport: this.get('sandbox'),
            db: this.db,
            env: this.env};

      this.showView('environment', options, {
        /**
         * Let the component framework know that the view has been rendered.
         *
         * @method show_environment.callback
         */
        callback: function() {
          this.views.environment.instance.rendered();
        },
        render: true
      });
      next();
    },

    /**
     * Object routing support
     *
     * This utility helps map from model objects to routes
     * defined on the App object. See the routes Attribute
     * for additional information.
     *
     * @param {object} model The model to determine a route URL for.
     * @param {object} [intent] the name of an intent associated with a route.
     *   When more than one route can match a model, the route without an
     *   intent is matched when this attribute is missing.  If intent is
     *   provided as a string, it is matched to the `intent` attribute
     *   specified on the route. This is effectively a tag.
     * @method getModelURL
     */
    getModelURL: function(model, intent) {
      var matches = [],
          attrs = (model instanceof Y.Model) ? model.getAttrs() : model,
          routes = this.get('routes'),
          regexPathParam = /([:*])([\w\-]+)?/g,
          idx = 0,
          finalPath = '';

      routes.forEach(function(route) {
        var path = route.path,
            required_model = route.model,
            reverse_map = route.reverse_map;

        // Fail fast on wildcard paths, on routes without models,
        // and when the model does not match the route type.
        if (path === '*' ||
            required_model === undefined ||
            model.name !== required_model) {
          return;
        }

        // Replace the path params with items from the model's attributes.
        path = path.replace(regexPathParam,
                            function(match, operator, key) {
                              if (reverse_map !== undefined &&
                                  reverse_map[key]) {
                                key = reverse_map[key];
                              }
                              return attrs[key];
                            });
        matches.push(Y.mix({path: path,
          route: route,
          attrs: attrs,
          intent: route.intent,
          namespace: route.namespace}));
      });

      // See if intent is in the match. Because the default is to match routes
      // without intent (undefined), this test can always be applied.
      matches = Y.Array.filter(matches, function(match) {
        return match.intent === intent;
      });

      if (matches.length > 1) {
        console.warn('Ambiguous routeModel', attrs.id, matches);
        // Default to the last route in this configuration error case.
        idx = matches.length - 1;
      }

      if (matches[idx] && matches[idx].path) {
        finalPath = this.nsRouter.url({ gui: matches[idx].path });
      }
      return finalPath;
    }

  }, {
    ATTRS: {
      html5: true,
      charm_store: {},
      charm_store_url: {},
      charmworldURL: {},

      /**
       * Routes
       *
       * Each request path is evaluated against all hereby defined routes,
       * and the callbacks for all the ones that match are invoked,
       * without stopping at the first one.
       *
       * To support this we supplement our routing information with
       * additional attributes as follows:
       *
       * `namespace`: (optional) when namespace is specified this route should
       *   only match when the URL fragment occurs in that namespace. The
       *   default namespace (as passed to this.nsRouter) is assumed if no
       *   namespace  attribute is specified.
       *
       * `model`: `model.name` (required)
       *
       * `reverse_map`: (optional) A reverse mapping of `route_path_key` to the
       *   name of the attribute on the model.  If no value is provided, it is
       *   used directly as attribute name.
       *
       * `intent`: (optional) A string named `intent` for which this route
       *   should be used. This can be used to select which subview is selected
       *   to resolve a model's route.
       *
       * @attribute routes
       */
      routes: {
        value: [
          // Called on each request.
          { path: '*', callbacks: 'checkUserCredentials'},
          { path: '*', callbacks: 'show_notifications_view'},
          { path: '*', callbacks: 'toggleStaticViews'},
          { path: '*', callbacks: 'show_environment'},
          // Charms.
          { path: '/charms/',
            callbacks: 'show_charm_collection',
            namespace: 'gui'},
          { path: '/charms/*charm_store_path/',
            callbacks: 'show_charm',
            model: 'charm',
            namespace: 'gui'},
          // Notifications.
          { path: '/notifications/',
            callbacks: 'show_notifications_overview',
            namespace: 'gui'},
          // Services.
          { path: '/service/:id/config/',
            callbacks: 'show_service_config',
            intent: 'config',
            model: 'service',
            namespace: 'gui'},
          { path: '/service/:id/constraints/',
            callbacks: 'show_service_constraints',
            intent: 'constraints',
            model: 'service',
            namespace: 'gui'},
          { path: '/service/:id/relations/',
            callbacks: 'show_service_relations',
            intent: 'relations',
            model: 'service',
            namespace: 'gui'},
          { path: '/service/:id/',
            callbacks: 'show_service',
            model: 'service',
            namespace: 'gui'},
          // Units.
          { path: '/unit/:id/',
            callbacks: 'show_unit',
            reverse_map: {id: 'urlName'},
            model: 'serviceUnit',
            namespace: 'gui'},
          // Authorization
          { path: '/login/', callbacks: 'showLogin' }
        ]
      }
    }
  });

  Y.namespace('juju').App = JujuGUI;

}, '0.5.2', {
  requires: [
    'juju-charm-models',
    'juju-charm-panel',
    'juju-charm-store',
    'juju-models',
    'juju-notifications',
    'ns-routing-app-extension',
    // This alias does not seem to work, including references by hand.
    'juju-controllers',
    'juju-notification-controller',
    'juju-endpoints-controller',
    'juju-env',
    'juju-env-fakebackend',
    'juju-fakebackend-simulator',
    'juju-env-sandbox',
    'juju-charm-models',
    'juju-views',
    'juju-view-login',
    'juju-landscape',
    'juju-websocket-logging',
    'io',
    'json-parse',
    'app-base',
    'app-transitions',
    'base',
    'node',
    'model',
    'app-subapp-extension',
    'sub-app',
    'subapp-browser',
    'event-key',
    'event-touch',
    'model-controller',
    'FileSaver',
    'juju-inspector-widget'
  ]
});
