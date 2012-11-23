'use strict';

describe('notifications', function() {
  var Y, juju, models, views;

  var default_env = {
    'result': [
      ['service', 'add', {
        'charm': 'cs:precise/wordpress-6',
        'id': 'wordpress',
        'exposed': false
      }],
      ['service', 'add', {
        'charm': 'cs:precise/mediawiki-3',
        'id': 'mediawiki',
        'exposed': false
      }],
      ['service', 'add', {
        'charm': 'cs:precise/mysql-6',
        'id': 'mysql'
      }],
      ['relation', 'add', {
        'interface': 'reversenginx',
        'scope': 'global',
        'endpoints':
         [['wordpress', {'role': 'peer', 'name': 'loadbalancer'}]],
        'id': 'relation-0000000000'
      }],
      ['relation', 'add', {
        'interface': 'mysql',
        'scope': 'global',
        'endpoints':
         [['mysql', {'role': 'server', 'name': 'db'}],
          ['wordpress', {'role': 'client', 'name': 'db'}]],
        'id': 'relation-0000000001'
      }],
      ['machine', 'add', {
        'agent-state': 'running',
        'instance-state': 'running',
        'id': 0,
        'instance-id': 'local',
        'dns-name': 'localhost'
      }],
      ['unit', 'add', {
        'machine': 0,
        'agent-state': 'started',
        'public-address': '192.168.122.113',
        'id': 'wordpress/0'
      }],
      ['unit', 'add', {
        'machine': 0,
        'agent-state': 'error',
        'public-address': '192.168.122.222',
        'id': 'mysql/0'
      }]
    ],
    'op': 'delta'
  };


  before(function(done) {
    Y = YUI(GlobalConfig).use([
      'juju-models',
      'juju-views',
      'juju-gui',
      'juju-env',
      'node-event-simulate',
      'juju-tests-utils'],

    function(Y) {
      juju = Y.namespace('juju');
      models = Y.namespace('juju.models');
      views = Y.namespace('juju.views');
      done();
    });
  });

  it('must be able to make notification and lists of notifications',
     function() {
        var note1 = new models.Notification({
         title: 'test1',
         message: 'Hello'
        }),
            note2 = new models.Notification({
         title: 'test2',
         message: 'I said goodnight!'
            }),
            notifications = new models.NotificationList();

        notifications.add([note1, note2]);
        notifications.size().should.equal(2);

        // timestamp should be generated once
        var ts = note1.get('timestamp');
        note1.get('timestamp').should.equal(ts);
        // force an update so we can test ordering
        // fast execution can result in same timestamp
        note2.set('timestamp', ts + 1);
        note2.get('timestamp').should.be.above(ts);

        // defaults as expected
        note1.get('level').should.equal('info');
        note2.get('level').should.equal('info');
        // the sort order on the list should be by
        // timestamp
        notifications.get('title').should.eql(['test2', 'test1']);
     });

  it('must be able to render its view with sample data',
     function() {
       var note1 = new models.Notification({
         title: 'test1', message: 'Hello'}),
           note2 = new models.Notification({
         title: 'test2', message: 'I said goodnight!'}),
           notifications = new models.NotificationList(),
           container = Y.Node.create('<div id="test">'),
           env = new juju.Environment(),
           view = new views.NotificationsView({
                   container: container,
                   notifications: notifications,
                   env: env});
       view.render();
       // Verify the expected elements appear in the view
       container.one('#notify-list').should.not.equal(undefined);
       container.destroy();
     });

  it('must be able to limit the size of notification events',
     function() {
       var note1 = new models.Notification({
         title: 'test1',
         message: 'Hello'
       }),
           note2 = new models.Notification({
         title: 'test2',
         message: 'I said goodnight!'
       }),
           note3 = new models.Notification({
         title: 'test3',
         message: 'Never remember'
       }),
           notifications = new models.NotificationList({
         max_size: 2
       });

       notifications.add([note1, note2]);
       notifications.size().should.equal(2);

       // Adding a new notification should pop the oldest from the list (we
       // exceed max_size)
       notifications.add(note3);
       notifications.size().should.equal(2);
       notifications.get('title').should.eql(['test3', 'test2']);
     });

  it('must be able to get notifications for a given model',
     function() {
       var m = new models.Service({id: 'mediawiki'}),
           note1 = new models.Notification({
         title: 'test1',
         message: 'Hello',
         modelId: m
       }),
           note2 = new models.Notification({
         title: 'test2',
         message: 'I said goodnight!'
       }),
           notifications = new models.NotificationList();

       notifications.add([note1, note2]);
       notifications.size().should.equal(2);
       notifications.getNotificationsForModel(m).should.eql(
       [note1]);

     });

  it('must be able to include and show object links', function() {
    var container = Y.Node.create('<div id="test">'),
        conn = new(Y.namespace('juju-tests.utils')).SocketStub(),
        env = new juju.Environment({conn: conn}),
        app = new Y.juju.App({env: env, container: container}),
        db = app.db,
        mw = db.services.create({id: 'mediawiki',
                                    name: 'mediawiki'}),
        notifications = db.notifications,
        view = new views.NotificationsOverview({
                      container: container,
                      notifications: notifications,
                      app: app,
                      env: env}).render();
    // we use overview here for testing as it defaults
    // to showing all notices

    // we can use app's routing table to derive a link
    notifications.create({title: 'Service Down',
      message: 'Your service has an error',
      link: app.getModelURL(mw)
    });
    view.render();
    var link = container.one('.notice').one('a');
    link.getAttribute('href').should.equal(
        '/service/mediawiki/');
    link.getHTML().should.contain('View Details');


    // create a new notice passing the link_title
    notifications.create({title: 'Service Down',
      message: 'Your service has an error',
      link: app.getModelURL(mw),
      link_title: 'Resolve this'
    });
    view.render();
    link = container.one('.notice').one('a');
    link.getAttribute('href').should.equal(
        '/service/mediawiki/');
    link.getHTML().should.contain('Resolve this');
  });

  it('must be able to evict irrelevant notices', function() {
    var container = Y.Node.create(
        '<div id="test" class="container"></div>'),
        conn = new(Y.namespace('juju-tests.utils')).SocketStub(),
        env = new juju.Environment({conn: conn}),
        app = new Y.juju.App({
          env: env,
          container: container,
          viewContainer: container
        });
    var environment_delta = default_env;

    var notifications = app.db.notifications,
        view = new views.NotificationsView({
          container: container,
          notifications: notifications,
          env: app.env}).render();


    app.env.dispatch_result(environment_delta);


    notifications.size().should.equal(7);
    // we have one unit in error
    view.getShowable().length.should.equal(1);

    // now fire another delta event marking that node as
    // started
    app.env.dispatch_result({result: [['unit', 'change', {
      'machine': 0,
      'agent-state': 'started',
      'public-address': '192.168.122.222',
      'id': 'mysql/0'
    }]], op: 'delta'});
    notifications.size().should.equal(8);
    // This should have evicted the prior notice from seen
    view.getShowable().length.should.equal(0);
  });

  it('must properly construct title and message based on level from ' +
     'event data',
     function() {
       var container = Y.Node.create(
       '<div id="test" class="container"></div>'),
       app = new Y.juju.App({
         container: container,
         viewContainer: container
       });
       var environment_delta = {
         'result': [
           ['service', 'add', {
             'charm': 'cs:precise/wordpress-6',
             'id': 'wordpress'
           }],
           ['service', 'add', {
             'charm': 'cs:precise/mediawiki-3',
             'id': 'mediawiki'
           }],
           ['service', 'add', {
             'charm': 'cs:precise/mysql-6',
             'id': 'mysql'
           }],
           ['unit', 'add', {
             'agent-state': 'install-error',
             'id': 'wordpress/0'
           }],
           ['unit', 'add', {
             'agent-state': 'error',
             'public-address': '192.168.122.222',
             'id': 'mysql/0'
           }],
           ['unit', 'add', {
             'public-address': '192.168.122.222',
             'id': 'mysql/2'
           }]
         ],
         'op': 'delta'
       };

       var notifications = app.db.notifications,
       view = new views.NotificationsView({
         container: container,
         notifications: notifications,
         app: app,
         env: app.env}).render();

       app.env.dispatch_result(environment_delta);

       notifications.size().should.equal(6);
       // we have one unit in error
       var showable = view.getShowable();
       showable.length.should.equal(2);
       // The first showable notification should indicate an error.
       showable[0].level.should.equal('error');
       showable[0].title.should.equal('Error with mysql/0');
       showable[0].message.should.equal('Agent-state = error.');
       // The second showable notification should also indicate an error.
       showable[1].level.should.equal('error');
       showable[1].title.should.equal('Error with wordpress/0');
       showable[1].message.should.equal('Agent-state = install-error.');
       // The first non-error notice should have an 'info' level and less
       // severe messaging.
       var notice = notifications.item(0);
       notice.get('level').should.equal('info');
       notice.get('title').should.equal('Problem with mysql/2');
       notice.get('message').should.equal('');
     });


  it('should open on click and close on clickoutside', function(done) {
    var container = Y.Node.create(
        '<div id="test-container" style="display: none" class="container"/>'),
        notifications = new models.NotificationList(),
        env = new juju.Environment(),
        view = new views.NotificationsView({
          container: container,
          notifications: notifications,
          env: env}).render(),
        indicator;

    Y.one('body').append(container);
    notifications.add({title: 'testing', 'level': 'error'});
    indicator = container.one('#notify-indicator');

    indicator.simulate('click');
    indicator.ancestor().hasClass('open').should.equal(true);

    Y.one('body').simulate('click');
    indicator.ancestor().hasClass('open').should.equal(false);

    container.remove();
    done();
  });

});


