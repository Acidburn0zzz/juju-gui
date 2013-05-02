'use strict';

(function() {
  describe('juju-views-utils', function() {
    var views, Y;
    before(function(done) {
      Y = YUI(GlobalConfig).use(
          'juju-view-utils', 'node-event-simulate',
          function(Y) {
            views = Y.namespace('juju.views');
            done();
          });
    });

    it('can generate a hash', function() {
      // We aren't testing the algorithm here, just basic hash characteristics.
      // It's a number.
      assert.strictEqual(views.utils.generateHash(''), 0);
      assert.isNumber(views.utils.generateHash('kumquat'));
      assert.isNumber(views.utils.generateHash('qumquat'));
      // It's stable.
      assert.strictEqual(
          views.utils.generateHash('kumquat'),
          views.utils.generateHash('kumquat'));
      // Different values hash differently.
      assert.notEqual(
          views.utils.generateHash('kumquat'),
          views.utils.generateHash('qumquat'));
    });

    it('can generate safe relation ids', function() {
      var relationId;
      relationId = 'foo:Bar relation-00000006!@#';
      assert.strictEqual(
          views.utils.generateSafeDOMId(relationId),
          'e-foo_Bar_relation_00000006___-' +
          views.utils.generateHash(relationId));
    });

    it('should create a confirmation panel',
       function() {
          var confirmed = false;
          var panel = views.createModalPanel(
              'Description',
              '#main',
              'Action Label',
              function() {confirmed = true;}
         );
          panel.show();
          var panel_node = panel.get('boundingBox'),
              button = panel_node.one('.btn-danger');
          button.getHTML().should.equal('Action Label');
          button.simulate('click');
          confirmed.should.equal(true);
          panel.destroy();
       });

    it('should hide the panel when the Cancel button is clicked',
       function() {
          var confirmed = false;
          var panel = views.createModalPanel(
              'Description',
              '#main',
              'Action Label',
              function() {confirmed = true;});
          panel.show();
          var panel_node = panel.get('boundingBox'),
              button = panel_node.one('.btn:not(.btn-danger)');
          button.getHTML().should.equal('Cancel');
          button.simulate('click');
          confirmed.should.equal(false);
          panel.destroy();
       });

    it('should allow you to reset the buttons', function() {
      var confirmed = false;
      var panel = views.createModalPanel(
          'Description',
          '#main',
          'First Action Label',
          function() {confirmed = false;});
      panel.get('buttons').footer.length.should.equal(2);
      views.setModalButtons(
          panel, 'Second Action Label', function() { confirmed = true; });
      panel.get('buttons').footer.length.should.equal(2);
      panel.show();
      var panel_node = panel.get('boundingBox'),
              button = panel_node.one('.btn-danger');
      button.getHTML().should.equal('Second Action Label');
      button.simulate('click');
      confirmed.should.equal(true);
      panel.destroy();
    });

  });
}) ();

