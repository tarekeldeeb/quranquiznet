/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/

var db = null;

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'quranquiznet' is the name of this angular module (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('quranquiznet', ['ionic', 'ui.router', 'quranquiznet.controllers', 'quranquiznet.services',
    'quranquiznet.utils', 'quranquiznet.profile', 'quranquiznet.questionnaire', 'ngCordova',
    'ngResource', 'firebase', 'angular-svg-round-progress', '720kb.socialshare'
  ])
  .run(function ($ionicPlatform, $cordovaSQLite, $rootScope, $ionicPopup, $resource, $http, $state, Utils, Profile) {
    var allRowPromises = [];
    var QQ = {
      _httpGetJson: function (onSuccess, onError) {
        $http({
          method: 'GET',
          url: 'q.json'
        }).then(function (response) {
          onSuccess(response.data.objects[0]);
        }, function (response) {
          if (onError) onError(response);
        });
      },
      _formatInsertQueries: function (json) {
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
      CheckDatabase: function (db, onSuccess, onError) {
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
      ImportDatabase: function (db, onSuccess, onError) {
        this._httpGetJson(function (sqlJson) {
          $cordovaSQLite.execute(db, sqlJson.ddl, [])
            .then(function (r) {
              var insertQueries = this._formatInsertQueries(sqlJson);
              for (var i = 0; i < insertQueries.length; i++) {
                allRowPromises.push($cordovaSQLite.execute(db, insertQueries[i], []).then(function (response) {
                  console.log(response);
                }, function (error) {
                  if (onError) onError(error);
                }));
              }
              Promise.all(allRowPromises).then(function (r) {
                if (onSuccess) onSuccess();
              });
            }.bind(this), function (error) {
              if (onError) onError(error);
            });
        }.bind(this));
      }
    };
	
	// Register worker for web App
	if ('serviceWorker' in navigator) {
	  navigator.serviceWorker.register('worker.js');
	}

  $rootScope.auth = firebase.auth();
  $rootScope.database = firebase.database();
  $rootScope.storage = firebase.storage();
  $rootScope.source_version = "193";
  $rootScope.appName = "اختبار القرآن";
  $rootScope.Loc = {};
    
  $ionicPlatform.ready(function () {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
        cordova.plugins.Keyboard.disableScroll(true);
      }
      if (!ionic.Platform.isIOS() && !ionic.Platform.isAndroid()) {
        Utils.log('Enabling the phone container!');
        $rootScope.phoneStyle = {
          'position': 'relative'
        }
      } else {
        Utils.log('Starting on a phone, no container!');
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

      } else { // Progressive Web App

        if (window.openDatabase) { // Browser  does support WebSQL!
          db = window.openDatabase("myapp.db", "1.0", "My app", 5000000);
          if (Profile.load()) {
            console.log('Loaded profile with UID: ' + JSON.stringify(Profile.uid));
            $rootScope.loadingDone = true;
            $rootScope.messaging = firebase.messaging();
            $rootScope.messaging.usePublicVapidKey("BD84KclfrcaNEhP4wPCiLHh73Mrsj3V_Tb4wC-NlPClDlcLlaDIwFDCXX2tYGmzLHEqKfCH22tTyOVkwKw6FHV0");

            $state.go('q.profile');
          } else {
            console.log('Created new profile with UID: ' + Profile.uid);
            QQ.CheckDatabase(db, function () {
              console.log("Quran quiz database imported successfully");
              allRowPromises = [];
              $rootScope.loadingDone = true;
              //$rootScope.$apply();
              Utils.log('Jumping to Ahlan page .. [customStart='+$state.params.customStart+']');
              if($state.current.name == 'q.quiz') $state.go('ahlan',{"customStart":$state.params.customStart});
            }, function (error) {
              if(error.message.includes('already exists')){
                console.log("Quran quiz database already exists");
                allRowPromises = [];
                $rootScope.loadingDone = true;
                return;
              } 
              console.error("Error happened while importing quran quiz database ", error);
            });
          }
          $rootScope.back = "";
        } else { // Browser  does not support WebSQL!
          var alertPopup = $ionicPopup.alert({
            title: 'Unsupported Browser!',
            template: 'Your browser does not support WebSQL, please use: Chrome, Safari or Opera.'
          });
          alertPopup.then(function (res) {
            console.log('Unsupported browser, exiting!');
            window.open('http://caniuse.com/#feat=sql-storage', '_self', 'location=yes');
            return false;
          });
        }
      }
    });
  })

  .directive("qqSrc", function () {
    return {
      link: function (scope, element, attrs) {
        var loadImage, img = null;
        loadImage = function () {
          element[0].src = "img/book-loading.gif";
          img = new Image();
          img.src = attrs.qqSrc;
          img.onload = function () {
            element[0].src = attrs.qqSrc;
          };
        };
        scope.$watch((function () {
          return attrs.qqSrc;
        }), function (newVal, oldVal) {
          if (oldVal !== newVal) {
            loadImage();
          }
        });
      }
    };
  })
  .config(function ($stateProvider, $urlRouterProvider) {

    // Ionic uses AngularUI Router which uses the concept of states
    // Learn more here: https://github.com/angular-ui/ui-router
    // Set up the various states which the app can be in.
    // Each state's controller can be found in controllers.js
    $stateProvider

      // setup an abstract state for the tabs directive
      .state('q', {
        url: '/q',
        abstract: true,
        templateUrl: 'templates/menu.html'
      })

      // Each tab has its own nav history stack:

      .state('q.quiz', {
        url: '/quiz/:customStart',
        views: {
          'menuContent': {
            templateUrl: 'quiz/tab-quiz.html',
            controller: 'quizCtrl'
          }
        }
      })

      .state('q.settings', {
        url: '/settings',
        views: {
          'menuContent': {
            templateUrl: 'settings/tab-settings.html',
            controller: 'settingsCtrl'
          }
        }
      })

      .state('q.profile', {
        url: '/profile',
        views: {
          'menuContent': {
            templateUrl: 'profile/tab-profile.html',
            controller: 'firebasecontrol'
          }
        }
      })

      .state('q.daily', {
        url: '/daily/:dailyRandom',
        views: {
          'menuContent': {
            templateUrl: 'daily/tab-daily.html',
            controller: 'daily'
          }
        }
      })

      .state('q.study', {
        url: '/study',
        views: {
          'menuContent': {
            templateUrl: 'study/tab-study.html',
            controller: 'StudyCtrl'
          }
        }
      });

    $stateProvider
      .state('ahlan', {
        url: '/ahlan/:customStart',
        controller: 'firebasecontrol',
        templateUrl: 'templates/ahlan.html'
      });
    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/ahlan');

  })
  .config(function ($ionicConfigProvider) {
    $ionicConfigProvider.navBar.alignTitle('right')
  });
