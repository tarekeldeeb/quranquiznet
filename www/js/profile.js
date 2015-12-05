angular.module('starter.profile',[])
.factory('Profile', function(Utils) {
  var self = this;
  
  this.uid = 0;
  this.lastSeed = 0;
  this.level = 1;
  this.specialEnabled = false;
  this.specialScore = 0;
  this.scores = [{date:0,score:0}];
  this.parts = [];
  this.version = {db:1.0, app:1.0, profile:1.0};
  
  var studyPart = function(start,length,correct,questions,avgLevel,name,checked) {
	return {	start:start,
				length:length,
				numCorrect:correct,
				numQuestions:questions,
				avgLevel:avgLevel,
				name:name,
				checked:checked
			};
  }
  
  var QQSparseResult = function(idx, part){
	return {	idx: idx,
				part:part
			};
  }
  var getCorrectRatio = function(i){
  		var numCorrect = this.parts[i].numCorrect;
  		var numQuestions = this.parts[i].numQuestions;
		return (numCorrect==0)? 0: (numCorrect / numQuestions);
  }
  var calculateScorePart = function(i){
		var score=0.0;
		var partWeight,scaledQCount,avgLevel,scaledCorrectRatio;
		/**
		 * Calculate the normalized Number of words in current part
		 */
		partWeight   = Utils.PartWeight100[i]/100;
		avgLevel     = this.parts[i].avgLevel;
		scaledQCount = Utils.sCurve(this.parts[i].numCorrect,
									  Utils.Juz2SaturationQCount*partWeight);
		scaledQCount+=1;
		scaledCorrectRatio = Utils.sCurve(getCorrectRatio(i),1);
		
		score = 100*partWeight*avgLevel*scaledQCount*scaledCorrectRatio;

		Utils.log("["+i+"] S= "+(100*partWeight*avgLevel*scaledQCount*scaledCorrectRatio)+
					"::pW="(partWeight)+
					" av="+(avgLevel)+
					" sC="+(scaledQCount)+
					" sR="+(scaledCorrectRatio));
		return score;
  }
  
  this.load = function() {
	if (Utils.load('prf_uid',-1) == -1){
		// Create Default Profile
		this.parts.push( new studyPart(1,(Utils.sura_idx[0]),0,0,1.0,'سورة '+Utils.sura_name[0],true));

		for (var i = 1; i < 45; i++) 
			this.parts.push( new studyPart(	(Utils.sura_idx[i-1]),
											(Utils.sura_idx[i] - Utils.sura_idx[i-1]),
											0,0,1.0,'سورة '+Utils.sura_name[i],false));
		for (var i = 0; i < 5; i++) 
			this.parts.push( new studyPart(	(Utils.last5_juz_idx[i]),
											(Utils.last5_juz_idx[i+1] - Utils.last5_juz_idx[i]),
											0,0,1.0,'جزء '+Utils.last5_juz_name[i],false));

		this.parts[49].checked = true;		//Juz2 3amma!
		//TODO: Use https://github.com/davidbau/seedrandom
		this.lastSeed	 		= Math.floor(Math.random()*(Utils.QuranWords-1));
		this.saveAll();
		return false;
	} else {
		this.uid 				= Utils.load('prf_uid',0);
		this.lastSeed 			= Utils.load('prf_lastSeed',0);
		this.level 				= Utils.load('prf_level',-1);
		this.specialEnabled 	= Utils.load('prf_specialEnabled',false);
		this.specialScore 		= Utils.load('prf_specialScore',0);
		this.scores 			= Utils.loadObject('prf_scores');
		this.parts 				= Utils.loadObject('prf_parts');		
		this.version 			= Utils.loadObject('prf_version');		
		return true;
	}
  }
  
  this.saveAll = function(){
	Utils.save('prf_uid',this.uid);
	Utils.save('prf_lastSeed',this.lastSeed);
	Utils.save('prf_level',this.level);
	Utils.save('prf_specialEnabled',this.specialEnabled);
	Utils.save('prf_specialScore',this.specialScore);
	Utils.saveObject('prf_scores',this.scores);
	Utils.saveObject('prf_parts',this.parts);	
	Utils.saveObject('prf_version',this.version);	
  }
  
  this.saveParts = function(){
	Utils.saveObject('prf_parts',this.parts);	
  }
  
  this.addCorrect = function(currentPart) {
		if (currentPart < this.parts.length) {
			var numCorrect = this.parts[currentPart].numCorrect;
			var avgLevel = this.parts[currentPart].avgLevel;
			this.parts[currentPart].avgLevel = (numCorrect*avgLevel + this.level)/(numCorrect+1);
			this.parts[currentPart].numCorrect += 1;
			this.parts[currentPart].numQuestions += 1;			
			
			Utils.saveObject('prf_parts',this.parts);	
		}
	}

  this.addIncorrect = function(currentPart) {
		if (currentPart < this.parts.length) {
			this.parts[currentPart].numQuestions += 1;	

			Utils.saveObject('prf_parts',this.parts);				
		}
	}

  this.getScore = function(){
		var score=0.0;
		for(var i=0;i<this.parts.length;i++){
			score += calculateScorePart(i);
		}
		return Math.round(score+specialScore);
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
			pLength = this.parts[i].length;
			if (CntTot < Length + pLength) {
				return new QQSparseResult(this.parts[i].start + CntTot
						- Length, i);
			} else {
				Length += pLength;
			}
		}
		return new QQSparseResult(this.parts[i].start, i);
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
				Tot += this.parts[i].numCorrect;
		}
		return Tot;
	}

	this.getTotalQuesCount = function() {
		var Tot = 0;
		for (var i = 0; i < this.parts.length; i++) {
			if (this.parts[i].checked === true)
				Tot += this.parts[i].getNumQuestions;
		}
		return Tot;
	}
	
	this.addSpecial = function(score) {
		this.specialScore+= score;		
		Utils.save('prf_specialScore',this.specialScore);
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

	/* 	// TODO: continue Port!

	public boolean updateScoreRecord() {
		if (QScores.size() < 5) {
			QScores.add(new QQScoreRecord(this.getScore()));
			return true;
		} else if (QScores.get(QScores.size() - 1).isOlderThan1Day()) {
			QScores.add(new QQScoreRecord(this.getScore()));
			return true;
		}
		return false;
	}
	
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
	
		public CharSequence getUpScore(int CurrentPart) {
		double currentPartScore, currentPartScoreUp;
		double partWeight, avgLevel, scaledQCount, scaledCorrectRatio;
		int numCorrect, numQuestions, currLevel;
		
		//
		//Find the difference between the current and the to-be-incremented score
		//The difference comes from the current part only. The current is calculated
		//normally, while the UP is calculated manually as below
		//
		currentPartScore = calculateScorePart(CurrentPart, true);
		
		//
		//Calculate the normalized Number of words in current part + UP
		//
		numCorrect   = QParts.get(CurrentPart).getNumCorrect();
		numQuestions = QParts.get(CurrentPart).getNumQuestions();
		currLevel  	 = getLevel();
		
		partWeight   = QQUtils.PartWeight100[CurrentPart]/100;
		
		avgLevel     = numCorrect*(QParts.get(CurrentPart).getAvgLevel())+currLevel;
		avgLevel	/= (numCorrect+1);		
		
		scaledQCount = QQUtils.sCurve(QParts.get(CurrentPart).getNumCorrect() + 1,
									  QQUtils.Juz2SaturationQCount*partWeight);
		scaledQCount+=1;
		scaledCorrectRatio = QQUtils.sCurve(((float)numCorrect+1)/((float)numQuestions+1),1);
		
		currentPartScoreUp = 100*partWeight*avgLevel*scaledQCount*scaledCorrectRatio;

		return String.valueOf((int)Math.round(currentPartScoreUp-currentPartScore));
	}

	public CharSequence getDownScore(int CurrentPart) {
		double currentPartScore, currentPartScoreDown;
		double partWeight, avgLevel, scaledQCount, scaledCorrectRatio;
		int numCorrect, numQuestions, downScore;
		
		//
		//Find the difference between the current and the to-be-decremented score
		//The difference comes from the current part only. The current is calculated
		//normally, while the DOWN is calculated manually as below
		//
		currentPartScore = calculateScorePart(CurrentPart, false);
		
		//
		//Calculate the normalized Number of words in current part + UP
		//
		numCorrect   = QParts.get(CurrentPart).getNumCorrect();
		numQuestions = QParts.get(CurrentPart).getNumQuestions();
		partWeight   = QQUtils.PartWeight100[CurrentPart]/100;
		
		avgLevel     = QParts.get(CurrentPart).getAvgLevel();		
		scaledQCount = QQUtils.sCurve(QParts.get(CurrentPart).getNumCorrect(),
									  QQUtils.Juz2SaturationQCount*partWeight);
		scaledQCount+=1;
		scaledCorrectRatio = QQUtils.sCurve(((float)numCorrect)/((float)numQuestions+1),1);
		
		currentPartScoreDown = 100*partWeight*avgLevel*scaledQCount*scaledCorrectRatio;
		downScore 			 = (int)Math.round(currentPartScore-currentPartScoreDown);
		if(QQUtils.QQDebug==1 && downScore ==0 ){
			Log.d("[0Down] Sd= "+new DecimalFormat("##.##").format(100*partWeight*avgLevel*scaledQCount*scaledCorrectRatio)+
					"::pW="+new DecimalFormat("##.##").format(partWeight)+
					" av="+new DecimalFormat("##.##").format(avgLevel)+
					" sC="+new DecimalFormat("##.##").format(scaledQCount)+
					" sR="+new DecimalFormat("##.##").format(scaledCorrectRatio));			
		}
		return String.valueOf(downScore);
	}
	
  */
  return self;
})
