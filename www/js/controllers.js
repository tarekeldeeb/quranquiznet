/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope, $ionicLoading, Q, $q, DBA, Utils, Profile, Questionnaire) {
	var round;
	
	$scope.busyShow = function(){ $ionicLoading.show({template: '<ion-spinner></ion-spinner>'}); }
	$scope.busyHide = function(){ $ionicLoading.hide(); }
	$scope.nextQ = function(){
		$scope.busyShow();
		Questionnaire.createNextQ()
		.then(function(){
			round = 0;
			$scope.question = Questionnaire.qo.txt.question;
			$scope.options = Questionnaire.qo.txt.op[0];

			$scope.busyHide();			
		});
	}
	$scope.selectOption = function(sel) {
		$scope.question = $scope.question + ' ' + $scope.options[sel];
		round++;
		if( round == Questionnaire.qo.rounds){
			//TODO: Handle Score
			
			//TODO: Handle profile
			//Profile.parts[ii%50].numQuestions = Profile.parts[ii%50].numQuestions+ 1;
			//Profile.saveAll();
			$scope.nextQ();
			return;
		}	
		
		$scope.options = Questionnaire.qo.txt.op[round];

	}
	$scope.flip = function(){
		angular.element(document.getElementById('flip-container')).toggle("flip") 
		console.log('Flipped:' + JSON.stringify());
	}

	$scope.nextQ();


})

/**
* All below services are for demo purposes!
* You may ignore for now.
*/
.controller('google', function ($scope, googleLogin, Utils) {
	$scope.google_data = {};
	$scope.login = function () {
		var promise = googleLogin.startLogin();
		promise.then(function (data) {
			Utils.save('google_data', JSON.stringify(data));
			$scope.google_data = data;
			Utils.log(JSON.stringify(data));
		}, function (data) {
			$scope.google_data = data;
		});
	}
})

.controller('AccountCtrl', function($scope, Profile) {
  $scope.profile = Profile;
  $scope.saveSettings = function(){
	//TODO: Validate selected quantity!
	Profile.saveParts();
}
  $scope.toggleParts = function(){
    var tog = ($scope.profile.parts[1].checked === false);
	for(var i=1;i<$scope.profile.parts.length;i++){
		$scope.profile.parts[i].checked = tog; 
	}
	$scope.saveSettings();
  };
  
  $scope.getIcon = function(part){
	var ico = 'ion-help-circled stable';
	if(part.numQuestions > 0){
		if((part.numCorrect/part.numQuestions)>=0.8)
			ico = 'ion-heart balanced';
		else if((part.numCorrect/part.numQuestions)>=0.5)
			ico = 'ion-heart-broken energized';
		else 	
			ico = 'ion-flag assertive';
	}
	return ('icon '+ico);
  }
});
