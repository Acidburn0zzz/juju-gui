'use strict';


YUI.add('subapp-browser-charmview', function(Y) {
  var ns = Y.namespace('juju.browser.views'),
      models = Y.namespace('juju.models'),
      views = Y.namespace('juju.views'),
      widgets = Y.namespace('juju.widgets'),
      DATE_FORMAT = '%d/%b/%y';


  /**
   * View for the Charm details UI.
   *
   * @class CharmView
   * @extends {Y.View}
   *
   */
  ns.BrowserCharmView = Y.Base.create('browser-view-charmview', Y.View, [
    widgets.browser.IndicatorManager,
    Y.Event.EventTracker,
    views.utils.apiFailingView
  ], {

    template: views.Templates.browser_charm,
    qatemplate: views.Templates.browser_qa,

    /**
     * List the DOM based events to watch for in the container.
     * @attribute events
     *
     */
    events: {
      '.changelog h3 .expandToggle': {
        click: '_toggleLog'
      },
      '.charm .add': {
        click: '_addCharmEnvironment'
      },
      '#bws-hooks select': {
        change: '_loadHookContent'
      },
      '.nav .back': {
        click: '_handleBack'
      }
    },

    /**
     * Begin the service creation process by showing the service configuration
     * form.
     *
     * @method _addCharmEnvironment
     * @param {Event} ev the event from the click handler.
     * @return {undefined} Nothing.
     * @private
     *
     */
    _addCharmEnvironment: function(ev) {
      ev.halt();
      var browserCharm = this.get('charm');
      var charm = new models.Charm(browserCharm.getAttrs());
      if (this.get('isFullscreen')) {
        this.fire('viewNavigate',
            {change: {viewmode: 'sidebar', charmID: null}});
      } else {
        this.fire('viewNavigate', {change: {charmID: null}});
      }
      this.get('deploy').call(null, charm);
    },

    /**
     * Shared method to generate a message to the user based on a bad api
     * call.
     *
     * @method apiFailure
     * @param {Object} data the json decoded response text.
     * @param {Object} request the original io_request object for debugging.
     *
     */
    apiFailure: function(data, request) {
      this._apiFailure(data, request, 'Failed to load charm details.');
    },

    /**
     * The API retuns the questions and the scores. Combine the data into a
     * single source to make looping in the handlebars templates nicer.
     *
     * @method _buildQAData
     * @param {Object} responseData the qa data from the store.
     *
     */
    _buildQAData: function(responseData) {
      var questions = responseData.result.questions,
          scores = responseData.scores,
          totalAvailable = 0,
          totalScore = 0;

      Y.Array.each(questions, function(category) {
        var sum = 0;

        Y.Array.each(category.questions, function(question, idx) {
          var categoryName = category.name,
              questionIndex = categoryName + '_' + idx;

          if (scores && scores[categoryName] &&
              scores[categoryName][questionIndex]) {
            var score = parseInt(scores[categoryName][questionIndex], 10);
            sum += score;
            category.questions[idx].score = score;
          } else {
            category.questions[idx].score = undefined;
          }
        });

        category.score = sum;
        totalAvailable += category.questions.length;
        totalScore += sum;
      });

      return {
        questions: questions,
        totalAvailable: totalAvailable,
        totalScore: totalScore
      };
    },

    /**
     * Watch the tab control for change events and dispatch accordingly.
     *
     * @method _bindTabEvents
     * @param {TabView} tab the tab control to monitor.
     *
     */
    _dispatchTabEvents: function(tab) {
      this.addEvent(
          tab.after('selectionChange', function(ev) {
            var tab = ev.newVal.get('content');
            switch (tab) {
              case 'Interfaces':
                console.log('not implemented interfaces handler');
                break;
              case 'Quality':
                this._loadQAContent();
                break;
              default:
                break;
            }
          }, this)
      );
    },

    /**
     * Commits need to be formatted, dates made pretty for the output to the
     * template. We have to break up the first one from the rest since it's
     * displayed differently.
     *
     * @method _formatCommitsForHtml
     * @param {Array} commits a list of commit objects.
     *
     */
    _formatCommitsForHtml: function(commits) {
      var firstTmp;
      var prettyCommits = {
        remaining: []
      };

      // No commits then just return an empty list.
      if (!commits) {
        return [];
      }

      if (commits.length > 0) {
        firstTmp = commits.shift();
        prettyCommits.first = firstTmp;
        prettyCommits.first.prettyDate = Y.Date.format(
            prettyCommits.first.date, {
              format: DATE_FORMAT
            });
      }

      Y.Array.each(commits, function(commit) {
        commit.prettyDate = Y.Date.format(
            commit.date, {
              format: DATE_FORMAT
            });
        prettyCommits.remaining.push(commit);
      });

      // Put our first item back on the commit list.
      if (firstTmp) {
        commits.unshift(firstTmp);
      }

      return prettyCommits;
    },

    /**
        Handle the back button being clicked on from the header of the
        details.

        @method _handleBack
        @param {Event} ev the click event handler.

     */
    _handleBack: function(ev) {
      ev.halt();
      this.fire('viewNavigate', {
        change: {
          charmID: null
        }
      });
    },

    /**
     * Determine which intro copy to display depending on the number
     * of interfaces.
     *
     *  The goal is to build a property string like: noRequiresNoProvides
     *
     * @method _getInterfaceIntroFlag
     * @param {Array} commits a list of commit objects.
     *
     */
    _getInterfaceIntroFlag: function(requires, provides) {
      var interfaceIntro = {},
          prefixes = ['no', 'one', 'many'],
          build = '';

      // Which prefix is used is based on the number of each item we check.
      var counts = {
        requires: requires ? Y.Object.keys(requires).length : 0,
        provides: provides ? Y.Object.keys(provides).length : 0
      };

      // Go through both requires and provides and build a string to be used
      // for generating our attribute such as 'noRequiresNoProvides'.
      Y.Array.each(['requires', 'provides'], function(check, idx) {
        var string = '';

        // Given the count, check which prefix we should be using.
        switch (counts[check]) {
          case 0:
            string += prefixes[0];
            break;
          case 1:
            string += prefixes[1];
            break;
          default:
            string += prefixes[2];
        }

        // Append the name of the field we're checking, but upper cased.
        string += check.charAt(0).toUpperCase() + check.slice(1);

        // And finally, if the index is > 0, we need to camel case the start
        // of the string as well.
        if (idx > 0) {
          build += string.charAt(0).toUpperCase() + string.slice(1);
        } else {
          build += string;
        }
      });
      interfaceIntro[build] = true;
      return interfaceIntro;
    },

    /**
     * Event handler for clicking on a hook filename to load that file.
     *
     * @method _loadHookContent
     * @param {Event} ev the click event created.
     *
     */
    _loadHookContent: function(ev) {
      var index = ev.currentTarget.get('selectedIndex');
      var filename = ev.currentTarget.get('options').item(
          index).getAttribute('value'),
          node = this.get('container').one('#bws-hooks .filecontent');

      // Load the file, but make sure we prettify the code.
      this._loadFile(node, filename, true);
    },

    /**
     * Load the charm's QA data and fill it into the tab when selected.
     *
     * @method _loadQAContent
     *
     */
    _loadQAContent: function() {
      var node = Y.one('#bws-qa');
      this.showIndicator(node);
      // Only load the QA data once.
      if (!this._qaLoaded) {
        this.get('store').qa(
            this.get('charm').get('id'), {
              'success': function(data) {
                data = this._buildQAData(data);
                node.setHTML(this.qatemplate(data));
                this.hideIndicator(node);
              },
              'failure': function(data, request) {

              }
            }, this);
      }
    },

    /**
     * The readme file in a charm can be upper/lower/etc. This helps find a
     * readme from the list of files in a charm.
     *
     * @method _locateReadme
     * @private
     *
     */
    _locateReadme: function() {
      var files = this.get('charm').get('files'),
          match = 'readme';

      return Y.Array.find(files, function(file) {
        if (file.toLowerCase().slice(0, 6) === match) {
          return true;
        }
      });
    },

    /**
     * Fetch the contents from a file and drop it into the container
     * specified.
     *
     * @method _loadFile
     * @param {Node} container the node to set content to.
     * @param {String} filename the name of the file to fetch from the api.
     * @private
     *
     */
    _loadFile: function(container, filename, prettify) {
      // Enable the indicator on the container while we load.
      this.showIndicator(container);

      this.get('store').file(
          this.get('charm').get('id'),
          filename, {
            'success': function(data) {
              if (prettify) {
                // If we say we want JS-prettified, use the prettify module.
                Y.prettify.renderPrettyPrintedFile(container, data);
              } else if (filename.slice(-3) === '.md') {
                // else if it's a .md file, render the markdown to html.
                container.setHTML(Y.Markdown.toHTML(data));
              } else {
                // Else just stick the content in a pre so it's blocked.
                container.setHTML(Y.Node.create('<pre/>').setContent(data));
              }

              this.hideIndicator(container);
            },
            'failure': function(data, request) {

            }
          }, this);
    },

    /**
     * When there is no readme setup some basic 'nothing found content'.
     *
     * @method _noReadme
     * @param {Node} container the node to drop this default content into.
     *
     */
    _noReadme: function(container) {
      container.setHTML('<h3>Charm has no README</h3>');
    },

    /**
     * Clicking on the open log should toggle the list of log entries.
     *
     * @method _toggleLog
     * @param {Event} ev the click event of the open log control.
     * @private
     *
     */
    _toggleLog: function(ev) {
      ev.halt();
      var container = this.get('container'),
          target = ev.currentTarget,
          state = target.getData('state'),
          more = target.one('.more'),
          less = target.one('.less');

      if (state === 'closed') {
        // open up the changelog.
        container.one('.changelog .remaining').removeClass('hidden');
        target.setData('state', 'open');
        more.addClass('hidden');
        less.removeClass('hidden');
      } else {
        // close up the changelog.
        container.one('.changelog .remaining').addClass('hidden');
        target.setData('state', 'closed');
        less.addClass('hidden');
        more.removeClass('hidden');
      }
    },

    /**
     * Clean up after ourselves.
     *
     * @method destructor
     *
     */
    destructor: function() {
      if (this.tabview) {
        this.tabview.destroy();
      }
    },

    /**
     * Generic YUI initializer. Make sure we track indicators for cleanup.
     *
     * @method initializer
     * @param {Object} cfg configuration object.
     * @return {undefined} Nothing.
     */
    initializer: function(cfg) {
      // Hold onto references of the indicators used so we can clean them all
      // up. Indicators are keyed on their yuiid so we don't dupe them.
      this.indicators = {};
    },

    /**
     * Render the view of a single charm details page.
     *
     * @method _renderCharmView
     * @param {BrowserCharm} charm the charm model instance to view.
     * @param {Boolean} isFullscreen is this display for the fullscreen
     * experiecne?
     *
     */
    _renderCharmView: function(charm, isFullscreen) {
      this.set('charm', charm);

      var tplData = charm.getAttrs(),
          container = this.get('container');

      tplData.isFullscreen = isFullscreen;
      tplData.prettyCommits = this._formatCommitsForHtml(
          tplData.recent_commits);
      tplData.interfaceIntro = this._getInterfaceIntroFlag(
          tplData.requires, tplData.provides);

      var tpl = this.template(tplData);
      var tplNode = container.setHTML(tpl);

      // Set the content then update the container so that it reload
      // events.
      Y.one('.bws-view-data').setHTML(tplNode);

      this.tabview = new widgets.browser.TabView({
        srcNode: tplNode.one('.tabs')
      });
      this.tabview.render();
      this._dispatchTabEvents(this.tabview);

      // Start loading the readme so it's ready to go.
      var readme = this._locateReadme();

      if (readme) {
        this._loadFile(tplNode.one('#bws-readme'),
                       readme
        );
      } else {
        this._noReadme(tplNode.one('#bws-readme'));
      }
    },

    /**
       Render out the view to the DOM.

       The View might be given either a charmID, which means go fetch the
       charm data, or a charm model instance, in which case the view has the
       data it needs to render.

       @method render

     */
    render: function() {
      var isFullscreen = this.get('isFullscreen');

      if (this.get('charm')) {
        this._renderCharmView(this.get('charm'), isFullscreen);
      } else {
        this.get('store').charm(this.get('charmID'), {
          'success': function(data) {
            var charm = new models.BrowserCharm(data);
            this.set('charm', charm);
            this._renderCharmView(this.get('charm'), isFullscreen);
          },
          'failure': this.apiFailure
        }, this);
      }
    }
  }, {
    ATTRS: {
      /**
         @attribute charmID
         @default undefined
         @type {Int}

       */
      charmID: {},

      /**
       * The charm we're viewing the details of.
       *
       * @attribute charm
       * @default undefined
       * @type {juju.models.BrowserCharm}
       *
       */
      charm: {},

      /**
         @attribute isFullscreen
         @default false
         @type {Boolean}

       */
      isFullscreen: {
        value: false
      },

      /**
       * The store is the api endpoint for fetching data.
       *
       * @attribute store
       * @default undefined
       * @type {Charmworld0}
       *
       */
      store: {},

      /**
       * The "deploy" function prompts the user for service configuration and
       * deploys a service.
       *
       * @attribute deploy
       * @default undefined
       * @type {Function}
       *
       */
      deploy: {}

    }
  });

}, '0.1.0', {
  requires: [
    'browser-overlay-indicator',
    'browser-tabview',
    'datatype-date',
    'datatype-date-format',
    'event-tracker',
    'gallery-markdown',
    'juju-charm-store',
    'juju-models',
    'juju-templates',
    'juju-views',
    'juju-view-utils',
    'node',
    'prettify',
    'view'
  ]
});
