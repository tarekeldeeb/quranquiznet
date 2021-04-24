// use a cacheName for cache versioning
var cacheName = 'v201:app';
const cacheNameAssets = 'v1:assets';

// during the install phase you usually want to cache static APP assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      console.log(" ::: Updated to cache: " + cacheName + " :::");
      return cache.addAll(
        [
          '/css/style.css',
          '/css/flags.min.css',
          '/js/angular-md5.min.js',
          '/js/angular-resource.min.js',
          '/js/angular-socialshare.min.js',
          '/js/app.js',
          '/js/controllers.js',
          '/js/html2canvas.min.js',
          '/js/js-unzip.min.js',
          '/js/ng-cordova.min.js',
          '/js/seedrandom.min.js',
          '/js/sqlite.min.js',
          '/font/AmiriQuranColored.woff2',
          '/font/Amiri-Regular.woff2',
          '/index.html',
          '/daily/tab-daily.html',
          '/daily/daily.js',
          '/profile/tab-profile.html',
          '/profile/firebasecontrol.js',
          '/quiz/tab-quiz.html',
          '/quiz/quizCtrl.js',
          '/settings/tab-settings.html',
          '/settings/settingsCtrl.js',
          '/study/tab-study.html',
          '/study/studyCtrl.js',
          '/templates/ahlan.html',
          '/q.json.zip',
          '/_model_/profile.js',
          '/_model_/questionnaire.js',
          '/_model_/services.js',
          '/_model_/utils.js',
        ]
      ).then(function() {
                self.skipWaiting();
            });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cn) {
          // Remove outdates caches
          return cn != cacheName && cn != cacheNameAssets;
        }).map(function(cn) {
          return caches.delete(cn);
        })
      );
    })
  );
});

// when the browser fetches a url
self.addEventListener('fetch', function(event) {
  // Let the browser do its default thing
  // for non-GET requests.
  if (event.request.method != 'GET') return;
  var activeCache = (event.request.url.includes("madina_images"))? cacheNameAssets: cacheName;
  event.respondWith(
    caches.open(activeCache).then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});

//Communicate with app.js
self.addEventListener('message', (event) => {
  if (event.data.type === 'GET_APP_VERSION') {
    // Select who we want to respond to
    self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    }).then((clients) => {
      if (clients && clients.length) {
        // Send a response - the clients
        // array is ordered by last focused
        clients[0].postMessage({
          type: 'APP_VERSION',
          version: cacheName.split(":")[0].substring(1),
        });
      }
    });
  }
});
