/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2015 Canonical Ltd.

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

var juju = {components: {}}; // eslint-disable-line no-unused-vars

describe('LoginComponent', function() {

  beforeAll(function(done) {
    // By loading this file it adds the component to the juju components.
    YUI().use('login-component', function() { done(); });
  });

  it('renders', function() {
    var renderer = jsTestUtils.shallowRender(
      <juju.components.Login
        helpMessage={<span>Exterminate!</span>}
        setCredentials={sinon.stub()}
        login={sinon.stub()}/>, true);
    var instance = renderer.getMountedInstance();
    var output = renderer.getRenderOutput();
    var expected = (
      <div className="login">
        <div className="login__logo">
          <juju.components.SvgIcon width="75" height="30" name="juju-logo" />
        </div>
        <div className="login__full-form">
          <div className="login__env-name">
            Login
          </div>
          {undefined}
          <form
            className="login__form"
            ref="form"
            onSubmit={instance._handleSubmit}>
            <label
              className="login__label">
              Username
              <input
                className="login__input"
                type="text"
                name="username"
                ref="username" />
            </label>
            <label
              className="login__label">
              Password
              <input
                className="login__input"
                type="password"
                name="password"
                ref="password" />
            </label>
            <juju.components.GenericButton
              action={instance._handleSubmit}
              submit={true}
              type="positive"
              title="Login" />
          </form>
        </div>
        <div className="login__message">
          <span>Exterminate!</span>
          <div className="login__message-link">
            <a
              href="https://jujucharms.com"
              target="_blank">
              jujucharms.com
            </a>
          </div>
        </div>
      </div>
    );
    assert.deepEqual(output, expected);
  });

  it('can display a login failure message', function() {
    var output = jsTestUtils.shallowRender(
      <juju.components.Login
        helpMessage={<span>Exterminate!</span>}
        setCredentials={sinon.stub()}
        login={sinon.stub()}
        loginFailure={true} />);
    var expected = (
      <div className="login__failure-message">
        The supplied username or password was incorrect.
      </div>);
    assert.deepEqual(
      output.props.children[1].props.children[1], expected);
  });

  it('calls to log the user in on submit', function() {
    var setCredentials = sinon.stub();
    var login = sinon.stub();
    var component = testUtils.renderIntoDocument(
      <juju.components.Login
        helpMessage={<span>Exterminate!</span>}
        setCredentials={setCredentials}
        login={login} />);
    component.refs.username.value = 'foo';
    component.refs.password.value = 'bar';

    testUtils.Simulate.submit(component.refs.form);

    assert.equal(setCredentials.callCount, 1, 'setCredentials never called');
    assert.deepEqual(setCredentials.args[0][0], {
      user: 'foo',
      password: 'bar'
    });
    assert.equal(login.callCount, 1, 'login never called');
  });

  it('can focus on the username field', function() {
    var focus = sinon.stub();
    var renderer = jsTestUtils.shallowRender(
      <juju.components.Login
        helpMessage={<span>Exterminate!</span>}
        setCredentials={sinon.stub()}
        login={sinon.stub()}
        loginFailure={true} />, true);
    var instance = renderer.getMountedInstance();
    instance.refs = {username: {focus: focus}};
    instance.componentDidMount();
    assert.equal(focus.callCount, 1);
  });
});