describe('utilities', function() {
  var Y, views, models, utils;

  before(function(done) {
    Y = YUI(GlobalConfig).use(['juju-views', 'juju-models'], function(Y) {
      views = Y.namespace('juju.views');
      models = Y.namespace('juju.models');
      utils = Y.namespace('juju.views.utils');
      done();
    });
  });

  it('must be able to display humanize time ago messages', function() {
    var now = Y.Lang.now();
    // Javascript timestamps are in milliseconds
    views.humanizeTimestamp(now).should.equal('less than a minute ago');
    views.humanizeTimestamp(now + 600000).should.equal('10 minutes ago');
  });


  describe('isPythonRelation', function() {
    var isPythonRelation;

    before(function() {
      isPythonRelation = utils.isPythonRelation;
    });

    it('identifies PyJuju relations', function() {
      var relations = ['relation-0000000002', 'relation-42', 'relation-0'];
      relations.forEach(function(relation) {
        assert.isTrue(isPythonRelation(relation), relation);
      });
    });

    it('identifies juju-core relations', function() {
      var relations = [
        'wordpress:loadbalancer',
        'haproxy:reverseproxy wordpress:website',
        'relation-0000000002:mysql'
      ];
      relations.forEach(function(relation) {
        assert.isFalse(isPythonRelation(relation), relation);
      });
    });

  });


  describe('relations visualization', function() {
    var db, service;

    beforeEach(function() {
      db = new models.Database();
      service = new models.Service({
        id: 'mysql',
        charm: 'cs:mysql',
        unit_count: 1,
        loaded: true
      });
      db.services.add(service);
    });

    it('shows a PyJuju rel from the perspective of a service', function() {
      db.relations.add({
        'interface': 'mysql',
        scope: 'global',
        endpoints: [
          ['mysql', {role: 'server', name: 'mydb'}],
          ['mediawiki', {role: 'client', name: 'db'}]
        ],
        'id': 'relation-0000000002'
      });
      var results = utils.getRelationDataForService(db, service);
      assert.strictEqual(1, results.length);
      var result = results[0];
      assert.strictEqual('mysql', result['interface'], 'interface');
      assert.strictEqual('global', result.scope, 'scope');
      assert.strictEqual('relation-0000000002', result.id, 'id');
      assert.strictEqual(
          utils.generateSafeDOMId('relation-0000000002'),
          result.elementId,
          'elementId'
      );
      assert.strictEqual('mydb:2', result.ident, 'ident');
      assert.strictEqual('mysql', result.near.service, 'near service');
      assert.strictEqual('server', result.near.role, 'near role');
      assert.strictEqual('mydb', result.near.name, 'near name');
      assert.strictEqual('mediawiki', result.far.service, 'far service');
      assert.strictEqual('client', result.far.role, 'far role');
      assert.strictEqual('db', result.far.name, 'far name');
    });

    it('shows a juju-core rel from the perspective of a service', function() {
      db.relations.add({
        'interface': 'mysql',
        scope: 'global',
        endpoints: [
          ['mysql', {role: 'provider', name: 'mydb'}],
          ['mediawiki', {role: 'requirer', name: 'db'}]
        ],
        'id': 'mediawiki:db mysql:mydb'
      });
      var results = utils.getRelationDataForService(db, service);
      assert.strictEqual(1, results.length);
      var result = results[0];
      assert.strictEqual('mysql', result['interface'], 'interface');
      assert.strictEqual('global', result.scope, 'scope');
      assert.strictEqual('mediawiki:db mysql:mydb', result.id, 'id');
      assert.strictEqual(
          utils.generateSafeDOMId('mediawiki:db mysql:mydb'),
          result.elementId,
          'elementId'
      );
      assert.strictEqual('mediawiki:db mysql:mydb', result.ident, 'ident');
      assert.strictEqual('mysql', result.near.service, 'near service');
      assert.strictEqual('provider', result.near.role, 'near role');
      assert.strictEqual('mydb', result.near.name, 'near name');
      assert.strictEqual('mediawiki', result.far.service, 'far service');
      assert.strictEqual('requirer', result.far.role, 'far role');
      assert.strictEqual('db', result.far.name, 'far name');
    });

  });

});

