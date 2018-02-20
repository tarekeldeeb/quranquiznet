/****
 * Copyright (C) 2011-2016 Quran Quiz Net
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/

angular.module('quranquiznet.profile', [])
  .factory('Profile', function (Utils) {
    var self = this;

    this.uid = 0;
    this.lastUpdate = 0;
    this.lastSync = 0;
    this.social = {};
    this.lastSeed = 0;
    this.level = 1;
    this.specialEnabled = false;
    this.scores = [{
      date: Utils.getTime(),
      score: 0
    }];
    this.parts = [];
    this.version = {
      db: 1.0,
      app: 1.0,
      profile: 1.0
    };
    this.correctRatioRange = {
      EMPTY: 0,
      HIGH: 1,
      MID: 2,
      LOW: 3
    };
    var scoreRecord = function () {
      return {
        date: Utils.getTime(),
        score: this.getScore()
      };
    }
    var studyPart = function (start, length, correct, questions, name, checked) {
      return {
        start: start,
        length: length,
        numCorrect: correct,
        numQuestions: questions,
        name: name,
        checked: checked
      };
    }

    var QQSparseResult = function (idx, part) {
      return {
        idx: idx,
        part: part
      };
    }
    var getCorrectRatios = function (i) {
      var r = [0, 0, 0, 0];
      var numCorrect, numQuestions;
      for (var j = 0; j < 4; j++) {
        numCorrect = self.parts[i].numCorrect[j];
        numQuestions = self.parts[i].numQuestions[j];
        r[j] = (numQuestions == 0) ? 0 : (numCorrect / numQuestions);
      }
      return r;
    }
    var getCorrectRatio = function (i) {
      var numCorrect, numQuestions;
      numCorrect = self.parts[i].numCorrect[0] +
        self.parts[i].numCorrect[1] +
        self.parts[i].numCorrect[2] +
        self.parts[i].numCorrect[3];
      numQuestions = self.parts[i].numQuestions[0] +
        self.parts[i].numQuestions[1] +
        self.parts[i].numQuestions[2] +
        self.parts[i].numQuestions[3];
      return (numQuestions == 0) ? 0 : (numCorrect / numQuestions);
    }
    var calculateScorePart = function (i) {
      return self.parts[i].numCorrect[0] +
        (2 * self.parts[i].numCorrect[1] - self.parts[i].numQuestions[1]) * 10 +
        (2 * self.parts[i].numCorrect[2] - self.parts[i].numQuestions[2]) * 20 +
        (2 * self.parts[i].numCorrect[3] - self.parts[i].numQuestions[3]) * 30;
    }
    var makeDefaultProfile = function() {
        self.parts.push(new studyPart(1, (Utils.sura_idx[0]), [0, 0, 0, 0], [0, 0, 0, 0], 'سورة ' + Utils.sura_name[0], true));
        for (var i = 1; i < 45; i++)
          self.parts.push(new studyPart((Utils.sura_idx[i - 1]),
            (Utils.sura_idx[i] - Utils.sura_idx[i - 1]), [0, 0, 0, 0], [0, 0, 0, 0], 'سورة ' + Utils.sura_name[i], false));
        for (var i = 0; i < 5; i++)
          self.parts.push(new studyPart((Utils.last5_juz_idx[i]),
            (Utils.last5_juz_idx[i + 1] - Utils.last5_juz_idx[i]), [0, 0, 0, 0], [0, 0, 0, 0], 'جزء ' + Utils.last5_juz_name[i], false));

        self.parts[49].checked = true; //Juz2 3amma!
        //TODO: Use https://github.com/davidbau/seedrandom
        self.lastSeed = Math.floor(Math.random() * (Utils.QuranWords - 1));
        self.saveAll();
    }

    this.load = function () {
      if (Utils.load('prf_uid', -1) == -1) {
        makeDefaultProfile();
        return false;
      } else {
        this.uid = Utils.load('prf_uid', 0);
				this.lastUpdate = Utils.load('prf_lastUpdate', 0);
    		this.lastSync = Utils.load('prf_lastSync', 0);
        this.lastSeed = parseInt(Utils.load('prf_lastSeed', 0));
        this.level = parseInt(Utils.load('prf_level', -1));
        this.specialEnabled = JSON.parse(Utils.load('prf_specialEnabled', false));
        this.scores = Utils.loadObject('prf_scores');
        this.parts = Utils.loadObject('prf_parts');
        this.version = Utils.loadObject('prf_version');
        this.social = Utils.loadObject('prf_social');
        return true;
      }
    }
    this.reset = function () {
      makeDefaultProfile();
    }
		this.setLastUpdate = function () {
			this.lastUpdate = Utils.getTime();
			Utils.save('prf_lastUpdate', this.lastUpdate);
		}
    this.saveAll = function () {
      Utils.save('prf_uid', this.uid);
			this.setLastUpdate();
			Utils.save('prf_lastSync', this.lastSync);
      Utils.save('prf_lastSeed', this.lastSeed);
      Utils.save('prf_level', this.level);
      Utils.save('prf_specialEnabled', this.specialEnabled);
      Utils.saveObject('prf_scores', this.scores);
      Utils.saveObject('prf_parts', this.parts);
      Utils.saveObject('prf_version', this.version);
      Utils.saveObject('prf_social', this.social);
    }

    this.saveParts = function () {
      Utils.saveObject('prf_parts', this.parts);
    }

    this.saveSettings = function () {
      Utils.save('prf_level', this.level);
      Utils.save('prf_specialEnabled', this.specialEnabled);
    }

    this.saveScores = function () {
      Utils.saveObject('prf_scores', this.scores);
      Utils.saveObject('prf_parts', this.parts);
    }

    this.saveSocial = function (social) {
      this.social = social
      Utils.saveObject('prf_social', this.social);
      Utils.saveObject('prf_uid', this.uid);
    }
    this.addCorrect = function (qo) {
      var currentPart = qo.currentPart;
      if ((currentPart < self.parts.length) && qo.level > 0) {
        if (qo.qType.id > 1) {
          /** Special Question */
          self.parts[currentPart].numCorrect[0] += qo.qType.score;
          self.parts[currentPart].numQuestions[0] += 1;
        } else {
          /** Normal Question */
          self.parts[currentPart].numCorrect[qo.level] += 1;
          self.parts[currentPart].numQuestions[qo.level] += 1;
        }
        Utils.saveObject('prf_parts', self.parts);
      }
    }

    this.addIncorrect = function (qo) {
      var currentPart = qo.currentPart;
      if ((currentPart < self.parts.length) && qo.level > 0) {
        if (qo.qType.id > 1) {
          /** Special Question */
          self.parts[currentPart].numQuestions[0] += 1;
        } else {
          /** Normal Question */
          self.parts[currentPart].numQuestions[qo.level] += 1;
        }
        Utils.saveObject('prf_parts', self.parts);
      }
    }

    this.getScore = function () {
      var score = 0;
      for (var i = 0; i < self.parts.length; i++) {
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
    this.getSparsePoint = function (CntTot) {
      var Length = 0,
        i, pLength;
      for (i = 0; i < this.parts.length; i++) {
        pLength = (this.parts[i].checked === true) ? this.parts[i].length : 0;
        if (CntTot < Length + pLength) {
          return new QQSparseResult(this.parts[i].start + CntTot -
            Length, i);
        } else {
          Length += pLength;
        }
      }
      return new QQSparseResult(self.parts[i].start, i);
    }

    //
    //@return The total word count of studied parts
    //
    this.getTotalStudyLength = function () {
      var Length = 0;
      for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].checked === true)
          Length += this.parts[i].length;
      }
      return Length;
    }

    this.getTotalCorrect = function () {
      var Tot = 0;
      for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].checked === true)
          Tot += this.parts[i].numCorrect.reduce(Utils.add, 0);
      }
      return Tot;
    }

    this.getTotalQuesCount = function () {
      var Tot = 0;
      for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].checked === true)
          Tot += this.parts[i].numQuestions.reduce(Utils.add, 0);
      }
      return Tot;
    }

    this.getPercentTotalStudy = function () {
      var Tot = 0;
      for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].numCorrect.reduce(Utils.add, 0) > 0)
          Tot += this.parts[i].length;
      }
      return Math.round((Tot * 100) / Utils.QuranWords) + '%';
    }
    this.getPercentTotalRatio = function () {
      /* Exclude index-0, special questions
         and add all levels: 1,2,3
      */
      var totCorrect = 0,
        totQuestions = 0;
      for (var i = 0; i < self.parts.length; i++) {
        totCorrect += self.parts[i].numCorrect.reduce(Utils.add, -self.parts[i].numCorrect[0]);
        totQuestions += self.parts[i].numQuestions.reduce(Utils.add, -self.parts[i].numQuestions[0]);
      }
      return Math.round((totQuestions == 0) ? 0 : (100 * totCorrect) / totQuestions) + '%';
    }
    this.getPercentTotalSpecialRatio = function () {
      var totCorrect = 0,
        totQuestions = 0;
      for (var i = 0; i < self.parts.length; i++) {
        totCorrect += self.parts[i].numCorrect[0];
        totQuestions += self.parts[i].numQuestions[0];
      }
      return Math.round((totQuestions == 0) ? 0 : (100 * totCorrect) / totQuestions) + '%';
    }
    //
    //If current profile selections has too few suras, then the user
    //is not eligible to some special questions; example: State Sura Name.
    //@return
    //
    this.isSurasSpecialQuestionEligible = function () {
      for (var i = this.parts.length - 1; i >= this.parts.length - 5; i--)
        if (this.parts[i].checked === true) return true;

      var s = 0;
      for (var j = this.parts.length - 6; j > 0; j--) {
        if (this.parts[i].checked === true) s++;
        if (s >= Utils.SurasSpecialQuestionEligibilityThreshold)
          return true;
      }
      return false;
    }

    this.updateScoreRecord = function () {
      var scoreLength = this.scores.length;
      if (scoreLength < 5) {
        if (scoreLength == 0 && this.scores[0].date == 0) {
          this.scores[0] = new scoreRecord();
        } else {
          this.scores.push(new scoreRecord());
        }
        return true;
      } else if (Utils.isOlderThan1day(this.scores[scoreLength - 1].date)) {
        this.scores.push(new scoreRecord());
        return true;
      }
      return false;
    }

    this.getCorrectRatioRange = function (i) {
      var rg, ratio = getCorrectRatio(i);
      if (Utils.countedScore(self.parts[i].numQuestions) == 0)
        rg = this.correctRatioRange.EMPTY;
      else if (ratio >= 0.8)
        rg = this.correctRatioRange.HIGH;
      else if (ratio >= 0.5)
        rg = this.correctRatioRange.MID;
      else
        rg = this.correctRatioRange.LOW;
      return rg;
    }
    this.levels = [{
        value: 0,
        text: "مستوى ابتدائي",
        comment: "يبدأ السؤال من رأس الاية، ولا يزيد النقاط",
        disabled: false
      },
      {
        value: 1,
        text: "مستوى أولي",
        comment: "السؤال من ثلاث كلمات، يزيد النقاط بعشرة",
        disabled: false
      },
      {
        value: 2,
        text: "مستوى ثانوي",
        comment: "السؤال من كلمتين، يزيد النقاط بعشرين",
        disabled: false
      },
      {
        value: 3,
        text: "مستوى متقدم",
        comment: "أكثر من اجابة صحيحة، يزيد النقاط بثلاثين",
        disabled: true
      }
    ];

    //@return An array of weights for studied parts to sum up
    //to Utils.DAILYQUIZ_QPERPART_COUNT
    //
    this.getDailyQuizStudyPartsWeights = function () {
      var sparse = [Utils.DAILYQUIZ_PARTS_COUNT];
      var totalStudyWeight = Math.ceil(this.getTotalStudyLength() / Utils.Juz2AvgWords);
      var Wn, WnX100;

      //Fill array as: [0, 0, W1, 0, W2, ..]
      for (var i = 0; i < Utils.DAILYQUIZ_PARTS_COUNT; i++) {
        //Skip Al-Fatiha
        if (i == 0 || Utils.countedScore(self.parts[i].numQuestions) == 0 || self.parts[i].checked == false)
          sparse[i] = 0;
        else {
          WnX100 = Utils.DAILYQUIZ_QPERPART_COUNT * Utils.PartWeight100[i] /
            totalStudyWeight; //Weight with scaling of 100
          Wn = Math.ceil(WnX100 / 100.0);
          if (Wn > 0) {
            sparse[i] = Wn;
          } else {
            sparse[i] = 0;
          }
        }
      }

      //Check if W1:Wn sum to DAILYQUIZ_QPERPART_COUNT
      var sum = 0;
      for (i = 0; i < Utils.DAILYQUIZ_PARTS_COUNT; i++) sum += sparse[i];
      var sumCorrection = Utils.DAILYQUIZ_QPERPART_COUNT - sum;

      //Handle newly created profile: Question = 0
      if (sum == 0) {
        sparse[Utils.DAILYQUIZ_PARTS_COUNT - 1] = Utils.DAILYQUIZ_QPERPART_COUNT;
        sumCorrection = 0;
      }
      if (sumCorrection != 0) {
        //Apply correction (due to approx) to last selection
        for (i = Utils.DAILYQUIZ_PARTS_COUNT - 1; i >= 0; i--) {
          if (sparse[i] != 0) {
            sparse[i] += sumCorrection;
            break;
          }
        }
      }

      for (i = 0; i < sparse.length; i++)
        if (sparse[i] != 0) Utils.log("DailyQuizStudyPartsWeights@" + i + " = " + sparse[i]);
      return sparse;
    }
		/**
		 * Sync a remote profile from backend to the local
		 * A write back is then required from the caller.
		 */
		this.syncTo = function(remoteProfile){
			Utils.assert(remoteProfile.uid == this.uid,"Got a bad remote profile");
			//Utils.assert(remoteProfile.version.profile <= this.version.profile,"Using an old client with a newer profile!");
			var copyNeeded = false;
			if(this.lastSync ==0){
				Utils.log("Found an existing profile ..")
				copyNeeded = true;
			}
			if( remoteProfile.lastSync > this.lastSync ){
				// remote has new stuff, but do I have new stuff too?
				// TODO: Resolve this situation.
				// For now, I will just overwrite local progress
				Utils.log("Getting new updates ..")
				copyNeeded = true; 
			}
			if(copyNeeded){
				//Update all needed fields and save;
    		this.lastUpdate = Utils.getTime();
				this.lastSync = Utils.getTime();
				this.lastSeed = remoteProfile.lastSeed;
				this.level = remoteProfile.level;
				this.specialEnabled = remoteProfile.specialEnabled;
				this.scores = Utils.deepCopy(remoteProfile.scores);
				this.parts = Utils.deepCopy(remoteProfile.parts);
				this.saveAll();
			}
    }
    /**
     * Gets a combined score to be submitted as a Daily Quiz Score
     *  Pseudo = 10*correct - 5*Time - 5*StudyParts
     * @param correct number of questions 
     * @param time to complete the quiz
     */
    this.getDailyQuizScore = function(correct, time){
      var score = 10*correct;
      score -= 5*(time-Utils.DAILYQUIZ_MINTIME)/(Utils.DAILYQUIZ_MAXTIME - Utils.DAILYQUIZ_MINTIME);
      score -= 5*(1 - this.getTotalStudyLength()/Utils.QuranWords);
      score = Math.min(Math.max(score,0),100);
      return Number.parseFloat(score).toFixed(2);
    }

    return self;
  })
