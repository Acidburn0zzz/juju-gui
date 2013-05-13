'use strict';


/**
   Provides searching functionality for the charm browser.

   @namespace juju
   @module browser
   @submodule views
 */
YUI.add('subapp-browser-searchview', function(Y) {
  var ns = Y.namespace('juju.browser.views'),
      views = Y.namespace('juju.views'),
      widgets = Y.namespace('juju.widgets'),
      models = Y.namespace('juju.models');

  /**
     Search results display view.

     @class BrowserSearchView
     @extends {juju.browser.views.CharmResults}

   */
  ns.BrowserSearchView = Y.Base.create(
      'browser-view-searchview',
      ns.CharmResults, [
        views.utils.apiFailingView,
        widgets.browser.IndicatorManager,
        Y.Event.EventTracker], {
        template: views.Templates.search,

        /**
           Watch for changes to the filters to update results.

           @method _bindEvents

         */
        _bindEvents: function() {
          this.events['.filterControl a'] = {
            click: '_toggleFilters'
          };
        },

        /**
           When a filter is changed, catch the event and build a change object
           for the subapp to generate a new route for.

           @method _filterChanged
           @param {Event} ev the change event detected from the widget.

         */
        _filterChanged: function(ev) {
          var filters = this.get('filters');
          filters[ev.change.field] = ev.change.value;
          var change = {
            search: true,
            filter: {}
          };
          change.filter[ev.change.field] = ev.change.value;
          this.fire('viewNavigate', {change: change});
        },

        /**
           Show/hide the filters based on the click of this control.

           @method _toggleFilters
           @param {Event} ev The click event from YUI.

         */
        _toggleFilters: function(ev) {
          ev.halt();

          var control = ev.currentTarget;
          var newTarget = control.hasClass('less') ? 'more' : 'less';
          newTarget = this.get('container').one('.filterControl .' + newTarget);

          control.hide();
          newTarget.show();

          if (newTarget.hasClass('less')) {
            this.get('container').one('.search-filters').show();
          } else {
            this.get('container').one('.search-filters').hide();
          }
        },

        /**
           Renders the search results from the the store query.

           @method _renderSearchResults

         */
        _renderSearchResults: function(results) {
          var target = this.get('renderTo'),
              tpl = this.template({
                count: results.size(),
                isFullscreen: this.get('isFullscreen')
              }),
              tplNode = Y.Node.create(tpl),
              results_container = tplNode.one('.search-results'),
              filter_container = tplNode.one('.search-filters');

          results.map(function(charm) {
            var ct = new widgets.browser.CharmToken(Y.merge(
                charm.getAttrs(), {
                  size: this.get('isFullscreen') ? 'large' : 'small'
                }));
            ct.render(results_container);
          }, this);
          this._renderFilterWidget(filter_container);
          this.get('container').setHTML(tplNode);
          target.setHTML(this.get('container'));
          // XXX: We shouldn't have to do this; calling .empty before rending
          // should reset where the node's overflow is scrolled to, but it
          // doesn't. Se we scroll the heading into view to ensure the view
          // renders at the top of the content.
          target.one('.search-title').scrollIntoView();
        },

        /**
           Render the filter controls widget into the search page.

           @method _renderfilterWidget
           @param {Node} container the node to drop the filter control into.

         */
        _renderFilterWidget: function(container) {
          this.filters = new widgets.browser.Filter({
            filters: this.get('filters')
          });

          this.filters.render(container);
          this.addEvent(
              this.filters.on(
                  this.filters.EV_FILTER_CHANGED, this._filterChanged, this)
          );
        },

        /**
           Renders the searchview, rendering search results for the view's
           search text.

           @method render
         */
        render: function() {
          this.showIndicator(this.get('renderTo'));
          // This is only rendered once from the subapp and so the filters is
          // the initial set from the application. All subsequent renders go
          // through the subapp so we don't have to keep the filters in sync
          // here.  If caching/reusing comes into play though an event to
          // track the change of the filters ATTR would make sense to re-draw.
          this.get('store').search(this.get('filters'), {
            'success': function(data) {
              var results = this.get('store').resultsToCharmlist(data.result);
              this._renderSearchResults(results);
              this.hideIndicator(this.get('renderTo'));

              // Set the active charm if available.
              var active = this.get('activeID');
              if (active) {
                this._updateActive(
                    this.get('container').one(
                        '.charm-token[data-charmid="' + active + '"]')
                );
              }
            },
            'failure': this.apiFailure
          }, this);
        }
      }, {
        ATTRS: {
          /**
             The search data object which is a Filter instance.

             @attribute filters
             @default undefined
             @type {Filter}
           */
          filters: {}
        }
      });

}, '0.1.0', {
  requires: [
    'base-build',
    'browser-charm-token',
    'browser-filter-widget',
    'event-tracker',
    'juju-browser-models',
    'juju-view-utils',
    'subapp-browser-charmresults'
  ]
});