(function() {
  describe('form validation', function() {

    var utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views',

          function(Y) {
            utils = Y.namespace('juju.views.utils');
            done();
          });
    });

    it('should handle int fields', function() {
      var schema = {an_int: {type: 'int'}};

      // If an int field has a valid value, no error is given.
      assert.equal(utils.validate({an_int: '0'}, schema).an_int, undefined);
      // If an int field has an invalid value, an error is reported.
      assert.equal(utils.validate({an_int: 'nope!'}, schema).an_int,
          'The value "nope!" is not an integer.');
      // Floating point numbers are not valid ints.
      assert.equal(utils.validate({an_int: '3.14159'}, schema).an_int,
          'The value "3.14159" is not an integer.');
      // Just starting with a number is not enough.
      assert.equal(utils.validate({an_int: '3peat'}, schema).an_int,
          'The value "3peat" is not an integer.');

      assert.equal(utils.validate({an_int: ''}, schema).an_int,
          'This field is required.');
      assert.equal(utils.validate({an_int: '  '}, schema).an_int,
          'This field is required.');

      // Floating point numbers are not valid ints.
      assert.equal(utils.validate({an_int: '+'}, schema).an_int,
          'The value "+" is not an integer.');
      assert.equal(utils.validate({an_int: '+1'}, schema).an_int,
          undefined);
      assert.equal(utils.validate({an_int: ' +1 '}, schema).an_int,
          undefined);
      // Just starting with a number is not enough.
      assert.equal(utils.validate({an_int: '-'}, schema).an_int,
          'The value "-" is not an integer.');
      assert.equal(utils.validate({an_int: '-1'}, schema).an_int,
          undefined);
      assert.equal(utils.validate({an_int: ' -1 '}, schema).an_int,
          undefined);

    });

    it('should handle float fields', function() {
      var schema = {a_float: {type: 'float'}};

      // Floating point numbers are valid floats.
      assert.equal(utils.validate({a_float: '3.14159'}, schema).a_float,
          undefined);
      // Decimal points are not strictly required.
      assert.equal(utils.validate({a_float: '42'}, schema).a_float, undefined);

      // Test numbers with - + and spaces
      assert.equal(utils.validate({a_float: '-42'}, schema).a_float,
          undefined);
      assert.equal(utils.validate({a_float: '+42'}, schema).a_float,
          undefined);
      assert.equal(utils.validate({a_float: ' +42 '}, schema).a_float,
          undefined);

      // Digits before the decimal point are not strictly required.
      assert.equal(utils.validate({a_float: '.5'}, schema).a_float, undefined);

      // Test numbers with - + and spaces
      assert.equal(utils.validate({a_float: '-0.5'}, schema).a_float,
          undefined);
      assert.equal(utils.validate({a_float: '+0.5'}, schema).a_float,
          undefined);
      assert.equal(utils.validate({a_float: ' -0.5 '}, schema).a_float,
          undefined);

      // If a float field has an invalid value, an error is reported.
      assert.equal(utils.validate({a_float: 'nope!'}, schema).a_float,
          'The value "nope!" is not a float.');
      // Just starting with a number is not enough.
      assert.equal(utils.validate({a_float: '3peat'}, schema).a_float,
          'The value "3peat" is not a float.');

      assert.equal(utils.validate({a_float: ''}, schema).a_float,
          'This field is required.');
      assert.equal(utils.validate({a_float: '  '}, schema).a_float,
          'This field is required.');

      assert.equal(utils.validate({a_float: '+'}, schema).a_float,
          'The value "+" is not a float.');
      assert.equal(utils.validate({a_float: '-'}, schema).a_float,
          'The value "-" is not a float.');
      assert.equal(utils.validate({a_float: '.'}, schema).a_float,
          'The value "." is not a float.');
    });

    it('should handle fields with defaults', function() {
      var defaults_schema =
          { an_int:
                { type: 'int',
                  'default': '7'},
            a_float:
                { type: 'float',
                  'default': '2.5'},
            a_string:
                { type: 'string',
                  'default': 'default'}};

      // If a field has a default and it is a numeric field and the value is an
      // empty string, then no error is generated.

      // Int:
      assert.equal(utils.validate({an_int: ''}, defaults_schema).an_int,
          undefined);
      // Float:
      assert.equal(utils.validate({a_float: ''}, defaults_schema).a_float,
          undefined);
    });

    it('should handle fields without defaults', function() {
      var no_defaults_schema =
          { an_int:
                { type: 'int'},
            a_float:
                { type: 'float'},
            a_string:
                { type: 'string'}};

      // If a field has no default and it is a numeric field and the value is
      // an empty string, then an error is generated.

      // Int without default:
      assert.equal(utils.validate({an_int: ''}, no_defaults_schema).an_int,
          'This field is required.');
      // Float without default
      assert.equal(utils.validate({a_float: ''}, no_defaults_schema).a_float,
          'This field is required.');
      // String fields do not generate errors when they are empty and do not
      // have a default because an empty string is still a string.
      assert.equal(utils.validate({a_string: ''}, no_defaults_schema).a_string,
          undefined);
    });

  });
})();

