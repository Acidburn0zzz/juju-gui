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
Sandbox APIs mimicking communications with the Go and Python backends.

@module env
@submodule env.sandbox
*/

YUI.add('juju-env-sandbox', function(Y) {

  var environments = Y.namespace('juju.environments');
  var sandboxModule = Y.namespace('juju.environments.sandbox');
  var CLOSEDERROR = 'INVALID_STATE_ERR : Connection is closed.';

  /**
  A client connection for interacting with a sandbox environment.

  @class ClientConnection
  */
  function ClientConnection(config) {
    ClientConnection.superclass.constructor.apply(this, arguments);
  }

  ClientConnection.NAME = 'sandbox-client-connection';
  ClientConnection.ATTRS = {
    juju: {} // Required.
  };

  Y.extend(ClientConnection, Y.Base, {

    /**
    Initialize.

    @method initializer
    @return {undefined} Nothing.
    */
    initializer: function() {
      this.connected = false;
    },

    /**
    React to a new message from Juju.
    You are expected to monkeypatch this method, as with websockets.

    @method onmessage
    @param {Object} event An object with a JSON string on the "data"
      attribute.
    @return {undefined} Nothing.
    */
    onmessage: function(event) {},

    /**
    Immediately give message to listener (contrast with receive).
    Uses onmessage to deliver message, as with websockets.

    @method receiveNow
    @param {Object} data An object to be sent as JSON to the listener.
    @param {Boolean} failSilently A flag to turn off the error when the
      connection is closed.  This exists to handle a race condition between
      receiveNow and receive, when the connection closes between the two.
    @return {undefined} Nothing.
    */
    receiveNow: function(data, failSilently) {
      if (this.connected) {
        this.onmessage({data: Y.JSON.stringify(data)});
      } else if (!failSilently) {
        throw CLOSEDERROR;
      }
    },

    /**
    Give message to listener asynchronously (contrast with receiveNow).
    Uses onmessage to deliver message, as with websockets.

    @method receive
    @param {Object} data An object to be sent as JSON to the listener.
    @return {undefined} Nothing.
    */
    receive: function(data) {
      if (this.connected) {
        Y.soon(this.receiveNow.bind(this, data, true));
      } else {
        throw CLOSEDERROR;
      }
    },

    /**
    Send a JSON string to the API.

    @method send
    @param {String} data A JSON string of the data to be sent.
    @return {undefined} Nothing.
    */
    send: function(data) {
      if (this.connected) {
        this.get('juju').receive(Y.JSON.parse(data));
      } else {
        throw CLOSEDERROR;
      }
    },

    /**
    React to an opening connection.
    You are expected to monkeypatch this method, as with websockets.

    @method onopen
    @return {undefined} Nothing.
    */
    onopen: function() {},

    /**
    Explicitly open the connection.
    This does not have an analog with websockets, but requiring an explicit
    "open" means less magic is necessary.  It is responsible for changing
    the "connected" state, for calling the onopen hook, and for calling
    the sandbox juju.open with itself.

    @method open
    @return {undefined} Nothing.
    */
    open: function() {
      if (!this.connected) {
        this.connected = true;
        this.get('juju').open(this);
        this.onopen();
      }
    },

    /**
    React to a closing connection.
    You are expected to monkeypatch this method, as with websockets.

    @method onclose
    @return {undefined} Nothing.
    */
    onclose: function() {},

    /**
    Close the connection.
    This is responsible for changing the "connected" state, for calling the
    onclosed hook, and for calling the sandbox juju.close.

    @method close
    @return {undefined} Nothing.
    */
    close: function() {
      if (this.connected) {
        this.connected = false;
        this.get('juju').close();
        this.onclose();
      }
    }

  });

  sandboxModule.ClientConnection = ClientConnection;

  /** Helper function method for generating operation methods
     * with a callback. Returns a method with a callback wired
     * in to continue the operation when done. The returned
     * method should be passed the data mapping to invoke.
     *
     * @method ASYNC_OP
     * @param {Object} context PyJujuAPI Instance.
     * @param {String} rpcName Name of method on fakebackend.
     * @param {Array} args String list of arguments to extract
     *                     from passed data. Used in order
     *                     listed as arguments to the RPC call.
     * @return {undefined} sends to client implicitly.
    */
  var ASYNC_OP = function(context, rpcName, args) {
    return Y.bind(function(data) {
      var state = this.get('state');
      var client = this.get('client');
      var vargs = Y.Array.map(args, function(i) {
        return data[i];
      });
      var callback = function(reply) {
        if (reply.error) {
          data.error = reply.error;
          data.err = reply.error;
        } else {
          data.result = reply.result;
        }
        client.receiveNow(data);
      };
      // Add our generated callback to arguments.
      vargs.push(callback);
      state[rpcName].apply(state, vargs);
    }, context);
  };

  /** Helper method for normalizing error handling
   * around sync operations with the fakebackend.
   * Returned method can directly return to the caller.
   *
   * @method OP
   * @param {Object} context PyJujuAPI instance.
   * @param {String} rpcName name of method on fakebackend to invoke.
   * @param {Array} args String Array of arguments to pass from
   *                data to fakebackend.
   * @param {Object} data Operational data to be munged into a fakebackend call.
   * @return {Object} result depends on underlying rpc method.
   */
  var OP = function(context, rpcName, args, data) {
    var state = context.get('state');
    var client = context.get('client');
    var vargs = Y.Array.map(args, function(i) {
      return data[i];
    });
    var reply = state[rpcName].apply(state, vargs);
    if (reply.error) {
      data.error = reply.error;
      data.err = reply.error;
    } else {
      data.result = reply.result;
    }
    client.receiveNow(data);
  };


  /**
  Given attrs or a model object and a whitelist of desired attributes,
  return an attrs hash of only the desired attributes.

  @method _getDeltaAttrs
  @private
  @param {Object} attrs A models or attrs hash.
  @param {Array} whitelist A list of desired attributes.
  @return {Object} A hash of the whitelisted attributes of the attrs object.
  */
  var _getDeltaAttrs = function(attrs, whitelist) {
    if (attrs.getAttrs) {
      attrs = attrs.getAttrs();
    }
    // For fuller verisimilitude, we could convert some of the
    // underlines in the attribute names to dashes.  That is currently
    // unnecessary.
    var filtered = {};
    Y.each(whitelist, function(name) {
      filtered[name] = attrs[name];
    });
    return filtered;
  };

  /**
  A sandbox Juju environment using the Python API.

  @class PyJujuAPI
  */
  function PyJujuAPI(config) {
    PyJujuAPI.superclass.constructor.apply(this, arguments);
  }

  PyJujuAPI.NAME = 'sandbox-py-juju-api';
  PyJujuAPI.ATTRS = {
    state: {}, // Required.
    client: {}, // Set in the "open" method.
    deltaInterval: {value: 1000} // In milliseconds.
  };

  Y.extend(PyJujuAPI, Y.Base, {

    /**
    Initializes.

    @method initializer
    @return {undefined} Nothing.
    */
    initializer: function() {
      this.connected = false;
    },


    /**
    Opens the connection to the sandbox Juju environment.
    Called by ClientConnection, which sends itself.

    @method open
    @param {Object} client A ClientConnection.
    @return {undefined} Nothing.
    */
    open: function(client) {
      if (!this.connected) {
        this.connected = true;
        this.set('client', client);
        var state = this.get('state');
        client.receive({
          ready: true,
          provider_type: state.get('providerType'),
          default_series: state.get('defaultSeries')
        });
        this.deltaIntervalId = setInterval(
            this.sendDelta.bind(this), this.get('deltaInterval'));
      } else if (this.get('client') !== client) {
        throw 'INVALID_STATE_ERR : Connection is open to another client.';
      }
    },

    _deltaWhitelist: {
      service: ['charm', 'config', 'constraints', 'exposed', 'id', 'name',
                'subordinate', 'annotations'],
      machine: ['agent_state', 'public_address', 'machine_id', 'id',
                'annotations'],
      unit: ['agent_state', 'machine', 'number', 'service', 'id',
             'annotations'],
      relation: ['relation_id', 'type', 'endpoints', 'scope', 'id'],
      annotation: ['annotations']
    },

    /**
    Send a delta of events to the client from since the last time they asked.

    @method sendDelta
    @return {undefined} Nothing.
    */
    sendDelta: function() {
      var state = this.get('state');
      var changes = state.nextChanges();
      if (changes && changes.error) {
        changes = null;
      }
      var annotations = state.nextAnnotations();
      if (annotations && annotations.error) {
        annotations = null;
      }
      if (changes || annotations) {
        var deltas = [];
        var response = {op: 'delta', result: deltas};
        Y.each(this._deltaWhitelist, function(whitelist, changeType) {
          var collectionName = changeType + 's';
          if (changes) {
            Y.each(changes[collectionName], function(change) {
              var attrs = _getDeltaAttrs(change[0], whitelist);
              var action = change[1] ? 'change' : 'remove';
              // The unit changeType is actually "serviceUnit" in the Python
              // stream.  Our model code handles either, so we're not modifying
              // it for now.
              deltas.push([changeType, action, attrs]);
            });
          }
          if (annotations) {
            Y.each(annotations[changeType + 's'], function(attrs, key) {
              if (!changes || !changes[key]) {
                attrs = _getDeltaAttrs(attrs, whitelist);
                // Special case environment handling.
                if (changeType === 'annotation') {
                  changeType = 'annotations';
                  attrs = attrs.annotations;
                }
                deltas.push([changeType, 'change', attrs]);
              }
            });
          }
        });
        if (deltas.length) {
          this.get('client').receiveNow(response);
        }
      }
    },

    /**
    Closes the connection to the sandbox Juju environment.
    Called by ClientConnection.

    @method close
    @return {undefined} Nothing.
    */
    close: function() {
      if (this.connected) {
        this.connected = false;
        clearInterval(this.deltaIntervalId);
        delete this.deltaIntervalId;
        this.set('client', undefined);
      }
    },

    /**
    Do any extra work to destroy the object.

    @method destructor
    @return {undefined} Nothing.
    */
    destructor: function() {
      this.close(); // Make sure the setInterval is cleared!
    },

    /**
    Receives messages from the client and dispatches them.

    @method receive
    @param {Object} data A hash of data sent from the client.
    @return {undefined} Nothing.
    */
    receive: function(data) {
      // Make a shallow copy of the received data because handlers will mutate
      // it to add an "err" or "result".
      if (this.connected) {
        this['performOp_' + data.op](Y.merge(data));
      } else {
        throw CLOSEDERROR;
      }
    },

    /**
    Handles login operations from the client.  Called by "receive".
    client.receive will receive all sent values back, transparently,
    plus a "result" value that will be true or false, representing whether
    the authentication succeeded or failed.

    @method performOp_login
    @param {Object} data A hash minimally of user and password.
    @return {undefined} Nothing.
    */
    performOp_login: function(data) {
      data.result = this.get('state').login(data.user, data.password);
      this.get('client').receive(data);
    },

    /**
    Handles deploy operations from client.  Called by receive.
    client.receive will receive all sent values back, transparently.
    If there is an error, the reply will also have an "err" with a string
    describing the error.

    @method performOp_deploy
    @param {Object} data A hash minimally of charm_url, and optionally also
      service_name, config, config_raw, and num_units.
    @return {undefined} Nothing.
    */
    performOp_deploy: function(data) {
      var client = this.get('client');
      var callback = function(result) {
        if (result.error) {
          data.err = result.error;
        }
        client.receiveNow(data);
      };
      this.get('state').deploy(data.charm_url, callback, {
        name: data.service_name,
        config: data.config,
        configYAML: data.config_raw,
        unitCount: data.num_units
      });
    },

    /**
      Handles add unit operations from the client.

      @method performOp_add_unit
      @param {Object} data Contains service_name and num_units required for
        adding additional units.
    */
    performOp_add_unit: function(data) {
      var res = this.get('state').addUnit(data.service_name, data.num_units);
      if (res.error) {
        data.err = res.error;
      } else {
        data.result = Y.Array.map(res.units, function(unit) {
          return unit.id;
        });
      }
      // respond with the new data or error
      this.get('client').receiveNow(data);
    },

    /**
      get_service from the client.

      @method performOp_get_service
      @param {Object} data contains service_name.
    */
    performOp_get_service: function(data) {
      OP(this, 'getService', ['service_name'], data);
    },

    /**
      destroy_service from the client.

      @method performOp_destroy_service
      @param {Object} data contains service_name.
    */
    performOp_destroy_service: function(data) {
      OP(this, 'destroyService', ['service_name'], data);
    },

    /**
      get_charm from the client.

      @method performOp_get_charm
      @param {Object} data contains service_name.
    */
    performOp_get_charm: function(data) {
      ASYNC_OP(this, 'getCharm', ['charm_url'])(data);
    },

    /**
      set_constraints from the client.

      @method performOp_set_constraints
      @param {Object} data contains service_name and constraints as either a
                      key/value map or an array of "key=value" strings..
    */
    performOp_set_constraints: function(data) {
      OP(this, 'setConstraints', ['service_name', 'constraints'], data);
    },

    /**
      set_config from the client.

      @method performOp_set_config
      @param {Object} data contains service_name and a config mapping
                      of key/value pairs.
    */
    performOp_set_config: function(data) {
      OP(this, 'setConfig', ['service_name', 'config'], data);
    },

    /**
     * Update annotations rpc
     *
     * @method performOp_update_annotations
     * @param {Object} data with entity name and payload.
     */
    performOp_update_annotations: function(data) {
      OP(this, 'updateAnnotations', ['entity', 'data'], data);
    },

    /**
     * Perform 'resolved' operation.
     * @method performOp_resolved
     * @param {Object} data with unitName and optional relation name.
     */
    performOp_resolved: function(data) {
      OP(this, 'resolved', ['unit_name', 'relation_name'], data);
    },

    /**
     * Perform 'export' operation.
     * @method performOp_export
     */
    performOp_exportEnvironment: function(data) {
      OP(this, 'exportEnvironment', [], data);
    },

    /**
     * Perform 'import' operation.
     * @method performOp_importEnvironment
     */
    performOp_importEnvironment: function(data) {
      ASYNC_OP(this, 'importEnvironment', ['envData'])(data);
    },

    /**
      Handles the remove unit operations from the client

      @method performOp_remove_unit
      @param {Object} data Contains unit_names to remove and a calback.
    */
    performOp_remove_units: function(data) {
      var res = this.get('state').removeUnits(data.unit_names);
      if (res.error.length > 0) {
        data.err = res.error;
        data.result = false;
      } else {
        data.result = true;
      }
      // respond with the new data or error
      this.get('client').receiveNow(data);
    },

    /**
      Handles exposing a service request from the client.

      @method performOp_expose
      @param {Object} data Contains service_name to expose and a callback.
    */
    performOp_expose: function(data) {
      var res = this.get('state').expose(data.service_name);

      data.err = res.error;
      data.result = (res.error === undefined);

      this.get('client').receiveNow(data);
    },

    /**
      Handles unexposing a service request from the client.

      @method performOp_unexpose
      @param {Object} data contains service_name to unexpose and a callback.
    */
    performOp_unexpose: function(data) {
      var res = this.get('state').unexpose(data.service_name);

      data.err = res.error;
      data.result = (res.error === undefined);

      this.get('client').receiveNow(data);
    },

    /**
      Handles adding a relation between two supplied services from the client

      @method performOp_add_relation
      @param {Object} data Object contains the operation, two endpoint strings
        and request id.
    */
    performOp_add_relation: function(data) {
      var relation = this.get('state').addRelation(
          data.endpoint_a, data.endpoint_b);

      if (relation === false) {
        // If everything checks out but could not create a new relation model
        data.err = 'Unable to create relation';
        this.get('client').receiveNow(data);
        return;
      }

      if (relation.error) {
        data.err = relation.error;
        this.get('client').receive(data);
        return;
      }
      // Normalize endpoints so that they are in the format
      // serviceName: { name: 'interface-name' }
      var normalizedEndpoints, epA = {}, epB = {};
      epA[relation.endpoints[0][0]] = relation.endpoints[0][1];
      epB[relation.endpoints[1][0]] = relation.endpoints[1][1];

      data.result = {
        endpoints: [epA, epB],
        id: relation.relationId,
        // interface is a reserved word
        'interface': relation.type,
        scope: relation.scope,
        request_id: data.request_id
      };

      this.get('client').receive(data);
    },

    /**
      Handles removing a relation between two supplied services from the client

      @method performOp_remove_relation
      @param {Object} data Object contains the operation, two endpoint strings
        and request id.
    */
    performOp_remove_relation: function(data) {
      var relation = this.get('state').removeRelation(
          data.endpoint_a, data.endpoint_b);

      if (relation.error) {
        data.err = relation.error;
      } else {
        data.result = true;
      }

      this.get('client').receive(data);
    }

  });

  sandboxModule.PyJujuAPI = PyJujuAPI;

  /**
  A sandbox Juju environment using the Go API.

  @class GoJujuAPI
  */
  function GoJujuAPI(config) {
    GoJujuAPI.superclass.constructor.apply(this, arguments);
  }

  GoJujuAPI.NAME = 'sandbox-py-juju-api';
  GoJujuAPI.ATTRS = {
    state: {},
    client: {}
  };

  Y.extend(GoJujuAPI, Y.Base, {

    /**
    Initializes.

    @method initializer
    @return {undefined} Nothing.
    */
    initializer: function() {
      this.connected = false;
    },

    /**
    Opens the connection to the sandbox Juju environment.
    Called by ClientConnection, which sends itself.

    @method open
    @param {Object} client A ClientConnection.
    @return {undefined} Nothing.
    */
    open: function(client) {
      if (!this.connected) {
        this.connected = true;
        this.set('client', client);
      } else if (this.get('client') !== client) {
        throw 'INVALID_STATE_ERR : Connection is open to another client.';
      }
    },

    /**
    Closes the connection to the sandbox Juju environment.
    Called by ClientConnection.

    @method close
    @return {undefined} Nothing.
    */
    close: function() {
      if (this.connected) {
        this.connected = false;
        this.set('client', undefined);
      }
    },

    /**
    Do any extra work to destroy the object.

    @method destructor
    @return {undefined} Nothing.
    */
    destructor: function() {
      this.close();
    },

    /**
    Receives messages from the client and dispatches them.

    @method receive
    @param {Object} data A hash of data sent from the client.
    @return {undefined} Nothing.
    */
    receive: function(data) {
      console.log('client message', data);
      if (this.connected) {
        this['handle_' + data.Type + '_' + data.Request](data,
            this.get('client'), this.get('state'));
      } else {
        throw CLOSEDERROR;
      }
    },

    /**
    Handle Login messages to the state object.

    @method handle_Admin_Login
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_Admin_Login: function(data, client, state) {
      data.Error = !state.login(data.Params.AuthTag, data.Params.Password);
      client.receive(data);
    },

    /**
    Handle EnvironmentView messages.

    @method handle_Client_ServiceGet
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_Client_EnvironmentInfo: function(data, client, state) {
      client.receive({
        ProviderType: state.get('providerType'),
        DefaultSeries: state.get('defaultSeries'),
        Name: 'Sandbox'
      });
    },

    /**
    Handle WatchAll messages.

    @method handle_Client_WatchAll
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_Client_WatchAll: function(data, client, state) {
      // TODO wire up delta stream to "Next" responses here.
      client.receive({Response: {AllWatcherId: '42'}});
    },

    /**
    Handle AllWatcher Next messages.

    @method handle_AllWatcher_Next
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_AllWatcher_Next: function(data, client, state) {
      // This is a noop for the moment because it must exist but the current
      // functionality does not depend on it having any effect.
      // TODO See if there are any changes and if so, send them.
    },

    /**
    Handle ServiceDeploy messages

    @method handle_Client_ServiceDeploy
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_Client_ServiceDeploy: function(data, client, state) {
      var callback = function(result) {
        var response = {RequestId: data.RequestId};
        if (result.error) {
          response.Error = result.error;
        }
        client.receive(response);
      };
      state.deploy(data.Params.CharmUrl, callback, {
        name: data.Params.ServiceName,
        config: data.Params.Config,
        configYAML: data.Params.ConfigYAML,
        unitCount: data.Params.NumUnits
      });
    },

    /**
    Handle SetAnnotations messages

    @method handle_Client_SetAnnotations
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_Client_SetAnnotations: function(data, client, state) {
      var serviceId = /service-([^ ]*)$/.exec(data.Params.Tag)[1];
      var reply = state.updateAnnotations(serviceId, data.Params.Pairs);
      client.receive({
        RequestId: data.RequestId,
        Error: reply.error});
    },

    /**
    Handle ServiceGet messages

    @method handle_Client_ServiceGet
    @param {Object} data The contents of the API arguments.
    @param {Object} client The active ClientConnection.
    @param {Object} state An instance of FakeBackend.
    */
    handle_Client_ServiceGet: function(data, client, state) {
      var reply = state.getService(data.Params.ServiceName);
      // TODO Include the optional Config or Constraints in the response.
      client.receive({
        RequestId: data.RequestId,
        Error: reply.error,
        Response: {Service: data.Params.ServiceName}});
    }

  });

  sandboxModule.GoJujuAPI = GoJujuAPI;
}, '0.1.0', {
  requires: [
    'base',
    'timers',
    'json-parse'
  ]
});
