'use strict';


/**
 * The widget used across Browser view to manage the search box and the
 * controls for selecting which view you're in.
 *
 * @module widgets
 * @submodule browser
 *
 */
YUI.add('browser-search-widget', function(Y) {
  var ns = Y.namespace('juju.widgets.browser'),
      templates = Y.namespace('juju.views').Templates;

  /**
   * Search widget present in the Charm browser across both fullscreen and
   * sidebar views.
   *
   * @class Search
   * @extends {Y.Widget}
   *
   */
  ns.Search = Y.Base.create('search-widget', Y.Widget, [], {
    _events: [],

    EVT_CLEAR_SEARCH: 'clear_search',
    EVT_TOGGLE_VIEWABLE: 'toggle_viewable',
    EVT_TOGGLE_FULLSCREEN: 'toggle_fullscreen',
    EVT_UPDATE_SEARCH: 'update_search',
    EVT_SEARCH_CHANGED: 'search_changed',

    TEMPLATE: templates['browser-search'],

    /**
     * Expose to the outside world that we've got a request to go fullscreen.
     *
     * @method _toggleFullScreen
     * @param {Event} ev the click event from the control.
     * @private
     *
     */
    _toggleFullScreen: function(ev) {
      this.fire(this.EVT_TOGGLE_FULLSCREEN);
    },

    /**
     * Expose to the outside world that we've got a request to hide from
     * sight.
     *
     * @method _toggleViewable
     * @param {Event} ev the click event from the control.
     * @private
     *
     */
    _toggleViewable: function(ev) {
      this.fire(this.EVT_TOGGLE_VIEWABLE);
    },

    /**
     * detach listeners for dom events.
     *
     * @method _unbind_events
     * @private
     * @return {undefined} mutates only.
     */
    _unbindUI: function() {
      Y.array.each(this._events, function(item) {
        item.detach();
      });
    },

    /**
     * bind the UI events to the DOM making up the widget control.
     *
     * @method bindUI
     *
     */
    bindUI: function() {
      var container = this.get('boundingBox');

      this._events.push(
          container.one('.bws-icon').on(
              'click', this._toggleViewable, this)
      );
      this._events.push(
          container.one('.toggle-fullscreen').on(
              'click', this._toggleFullScreen, this)
      );

      // Note that the search could be updated either from our internal input
      // control, or it could come from someone outside of the widget asking
      // it to update to a specific value. This is how things like clicking
      // categories can work.
      var input = container.one('input');
      this._events.push(
          input.on('valueChange', function(ev) {
            this.fire(this.EVT_SEARCH_CHANGED);
          }, this)
      );
    },

    /**
     * Clear the search input control in order to reset it.
     *
     * @method clearSearch
     *
     */
    clearSearch: function() {
      var input = this.get('contentBox').one('input');
      input.focus();
      input.set('value', '');
    },


    /**
     * destory the widget and unbind all DOM events.
     *
     * @method destructor
     *
     */
    destructor: function() {
      this._unbindUI();
    },

    /**
     * Generic initializer for the widget. Publish events we expose for
     * outside use.
     *
     * @method initializer
     * @param {Object} cfg configuration override object.
     *
     */
    initializer: function(cfg) {
      /**
       * Fires when the "Charm Browser" link is checked. Needs to communicate
       * with the parent view so that it can handle filters and the like. This
       * widget only needs to clear the search input box.
       *
       */
      this.publish(this.EVT_TOGGLE_VIEWABLE);
      this.publish(this.EVT_TOGGLE_FULLSCREEN);
      this.publish(this.EVT_SEARCH_CHANGED);
    },

    /**
     * Render all the things!
     *
     * @method renderUI
     *
     */
    renderUI: function() {
      this.get('contentBox').setHTML(
          this.TEMPLATE(this.getAttrs())
      );
    },

    /**
     * Update the search input to contain the string passed. This is meant to
     * be used by outside links that want to perform a pre-canned search and
     * display results.
     *
     * @method update_search
     * @param {String} newval the sting to update the input to.
     *
     */
    updateSearch: function(newval) {
      var input = this.get('contentBox').one('input');
      input.focus();
      input.set('value', newval);
    }

  }, {
    ATTRS: {

      /**
       * @attribute term
       * @default undefined
       * @type {String}
       *
       */
      term: {}

    }
  });

}, '0.1.0', {
  requires: [
    'base',
    'event',
    'event-valuechange',
    'juju-templates',
    'widget'
  ]
});