(function() {
  describe('service state simplification', function() {

    var simplifyState, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        simplifyState = Y.namespace('juju.views.utils').simplifyState;
        done();
      });
    });

    var makeUnit = function(state, relationErrors) {
      var unit = {agent_state: state};
      if (relationErrors) {
        unit.relation_errors = {myrelation: ['service']};
      }
      return unit;
    };

    it('translates service running states correctly', function() {
      var unit = makeUnit('started');
      assert.strictEqual('running', simplifyState(unit));
    });

    it('returns "error" if there is a relation error', function() {
      var unit = makeUnit('started', true); // Add a relation error.
      assert.strictEqual('error', simplifyState(unit));
    });

    it('has the ability to ignore relation errors', function() {
      var unit = makeUnit('started', true); // Add a relation error.
      var result = simplifyState(unit, true); // Ignore relation errors.
      assert.strictEqual('running', result);
    });

    it('translates service error states correctly', function() {
      var states = ['install-error', 'foo-error', '-error', 'error'];
      states.forEach(function(state) {
        var unit = makeUnit(state);
        assert.strictEqual('error', simplifyState(unit), state);
      });
    });

    it('translates service pending states correctly', function() {
      var states = ['pending', 'installed', 'waiting', 'stopped'];
      states.forEach(function(state) {
        var unit = makeUnit(state);
        assert.strictEqual('pending', simplifyState(unit), state);
      });
    });

  });
})();

(function() {
  describe('state to style', function() {

    var utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        utils = Y.namespace('juju.views.utils');
        done();
      });
    });

    it('should translate unit states to styles correctly', function() {
      // The states 'installed', 'pending' and 'stopped' are turned
      // into 'state-pending'.
      assert.equal('state-pending', utils.stateToStyle('installed'));
      assert.equal('state-pending', utils.stateToStyle('pending'));
      assert.equal('state-pending', utils.stateToStyle('stopped'));
      // The state 'started' is turned into 'state-started'.
      assert.equal('state-started', utils.stateToStyle('started'));
      // The states 'install-error', 'start-error' and 'stop-error' are turned
      // into 'state-error'.
      assert.equal('state-error', utils.stateToStyle('install-error'));
      assert.equal('state-error', utils.stateToStyle('start-error'));
      assert.equal('state-error', utils.stateToStyle('stop-error'));
    });

    it('should add the computed class to the existing ones', function() {
      var classes = utils.stateToStyle('pending', 'existing');
      assert.include(classes, 'state-pending');
      assert.include(classes, 'existing');
    });

  });
})();

(function() {
  describe('utils.isGuiService', function() {

    var utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        utils = Y.namespace('juju.views.utils');
        done();
      });
    });

    it('should extract values from "charm" attribute', function() {
      var candidate = {charm: 'cs:precise/juju-gui-7'};
      assert.isTrue(utils.isGuiService(candidate));
    });

    it('should extract values from .get("charm")', function() {
      var candidate = {
        get: function(name) {
          if (name === 'charm') {
            return 'cs:precise/juju-gui-7';
          }
        }
      };
      assert.isTrue(utils.isGuiService(candidate));
    });

  });
})();

(function() {
  describe('utils.extractServiceSettings', function() {
    var utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        utils = Y.namespace('juju.views.utils');
        done();
      });
    });

    it('should identify booleans with default', function() {
      var schema = {
        an_entry: {
          type: 'boolean',
          name: 'present',
          'default': true
        }
      };

      var settings = utils.extractServiceSettings(schema);
      assert.isTrue(settings[0].isBool);
      assert.isUndefined(settings[0].isNumeric);
      assert.equal('checked', settings[0].value);
    });

    it('should identify booleans without default', function() {
      var schema = {
        an_entry: {
          type: 'boolean',
          name: 'present'
        }
      };

      var settings = utils.extractServiceSettings(schema);
      assert.isTrue(settings[0].isBool);
      assert.isUndefined(settings[0].isNumeric);
      assert.equal('', settings[0].value);
    });

    it('should identify text input with simple default', function() {
      var schema = {
        an_entry: {
          type: 'string',
          name: 'thing',
          'default': 'something'
        }
      };

      var settings = utils.extractServiceSettings(schema);
      assert.isUndefined(settings[0].isBool);
      assert.isUndefined(settings[0].isNumeric);
      assert.equal('something', settings[0].value);
    });

    it('should identify ints', function() {
      var schema = {
        an_entry: {
          type: 'int',
          name: 'thing',
          'default': 100
        }
      };

      var settings = utils.extractServiceSettings(schema);
      assert.isUndefined(settings[0].isBool);
      assert.isTrue(settings[0].isNumeric);
      assert.equal(100, settings[0].value);
    });

    it('should identify floats', function() {
      var schema = {
        an_entry: {
          type: 'float',
          name: 'thing',
          'default': 10.0
        }
      };

      var settings = utils.extractServiceSettings(schema);
      assert.isUndefined(settings[0].isBool);
      assert.isTrue(settings[0].isNumeric);
      assert.equal(10.0, settings[0].value);
    });

    it('should use config values if passed', function() {
      var schema = {
        a_string: {
          type: 'string',
          name: 'thing',
          'default': 'something\neven\nmore'
        },
        another_string: {
          type: 'string',
          name: 'thing2',
          'default': 'schema default'
        },
        a_float: {
          type: 'float',
          name: 'another thing',
          'default': 10.0
        }

      };

      var serviceConfig = {
        a_string: 'service value',
        some_other_thing: 'junk',
        a_float: 3.14159
      };

      var settings = utils.extractServiceSettings(schema, serviceConfig);
      assert.isUndefined(settings[0].isBool);
      assert.equal('service value', settings[0].value);

      // The service config value is not complete in that it does not have an
      // entry for 'another_string'.  As such, the value returned for that
      // entry is undefined.
      assert.isUndefined(settings[1].value);

      assert.isUndefined(settings[2].isBool);
      assert.equal(3.14159, settings[2].value);
    });
  });
})();

