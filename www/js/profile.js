/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.profile',[])
.factory('Profile', function(Utils) {
  var self = this;
  
  this.uid = 0;
  this.social = {type:{}, data:{}};
  this.lastSeed = 0;
  this.level = 1;
  this.specialEnabled = false;
  this.scores = [{date:0,score:0}];
  this.parts = [];
  this.version = {db:1.0, app:1.0, profile:1.0};

  var scoreRecord = function() {
	return {	date:Utils.getTime(),
				score:this.getScore()
			};
  }  
  var studyPart = function(start,length,correct,questions,name,checked) {
	return {	start:start,
				length:length,
				numCorrect:correct,
				numQuestions:questions,
				name:name,
				checked:checked
			};
  }
  
  var QQSparseResult = function(idx, part){
	return {	idx: idx,
				part:part
			};
  }
  var getCorrectRatios = function(i){
	  	var r = [0,0,0,0];
		  var numCorrect, numQuestions;
		for(varj=0;j<4;j++){
			numCorrect = this.parts[i].numCorrect[j];
			numQuestions = this.parts[i].numQuestions[j];
			r[j] = (numQuestions==0)? 0: (numCorrect / numQuestions);			
		}
		return r;
  }
  var getCorrectRatio = function(i){
	var numCorrect, numQuestions;
	numCorrect = 	this.parts[i].numCorrect[0]+
					this.parts[i].numCorrect[1]+
					this.parts[i].numCorrect[2]+
					this.parts[i].numCorrect[3];
	numQuestions =  this.parts[i].numQuestions[0]+
					this.parts[i].numQuestions[1]+
					this.parts[i].numQuestions[2]+
					this.parts[i].numQuestions[3];
	return (numQuestions==0)? 0: (numCorrect / numQuestions);			
  }
  var calculateScorePart = function(i){
		return 	self.parts[i].numCorrect[0] +
				(2*self.parts[i].numCorrect[1]-self.parts[i].numQuestions[1])*10 +
				(2*self.parts[i].numCorrect[2]-self.parts[i].numQuestions[2])*20 +
				(2*self.parts[i].numCorrect[3]-self.parts[i].numQuestions[3])*30;
  }
  
  this.load = function() {
	if (Utils.load('prf_uid',-1) == -1){
		// Create Default Profile
		this.parts.push( new studyPart(1,(Utils.sura_idx[0]),[0,0,0,0],[0,0,0,0],'سورة '+Utils.sura_name[0],true));

		for (var i = 1; i < 45; i++) 
			this.parts.push( new studyPart(	(Utils.sura_idx[i-1]),
											(Utils.sura_idx[i] - Utils.sura_idx[i-1]),
											[0,0,0,0],[0,0,0,0],'سورة '+Utils.sura_name[i],false));
		for (var i = 0; i < 5; i++) 
			this.parts.push( new studyPart(	(Utils.last5_juz_idx[i]),
											(Utils.last5_juz_idx[i+1] - Utils.last5_juz_idx[i]),
											[0,0,0,0],[0,0,0,0],'جزء '+Utils.last5_juz_name[i],false));

		this.parts[49].checked = true;		//Juz2 3amma!
		//TODO: Use https://github.com/davidbau/seedrandom
		this.lastSeed	 		= Math.floor(Math.random()*(Utils.QuranWords-1));
		this.saveAll();
		return false;
	} else {
		this.uid 				= parseInt(Utils.load('prf_uid',0));
		this.lastSeed 			= parseInt(Utils.load('prf_lastSeed',0));
		this.level 				= parseInt(Utils.load('prf_level',-1));
		this.specialEnabled 	= JSON.parse(Utils.load('prf_specialEnabled',false));
		this.scores 			= Utils.loadObject('prf_scores');
		this.parts 				= Utils.loadObject('prf_parts');		
		this.version 			= Utils.loadObject('prf_version');		
		this.social 			= Utils.loadObject('prf_social');		
		return true;
	}
  }
  
  this.saveAll = function(){
	Utils.save('prf_uid',this.uid);
	Utils.save('prf_lastSeed',this.lastSeed);
	Utils.save('prf_level',this.level);
	Utils.save('prf_specialEnabled',this.specialEnabled);
	Utils.saveObject('prf_scores',this.scores);
	Utils.saveObject('prf_parts',this.parts);	
	Utils.saveObject('prf_social',this.social);	
  }
  
  this.saveParts = function(){
	Utils.saveObject('prf_parts',this.parts);	
  }

  this.saveSettings = function(){
	Utils.save('prf_level',this.level);
	Utils.save('prf_specialEnabled',this.specialEnabled);
  }
 
  this.saveScores = function(){
	Utils.saveObject('prf_scores',this.scores);
	Utils.saveObject('prf_parts',this.parts);	
  }
  
  this.saveSocial = function(social){
	  this.social = social
	  //TODO: Add checks from social  provider: basic fields? error codes?	
	  Utils.saveObject('prf_social',this.social);	
  }
  this.addCorrect = function (qo) {
	  var currentPart = qo.currentPart;
	  if ((currentPart < self.parts.length) && self.level > 0) {
		  if (qo.qType.id > 1) { 
			  /** Special Question */
			  self.parts[currentPart].numCorrect[0] += qo.qType.score;
			  self.parts[currentPart].numQuestions[0] += 1;
		  } else {
			  /** Normal Question */
			  self.parts[currentPart].numCorrect[self.level] += 1;
			  self.parts[currentPart].numQuestions[self.level] += 1;
		  }
		  Utils.saveObject('prf_parts', self.parts);
	  }
  }

  this.addIncorrect = function(qo) {
	  var currentPart = qo.currentPart;
	  if ((currentPart < self.parts.length) && self.level > 0) {
		  if (qo.qType.id > 1) { 
			  /** Special Question */
			  self.parts[currentPart].numQuestions[0] += 1;
		  } else {
			  /** Normal Question */
			  self.parts[currentPart].numQuestions[self.level] += 1;
		  }
		  Utils.saveObject('prf_parts', self.parts);
	  }
	}

  this.getScore = function(){
		var score=0;
		for(var i=0;i<self.parts.length;i++){
			score += calculateScorePart(i);
		}
		return parseInt(score);
	}

	//
	//After getting a random number between 1:TotalStudy,
	//it's needed to map that number to un-contiguous study part.
	//@param CntTot: 
	//@return
	//
	this.getSparsePoint = function(CntTot) {
		var Length = 0, i, pLength;
		for (i = 0; i < this.parts.length; i++) {
			pLength = (this.parts[i].checked === true)?this.parts[i].length:0;
			if (CntTot < Length + pLength) {
				return new QQSparseResult(this.parts[i].start + CntTot
						- Length, i);
			} else {
				Length += pLength;
			}
		}
		return new QQSparseResult(self.parts[i].start, i);
	}

	//
	//@return The total word count of studied parts
	//
	this.getTotalStudyLength = function() {
		var Length = 0;
		for (var i = 0; i < this.parts.length; i++) {
			if (this.parts[i].checked === true)
				Length += this.parts[i].length;
		}
		return Length;
	}

	this.getTotalCorrect = function() {
		var Tot = 0;
		for (var i = 0; i < this.parts.length; i++) {
			if (this.parts[i].checked === true)
				Tot += this.parts[i].numCorrect.reduce(Utils.add, 0);
		}
		return Tot;
	}

	this.getTotalQuesCount = function() {
		var Tot = 0;
		for (var i = 0; i < this.parts.length; i++) {
			if (this.parts[i].checked === true)
				Tot += this.parts[i].getNumQuestions.reduce(Utils.add, 0);
		}
		return Tot;
	}

	this.getTotAvgLevel = function() {
		var avg=0.0,studyWeight=0.0;
		var avgLevel,partWeight;
		for(var i=0;i<this.parts.length;i++){
			avgLevel    = this.parts[i].avgLevel;
			partWeight	= Utils.PartWeight100[i]/100; 
			studyWeight += partWeight;
			avg 		+= avgLevel*partWeight;
		}
		return (avg/studyWeight);
	}

	//
	//If current profile selections has too few suras, then the user 
	//is not eligible to some special questions; example: State Sura Name.
	//@return
	//
	this.isSurasSpecialQuestionEligible = function(){
		for(var i=this.parts.length-1;i>=this.parts.length-5;i--)
			if(this.parts[i].checked === true) return true;
		
		var s=0;
		for(var j=this.parts.length-6;j>0;j--){
			if(this.parts[i].checked === true) s++;
			if(s>=Utils.SurasSpecialQuestionEligibilityThreshold)
				return true;
		}
		return false; 
	}

	this.updateScoreRecord = function() {
		var scoreLength = this.scores.length;
		if (scoreLength < 5) {
			if (scoreLength == 0 && this.scores[0].date == 0){
				this.scores[0] = new scoreRecord();
			}else{
				this.scores.push(new scoreRecord());
			}
			return true;
		} else if (Utils.isOlderThan1day(this.scores[scoreLength-1].date)) {
			this.scores.push(new scoreRecord());
			return true;
		}
		return false;
	}

	this.levels = [	{value:0, text:"مستوى ابتدائي", comment:"يبدأ السؤال من رأس الاية، ولا يزيد النقاط", disabled:false},
					{value:1, text:"مستوى أولي", comment:"السؤال من ثلاث كلمات، يزيد النقاط بعشرة", disabled:false},
					{value:2, text:"مستوى ثانوي", comment:"السؤال من كلمتين، يزيد النقاط بعشرين", disabled:false},
					{value:3, text:"مستوى متقدم", comment:"أكثر من اجابة صحيحة، يزيد النقاط بثلاثين", disabled:true}];

	
	/* 	// TODO: continue Port!
	
	//@return An array of weights for studied parts to sum up 
	//to QQUtils.DAILYQUIZ_QPERPART_COUNT
	//
	this.getDailyQuizStudyPartsWeights = function(dailyRandom){
		var sparse = [Utils.DAILYQUIZ_PARTS_COUNT];
		var totalStudyWeight = Math.ceil(this.getTotalStudyLength()/Utils.Juz2AvgWords);
		var Wn, WnX100_remainder=0, WnX100;
		
		//Fill array as: [0, 0, W1, 0, W2, ..]
		for(int i=0;i<QQUtils.DAILYQUIZ_PARTS_COUNT;i++){
			//Skip Al-Fatiha
			if(QParts.get(i+1).getLength()==0)
				sparse[i] = 0;
			else{
				WnX100 = QQUtils.DAILYQUIZ_QPERPART_COUNT*QQUtils.PartWeight100[i+1]
									/totalStudyWeight; //Weight with scaling of 100
				if( Integer.valueOf(dailyRandom.charAt(i))>4 ){
					Wn = (int) Math.ceil((WnX100+WnX100_remainder)/(float)100);
					if(Wn>0){
						sparse[i] = Wn;
						WnX100_remainder += WnX100-100;
					} else {
						sparse[i] = 0;
						WnX100_remainder += WnX100;
					}
				} else {
					Wn = (int) Math.round((WnX100+WnX100_remainder)/(float)100);
					if(Wn>0){
						sparse[i] = Wn;
						WnX100_remainder += WnX100-100;
					} else {
						sparse[i] = 0;
						WnX100_remainder += WnX100;
					}
				}
			}
		}

		//Check if W1:Wn sum to DAILYQUIZ_QPERPART_COUNT
		int sum=0;
		for(int i=0;i<QQUtils.DAILYQUIZ_PARTS_COUNT;i++)
			sum += sparse[i];
		int sumCorrection = QQUtils.DAILYQUIZ_QPERPART_COUNT - sum;
		
		//Apply correction (due to approx) to last selection
		for(int i=QQUtils.DAILYQUIZ_PARTS_COUNT-1;i>=0;i--){
			if(sparse[i]!=0){
				sparse[i] += sumCorrection;
				break;
			}
		}

		Log.i("DailyQuizStudyPartsWeights:: "+ sparse[0] + sparse[1] + sparse[2] + sparse[3] + sparse[4] + sparse[5] 
											 + sparse[6] + sparse[7] + sparse[8] + sparse[9] + sparse[10] + sparse[11] 
											 + sparse[12] + sparse[13] + sparse[14] + sparse[15] + sparse[16] + sparse[17] 
											 + sparse[18] + sparse[19] + sparse[20] + sparse[21] + sparse[22] + sparse[23] 
											 + sparse[24] + sparse[25] + sparse[26] + sparse[27] + sparse[28] + sparse[29] 
											 + sparse[30] + sparse[31] + sparse[32] + sparse[33] + sparse[34] + sparse[35] 
											 + sparse[36] + sparse[37] + sparse[38] + sparse[39] + sparse[40] + sparse[41] 
											 + sparse[42] + sparse[43] + sparse[44] + sparse[45] + sparse[46] + sparse[47] 
										     + " " + sparse[48]);
		
		return sparse;
	}
	
	
  */
  return self;
})