describe('changing notifications to words', function() {
  var Y, juju;

  before(function(done) {
    Y = YUI(GlobalConfig).use(
        ['juju-notification-controller'],
        function(Y) {
          juju = Y.namespace('juju');
          done();
        });
  });

  it('should correctly translate notification operations into English',
     function() {
       assert.equal(juju._changeNotificationOpToWords('add'), 'created');
       assert.equal(juju._changeNotificationOpToWords('remove'), 'removed');
       assert.equal(juju._changeNotificationOpToWords('not-an-op'), 'changed');
     });
});

describe('relation notifications', function() {
  var Y, juju;

  before(function(done) {
    Y = YUI(GlobalConfig).use(
        ['juju-notification-controller'],
        function(Y) {
          juju = Y.namespace('juju');
          done();
        });
  });

  it('should produce reasonable titles', function() {
    assert.equal(
        juju._relationNotifications.title(undefined, 'add'),
        'Relation created');
    assert.equal(
        juju._relationNotifications.title(undefined, 'remove'),
        'Relation removed');
  });

  it('should generate messages about two-party relations', function() {
    var changeData =
        { endpoints:
              [['endpoint0', {name: 'relation0'}],
                ['endpoint1', {name: 'relation1'}]]};
    assert.equal(
        juju._relationNotifications.message(undefined, 'add', changeData),
        'Relation between endpoint0 (relation type "relation0") and ' +
        'endpoint1 (relation type "relation1") was created');
  });

  it('should generate messages about one-party relations', function() {
    var changeData =
        { endpoints:
              [['endpoint1', {name: 'relation1'}]]};
    assert.equal(
        juju._relationNotifications.message(undefined, 'add', changeData),
        'Relation with endpoint1 (relation type "relation1") was created');
  });
});

