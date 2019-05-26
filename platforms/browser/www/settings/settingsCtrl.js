/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('settingsCtrl', function ($scope, Profile) {
    $scope.profile = Profile;
    $scope.saveSettings = function () {
      Profile.saveSettings();
    }
  })