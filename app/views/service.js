'use strict';

YUI.add('juju-view-service', function(Y) {

  var ENTER = Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.enter;
  var ESC = Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.esc;


  var views = Y.namespace('juju.views'),
      Templates = views.Templates,
      models = Y.namespace('juju.models'),
      utils = Y.namespace('juju.views.utils');

  var exposeButtonMixin = {
    events: {
      '.unexposeService': {click: 'unexposeService'},
      '.exposeService': {click: 'exposeService'}
    },

    unexposeService: function() {
      var service = this.get('model'),
          env = this.get('env');

      env.unexpose(service.get('id'),
          Y.bind(this._unexposeServiceCallback, this));
    },

    _unexposeServiceCallback: function() {
      var service = this.get('model'),
          db = this.get('db');
      service.set('exposed', false);
      db.fire('update');
    },

    exposeService: function() {
      var service = this.get('model'),
          env = this.get('env');
      env.expose(service.get('id'),
          Y.bind(this._exposeServiceCallback, this));
    },

    _exposeServiceCallback: function() {
      var service = this.get('model'),
          db = this.get('db');
      service.set('exposed', true);
      db.fire('update');
    }
  };

  var getElementsValuesMap = function(container, cls) {
    var result = {};
    container.all(cls).each(function(el) {
      var value = null;
      if (el.getAttribute('type') === 'checkbox') {
        value = el.get('checked');
      } else {
        value = el.get('value');
      }
      result[el.get('name')] = value;
    });

    return result;
  };

  var ServiceRelations = Y.Base.create(
      'ServiceRelationsView', Y.View, [views.JujuBaseView], {

        template: Templates['service-relations'],

        initializer: function() {
          Y.mix(this, exposeButtonMixin, undefined, undefined, undefined, true);
        },

        events: {
          '#service-relations .btn': {click: 'confirmRemoved'}
        },

        render: function() {
          var container = this.get('container'),
              db = this.get('db'),
              service = this.get('model'),
              querystring = this.get('querystring');
          if (!service) {
            container.setHTML('<div class="alert">Loading...</div>');
            console.log('waiting on service data');
            return this;
          }

          var rels = db.relations.get_relations_for_service(service);

          var getRelations = function(rels) {
            // Return a list of objects representing the `near` and `far`
            // endpoints for all of the relationships `rels`.  If it is a peer
            // relationship, then `far` will be undefined.
            var relations = [],
                service_name = service.get('id');

            rels.forEach(function(rel) {
              var endpoints = rel.get('endpoints'),
                  near,
                  far,
                  rel_data = {};
              if (endpoints[0][0] === service_name) {
                near = endpoints[0];
                far = endpoints[1]; // undefined if a peer relationship.
              } else {
                near = endpoints[1];
                far = endpoints[0]; // undefined if a peer relationship.
              }
              rel_data.relation_id = rel.get('relation_id');
              if (rel_data.relation_id === querystring.rel_id) {
                rel_data.highlight = true;
              }
              rel_data.role = near[1].role;
              rel_data.scope = rel.get('scope');
              var rel_id = rel.get('relation_id').split('-')[1];
              rel_data.ident = near[1].name + ':' + parseInt(rel_id, 10);
              // far will be undefined or the far endpoint.
              rel_data.far = far && far[0];
              relations.push(rel_data);
            });
            return relations;
          };

          var relations = getRelations(rels);

          container.setHTML(this.template(
              {'service': service.getAttrs(),
                'relations': relations,
                'charm': this.renderable_charm(service.get('charm'), db)}
              ));
        },

        confirmRemoved: function(ev) {
          // We wait to make the panel until now, because in the render method
          // the container is not yet part of the document.
          ev.preventDefault();
          var rel_id = ev.target.get('value');
          if (Y.Lang.isUndefined(this.remove_panel)) {
            this.remove_panel = views.createModalPanel(
                'Are you sure you want to remove this service relation?  ' +
                'This action cannot be undone, though you can ' +
                'recreate it later.',
                '#remove-modal-panel',
                'Remove Service Relation',
                Y.bind(this.doRemoveRelation, this, rel_id, ev.target));
          }
          this.remove_panel.show();
        },

        doRemoveRelation: function(rel_id, button, ev) {
          ev.preventDefault();
          var env = this.get('env'),
              db = this.get('db'),
              service = this.get('model'),
              relation = db.relations.getById(rel_id),
              endpoints = relation.get('endpoints'),
              endpoint_a = endpoints[0][0] + ':' + endpoints[0][1].name,
              endpoint_b;

          if (endpoints.length === 1) {
            // For a peer relationship, both endpoints are the same.
            endpoint_b = endpoint_a;
          } else {
            endpoint_b = endpoints[1][0] + ':' + endpoints[1][1].name;
          }

          ev.target.set('disabled', true);

          env.remove_relation(
              endpoint_a,
              endpoint_b,
              Y.bind(this._doRemoveRelationCallback, this,
                     relation, button, ev.target));
        },

        _doRemoveRelationCallback: function(relation, rm_button,
            confirm_button, ev) {
          // XXX Once we have a way of showing notifications, if ev.err exists,
          // report it.
          var db = this.get('db'),
              app = this.get('app'),
              service = this.get('model');
          if (ev.err) {
            db.notifications.add(
                new models.Notification({
                  title: 'Error deleting relation',
                  message: 'Relation ' + ev.endpoint_a + ' to ' + ev.endpoint_b,
                  level: 'error',
                  link: app.getModelURL(service) + 'relations?rel_id=' +
                      relation.get('id'),
                  modelId: relation
                })
            );
            var row = rm_button.ancestor('tr');
            row.removeClass('highlighted'); // Whether we need to or not.
            var old_color = row.getStyle('backgroundColor');
            row.setStyle('backgroundColor', 'pink');
            row.transition({easing: 'ease-out', duration: 3,
              backgroundColor: old_color});
          } else {
            db.relations.remove(relation);
            db.fire('update');
          }
          confirm_button.set('disabled', false);
          this.remove_panel.hide();
        }
      });

  views.service_relations = ServiceRelations;

  var ServiceConstraints = Y.Base.create(
      'ServiceConstraintsView', Y.View, [views.JujuBaseView], {

        template: Templates['service-constraints'],

        initializer: function() {
          Y.mix(this, exposeButtonMixin, undefined, undefined, undefined, true);
        },

        events: {
          '#save-service-constraints': {click: 'updateConstraints'}
        },

        updateConstraints: function() {
          var service = this.get('model'),
              container = this.get('container'),
              env = this.get('env');

          var values = (function() {
            var result = [],
                map = getElementsValuesMap(container, '.constraint-field');

            Y.Object.each(map, function(value, name) {
              result.push(name + '=' + value);
            });

            return result;
          })();

          // Disable the "Update" button while the RPC call is outstanding.
          container.one('#save-service-constraints')
            .set('disabled', 'disabled');
          env.set_constraints(service.get('id'),
              values,
              utils.buildRpcHandler({
                container: container,
                successHandler: function()  {
                  var service = this.get('model'),
                      env = this.get('env'),
                      app = this.get('app');

                  env.get_service(
                      service.get('id'), Y.bind(app.load_service, app));
                },
                errorHandler: function() {
                  container.one('#save-service-constraints')
                    .removeAttribute('disabled');
                },
                scope: this}
              ));
        },

        render: function() {
          var container = this.get('container'),
              db = this.get('db'),
              service = this.get('model');

          var constraints = service.get('constraints');
          var display_constraints = [];

          //these are read-only values
          var readOnlyConstraints = {
            'provider-type': constraints['provider-type'],
            'ubuntu-series': constraints['ubuntu-series']
          };

          Y.Object.each(constraints, function(value, name) {
            if (!(name in readOnlyConstraints)) {
              display_constraints.push({
                'name': name,
                'value': value});
            }
          });

          var generics = ['cpu', 'mem', 'arch'];
          Y.Object.each(generics, function(idx, gkey) {
            if (!(gkey in constraints)) {
              display_constraints.push({'name': gkey, 'value': ''});
            }
          });

          console.log('service constraints', display_constraints);
          container.setHTML(this.template({
            service: service.getAttrs(),
            constraints: display_constraints,
            readOnlyConstraints: (function() {
              var arr = [];
              Y.Object.each(readOnlyConstraints, function(name, value) {
                arr.push({'name': name, 'value': value});
              });
              return arr;
            })(),
            charm: this.renderable_charm(service.get('charm'), db)}
          ));
        }

      });

  views.service_constraints = ServiceConstraints;

  var ServiceConfigView = Y.Base.create(
      'ServiceConfigView', Y.View, [views.JujuBaseView], {

        template: Templates['service-config'],

        initializer: function() {
          Y.mix(this, exposeButtonMixin, undefined, undefined, undefined, true);
        },

        events: {
          '#save-service-config': {click: 'saveConfig'}
        },

        render: function() {
          var container = this.get('container'),
              db = this.get('db'),
              service = this.get('model');

          if (!service || !service.get('loaded')) {
            console.log('not connected / maybe');
            return this;
          }

          console.log('config', service.get('config'));
          var charm_url = service.get('charm');

          // combine the charm schema and the service values for display.
          var charm = db.charms.getById(charm_url);
          var config = service.get('config');
          var schema = charm.get('config');

          var settings = [];
          var field_def;

          Y.Object.each(schema, function(field_def, field_name) {
            var entry = {
              'name': field_name
            };

            if (schema[field_name].type === 'boolean') {
              entry.isBool = true;

              if (config[field_name]) {
                // The "checked" string will be used inside an input tag
                // like <input id="id" type="checkbox" checked>
                entry.value = 'checked';
              } else {
                // The output will be <input id="id" type="checkbox">
                entry.value = '';
              }

            } else {
              entry.value = config[field_name];
            }

            settings.push(Y.mix(entry, field_def));
          });

          console.log('render view svc config', service.getAttrs(), settings);

          container.setHTML(this.template(
              {service: service.getAttrs(),
                settings: settings,
                charm: this.renderable_charm(service.get('charm'), db)}
              ));

          return this;
        },

        saveConfig: function() {
          var env = this.get('env'),
              container = this.get('container'),
              service = this.get('model');

          // Disable the "Update" button while the RPC call is outstanding.
          container.one('#save-service-config').set('disabled', 'disabled');

          env.set_config(service.get('id'),
              getElementsValuesMap(container, '.config-field'),
              utils.buildRpcHandler({
                container: container,
                successHandler: function()  {
                  var service = this.get('model'),
                      env = this.get('env'),
                      app = this.get('app');

                  env.get_service(
                      service.get('id'), Y.bind(app.load_service, app));
                },
                errorHandler: function() {
                  container.one('#save-service-config')
                    .removeAttribute('disabled');
                },
                scope: this}
              ));
        }
      });

  views.service_config = ServiceConfigView;

  var ServiceView = Y.Base.create('ServiceView', Y.View, [views.JujuBaseView], {

    template: Templates.service,

    initializer: function() {
      Y.mix(this, exposeButtonMixin, undefined, undefined, undefined, true);
    },

    render: function() {
      console.log('service view render');

      var container = this.get('container'),
          db = this.get('db'),
          service = this.get('model'),
          env = this.get('env');

      if (!service) {
        console.log('not connected / maybe');
        return this;
      }
      container.setHTML(this.template(
          {'service': service.getAttrs(),
            'charm': this.renderable_charm(service.get('charm'), db),
            'units': db.units.get_units_for_service(service)
          }));
      return this;
    },

    events: {
      '#num-service-units': {keydown: 'modifyUnits', blur: 'resetUnits'},
      'div.thumbnail': {click: function(ev) {
        console.log('Unit clicked', ev.currentTarget.get('id'));
        this.fire('showUnit', {unit_id: ev.currentTarget.get('id')});
      }},
      'a#destroy-service': {click: 'confirmDestroy'}
    },

    confirmDestroy: function(ev) {
      // We wait to make the panel until now, because in the render method
      // the container is not yet part of the document.
      if (Y.Lang.isUndefined(this.panel)) {
        this.panel = views.createModalPanel(
            'Are you sure you want to destroy the service?  ' +
            'This cannot be undone.',
            '#destroy-modal-panel',
            'Destroy Service',
            Y.bind(this.destroyService, this)
            );
      }
      this.panel.show();
    },

    destroyService: function(ev) {
      ev.preventDefault();
      var env = this.get('env'),
          service = this.get('model');
      ev.target.set('disabled', true);
      env.destroy_service(
          service.get('id'), Y.bind(this._destroyCallback, this));
    },

    _destroyCallback: function(ev) {
      var db = this.get('db'),
          service = this.get('model'),
          service_id = service.get('id');
      db.services.remove(service);
      db.relations.remove(
          db.relations.filter(
          function(r) {
            return Y.Array.some(r.get('endpoints'), function(ep) {
              return ep[0] === service_id;
            });
          }
          ));
      this.panel.hide();
      this.panel.destroy();
      this.fire('showEnvironment');
    },

    resetUnits: function() {
      var container = this.get('container'),
          field = container.one('#num-service-units');
      field.set('value', this.get('model').get('unit_count'));
      field.set('disabled', false);
    },

    modifyUnits: function(ev) {
      if (ev.keyCode !== ESC && ev.keyCode !== ENTER) {
        return;
      }
      var container = this.get('container'),
          field = container.one('#num-service-units');

      if (ev.keyCode === ESC) {
        this.resetUnits();
      }
      if (ev.keyCode !== ENTER) { // If not Enter keyup...
        return;
      }
      ev.halt(true);

      if (/^\d+$/.test(field.get('value'))) {
        this._modifyUnits(parseInt(field.get('value'), 10));
      } else {
        this.resetUnits();
      }
    },

    _modifyUnits: function(requested_unit_count) {

      var service = this.get('model'),
          unit_count = service.get('unit_count'),
          field = this.get('container').one('#num-service-units'),
          env = this.get('env');

      if (requested_unit_count < 1) {
        console.log('You must have at least one unit');
        field.set('value', unit_count);
        return;
      }

      var delta = requested_unit_count - unit_count;
      if (delta > 0) {
        // Add units!
        env.add_unit(
            service.get('id'), delta,
            Y.bind(this._addUnitCallback, this));
      } else if (delta < 0) {
        delta = Math.abs(delta);
        var db = this.get('db'),
                units = db.units.get_units_for_service(service),
                unit_ids_to_remove = [];

        for (var i = units.length - 1;
            unit_ids_to_remove.length < delta;
            i -= 1) {
          unit_ids_to_remove.push(units[i].id);
        }
        env.remove_units(
            unit_ids_to_remove,
            Y.bind(this._removeUnitCallback, this)
        );
      }
      field.set('disabled', true);
    },

    _addUnitCallback: function(ev) {
      var service = this.get('model'),
          service_id = service.get('id'),
          db = this.get('db'),
          unit_names = ev.result || [];
      console.log('_addUnitCallback with: ', arguments);
      // Received acknowledgement message for the 'add_units' operation.
      // ev.results is an array of the new unit ids to be created.
      db.units.add(
          Y.Array.map(unit_names, function(unit_id) {
            return {id: unit_id,
              agent_state: 'pending'};
          }));
      service.set(
          'unit_count', service.get('unit_count') + unit_names.length);
      db.fire('update');
      // View is redrawn so we do not need to enable field.
    },

    _removeUnitCallback: function(ev) {
      var service = this.get('model'),
          db = this.get('db'),
          unit_names = ev.unit_names;
      console.log('_removeUnitCallback with: ', arguments);
      Y.Array.each(unit_names, function(unit_name) {
        db.units.remove(db.units.getById(unit_name));
      });
      service.set(
          'unit_count', service.get('unit_count') - unit_names.length);
      db.fire('update');
      // View is redrawn so we do not need to enable field.
    }
  });

  views.service = ServiceView;
}, '0.1.0', {
  requires: ['panel',
    'juju-view-utils',
    'juju-models',
    'base-build',
    'handlebars',
    'node',
    'view',
    'event-key',
    'transition',
    'json-stringify']
});
