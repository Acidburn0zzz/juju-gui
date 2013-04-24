'use strict';


/**
 * Browser SubApp minized state representation.
 *
 * @module juju.browser
 * @submodule views
 *
 */
YUI.add('subapp-browser-minimized', function(Y) {
  var ns = Y.namespace('juju.browser.views'),
      views = Y.namespace('juju.views');

  /**
   * The minimized state view.
   *
   * @class MinimizedView
   * @extends {Y.View}
   *
   */
  ns.MinimizedView = Y.Base.create('browser-view-minimized', Y.View, [], {
    template: views.Templates.minimized,

    events: {
      '.bws-icon': {
         click: '_toggleViewState'
      }
    },

    /**
     * Toggle the visibility of the browser. Bound to nav controls in the
     * view, however this will be expanded to be controlled from the new
     * constant nav menu outside of the view once it's completed.
     *
     * @method _toggle_sidebar
     * @param {Event} ev event to trigger the toggle.
     *
     */
    _toggleViewState: function(ev) {
      ev.halt();

      this.fire('viewNavigate', {
        change: {
          viewmode: this.get('oldViewMode')
        }
      });
    },

    /**
     * Render out the view to the DOM.
     *
     * @method render
     *
     */
    render: function() {
      var tpl = this.template(),
          tplNode = Y.Node.create(tpl);
      this.get('container').setHTML(tplNode);
    }

  }, {
    ATTRS: {
      container: {
        value: '#subapp-browser-min'
      },

      /**
       * The old viewmode tells us how to return to the last state that we
       * were in when we closed the Browser.
       *
       * @attribute oldViewMode
       * @default 'sidebar'
       * @type {String}
       *
       */
      oldViewMode: {
        value: 'sidebar'
      }
    }
  });

}, '0.1.0', {
  requires: [
    'base',
    'juju-templates',
    'juju-views',
    'view'
  ]
});
