// Ionic Starter App
var db = null;

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services', 'ngCordova'])

.run(function($ionicPlatform, $cordovaSQLite, $ionicPopup) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);

    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
	
	if(window.cordova) {
      // App syntax
      db = $cordovaSQLite.openDB("myapp.db");
    } else {
      // Ionic serve syntax
	  	/**
		* FIXME: Manually Copy db:
		* [1] Open site, a file will be created locally at:
		* C:\Users\_YOUR_USER_\AppData\Local\Google\Chrome\User Data\Default\databases\_HOST_
		* [2] Download+Unzip DB from: https://github.com/tarekeldeeb/quranquiz/raw/master/android-app/res/raw/qq_noidx_sqlite.zip
		* [3] replace Generated file from step #1
		>> Should programatically be: Download Zip > Unzip > Copy 
		*/
		if (window.openDatabase) { // WebSQL Supported!
			db = window.openDatabase("myapp.db", "1.0", "My app", -1);
			console.log('DB= '+db);
			var query="CREATE INDEX IF NOT EXISTS Q_TXT_INDEX on q (txt ASC)";
			$cordovaSQLite.execute(db, query, [])
			.then(function(res) {
				console.log('DB OK ..');
			}, function(e) {
				var alertPopup = $ionicPopup.alert({
				 title: 'Database needs a manual copy!',
				 template: 'This product is still in pre-mature development state,'
							+"you need to:<br/><br/>"
							+' #1 Download+Unzip DB from: '
							+'<a href="https://github.com/tarekeldeeb/quranquiz/raw/master/android-app/res/raw/qq_noidx_sqlite.zip">Quran Quiz Project</a> <br/><br/>'
							+' #2 Replace Generated file at: <br/>'
							+'C:\\Users\\_YOUR_USER_\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\databases\\_HOST_'
				});
				alertPopup.then(function(res) {
				 console.log('User instructed to manually prepare the DB!');
				});
				console.log(e);
			});
		} else { // Browser  does not support WebSQL!
			var alertPopup = $ionicPopup.alert({
				 title: 'Unsupported Browser!',
				 template: 'Your browser does not support WebSQL, please use: Chrome, Safari or Opera.'
				});
				alertPopup.then(function(res) {
				 console.log('Unsupported browser, exiting!');
				 window.open('http://caniuse.com/#feat=sql-storage', '_self', 'location=yes'); 
				 return false;
				});
		}
    }	
  });
})

.config(function($stateProvider, $urlRouterProvider) {

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider

  // setup an abstract state for the tabs directive
    .state('tab', {
    url: '/tab',
    abstract: true,
    templateUrl: 'templates/tabs.html'
  })

  // Each tab has its own nav history stack:

  .state('tab.dash', {
    url: '/dash',
    views: {
      'tab-dash': {
        templateUrl: 'templates/tab-dash.html',
        controller: 'DashCtrl'
      }
    }
  })

  .state('tab.chats', {
      url: '/chats',
      views: {
        'tab-chats': {
          templateUrl: 'templates/tab-chats.html',
          controller: 'ChatsCtrl'
        }
      }
    })
    .state('tab.chat-detail', {
      url: '/chats/:chatId',
      views: {
        'tab-chats': {
          templateUrl: 'templates/chat-detail.html',
          controller: 'ChatDetailCtrl'
        }
      }
    })

  .state('tab.account', {
    url: '/account',
    views: {
      'tab-account': {
        templateUrl: 'templates/tab-account.html',
        controller: 'AccountCtrl'
      }
    }
  });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/tab/dash');

});