(function() {
  describe('utils.isGuiCharmUrl', function() {

    var utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        utils = Y.namespace('juju.views.utils');
        done();
      });
    });

    it('should recognize charm store URLs', function() {
      assert.isTrue(utils.isGuiCharmUrl('cs:precise/juju-gui-7'));
    });

    it('should recognize unofficial charm store URLs', function() {
      assert.isTrue(utils.isGuiCharmUrl('cs:~foobar/precise/juju-gui-7'));
    });

    it('should ignore owners of unofficial charm store URLs', function() {
      assert.isFalse(utils.isGuiCharmUrl('cs:~juju-gui/precise/foobar-7'));
    });

    it('should recognize local charm URLs', function() {
      assert.isTrue(utils.isGuiCharmUrl('local:juju-gui-3'));
    });

    it('should not allow junk on the end of the URL', function() {
      assert.isFalse(utils.isGuiCharmUrl('local:juju-gui-3 ROFLCOPTR!'));
    });

  });
})();


(function() {
  describe('DecoratedRelation', function() {

    var utils, views, Y, inputRelation, source, target;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        utils = Y.namespace('juju.views.utils');
        views = Y.namespace('juju.views');
        done();
      });
    });

    beforeEach(function() {
      source = {
        modelId: function() {
          return 'source-id';
        }
      };
      target = {
        modelId: function() {
          return 'target-id';
        }
      };
      inputRelation = {
        getAttrs: function() {
          return {};
        }
      };

    });

    it('mirrors the relation\'s properties', function() {
      var relation = {
        getAttrs: function() {
          return {foo: 'bar'};
        }
      };
      relation = views.DecoratedRelation(relation, source, target);
      assert.deepProperty(relation, 'foo');
      assert.equal(relation.foo, 'bar');
    });

    it('exposes the source and target as attributes', function() {
      var relation = views.DecoratedRelation(inputRelation, source, target);
      assert.equal(relation.source, source);
      assert.equal(relation.target, target);
    });

    it('generates an ID that includes source and target IDs', function() {
      var relation = views.DecoratedRelation(inputRelation, source, target);
      assert.match(relation.compositeId, new RegExp(source.modelId()));
      assert.match(relation.compositeId, new RegExp(target.modelId()));
    });

    it('includes endpoint names in its ID, if they exist', function() {
      var source = {
        modelId: function() {
          return 'source-id';
        }
      };
      var target = {
        modelId: function() {
          return 'target-id';
        }
      };
      var firstEndpointName = 'endpoint-1';
      var secondEndpointName = 'endpoint-2';
      inputRelation.endpoints = [
        [null, {name: firstEndpointName}],
        [null, {name: secondEndpointName}]
      ];
      var relation = views.DecoratedRelation(inputRelation, source, target);
      assert.match(relation.compositeId, new RegExp(firstEndpointName));
      assert.match(relation.compositeId, new RegExp(secondEndpointName));
    });

    it('exposes the fact that a relation is a subordinate', function() {
      var inputRelation = {
        getAttrs: function() {
          return {scope: 'container'};
        }
      };
      var relation = views.DecoratedRelation(inputRelation, source, target);
      assert.isTrue(relation.isSubordinate);
    });

    it('exposes the fact that a relation is not a subordinate', function() {
      var inputRelation = {
        getAttrs: function() {
          return {scope: 'not-container'};
        }
      };
      var relation = views.DecoratedRelation(inputRelation, source, target);
      assert.isFalse(relation.isSubordinate);
    });

  });
})();

