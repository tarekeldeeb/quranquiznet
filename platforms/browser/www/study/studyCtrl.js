/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('StudyCtrl', function ($scope, Profile, Utils) {
    $scope.profile = Profile;
    $scope.saveParts = function () {
      //TODO: Validate selected quantity!
      Profile.saveParts();
    }
    $scope.toggleParts = function () {
      var tog = ($scope.profile.parts[1].checked === false);
      for (var i = 1; i < $scope.profile.parts.length; i++) {
        $scope.profile.parts[i].checked = tog;
      }
      $scope.saveParts();
    };
    $scope.heartParts = function () {
      for (var i = 1; i < $scope.profile.parts.length; i++) {
        $scope.profile.parts[i].checked =
          ($scope.profile.getCorrectRatioRange(i) == $scope.profile.correctRatioRange.HIGH) ||
          ($scope.profile.getCorrectRatioRange(i) == $scope.profile.correctRatioRange.MID);
      }
      $scope.saveParts();
    };
    $scope.flagParts = function () {
      for (var i = 1; i < $scope.profile.parts.length; i++) {
        $scope.profile.parts[i].checked =
          ($scope.profile.getCorrectRatioRange(i) == $scope.profile.correctRatioRange.LOW);
      }
      $scope.saveParts();
    };
    $scope.getIcon = function (i) {
      var ico = 'ion-help-circled stable';
      var ratio = $scope.profile.getCorrectRatioRange(i);
      if (ratio == $scope.profile.correctRatioRange.HIGH)
        ico = 'ion-heart balanced';
      else if (ratio == $scope.profile.correctRatioRange.MID)
        ico = 'ion-heart-broken energized';
      else if (ratio == $scope.profile.correctRatioRange.LOW)
        ico = 'ion-flag assertive';

      return ('icon ' + ico);
    }
  });