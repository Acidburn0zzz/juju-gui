/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012  Canonical Ltd.
Copyright (C) 2013  Canonical Ltd.

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

describe('Landscape integration', function() {

  var views, models, db, landscape, Y;

  before(function(done) {
    Y = YUI(GlobalConfig).use(['node',
      'juju-landscape',
      'juju-models',
      'juju-views'], function(Y) {
      var envAnno;

      views = Y.namespace('juju.views');
      models = Y.namespace('juju.models');

      db = new models.Database();
      landscape = new views.Landscape();
      landscape.set('db', db);

      // Set defaults for testing.
      envAnno = db.environment.get('annotations');
      envAnno['landscape-url'] = 'http://landscape.com';
      envAnno['landscape-computers'] = '/computers/criteria/environment:test';
      envAnno['landscape-reboot-alert-url'] =
          '+alert:computer-reboot/info#power';
      envAnno['landscape-security-alert-url'] =
          '+alert:security-upgrades/packages/list?filter=security';

      // Create a default Service and some units.
      db.services.add({id: 'mysql',
        annotations: {'landscape-computers': '+service:mysql'}
      });
      db.units.add([{id: 'mysql/0',
        annotations: {'landscape-computer': '+unit:mysql-0'}
      }, {
        id: 'mysql/1',
        annotations: {'landscape-computer': '+unit:mysql-1'}
      }]);

      done();
    });
  });

  it('should provide valid Landscape URLs for given object', function() {
    var url;
    url = landscape.getLandscapeURL(db.environment);
    url.should.equal(
        'http://landscape.com/computers/criteria/environment:test/');

    url = landscape.getLandscapeURL(db.environment, 'security');
    url.should.equal(
        'http://landscape.com/computers/criteria/environment:test' +
        '+alert:security-upgrades/packages/list?filter=security');

    url = landscape.getLandscapeURL(db.environment, 'reboot');
    url.should.equal(
        'http://landscape.com/computers/criteria/environment:test' +
        '+alert:computer-reboot/info#power');

    url = landscape.getLandscapeURL(db.services.getById('mysql'));
    url.should.equal(
        'http://landscape.com/computers/criteria/environment:test+service:mysql/');

    url = landscape.getLandscapeURL(db.units.item(0));
    url.should.equal(
        'http://landscape.com/computers/criteria/environment:test+unit:mysql-0/');
  });


  it('should summarize landscape annotations at object parents', function() {
    var anno, unit1, unit2;
    var env = db.environment;
    var mysql = db.services.getById('mysql');

    landscape.update();
    anno = db.environment.get('annotations');

    unit1 = db.units.item(0);
    unit2 = db.units.item(1);

    // The delta stream will set this if the unit has annotations
    // but we don't make an empty by default as we need units to
    // scale well.
    unit1.annotations = {};
    unit2.annotations = {};

    unit1.annotations['landscape-needs-reboot'] = true;
    unit2.annotations['landscape-security-upgrades'] = true;

    // Check rollup to environment.
    landscape.update();
    env['landscape-needs-reboot'].should.equal(true);
    env['landscape-security-upgrades'].should.equal(true);

    // Check rollup to service.
    mysql['landscape-needs-reboot'].should.equal(true);
    mysql['landscape-security-upgrades'].should.equal(true);

    // Remove one of the flags.
    unit2.annotations['landscape-security-upgrades'] = false;

    // Check rollup to environment.
    landscape.update();
    env['landscape-needs-reboot'].should.equal(true);
    env['landscape-security-upgrades'].should.equal(false);

    // Check rollup to service.
    mysql['landscape-needs-reboot'].should.equal(true);
    mysql['landscape-security-upgrades'].should.equal(false);

    // Add a second service with a unit in a flagged state
    // and make sure the environment reflects this.
    var wordpress = db.services.add({id: 'wordpress'});
    var unit3 = db.units.add({
      id: 'wordpress/0',
      annotations: {'landscape-security-upgrades': true}
    });
    // We expect the environment to be flagged now.
    landscape.update();
    env['landscape-security-upgrades'].should.equal(true);

    // ... and wordpress.
    wordpress['landscape-security-upgrades'].should.equal(true);

    // But mysql is still not flagged.
    mysql['landscape-security-upgrades'].should.equal(false);
  });

  it('should build the bottom-bar properly', function() {
    var env = db.environment;
    var mysql = db.services.getById('mysql');
    var unit = db.units.item(0);
    var partial = Y.Handlebars.partials['landscape-controls'];
    Y.one('body').append('<div id="test-node"></div>');
    var node = Y.one('#test-node');
    node.append(partial());

    views.utils.updateLandscapeBottomBar(landscape, env, env, node,
        'environment');

    // We should have the logo.
    node.one('.logo-tab i').hasClass('landscape_logo').should.equal(true);
    // We should have the correct URL for the machines.
    node.one('.machine-control a').get('href').should
      .equal('http://landscape.com/computers/criteria/environment:test/');
    // We should have visible controls.
    node.one('.updates-control').getStyle('display').should.equal('block');
    node.one('.restart-control').getStyle('display').should.equal('block');

    views.utils.updateLandscapeBottomBar(landscape, env, mysql, node,
        'service');

    // We should have the correct URL for the machines.
    node.one('.machine-control a').get('href').should.equal('http://' +
        'landscape.com/computers/criteria/environment:test+service:mysql/');
    // We should have visible restart but not update controls.
    node.one('.updates-control').getStyle('display').should.equal('none');
    node.one('.restart-control').getStyle('display').should.equal('block');

    // We handle missing annotations on a service.
    mysql.set('annotations', {});
    landscape.update();
    views.utils.updateLandscapeBottomBar(landscape, env, mysql, node,
        'service');
    node.one('.machine-control').getStyle('display').should.equal('none');

    // We handle normal unit annotations.
    unit.annotations = {'landscape-computer': '+unit:mysql-0'};
    landscape.update();

    views.utils.updateLandscapeBottomBar(landscape, env, unit, node,
        'unit');

    // We should have the correct URL for the machines.
    node.one('.machine-control a').get('href').should.equal('http://' +
        'landscape.com/computers/criteria/environment:test+unit:mysql-0/');
    // We should have no visible controls.
    node.one('.updates-control').getStyle('display').should.equal('none');
    node.one('.restart-control').getStyle('display').should.equal('none');

    // We handle completely missing annotations on a unit.
    delete unit.annotations;
    landscape.update();
    views.utils.updateLandscapeBottomBar(landscape, env, unit, node,
        'unit');
    node.one('.machine-control').getStyle('display').should.equal('none');

    node.remove();
  });

});
