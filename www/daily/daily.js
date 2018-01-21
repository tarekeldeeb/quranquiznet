/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('daily', function ($scope, $stateParams, Questionnaire, Utils) {
    $scope.dailyStart = function () {
      Questionnaire.getDailyQuiz(parseInt($stateParams.dailyRandom));
    }
  })