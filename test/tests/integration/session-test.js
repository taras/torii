var container, session, user, adapter, registry;

import toriiContainer from 'test/helpers/torii-container';
import SessionService from 'torii/services/torii-session';
import DummyAdapter from 'test/helpers/dummy-adapter';
import DummySuccessProvider from 'test/helpers/dummy-success-provider';
import DummyFailureProvider from 'test/helpers/dummy-failure-provider';

module('Session (open) - Integration', {
  setup: function(){
    var results = toriiContainer();
    registry = results[0];
    container = results[1];
    registry.register('service:session', SessionService);
    registry.register('torii-provider:dummy-success', DummySuccessProvider);
    registry.register('torii-provider:dummy-failure', DummyFailureProvider);
    registry.injection('service:session', 'torii', 'service:torii');
    session = container.lookup('service:session');
  },
  teardown: function(){
    Ember.run(container, 'destroy');
  }
});

test("session starts in unauthenticated unopened state", function(){
  ok(!session.get('isOpening'), 'not opening');
  ok(!session.get('isAuthenticated'), 'not authenticated');
});

test("starting auth sets isOpening to true", function(){
  var provider = container.lookup('torii-provider:dummy-success');
  var oldOpen = provider.open;

  provider.open = function(){
    ok(true, 'calls provider.open');
    ok(session.get('isOpening'), 'session.isOpening is true');

    return oldOpen.apply(this, arguments);
  };

  registry.register("torii-adapter:dummy-success", DummyAdapter);
  Ember.run(function(){
    session.open('dummy-success');
  });
});

test("successful auth sets isAuthenticated to true", function(){
  registry.register("torii-adapter:dummy-success", DummyAdapter);
  Ember.run(function(){
    session.open('dummy-success').then(function(){
      ok(!session.get('isOpening'), 'session is no longer opening');
      ok(session.get('isAuthenticated'), 'session is authenticated');
    });
  });
});

test("failed auth sets isAuthenticated to false, sets error", function(){
  Ember.run(function(){
    session.open('dummy-failure').then(function(){
      ok(false, 'should not resolve promise');
    }, function(err){
      ok(true, 'rejects promise');

      ok(!session.get('isOpening'), 'session is no longer opening');
      ok(!session.get('isAuthenticated'), 'session is not authenticated');
      ok(session.get('errorMessage'), 'session has error message');
    });
  });
});

module('Session (close) - Integration', {
  setup: function(){
    var results = toriiContainer();
    registry = results[0];
    container = results[1];
    registry.register('service:session', SessionService);
    registry.injection('service:session', 'torii', 'service:torii');
    session = container.lookup('service:session');
    adapter = container.lookup('torii-adapter:application');

    // Put the session in an open state
    user = {email: 'fake@fake.com'};
    session.get('stateMachine').transitionTo('opening');
    session.get('stateMachine').send('finishOpen', { currentUser: user});
  },
  teardown: function(){
    Ember.run(container, 'destroy');
  }
});

test("session starts in authenticated opened state", function(){
  ok(session.get('isAuthenticated'), 'not authenticated');
  deepEqual(session.get('currentUser'), user, 'has currentUser');
});

test("starting close sets isWorking to true", function(){
  var oldClose = adapter.close;

  adapter.close = function(){
    ok(true, 'calls adapter.close');
    ok(session.get('isWorking'), 'session.isWorking is true');
    return Ember.RSVP.resolve();
  };

  Ember.run(function(){
    session.close();
  });
});

test("finished close sets isWorking to false, isAuthenticated false", function(){
  adapter.close = function(){
    return Ember.RSVP.resolve();
  };

  Ember.run(function(){
    session.close().then(function(){
      ok(!session.get('isWorking'), "isWorking is false");
      ok(!session.get('isAuthenticated'), "isAuthenticated is false");
      ok(!session.get('currentUser'), "currentUser is false");
    }, function(err){
      ok(false, "promise rejected with error: "+err);
    });
  });
});

test("failed close sets isWorking to false, isAuthenticated true, error", function(){
  var error = 'Oh my';

  adapter.close = function(){
    return Ember.RSVP.reject(error);
  };

  Ember.run(function(){
    session.close().then(function(){
      ok(false, "promise resolved");
    },function(error){
      ok(!session.get('isWorking'), "isWorking is false");
      ok(!session.get('isAuthenticated'), "isAuthenticated is true");
      equal(session.get('errorMessage'), error, "error is present");
    });
  });
});
