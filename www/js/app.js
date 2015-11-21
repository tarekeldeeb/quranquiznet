// Ionic Starter App
var db = null;


// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services', 'starter.utils', 'ngCordova', 'ngResource'])

.run(function($ionicPlatform, $cordovaSQLite, $ionicPopup, $resource, $ionicLoading, $http, Utils) {


    var QQ = {
        _httpGetJson: function(onSuccess, onError) {
            $http({
                method: 'GET',
                url: '/q.json'
            }).then(function(response) {
                onSuccess(response.data.objects[0]);
            }, function(response) {
                if (onError) onError(response);
            });
        },
        _formatInsertQueries: function(json) {
            var insertQueries = [];
            var insertTpl = "({0},'{1}','{2}',{3},{4},{5},{6})";
            for (var i = 0; i < json.rows.length; i++) {
                if (i % 500 === 0) {
                    if (insertQueries.length > 0) insertQueries[(insertQueries.length - 1)] = insertQueries[(insertQueries.length - 1)].substr(0, insertQueries[(insertQueries.length - 1)].length - 2) + ";";
                    insertQueries.push("INSERT INTO q VALUES ");
                }
                insertQueries[(insertQueries.length - 1)] = insertQueries[(insertQueries.length - 1)] + Utils.String(insertTpl, json.rows[i]) + ", ";
            }
            insertQueries[(insertQueries.length - 1)] = insertQueries[(insertQueries.length - 1)].substr(0, insertQueries[(insertQueries.length - 1)].length - 2) + ";";

            return insertQueries;
        },
		CheckDatabase: function(db, onSuccess, onError) {
		//	$cordovaSQLite.execute(db, "SELECT COUNT ( * ) FROM sqlite_master WHERE type='table' AND name='q'", [])
		//		.then(function(r) {
		//			console.log('Table q status: '+ JSON.stringify( r.rows.item(0) ));
		//			if(r.rows.item(0)){ // Table exists, check size:: FIXME! Cannot select field: "COUNT ( * )" bad syntax
		//				$cordovaSQLite.execute(db, "SELECT Count(*) FROM q", [])
		//				.then(function(c) {
		//					if(c.rows.item(0) != Utils.QuranWords){ 
		//						console.log("DB not complete, drop it and import!");
		//						$cordovaSQLite.execute(db, "DROP TABLE IF EXISTS q", [])
		//							.then(function(x) {
		//								this.ImportDatabase(db, onSuccess, onError);
		//							});
		//					}	
		//				});
		//			} else { // Table does not exist, first run!
						this.ImportDatabase(db, onSuccess, onError);
		//			}
		//		});
		},
        ImportDatabase: function(db, onSuccess, onError) {
			this._httpGetJson(function(sqlJson) {
				$cordovaSQLite.execute(db, sqlJson.ddl, [])
					.then(function(r) {
						var insertQueries = this._formatInsertQueries(sqlJson);
						for (var i = 0; i < insertQueries.length; i++) {
							$cordovaSQLite.execute(db, insertQueries[i], []).then(function(response) {
								console.log(response);
							}, function(error) {
								if (onError) onError(error);
							});
						}
						if (onSuccess) onSuccess();
					}.bind(this), function(error) {
						if (onError) onError(error);
					});
				}.bind(this));
		}
    };

    $ionicPlatform.ready(function() {

        $ionicLoading.show({
            template: 'جاري الاعداد ..'
        });
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

        if (window.cordova) {
            // App syntax
            db = $cordovaSQLite.openDB("myapp.db"); // to be replaced
            /*
			//TODO: Check if DB exists
			window.plugins.sqlDB.copy("populated.db", function() {
                db = $cordovaSQLite.openDB("populated.db");
            }, function(error) {
                console.error("There was an error copying the database: " + error);
                db = $cordovaSQLite.openDB("populated.db");
            });
			*/

        } else { // Ionic serve syntax

            if (window.openDatabase) { // Browser  does support WebSQL!
                db = window.openDatabase("myapp.db", "1.0", "My app", 5000000);
                QQ.CheckDatabase(db, function () {
                    console.log("quran quiz database imported successfully");
                }, function (error) {
                    console.error("error happened while importing quran quiz database", error);
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
        $ionicLoading.hide();
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
