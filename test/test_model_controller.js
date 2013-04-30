'use strict';

describe('Model Controller Promises', function() {
  var modelController, yui, env, db, conn, environment, load, serviceError,
      getService;

  before(function(done) {
    YUI(GlobalConfig).use(
        'juju-models', 'model-controller', 'juju-charm-models',
        'juju-view-environment', 'juju-tests-utils', function(Y) {
          var environments = Y.juju.environments;
          yui = Y;
          load = Y.juju.models.Charm.prototype.load;
          getService = environments.PythonEnvironment.prototype.get_service;
          done();
        });
  });

  beforeEach(function() {
    conn = new yui['juju-tests'].utils.SocketStub();
    environment = env = yui.juju.newEnvironment(
        {conn: conn});
    db = new yui.juju.models.Database();
    env.connect();
    modelController = new yui.juju.ModelController({
      db: db,
      env: env
    });
  });

  afterEach(function() {
    env.destroy();
    db.destroy();
    // conn has no destroy method
    modelController.destroy();
    serviceError = false;
  });

  /**
    Monkeypatching the Charm model's load method to allow the load calls
    to execute successfully.

    @method clobberLoad
    @static
  */
  function clobberLoad() {
    yui.juju.models.Charm.prototype.load = function(env, callback) {
      assert.deepEqual(env, environment);
      callback();
    };
  }

  /**
    Restores the Charm model's load method to its original value.

    @method restoreLoad
    @static
  */
  function restoreLoad() {
    yui.juju.models.Charm.prototype.load = load;
  }

  /**
    Monkeypatching the python environments get_service method to allow
    the get_service calls to execute successfully.

    @method clobberGetService
    @static
  */
  function clobberGetService() {
    yui.juju.environments.PythonEnvironment.prototype.get_service = function(
        serviceName, callback) {
      assert(typeof serviceName, 'string');
      // This is to test the error reject path of the getService tests
      if (serviceError === true) {
        callback({err: true});
      }
      // This adds the service for the getService success path
      db.services.add({id: serviceName});
      callback({
        service_name: serviceName,
        result: {
          config: '',
          constraints: ''
        }
      });
    };
  }

  /**
    Restores the Services model's load get_service to its original value.

    @method restireGetService
    @static
  */
  function restoreGetService() {
    yui.juju.environments.PythonEnvironment.prototype.get_service = getService;
  }

  it('will return a promise with a stored populated charm', function(done) {
    // this tests the first resolve path
    var charmId = 'cs:precise/wordpress-7',
        charm = db.charms.add({id: charmId});
    charm.loaded = true;
    var promise = modelController.getCharm(charmId);
    assert(yui.Promise.isPromise(promise), true);
    assert(!!db.charms.getById(charmId), true);
    promise.then(
        function(charm) {
          assert(charm.get('id'), charmId);
          assert(!!db.charms.getById(charmId), true);
          done();
        },
        function() {
          assert.fail('This should not have failed.');
          done();
        });
  });

  it('will return a promise with a populated charm', function(done) {
    // This tests the second resolve path
    clobberLoad();
    var charmId = 'cs:precise/wordpress-7',
        promise = modelController.getCharm(charmId);
    assert(yui.Promise.isPromise(promise), true);
    assert(db.charms.getById(charmId), null);
    promise.then(
        function(charm) {
          assert(charm.get('package_name'), 'wordpress');
          restoreLoad();
          done();
        },
        function() {
          assert.fail('This should not have failed.');
          restoreLoad();
          done();
        });
  });

  it('will return a promise with a stored populated service', function(done) {
    // This tests the first resolve path
    var serviceId = 'wordpress',
        service = db.services.add({
          id: serviceId,
          loaded: true});
    var promise = modelController.getService(serviceId);
    assert(yui.Promise.isPromise(promise), true);
    assert(!!db.services.getById(serviceId), true);
    promise.then(
        function(service) {
          assert(service.get('id'), serviceId);
          assert(!!db.services.getById(serviceId), true);
          done();
        },
        function() {
          assert.fail('This should not have failed.');
          done();
        });

  });

  it('will return a promise with a populated service', function(done) {
    // This tests the second resolve path
    clobberGetService();
    var serviceId = 'wordpress',
        promise = modelController.getService(serviceId);
    assert(yui.Promise.isPromise(promise), true);
    assert(db.services.getById(serviceId), null);
    promise.then(
        function(service) {
          assert(service.get('id'), serviceId);
          assert(!!db.services.getById(serviceId), true);
          restoreGetService();
          done();
        },
        function() {
          assert.fail('This should not have failed.');
          restoreGetService();
          done();
        });
  });

  it('will reject the promise if the service does not exist', function(done) {
    serviceError = true;
    clobberGetService();
    var serviceId = 'wordpress',
        promise = modelController.getService(serviceId);
    assert(yui.Promise.isPromise(promise), true);
    assert(db.services.getById(serviceId), null);
    promise.then(
        function() {
          assert.fail('This should not have been successful.');
          restoreGetService();
          done();
        },
        function(err) {
          assert(err.err, true);
          restoreGetService();
          done();
        });
  });

  it('will return a promise with a populated charm and service',
      function(done) {
        clobberLoad();
        clobberGetService();
        var serviceId = 'wordpress',
            charmId = 'cs:precise/wordpress-7';
        db.services.add({
          id: serviceId,
          loaded: true,
          charm: charmId
        });
        var promise = modelController.getServiceWithCharm(serviceId);
        assert(yui.Promise.isPromise(promise), true);
        promise.then(
            function(result) {
              assert(result.service.get('id'), serviceId);
              assert(result.charm.get('id'), charmId);
              assert(!!db.services.getById(serviceId), true);
              assert(!!db.charms.getById(charmId), true);
              restoreLoad();
              restoreGetService();
              done();
            },
            function() {
              assert.fail('This should not have failed.');
              restoreLoad();
              restoreGetService();
              done();
            });

      });
});
