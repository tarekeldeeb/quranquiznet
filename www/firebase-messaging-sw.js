
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/7.14.3/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/7.14.3/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
    apiKey: "AIzaSyCGxNSZizDrqsm58SIi1mmBAe4tWfvCmJk",
    authDomain: "quranquiznet-3a54c.firebaseapp.com",
    databaseURL: "https://quranquiznet-3a54c.firebaseio.com",
    projectId: "quranquiznet-3a54c",
    storageBucket: "quranquiznet-3a54c.appspot.com",
    messagingSenderId: "635224907527",
    appId: "1:635224907527:web:bb6cd3e8d858130d3a6fa2",
    measurementId: "G-Y9MJ3PD6KV"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = 'Background Message Title';
    const notificationOptions = {
      body: 'Background Message body.',
      icon: '/firebase-logo.png'
    };
  
    return self.registration.showNotification(notificationTitle,
      notificationOptions);
  });
  