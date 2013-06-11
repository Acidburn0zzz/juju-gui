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
 * Provide the Charm and CharmList classes.
 *
 * @module models
 * @submodule models.charm
 */

YUI.add('juju-charm-models', function(Y) {

  var RECENT_DAYS = 30;

  var models = Y.namespace('juju.models');
  var charmIdRe = /^(?:(\w+):)?(?:~(\S+)\/)?(\w+)\/(\S+?)-(\d+)$/;
  var idElements = ['scheme', 'owner', 'series', 'package_name', 'revision'];
  var simpleCharmIdRe = /^(?:(\w+):)?(?!:~)(\w+)$/;
  var simpleIdElements = ['scheme', 'package_name'];
  var parseCharmId = models.parseCharmId = function(charmId, defaultSeries) {
    if (typeof charmId === 'string') {
      var parts = charmIdRe.exec(charmId);
      var pairs;
      if (parts) {
        parts.shift(); // Get rid of the first, full string.
        pairs = Y.Array.zip(idElements, parts);
      } else if (defaultSeries) {
        parts = simpleCharmIdRe.exec(charmId);
        if (parts) {
          parts.shift(); // Get rid of the first, full string.
          pairs = Y.Array.zip(simpleIdElements, parts);
          pairs.push(['series', defaultSeries]);
        }
      }
      if (parts) {
        var result = {};
        Y.Array.map(pairs, function(pair) { result[pair[0]] = pair[1]; });
        result.charm_store_path = [
          (result.owner ? '~' + result.owner : 'charms'),
          result.series,
          result.package_name + (
              result.revision ? '-' + result.revision : ''),
          'json'
        ].join('/');
        return result;
      }
    }
  };
  /**
   * Helper to use a setter so that we can set null when the api returns an
   * empty object.
   *
   * @method unsetIfNoValue
   * @param {Object} val the Object to check if it's empty.
   *
   */
  var unsetIfNoValue = function(val) {
    if (Y.Object.keys(val).length === 0) {
      return null;
    } else {
      return val;
    }
  };

  /**
   * Charms, once instantiated and loaded with data from their respective
   * sources, are immutable and read-only. This reflects the reality of how
   * we interact with them.
   *
   * Charm instances can represent both environment charms and charm store
   * charms.  A charm id is reliably and uniquely associated with a given
   * charm only within a given context: the environment or the charm store.
   *
   * Charms begin their lives with full charm ids, as provided by
   * services in the environment and the charm store:
   *
   *   `[SCHEME]:(~[OWNER]/)?[SERIES]/[PACKAGE NAME]-[REVISION]`
   *
   * With an id, we can instantiate a charm: typically we use
   * `db.charms.add({id: [ID]})`.  Finally, we load the charm's data over the
   * network using the standard YUI Model method `load`, providing an object
   * with a get_charm callable, and an optional callback (see YUI docs).  Both
   * the env and the charm store have a `get_charm` method, so, by design, it
   * works easily: `charm.load(env, optionalCallback)` or
   * `charm.load(charm_store, optionalCallback)`.  The `get_charm` method must
   * either callback using the default YUI approach for this code, a boolean
   * indicating failure, and a result; or it must return what the env version
   * does: an object with a `result` object containing the charm data, or an
   * object with an `err` attribute.
   *
   * In both cases, environment charms and charm store charms, a charm's
   * `loaded` attribute is set to true once it has all the data from its
   * environment.
   *
   * @class Charm
   */
  var Charm = Y.Base.create('charm', Y.Model, [], {

    initializer: function() {
      var id = this.get('id'),
          parts = parseCharmId(id),
          self = this;
      if (!parts) {
        throw 'Developers must initialize charms with a well-formed id.';
      }
      this.loaded = false;
      this.on('load', function() { this.loaded = true; });
      Y.Object.each(
          parts,
          function(value, key) { self.set(key, value); });
    },

    sync: function(action, options, callback) {
      if (action !== 'read') {
        throw (
            'Only use the "read" action; "' + action + '" not supported.');
      }
      if (Y.Lang.isValue(options.get_charm)) {
        // This is an env.
        options.get_charm(
            this.get('id'),
            function(response) {
              if (response.err) {
                callback(true, response);
              } else if (response.result) {
                callback(false, response.result);
              } else {
                // What's going on?  This does not look like either of our
                // expected signatures.  Declare a loading error.
                callback(true, response);
              }
            }
        );
      } else if (Y.Lang.isValue(options.loadByPath)) {
        // This is a charm store.
        options.loadByPath(
            this.get('charm_store_path'),
            { success: function(response) {
              callback(false, response);
            },
            failure: function(response) {
              callback(true, response);
            }
            });
      } else {
        throw 'You must supply a get_charm or loadByPath function.';
      }
    },

    parse: function() {
      var data = Charm.superclass.parse.apply(this, arguments),
          self = this;
      data.is_subordinate = data.subordinate;
      Y.each(data, function(value, key) {
        if (!value ||
            !self.attrAdded(key) ||
            Y.Lang.isValue(self.get(key))) {
          delete data[key];
        }
      });
      if (data.owner === 'charmers') {
        delete data.owner;
      }
      return data;
    },

    compare: function(other, relevance, otherRelevance) {
      // Official charms sort before owned charms.
      // If !X.owner, that means it is owned by charmers.
      var owner = this.get('owner'),
          otherOwner = other.get('owner');
      if (!owner && otherOwner) {
        return -1;
      } else if (owner && !otherOwner) {
        return 1;
      // Relevance is next most important.
      } else if (relevance && (relevance !== otherRelevance)) {
        // Higher relevance comes first.
        return otherRelevance - relevance;
      // Otherwise sort by package name, then by owner, then by revision.
      } else {
        return (
                (this.get('package_name').localeCompare(
                other.get('package_name'))) ||
                (owner ? owner.localeCompare(otherOwner) : 0) ||
                (this.get('revision') - other.get('revision')));
      }
    }
  }, {
    ATTRS: {
      id: {
        validator: function(val) {
          return Y.Lang.isString(val) && !!charmIdRe.exec(val);
        }
      },
      bzr_branch: {},
      charm_store_path: {
        /**
         * Generate the charm store path from the attributes of the charm.
         *
         * @method getter
         *
         */
        getter: function() {
          // charm_store_path
          var owner = this.get('owner');
          return [
            (owner ? '~' + owner : 'charms'),
            this.get('series'),
            (this.get('package_name') + '-' + this.get('revision')),
            'json'
          ].join('/');
        }
      },
      config: {},
      description: {},
      full_name: {
        /**
         * Generate the full name of the charm from its attributes.
         *
         * @method geetter
         *
         */
        getter: function() {
          // full_name
          var tmp = [this.get('series'), this.get('package_name')],
              owner = this.get('owner');
          if (owner) {
            tmp.unshift('~' + owner);
          }
          return tmp.join('/');
        }
      },
      is_subordinate: {},
      last_change: {
        /**
         * Normalize created value from float to date object.
         *
         * @method last_change.writeOnce.setter
         */
        setter: function(val) {
          if (val && val.created) {
            // Mutating in place should be fine since this should only
            // come from loading over the wire.
            val.created = new Date(val.created * 1000);
          }
          return val;
        }
      },
      maintainer: {},
      metadata: {},
      owner: {},
      package_name: {},
      peers: {},
      proof: {},
      provides: {},
      requires: {},
      revision: {
        /**
         * Parse the revision number out of a string.
         *
         * @method revision.setter
         */
        setter: function(val) {
          return parseInt(val, 10);
        }
      },
      scheme: {
        value: 'cs',
        /**
         * If no value is given, "cs" is used as the default.
         *
         * @method scheme.setter
         */
        setter: function(val) {
          if (!Y.Lang.isValue(val)) {
            val = 'cs';
          }
          return val;
        }
      },
      series: {},
      summary: {},
      url: {}
    }
  });

  models.Charm = Charm;
  models.charmIdRe = charmIdRe;

  /**
   * The database keeps the charms separate in two different CharmList
   * instances.  One is `db.charms`, representing the environment charms.
   * The other, from the charm store, is maintained by and within the
   * persistent charm panel instance. As you would expect, environment
   * charms are what to use when viewing or manipulating the environment.
   * Charm store charms are what we can browse to select and deploy new
   * charms to the environment.
   *
   * @class CharmList
   */
  var CharmList = Y.Base.create('charmList', Y.ModelList, [], {
    model: Charm
  });
  models.CharmList = CharmList;


  /**
   * Model to represent the Charms from the Charmworld2 Api.
   *
   * @class BrowserCharm
   * @extends {Charm}
   *
   */
  models.BrowserCharm = Y.Base.create('browser-charm', Charm, [], {
    /**
     * Load the recent commits into a format we can use nicely.
     *
     * @method _loadRecentCommits
     *
     */
    _loadRecentCommits: function() {
      var source = this.get('code_source'),
          commits = [];

      if (source && source.revisions) {
        Y.Array.each(source.revisions, function(commit) {
          commits.push({
            author: {
              name: commit.authors[0].name,
              email: commit.authors[0].email
            },
            date: new Date(commit.date),
            message: commit.message,
            revno: commit.revno
          });
        });
      }

      return commits;
    },

    /**
     * Parse the relations ATTR from the api into specific provides/requires
     * information.
     *
     * @method _parseRelations
     * @param {String} attr the attribute to load from the relations object.
     *
     */
    _parseRelations: function(attr) {
      var relations = this.get('relations');
      if (relations && relations[attr]) {
        return relations[attr];
      } else {
        return null;
      }
    },

    /**
     * Initializer
     *
     * @method initializer
     * @param {Object} cfg The configuration object.
     */
    initializer: function(cfg) {
      if (cfg && cfg.downloads_in_past_30_days) {
        this.set('recent_download_count', cfg.downloads_in_past_30_days);
      }
    }
  }, {
    ATTRS: {
      id: {
        validator: function(val) {
          return Y.Lang.isString(val) && !!charmIdRe.exec(val);
        }
      },
      bzr_branch: {},
      categories: {
        value: []
      },
      changelog: {
        value: {}
      },
      charm_store_path: {},
      /**
       * Object of data about the source for this charm including bugs link,
       * log, revisions, etc.
       *
       * @attribute code_source
       * @default undefined
       * @type {Object}
       *
       */
      code_source: {},
      date_created: {},
      description: {},
      'failingProviders': {
        /**
         * @method failingProviders.valueFn
         * @return {Array} the list of failing provider names.
         *
         */
        valueFn: function() {
          var failing = [],
              providers = this.get('tested_providers');
          Y.Object.each(providers, function(value, key) {
            if (value !== 'SUCCESS') {
              failing.push(key);

              // We test openstack on HP. If it fails on openstack, it's
              // failing on HP as well so add that.
              if (key === 'openstack') {
                failing.push('hp');
              }
            }
          });

          if (failing.length > 0) {

            return failing;
          } else {
            return null;
          }
        }
      },
      files: {
        value: []
      },
      full_name: {
        /**
         * Generate the full name of the charm from its attributes.
         *
         * @method full_name.getter
         *
         */
        getter: function() {
          // full_name
          var tmp = [this.get('series'), this.get('package_name')],
              owner = this.get('owner');
          if (owner) {
            tmp.unshift('~' + owner);
          }
          return tmp.join('/');
        }
      },
      hasIcon: {
        /**
          Does this charm have an icon file. Helper used for template rendering
          decisions.

          @method hasIcon.valueFn
          @return {Boolean} Does the Charm have an icon file.

         */
        valueFn: function() {
          return this.get('files').indexOf('icon.svg') !== -1 ? true : false;
        }
      },
      is_approved: {},
      is_subordinate: {},
      last_change: {
        /**
         * Normalize created value from float to date object.
         *
         * @method last_change.setter
         */
        setter: function(val) {
          if (val && val.created) {
            // Mutating in place should be fine since this should only
            // come from loading over the wire.
            val.created = new Date(val.created * 1000);
          }
          return val;
        }
      },
      /**
        The mainCategory is a helper since we can only show one icon per
        charm, but we permit multiple categories. An initial pass just grabs
        the first category to use as an icon if required.

        @attribute mainCategory
        @default null
        @type {String}

       */
      mainCategory: {
        /**
          @method mainCategory.valueFn
          @return {String|Null} If a category is found its value else null.

         */
        valueFn: function() {
          var categories = this.get('categories');
          if (categories.length > 0) {
            return categories[0];
          } else {
            return null;
          }
        }
      },
      maintainer: {},
      /*
        API related metdata information for this charm object.

        This includes information such as related charms calculated by the
        back end, but are not directly part of the charms representation.

      */
      metadata: {},
      name: {},
      /**
       * options is the parsed YAML object from config.yaml in a charm. Do not
       * set a value if there are no options to be had.
       *
       * @attribute options
       * @default undefined
       * @type {Object}
       *
       */
      options: {
        setter: 'unsetIfNoValue'
      },
      owner: {},
      peers: {},
      proof: {},
      /**
       * This attr is a mapper to the relations ATTR in the new API. It's
       * provided for backwards compatibility with the original Charm model.
       * This can be removed when Charmworld2 is the one true model used in
       * all Juju Gui code.
       *
       * @attribute provides
       * @default undefined
       * @type {Object}
       *
       */
      provides: {
        /**
         * provides is a subcomponent of relations in the new api.
         *
         * @method provides.getter
         *
         */
        getter: function(value, key) {
          return this._parseRelations(key);
        }
      },
      rating_numerator: {},
      rating_denominator: {},
      /**
       * @attribute recent_commit_count
       * @default 0
       * @type {Int}
       *
       */
      'recent_commit_count': {
        /**
         * @method recent_commit_count.getter
         * @return {Int} count of the commits in 'recent' time.
         *
         */
        getter: function() {
          var count = 0,
              commits = this.get('recent_commits'),
              today = new Date(),
              recentAgo = new Date();
          recentAgo.setDate(today.getDate() - RECENT_DAYS);

          Y.Array.each(commits, function(commit) {
            if (commit.date > recentAgo) {
              count += 1;
            }
          });
          return count;
        }
      },
      /**
       * @attribute recent_commits
       * @default undefined
       * @type {Array} list of objects for each commit.
       *
       */
      'recent_commits': {
        /**
         * Return the commits of the charm in a format we can live with from
         * the source code data provided by the api.
         *
         * @method recent_commits.valueFn
         *
         */
        valueFn: function() {
          return this._loadRecentCommits();
        }
      },
      /**
       * Mapped from the downloads_in_past_30_days in the API.
       *
       * @attribute recent_download_count
       * @default undefined
       * @type {Int} number of downloads in 'recent' time.
       *
       */
      recent_download_count: {
        /**
         * @method recent_download_count.valueFn
         * @return {Int} the number of downloads in the 'recent' time frame.
         *
         */
        valueFn: function() {
          return 0;
        }
      },
      relations: {},

      /**
       * This attr is a mapper to the relations ATTR in the new API. It's
       * provided for backwards compatibility with the original Charm model.
       *
       * This can be removed when Charmworld2 is the one true model used in
       * all Juju Gui code.
       *
       * @attribute requires
       * @default undefined
       * @type {Object}
       *
       */
      requires: {
        /**
         * requires is a subcomponent of relations in the new api.
         *
         * @method requires.getter
         *
         */
        getter: function(value, key) {
          return this._parseRelations(key);
        }
      },
      revision: {
        /**
         * Parse the revision number out of a string.
         *
         * @method revision.setter
         */
        setter: function(val) {
          return parseInt(val, 10);
        }
      },
      scheme: {
        value: 'cs',
        /**
         * If no value is given, "cs" is used as the default.
         *
         * @method scheme.setter
         */
        setter: function(val) {
          if (!Y.Lang.isValue(val)) {
            val = 'cs';
          }
          return val;
        }
      },
      series: {},
      summary: {},
      tested_providers: {},
      url: {}
    }
  });


  /**
   * BrowserCharmList is set of BrowserCharms.
   *
   * @class BrowserCharmList
   */
  models.BrowserCharmList = Y.Base.create('browserCharmList', Y.ModelList, [], {
    model: models.BrowserCharm
  }, {
    ATTRS: {}
  });

}, '0.1.0', {
  requires: [
    'model',
    'model-list',
    'juju-charm-id'
  ]
});