(function() {
  describe('utils.isSubordinateRelation', function() {

    var utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use('juju-views', function(Y) {
        utils = Y.namespace('juju.views.utils');
        done();
      });
    });

    it('can tell if a relation is a subordinate', function() {
      var relation = {scope: 'container'};
      assert.isTrue(utils.isSubordinateRelation(relation));
    });

    it('can tell if a relation is not a subordinate', function() {
      var relation = {scope: 'not-a-container'};
      assert.isFalse(utils.isSubordinateRelation(relation));
    });

  });
})();

(function() {
  describe('template helpers', function() {
    var Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use(['juju-view-utils', 'handlebars'], function(Y) {
        done();
      });
    });

    it('pluralizes correctly', function() {
      var source = '{{ pluralize \'foo\' bar }}',
          template = Y.Handlebars.compile(source),
          context = {bar: 1},
          html = template(context);
      assert.equal('foo', html);

      context = {bar: 2};
      html = template(context);
      assert.equal('foos', html);

      context = {bar: [1]};
      html = template(context);
      assert.equal('foo', html);

      context = {bar: [1, 2]};
      html = template(context);
      assert.equal('foos', html);
    });

    it('can pluralize with an alternate word', function() {
      var source = '{{ pluralize \'foo\' bar \'fooi\' }}',
          template = Y.Handlebars.compile(source),
          context = {bar: 1},
          html = template(context);
      assert.equal('foo', html);

      context = {bar: 2};
      html = template(context);
      assert.equal('fooi', html);
    });

    it('truncates a string', function() {
      var source = '{{ truncate text 30 }}',
          template = Y.Handlebars.compile(source),
          context = {text: 'Lorem ipsum dolor sit amet consectetur'},
          html = template(context);
      assert.equal('Lorem ipsum dolor sit amet con...', html);
    });

    it('truncates a string with a trailing space', function() {
      var source = '{{ truncate text 30 }}',
          template = Y.Handlebars.compile(source),
          context = {text: 'Lorem ipsum dolor sit ametuco sectetur'},
          html = template(context);
      assert.equal('Lorem ipsum dolor sit ametuco...', html);
    });

    it('does not truncate a shorter string', function() {
      var source = '{{ truncate text 30 }}',
          template = Y.Handlebars.compile(source),
          context = {text: 'Lorem ipsum dolor sit amet'},
          html = template(context);
      assert.equal('Lorem ipsum dolor sit amet', html);
    });

    it('truncate handles an undefined value', function() {
      var source = '{{ truncate text 30 }}is empty',
          template = Y.Handlebars.compile(source),
          context = {text: undefined},
          html = template(context);
      assert.equal('is empty', html);
    });

    describe('showStatus', function() {
      var html, obj, template;

      before(function() {
        template = Y.Handlebars.compile('{{showStatus instance}}');
      });

      beforeEach(function() {
        obj = {agent_state: 'started'};
      });

      it('shows the instance status correctly', function() {
        html = template({instance: obj});
        assert.strictEqual(obj.agent_state, html);
      });

      it('avoids including status info if not present', function() {
        [undefined, null, ''].forEach(function(info) {
          obj.agent_state_info = info;
          html = template({instance: obj});
          assert.strictEqual(obj.agent_state, html, 'info: ' + info);
        });
      });

      it('includes status info if present', function() {
        obj.agent_state_info = 'some information';
        html = template({instance: obj});
        var expected = obj.agent_state + ': ' + obj.agent_state_info;
        assert.strictEqual(expected, html);
      });

    });

  });
})();
