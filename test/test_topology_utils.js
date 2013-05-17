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

describe('topology utils', function() {
  var Y, utils;

  before(function(done) {
    Y = YUI(GlobalConfig).use(['array-extras', 'juju-topology-utils'],
        function(Y) {
          utils = Y.namespace('juju.topology.utils');
          done();
        });
  });

  it('should translate service boxes to vertices', function() {
    var serviceBoxes = {
      one: {x: 100, y: 100},
      two: {x: 200, y: 100},
      red: {x: 100, y: 200},
      blue: {x: 200, y: 200}
    };
    var mungedBoxes = utils.serviceBoxesToVertices(serviceBoxes);
    assert.deepEqual(mungedBoxes,
        [[100, 100], [200, 100], [100, 200], [200, 200]]);
  });

  it('should place points outside a graph', function() {
    // Empty array returns [padding, padding].
    var existing = [];
    assert.deepEqual(utils.pointOutside(existing, 100), [100, 100]);
    // One vertex pads on x.
    existing.push([100, 100]);
    assert.deepEqual(utils.pointOutside(existing, 100), [200, 100]);
    // Two vertices pads on x on the second vertex.
    existing.push([100, 200]);
    assert.deepEqual(utils.pointOutside(existing, 100), [200, 200]);
    // Three or more vertices pad on x on the furthest vertex from the origin.
    existing.push([200, 200]);
    assert.deepEqual(utils.pointOutside(existing, 100), [300, 200]);
  });
});
