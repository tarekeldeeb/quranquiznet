/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/
angular.module('starter.questionnaire',[])
.factory('Questionnaire', function(Profile, Q, Utils) {
	var self = this;
	var sparsed;
	var QLEN_EXTRA_LIMIT=2;
  
  this.qTypeEnum = { 
		NOTSPECIAL:		{id:1, score:0, txt:'اختر التكملة الصحيحة'},
		SURANAME:		{id:2, score:2, txt:'اختر اسم السورة'},
		SURAAYACOUNT:	{id:3, score:4, txt:'اختر عدد ايات السورة'},
		MAKKI:			{id:4, score:2, txt:'اختر بيان السورة'},
		AYANUMBER:		{id:5, score:7, txt:'اختر رقم الاية'}
	};

  this.qo = {
  	/******** Questions parameters to be set: Start **********/
	rounds: 10, 	// How many rounds a question has: 10 for normal, 1 for special
	validCount: 1, 	// Number of correct options at the first round
	op:[] , 		// Holds all 5 options x 10 rounds
	startIdx: 1, 	// Precise Position near seed, valid options
	qLen: 3, 		// Number of words to display to start the Question
	oLen: 2, 		// Number of words of each option
	qType: 0, 		// Question Type: NOTSPECIAL or <Special Type>
	currentPart: {} // Current Study Part
  };
  
  
  /**************** Constructor Code ****************/
    var previousSeed = Profile.lastSeed;
	var rand = new Random(previousSeed);

	// Keep Reference of Q
	if(qdb != null) q = qdb;
	if(s != null) session = s;
		
	createNextQ();
		
  return self;
})