describe('notification visual feedback', function() {
  var env, models, notifications, notificationsView, notifierBox, views, Y;

  before(function(done) {
    Y = YUI(GlobalConfig).use('juju-env', 'juju-models', 'juju-views',
        function(Y) {
          var juju = Y.namespace('juju');
          env = new juju.Environment();
          models = Y.namespace('juju.models');
          views = Y.namespace('juju.views');
          done();
        });
  });

  // Instantiate the notifications model list and view.
  // Also create the notifier box and attach it as first element of the body.
  beforeEach(function() {
    notifications = new models.NotificationList();
    notificationsView = new views.NotificationsView({
      env: env,
      notifications: notifications
    });
    notifierBox = Y.Node.create('<div id="notifier-box"></div>');
    notifierBox.setStyle('display', 'none');
    Y.one('body').prepend(notifierBox);
  });

  // Destroy the notifier box created in beforeEach.
  afterEach(function() {
    notifierBox.remove();
    notifierBox.destroy(true);
  });

  // Assert the notifier box contains the expectedNumber of notifiers.
  var assertNumNotifiers = function(expectedNumber) {
    assert.equal(expectedNumber, notifierBox.get('children').size());
  };

  it('should appear when a new error is notified', function() {
    notifications.add({title: 'mytitle', level: 'error'});
    assertNumNotifiers(1);
  });

  it('should only appear when the DOM contains the notifier box', function() {
    notifierBox.remove();
    notifications.add({title: 'mytitle', level: 'error'});
    assertNumNotifiers(0);
  });

  it('should not appear when the notification is not an error', function() {
    notifications.add({title: 'mytitle', level: 'info'});
    assertNumNotifiers(0);
  });

  it('should not appear when the notification comes form delta', function() {
    notifications.add({title: 'mytitle', level: 'error', isDelta: true});
    assertNumNotifiers(0);
  });

});
