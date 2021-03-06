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

YUI.add('deployment-choose-cloud', function() {

  juju.components.DeploymentChooseCloud = React.createClass({

    propTypes: {
      changeCounts: React.PropTypes.object.isRequired,
      changeState: React.PropTypes.func.isRequired,
      clouds: React.PropTypes.object.isRequired,
      jem: React.PropTypes.object.isRequired,
      pluralize: React.PropTypes.func.isRequired,
      services: React.PropTypes.array.isRequired,
      setDeploymentInfo: React.PropTypes.func.isRequired,
      user: React.PropTypes.object.isRequired
    },

    getInitialState: function() {
      return {
        credentials: []
      };
    },

    componentWillMount: function() {
      this.props.jem.listTemplates((error, credentials) => {
        // XXX kadams54: This is basic error handling for the initial
        // implementation. It should be replaced with an error message for the
        // user in subsequent UI polish work.
        if (error) {
          console.error('Unable to list templates', error);
          return;
        }
        this.setState({credentials: credentials});
      });
    },

    /**
      Generate the list of credentials.

      @method _generateCredentials
    */
    _generateCredentials: function() {
      var credentials = this.state.credentials;
      if (!credentials || credentials.length === 0) {
        return;
      }
      var components = [];
      credentials.forEach((credential, i) => {
        var className = classNames(
          'deployment-choose-cloud__cloud-option',
          'deployment-choose-cloud__cloud-option--credential',
          'six-col',
          {'last-col': i % 2 === 1}
        );
        components.push(
          <li className={className}
            key={credential.path}
            onClick={this._handleCredentialClick.bind(this, credential.path)}>
            <span className="deployment-choose-cloud__cloud-option-title">
              {credential.path}
            </span>
          </li>);
      });
      return (
        <div>
          <h3 className="deployment-panel__section-title twelve-col">
            Your cloud credentials
          </h3>
          <ul className="deployment-choose-cloud__list twelve-col">
            {components}
          </ul>
        </div>);
    },

    /**
      Generate a list of cloud options.

      @method _generateChangeItems
      @returns {Array} The collection of changes.
    */
    _generateOptions: function() {
      var components = [];
      var clouds = this.props.clouds;
      Object.keys(clouds).forEach(function(cloud, i) {
        var option = clouds[cloud];
        var lastCol = i % 2 === 1 ? 'last-col' : '';
        var className = 'deployment-choose-cloud__cloud-option six-col ' +
          lastCol;
        components.push(
          <li className={className}
            key={option.id}
            onClick={this._handleCloudClick.bind(this, option.id)}>
            <span className="deployment-choose-cloud__cloud-option-image">
              <juju.components.SvgIcon
                height={option.svgHeight}
                name={option.id}
                width={option.svgWidth} />
            </span>
          </li>);
      }, this);
      return components;
    },

    /**
      Handling clicking on a cloud option.

      @method _handleCloudClick
    */
    _handleCloudClick: function(id) {
      this.props.changeState({
        sectionC: {
          component: 'deploy',
          metadata: {
            activeComponent: `add-credentials-${id}`
          }
        }
      });
    },

    /**
      Handling clicking on an existing credential option.

      @method _handleCredentialClick
    */
    _handleCredentialClick: function(id) {
      this.props.setDeploymentInfo('templateName', id);
      this.props.changeState({
        sectionC: {
          component: 'deploy',
          metadata: {
            activeComponent: 'summary'
          }
        }
      });
    },

    /**
      Generate the onboarding if there are no credentials.

      @method _generateOnboarding
    */
    _generateOnboarding: function() {
      var credentials = this.state.credentials;
      if (credentials && credentials.length > 0) {
        return;
      }
      return (
        <div className="deployment-panel__notice twelve-col">
          <juju.components.SvgIcon
            name="general-action-blue"
            size="16" />
          Add a public cloud credential, and we can save it as an option
          for later use
        </div>);
    },

    /**
      Generate the list of services.

      @method _generateServices
    */
    _generateServices: function() {
      var services = this.props.services;
      if (services.length === 0) {
        return;
      }
      var components = [];
      services.forEach((service, i) => {
        var className = classNames(
          'two-col',
          {'last-col': i % 3 === 1}
        );
        var name = service.get('name');
        components.push(
          <li className={className}
            key={service.get('id')}>
            <img alt={name}
              className="deployment-choose-cloud__services-icon"
              src={service.get('icon')} />
            {name}
          </li>);
      });
      return (
        <ul className="deployment-choose-cloud__services twelve-col">
          {components}
        </ul>);
    },

    render: function() {
      var username = this.props.user && this.props.user.usernameDisplay;
      var title = `Welcome back, ${username}`;
      var pluralize = this.props.pluralize;
      var changeCounts = this.props.changeCounts;
      var serviceCount = changeCounts['_deploy'] || 0;
      var machineCount = changeCounts['_addMachines'] || 0;
      return (
        <div className="deployment-panel__child">
          <juju.components.DeploymentPanelContent
            title={title}>
            <div className="six-col">
              <h3 className="deployment-panel__section-title">
                Deployment summary&nbsp;
                <span className="deployment-panel__section-title-count">
                  ({serviceCount} {pluralize('service', serviceCount)},&nbsp;
                  {machineCount} {pluralize('machine', machineCount)})
                </span>
              </h3>
              {this._generateServices()}
            </div>
            <div className="six-col last-col">
              <h3 className="deployment-panel__section-title">
                Unplaced units
              </h3>
              <div className="deployment-panel__box">
              </div>
            </div>
            {this._generateCredentials()}
            {this._generateOnboarding()}
            <h3 className="deployment-panel__section-title twelve-col">
              Public clouds
            </h3>
            <ul className="deployment-choose-cloud__list twelve-col">
              {this._generateOptions()}
            </ul>
          </juju.components.DeploymentPanelContent>
        </div>
      );
    }
  });

}, '0.1.0', { requires: [
  'deployment-panel-content',
  'svg-icon'
]});
