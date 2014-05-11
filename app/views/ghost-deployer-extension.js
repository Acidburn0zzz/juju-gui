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
  The ghost inspector is the viewlet manager implementation of the ghost
  configuration view.

  @module views
  @submodule views.ghostInspector
 */

YUI.add('ghost-deployer-extension', function(Y) {

  /**
    JujuGUI app extension to add the ghost deployer method.

    @class GhostDeployer
    @extension App
  */
  function GhostDeployer() {}

  GhostDeployer.prototype = {

    /**
      Show the deploy/configuration panel for a charm.

      @method deployService
      @param {Y.Model} charm model to add to the charms database.
    */
    deployService: function(charm, ghostAttributes) {
      // This flag is still required because it comes fully populated from the
      // browser but won't be fully populated when coming in on the delta.
      charm.loaded = true;
      var db = this.db;
      db.charms.add(charm);
      var ghostService = db.services.ghostService(charm);

      this._setupXYAnnotations(ghostAttributes, ghostService);

      if (window.flags && window.flags.il) {
        var ghostServiceId = ghostService.get('id');
        // XXX frankban 2014-05-11:
        // after the ODS demo, find a smarter way to set a unique service name.
        var serviceName = charm.get('name');
        var charmId = charm.get('id');
        var config = {};
        var constraints = {};
        this.env.deploy(
            charmId,
            serviceName,
            config,
            undefined, // Config file content.
            0, // Number of units.
            constraints,
            null, // toMachine.
            Y.bind(this._deployCallbackHandler,
                   this,
                   serviceName,
                   config,
                   constraints,
                   ghostService),
            // Options used by ECS, ignored by environment
            {modelId: ghostServiceId});

        // Add an unplaced unit to this service.
        // The service is not yet deployed (we just added it to ECS), so we can
        // safely assume the first unit to be unit 0. Each subsequent unit
        // added to the ghost service would have number
        // `ghostService.get('units').size()`.
        db.addUnits({
          id: ghostServiceId + '/0',
          displayName: serviceName + '/0',
          charmUrl: charmId,
          is_subordinate: charm.get('is_subordinate')
        });
        // XXX frankban 2014-05-11:
        // Add an ECS add_unit record by calling this.env.add_unit.
        // The call is not yet implemented.
        // When adding the call, attach a callback that, when called, removes
        // all the ghost units for this service. Real units should be then
        // created reacting to the mega-watcher changes.
      } else {
        var environment = this.views.environment.instance;
        environment.createServiceInspector(ghostService);
      }
    },

    /**
      Sets up the gui-x, gui-y annotations on the passed in ghost service.

      @method _setupXYAnnotations
      @param {Object} ghostAttributes The attrs to set on the ghost service.
      @param {Object} ghostService The ghost service model.
    */
    _setupXYAnnotations: function(ghostAttributes, ghostService) {
      if (ghostAttributes !== undefined) {
        if (ghostAttributes.coordinates !== undefined) {
          var annotations = ghostService.get('annotations');
          annotations['gui-x'] = ghostAttributes.coordinates[0];
          annotations['gui-y'] = ghostAttributes.coordinates[1];
        }
        ghostService.set('icon', ghostAttributes.icon);
      }
    },

    /**
      The callback handler from the env.deploy() of the charm.

      @method _deployCallbackHandler
      @param {String} serviceName The service name.
      @param {Object} config The configuration object of the service.
      @param {Object} constraints The constraint settings for the service.
      @param {Object} ghostService The model of the ghost service.
      @param {Y.EventFacade} e The event facade from the deploy event.
    */
    _deployCallbackHandler: function(serviceName, config, constraints,
        ghostService, e) {

      var db = this.db,
          models = Y.juju.models,
          topo = this.views.environment.instance.topo;

      if (e.err) {
        db.notifications.add(
            new models.Notification({
              title: 'Error deploying ' + serviceName,
              message: 'Could not deploy the requested service. Server ' +
                  'responded with: ' + e.err,
              level: 'error'
            }));
        return;
      }

      db.notifications.add(
          new models.Notification({
            title: 'Deployed ' + serviceName,
            message: 'Successfully deployed the requested service.',
            level: 'info'
          }));

      // Transition the ghost viewModel to the new service. It's alive!
      var ghostId = ghostService.get('id');

      ghostService.setAttrs({
        id: serviceName,
        displayName: undefined,
        pending: false,
        loading: false,
        config: config,
        constraints: constraints
      });

      // Without this following code on a real environment the service icons
      // would disappear and then re-appear when deploying services.
      var boxModel = topo.service_boxes[ghostId];
      boxModel.id = serviceName;
      boxModel.pending = false;
      delete topo.service_boxes[ghostId];
      topo.service_boxes[serviceName] = boxModel;

      topo.annotateBoxPosition(boxModel);
    }
  };

  Y.namespace('juju').GhostDeployer = GhostDeployer;

}, '0.1.0');
