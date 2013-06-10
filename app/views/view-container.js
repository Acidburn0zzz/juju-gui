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


/**
  Adds the ViewContainer constructor class and viewlet instantiable object

  @module juju-view-container
*/
YUI.add('juju-view-container', function(Y) {

  /**
    Viewlet object class. It's expected that these properties will be
    overwritten on instantiation and so only basic defaults are defined here.

    Instantiate with Object.create()

    @class ViewletBase
    @constructor
  */
  var ViewletBase = {

    /**
      The user defined name for the viewlet.

      @property name
      @type {String}
      @default ''
    */
    name: '',

    /**
      String template of the viewlet wrapper

      @property templateWrapper
      @type {string | compiled Handlebars template}
      @default '<div class="viewlet-wrapper" style="display: none"></div>'
    */
    templateWrapper: '<div class="viewlet-wrapper" style="display:none"></div>',

    /**
      Template of the viewlet, provided during configuration

      @property template
      @type {string | compiled Handlebars template}
      @default '{{viewlet}}'
    */
    template: '{{viewlet}}', // compiled handlebars template

    /**
      Bindings config for the binding engine
      ex) [ { name: 'modelFieldName', target: 'querySelectorString' } ]
      ex) [ { name: 'modelFieldName', target: [ 'querySelectorString' ] } ]

      @property bindings
      @type {array}
      @default []
    */
    bindings: [],

    /**
      The rendered viewlet element

      @property container
      @type {Y.Node}
      @default null
    */
    container: null,

    /**
      When defined it allows the developer to specify another model to bind the
      Viewlet to, usually one nested in the model passed to the View Container.

      @property rebind
      @type {Function}
      @default null
    */
    rebind: null,

    /**
      User defined update method which re-renders the contents of the viewlet.
      Called by the binding engine if a modellist is updated. This is
      accomplished by grabbing the viewlets container and setHTML() with the
      new contents.

      @property update
      @type {function}
      @default {noop function}
    */
    update: function(modellist) {},

    /**
      Render method to generate the container and insert the compiled viewlet
      template into it.

      @property render
      @type {function}
      @default {render function}
    */
    render: function(model) {
      this.container = Y.Node.create(this.templateWrapper);

      if (typeof this.template === 'string') {
        this.template = Y.Handlebars.compile(this.template);
      }
      this.container.setHTML(this.template(model.getAttrs()));
    }
  };

  /**
    ViewContainer class for rendering a parent view container which manages the
    display of viewlets.

    @namespace juju
    @class ViewContainer
    @constructor
  */
  var juju = Y.namespace('juju');
  juju.ViewContainer = new Y.Base.create('view-container', Y.View, [], {

    /**
      DOM bound events for any view container related events

      @property events
    */
    events: {},

    /**
      Viewlet configuration object. Set by passing `viewlets` in during
      instantiation.
      ex) (see ViewletBase)

      @property viewletConfig
      @default undefined
    */

    /**
      Template of the view container. Set by passing in during instantiation.
      ex) { template: Y.juju.templates['view-container'] }
      Must include {{ viewlets }} to allow rendering of the viewlets.

      @property template,
      @type {Handlebars Template}
      @default '<div class="view-container-wrapper">{{viewlets}}</div>'
    */

    /**
      Handlebars config options for the view-container template. Set by passing
      in during instantiation ex) { templateConfig: {} }

      @property templateConfig
      @type {Object}
    */

    /**
      A hash of the viewlet instances

      ex) {}

      @property viewlets
      @type {Object}
      @default undefined
    */

    initializer: function(options) {
      // Passed in on instantiation
      this.viewletConfig = options.viewlets;
      this.template = options.template;
      this.templateConfig = options.templateConfig;
      this.viewletContainer = options.viewletContainer;
      this.viewlets = this._generateViewlets();
      this.events = options.events;
    },

    /**
      Return the name of the model as a key to index its
      inspector panel.

      @method getName
      @return {String} id of the model
    */
    getName: function() {
      return this.get('model').get('id');
    },

    /**
      Renders the viewlets into the view container.

      @method render
      @chainable
    */
    render: function() {
      var container = this.get('container'),
          model = this.get('model'),
          viewletTemplate;

      // To allow you to pass in a string instead of a precompiled template
      if (typeof this.template === 'String') {
        this.template = Y.Handlebars.compile(this.template);
      }

      container.setHTML(this.template(this.templateConfig));

      // We may want to make this selector user defined at some point
      var viewletContainer = container.one(this.viewletContainer);

      // render the viewlets into their containers
      Y.Object.each(this.viewlets, function(viewlet) {
        viewlet.render(model);
        viewletContainer.append(viewlet.container);
      });

      // chainable
      return this;
    },

    /**
      Switches the visible viewlet to the requested.

      @method showViewlet
      @param {String} viewletName is a string representing the viewlet name.
    */
    showViewlet: function(viewletName) {
      var container = this.get('container');
      // possibly introduce some kind of switching animation here
      container.all('.viewlet-wrapper').hide();
      // This method can be called directly but it is also an event handler
      // for clicking on the view container tab handles
      if (typeof viewletName !== 'string') {
        viewletName = viewletName.currentTarget.getData('viewlet');
      }
      this.viewlets[viewletName].container.show();
    },

    /**
      Generates the viewlet instances based on the passed in configuration

      @method _generateViewlets
      @private
    */
    _generateViewlets: function() {
      var viewlets = {},
          model = this.get('model');

      // expand out the config to defineProperty syntax
      this._expandViewletConfig();

      Y.Object.each(this.viewletConfig, function(viewlet, key) {
        // create viewlet instances using the base and supplied config
        viewlets[key] = Object.create(ViewletBase, viewlet);
      }, this);

      return viewlets;
    },

    /**
      Expands the basic objects provided in the viewlet config into the
      defineProperty format for Object.create()

      @method _expandViewletConfig
      @private
    */
    _expandViewletConfig: function() {
      // uncomment below when we upgrade jshint
      // /*jshint -W089 */
      for (var viewlet in this.viewletConfig) {
        // remove ifcheck when we upgrade jshint
        if (this.viewletConfig.hasOwnProperty(viewlet)) {
          for (var cfg in this.viewletConfig[viewlet]) {
            // remove ifcheck when we upgrade jshint
            if (this.viewletConfig[viewlet].hasOwnProperty(cfg)) {
              if (this.viewletConfig[viewlet][cfg].value === undefined) {
                this.viewletConfig[viewlet][cfg] = {
                  value: this.viewletConfig[viewlet][cfg],
                  writable: true
                };
              }
            }
          }
        }
      }
      // uncomment below when we upgrade jshint
      // /*jshint +W089 */
    },

    destructor: function() {
      this.get('container').remove().destroy(true);
    }

  }, {
    ATTRS: {
      /**
        Reference to the model

        @attribute model
        @default undefined
      */
      model: {}
    }

  });

}, '', {
  requires: [
    'view',
    'node',
    'base-build',
    'handlebars'
  ]});
