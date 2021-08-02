/****
 * Copyright (C) 2011-2016 Quran Quiz Net
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
angular.module('quranquiznet.questionnaire', [])
  .factory('Questionnaire', function (Profile, IDB, Utils, $q, $rootScope) {  //Q,
    var self = this;
    var sparsed;
    var QLEN_EXTRA_LIMIT = 2;
    var QUESTIONNAIRE_ENABLE_LONG_QUESTIONS = true;
    var previousSeed = Profile.lastSeed;
    var rand = new Math.seedrandom(previousSeed);

    this.qTypeEnum = {
      NOTSPECIAL: {
        id: 1,
        score: 10,
        txt: 'اختر التكملة الصحيحة'
      },
      SURANAME: {
        id: 2,
        score: 5,
        txt: 'اختر اسم السورة'
      },
      SURAAYACOUNT: {
        id: 3,
        score: 25,
        txt: 'اختر عدد ايات السورة'
      },
      MAKKI: {
        id: 4,
        score: 15,
        txt: 'اختر بيان السورة'
      },
      AYANUMBER: {
        id: 5,
        score: 35,
        txt: 'اختر رقم الاية'
      }
    };

    this.qo = {
      /******** Questions parameters to be set: Start **********/
      level: 1, // Selected questionaire level
      rounds: 10, // How many rounds a question has: 10 for normal, 1 for special
      validCount: 1, // Number of correct options at the first round
      op: [], // Holds all 5 options x 10 rounds
      startIdx: 1, // Precise Position near seed, valid options
      qLen: 3, // Number of words to display to start the Question
      oLen: 2, // Number of words of each option
      qType: 0, // Question Type: NOTSPECIAL or <Special Type>
      currentPart: {}, // Current Study Part
      txt: {
        question: "",
        answer: "",
        op: []
      }
    };

    this.createNextQ = function (s) {
      var start = -1;
      if (isFinite(s) && s > 0 && s <= Utils.QuranWords) {
        start = s;
      }
      self.qo.level = Profile.level;
      if (Profile.specialEnabled && selectSpecial()) { //TODO: remove! || true  - && false
        Utils.log('Creating a special question ..');
        return self.createSpecialQ(start);
      } else {
        Utils.log('Creating a normal question ..');
        return self.createNormalQ(start);
      }
    }

    this.createSpecialQ = function (start) {
      this.qo.rounds = 1;

      if (Profile.isSurasSpecialQuestionEligible()) {
        if (Math.random() > 0.5) {
          this.qo.qType = this.qTypeEnum.SURANAME;
        } else if (Math.random() > 0.3) {
          this.qo.qType = this.qTypeEnum.SURAAYACOUNT;
        } else /*if (Math.random() > 0.3 ||true)*/ {
          this.qo.qType = this.qTypeEnum.AYANUMBER;
        }
        /*else{
                           this.qo.qType = this.qTypeEnum.MAKKI;
                       }*/
      } else {
        this.qo.qType = this.qTypeEnum.AYANUMBER;
      }
      Utils.log('Type id: ' + this.qo.qType.id);
      // +1 to compensate the rand-gen integer [0-QuranWords-1]
      this.sparsed = Profile.getSparsePoint(Math.abs(rand.int32()) % Profile.getTotalStudyLength() + 1);
      Profile.lastSeed = this.sparsed.idx;
      this.qo.currentPart = this.sparsed.part;

      //!session.addIfNew(qo.startIdx)); // TODO: Skip duplicates

      //TODO: Switch to getValidUniqueStartNear()
      return this.getValidStartNear(this.sparsed.idx)
        .then(function () {
          Utils.log('Set the question start at: ' + self.qo.startIdx);
          self.qo.validCount = 1; //Number of correct options at the first round
          self.qo.qLen = (self.qo.level == 1) ? 3 : 2;
          self.qo.oLen = 1;

          switch (self.qo.qType.id) {
            case self.qTypeEnum.SURANAME.id:
              //Correct Answer:
              self.qo.op[0][0] = Utils.getSuraIdx(self.qo.startIdx);
              //Incorrect Answers
              self.fillIncorrectRandomIdx(self.qo.op[0][0], 114);
              break;
            case self.qTypeEnum.SURAAYACOUNT.id:
              //Correct Answer:
              self.qo.op[0][0] = Utils.sura_ayas[Utils.getSuraIdx(self.qo.startIdx)]
              //Incorrect Answers
              self.fillIncorrectRandomNonZeroIdx(self.qo.op[0][0], 50);
              break;
            case self.qTypeEnum.AYANUMBER.id:
              //Correct Answer:
              IDB.ayaNumberOf(self.qo.startIdx)
                .then(function (aya) {
                  self.qo.op[0][0] = aya;
                  //Incorrect Answers
                  self.fillIncorrectRandomNonZeroIdx(self.qo.op[0][0], 50);
                  return this;
                });
              break;
            default:
              Utils.log('Unsupported question type!');
              break;
          }
          return self.fillText();
        }).then(function () {
          //Utils.log(JSON.stringify(self.qo));
        });
    }

    this.createQAyaNumber = function () {
      do {
        this.sparsed = Profile.getSparsePoint(rand.int32() % Profile.getTotalStudyLength());
        Profile.lastSeed = this.sparsed.idx;
        this.qo.currentPart = this.sparsed.part;
        // +1 to compensate the rand-gen integer [0-QuranWords-1]
        this.qo.startIdx = this.getValidUniqueStartNear(this.sparsed.idx + 1);
      } while (!1); //!session.addIfNew(qo.startIdx)); TODO

      this.qo.validCount = 1; //Number of correct options at the first round
      this.qo.qLen = (self.qo.level == 1) ? 3 : 2;
      this.qo.oLen = 1;
      //Correct Answer:
      this.qo.op[0][0] = IDB.ayaNumberOf(this.qo.startIdx);
      //Incorrect Answers
      this.fillIncorrectRandomNonZeroIdx(this.qo.op[0][0], 50);
    }

    this.getValidUniqueStartNear = function (start) {
      // Search for a correct neighbour unique start
      var dir = 1; // search down = +1
      var limitHit = 1;
      var start_shadow;
      var srch_cond;
      while (limitHit > 0) {
        start_shadow = start;
        limitHit = 0;
        srch_cond = true;
        while (srch_cond) {
          start_shadow = start_shadow + dir;
          if (start_shadow == 0 || start_shadow == (Utils.QuranWords - 1)) {
            limitHit = 1;
            dir = -dir;
            break;
          }
          srch_cond = IDB.sim2cnt(start_shadow) > 0;
        }

        start = start_shadow;
      }
      return start;
    }

    this.createNormalQ = function (start, forcedLevel) {
      this.qo.rounds = 10;
      this.qo.qType = this.qTypeEnum.NOTSPECIAL;
      if (typeof forcedLevel !== 'undefined') this.qo.level = forcedLevel;

      if (start < 0) {
        // +1 to compensate the rand-gen integer [0-QuranWords-1]
        this.sparsed = Profile.getSparsePoint(Math.abs(rand.int32()) % Profile.getTotalStudyLength() + 1);
        Profile.lastSeed = this.sparsed.idx;
        Utils.log('Set Profile seed = ' + Profile.lastSeed);
      } else {
        this.sparsed = {
          idx: start,
          part: 0
        };
      }
      this.qo.currentPart = this.sparsed.part;

      //!session.addIfNew(qo.startIdx)); TODO
      return this.getValidStartNear(this.sparsed.idx)
        .then(function () {
          Utils.log('Set the question start at: ' + self.qo.startIdx);
          self.fillCorrectOptions();
          return self.fillIncorrectOptions();
        }).then(function () {
          return self.fillText();
        }).then(function () {
          //Utils.log(JSON.stringify(self.qo));
          return true;
        });
    }

    this.fillCorrectOptions = function () {
      // fill Correct Option Words @indx=1 (2,3,..validCount for higher
      // levels)
      var tmp = [];
      this.qo.op[0][0] = Utils.modQWords(this.qo.startIdx + this.qo.qLen);
      for (var k = 1; k < this.qo.rounds; k++) {
        this.qo.op[k][0] = Utils.modQWords(this.qo.op[k - 1][0] + this.qo.oLen);
      }
      if (self.qo.level > 1) { //TODO: Put more correct answers :: DEAD Code! Only 1 answer exists.
        if (this.qo.qLen == 1) { // A 2-word Question
          tmp = IDB.sim2idx(this.qo.startIdx);
          for (var i = 1; i < qo.validCount; i++)
            this.qo.op[0][i] = tmp[i];

        } else { // A 3-word Question
          tmp = IDB.sim3idx(this.qo.startIdx);
          for (var i = 1; i < this.qo.validCount; i++)
            this.qo.op[0][i] = tmp[i];
        }
        for (var k = 1; k < 10; k++)
          for (var j = 1; j < this.qo.validCount; j++)
            this.qo.op[k][j] = this.qo.op[k - 1][j] + 1;
      }
    }

    this.fillIncorrectOptions = function () {
      // Get Valid Options @indx=2:5 (validCount+1:5 for higher levels)
      // Get the next words to similar-to-previous
      // Get unique options
      var last_correct, uniq_cnt;
      var diffList = [];
      var i = -1;
      //for (var i = 0; i < 10; i++) {
      return Utils.promiseWhile(function () {
        return (i < 9);
      }, function () {
        i++;
        last_correct = self.qo.op[i][0] - 1;

        // We want to remove redundant correct choices from the given
        // options, this is made by removing subset sim2 from sim1
        // then finding the next unique set of words
        return IDB.uniqueSim1Not2Plus1(last_correct)
          .then(function (d) {
            diffList = d;
            uniq_cnt = diffList.length;
            var rnd_idx = []; //will need length = uniq_cnt

            if (uniq_cnt > 3) {
              rnd_idx = Utils.randperm(uniq_cnt);
              for (var j = 1; j < 5; j++) {
                self.qo.op[i][j] = diffList[rnd_idx[j - 1]];
              }
            } else {
              // We need Random unique and does not match correct
              return IDB.randomUnique4NotMatching(self.qo.op[i][0]);
            }
            return this;
          }).then(function (randList) {
            for (var i = 0; i < 10; i++) {
              if (self.qo.op[i][0] == randList.i) break;
            }
            if (i < 10) {
              //Utils.log('Adding ' + (4 - uniq_cnt) + ' random inc_op at round ' + i);
              if (uniq_cnt > 0) {
                rnd_idx = Utils.randperm(uniq_cnt);
                for (var j = 1; j < uniq_cnt + 1; j++) {
                  self.qo.op[i][j] = diffList[rnd_idx[j - 1]];
                }
                for (var j = uniq_cnt + 1; j < 5; j++) {
                  self.qo.op[i][j] = randList.set[j - uniq_cnt - 1];
                }
              } else { // uniq_cnt=0, all random options!
                for (var j = 1; j < 5; j++)
                  self.qo.op[i][j] = randList.set[j - uniq_cnt - 1] || j; // Fall-back if randList has nulls!
              }
            }
          });
      }); //.then(function(){Utils.log('Done with incorrect options');});
    }

    this.fillIncorrectRandomIdx = function (correctIdx, mod) {
      var perm = [];
      var rndIdx = [-1, 1, 0, 5, -4];

      perm = Utils.randperm(5);
      // Adding QuranWords does not affect the %QuranWords, but eliminates -ve values
      var correctIdxPerm = mod + correctIdx - rndIdx[perm[0]];

      this.qo.op[0][1] = (correctIdxPerm + rndIdx[perm[1]]) % mod;
      this.qo.op[0][2] = (correctIdxPerm + rndIdx[perm[2]]) % mod;
      this.qo.op[0][3] = (correctIdxPerm + rndIdx[perm[3]]) % mod;
      this.qo.op[0][4] = (correctIdxPerm + rndIdx[perm[4]]) % mod;
    }

    this.fillIncorrectRandomNonZeroIdx = function (correctIdx, mod) {
      var perm = [];
      var rndIdx = [-1, 1, 0, 5, -4];

      perm = Utils.randperm(5);
      // Adding QuranWords does not affect the %QuranWords, but eliminates -ve values
      var correctIdxPerm = mod + correctIdx - rndIdx[perm[0]];

      for (var i = 1; i < 5; i++)
        if ((correctIdx + rndIdx[perm[i]]) === rndIdx[perm[0]]) {
          //only one may give a zero, fix and break
          rndIdx[i] = 2;
          //break;
        }

      this.qo.op[0][1] = (correctIdxPerm + rndIdx[perm[1]]) % mod;
      this.qo.op[0][2] = (correctIdxPerm + rndIdx[perm[2]]) % mod;
      this.qo.op[0][3] = (correctIdxPerm + rndIdx[perm[3]]) % mod;
      this.qo.op[0][4] = (correctIdxPerm + rndIdx[perm[4]]) % mod;
    }

    this.getValidStartNear = function (start) {
      // Search for a correct neighbour start according to level
      var dir = 1; // search down = +1
      var disp2, disp3;
      var start_shadow = start - dir;
      var extraLength;
      var srch_cond = true;

      //while (srch_cond) {
      return Utils.promiseWhile(function () {
        return (srch_cond);
      }, function () {

        start_shadow += dir;
        if (start_shadow == 0 || start_shadow == (Utils.QuranWords - 1)) {
          //Need to start over searching the opposite direction
          start_shadow = start;
          dir = -dir;
          return; //break;
        }
        if (self.qo.level == 0) {
          // [Level-0] Get a non-motashabehat at aya start
          self.qo.validCount = 1; //TODO: Check it's unique!
          self.qo.qLen = 3;
          self.qo.oLen = 2;
          return IDB.isAyaStart(start_shadow).then(function (isAyaStart) {
            srch_cond = !isAyaStart;
          });
        } else {
          // [Level 1-3] Get a Motashabehat
          return IDB.sim2cnt(start_shadow)
            .then(function (sim2cnt) {
              srch_cond = (sim2cnt == 0); //Continue searching if not motashabeha
              //Utils.log('Start_shadow= ' + start_shadow + ' sim2snt= ' + sim2cnt + ' cnd=' + srch_cond);
              if (!srch_cond) {
                if (self.qo.level == 1 || self.qo.level == 2) {
                  self.qo.validCount = 1;
                  if (self.qo.level == 1) {
                    self.qo.qLen = 3;
                    self.qo.oLen = 2;
                  } else { // Level 2
                    self.qo.qLen = 2;
                    self.qo.oLen = 1;
                  }
                  // [Level 1-2] Add extra Length for unique answer!

                  var extraQDirection = 1; //TODO: Randomize +/- 1
                  return self.extraQLength(start_shadow, self.qo.qLen, false, extraQDirection)
                    .then(function (extraLength) {
                      self.qo.qLen = extraLength.qLen;
                      start_shadow = extraLength.start;
                      srch_cond = false;
                      Utils.log('              Extra=' + JSON.stringify(extraLength));
                    });
                } else {
                  // [Level 3] Non unique answers
                  // TODO: Port!!
                  // self.qo.level == 3
                  // Search for a motashabehat near selected index
                  // Specify # Words to display
                  disp2 = 0;
                  disp3 = 0;

                  if (IDB.sim3cnt(start_shadow) < 5 &&
                    IDB.sim3cnt(start_shadow) > 0)
                    disp3 = IDB.sim3cnt(start_shadow);

                  if (IDB.sim2cnt(start_shadow) < 5 &&
                    IDB.sim2cnt(start_shadow) > 0)
                    disp2 = IDB.sim2cnt(start_shadow);

                  // Motashabehat not found,continue!
                  srch_cond = (disp3 == 0 && disp2 == 0);

                  if (srch_cond == false) { // Found!
                    self.qo.validCount = (disp2 > disp3) ? disp2 : disp3; // TODO:
                    // Check,
                    // +1
                    // caused
                    // bound
                    // excep
                    self.qo.qLen = (disp2 > disp3) ? 1 : 2;
                  }
                  self.qo.oLen = 1;
                }
              }
            });
        }
      }).then(function (ctx) {
        self.qo.startIdx = start_shadow;
      });
    }

    this.extraQLength = function (start, qLen, long_q, direction) {
      //TODO: Review and apply!
      /**                  <qLen>,--{start}
       *  <----------{M M M M M M M M}------->
       *            U M M M M M M M       < Long_question:   forward only >
       *            U M M M               < Forward Search:  direction=1  >
       *                        M M M U   < Backward Search: direction=-1
       *
       * Assumptions:
       * 	- direction is only +1 or -1
       *   - sim2cnt(start)>0
       * 	- returns new values {start,qLen}
       */
      var extra = 0;
      var q_sim3cnt = 1;
      var dir = (long_q) ? 1 : direction;
      var idx = start; //Search back/forth till the start of this motashabeha!

      return Utils.promiseWhile(function () {
        return (q_sim3cnt > 0);
      }, function () {
        return IDB.sim3cnt(idx).then(function (sim3cnt) {
          q_sim3cnt = sim3cnt;
          if (sim3cnt > 0) extra++;
          //Utils.log('sim3cnt@' + idx + ' = ' + sim3cnt);
          idx += dir;
        });
      }).then(function (ctx) {
        var new_start, new_qLen;
        extra += 3 - qLen;
        if (long_q) {
          new_start = start;
          new_qLen = qLen + extra++;
        } else {
          new_start = start + dir * (extra++);
          new_qLen = qLen;
        }
        return {
          "start": new_start,
          "qLen": new_qLen
        };
      });
    }

    this.fillText = function () {
      return IDB.txt(this.qo.startIdx, Utils.answerLength, 'ayaMark')
        .then(function (txt) {
          self.qo.txt.question = txt.slice(0, self.qo.qLen).join(' ');
          self.qo.txt.answer = txt.slice(0, Utils.answerLength).join(' ');
          /*  Setting the question text is common, the answer depends on the
              question type as follows */
          switch (self.qo.qType.id) {
            case self.qTypeEnum.NOTSPECIAL.id:
              var op = [],
                tmp;
              for (var k = 0; k < self.qo.rounds; k++) {
                for (var l = 0; l < 5; l++) {
                  for (var m = 0; m < self.qo.oLen; m++) {
                    tmp = Utils.modQWords(self.qo.op[k][l] + m);
                    if (!isFinite(tmp)) {
                      tmp = 0;
                      console.warn('Bad op[' + k + '][' + l + ']');
                      //TODO: Handle the exception!
                    }
                    op.push(tmp);
                  }
                }
              }
              return IDB.txts(op)
                .then(function (txt) {
                  for (var k = 0; k < self.qo.rounds; k++) {
                    for (var l = 0; l < 5; l++) {
                      self.qo.txt.op[k][l] = txt.slice((5 * k + l) * self.qo.oLen, (5 * k + (l + 1)) * self.qo.oLen).join(' ');
                    }
                  }
                });

            case self.qTypeEnum.SURANAME.id:
              for (var l = 0; l < 5; l++) {
                self.qo.txt.op[0][l] = 'سورة ' + Utils.getSuraNameFromIdx(self.qo.op[0][l]);
              }
              return;
            case self.qTypeEnum.SURAAYACOUNT.id:
              for (var l = 0; l < 5; l++) {
                self.qo.txt.op[0][l] = 'ايات السورة ' + self.qo.op[0][l];
              }
              return;
            case self.qTypeEnum.AYANUMBER.id:
              for (var l = 0; l < 5; l++) {
                self.qo.txt.op[0][l] = 'رقم الاية ' + self.qo.op[0][l];
              }
              break;
            case self.qTypeEnum.MAKKI.id:
              // Do nothing!
              break;

            default:
              // Do nothing!
              break;
          }
        });
    }

    this.getUpScore = function () {

      switch (this.qo.qType.id) {
        case this.qTypeEnum.NOTSPECIAL.id:
          return this.qTypeEnum.NOTSPECIAL.score * self.qo.level;
        case this.qTypeEnum.SURANAME.id:
          return this.qTypeEnum.SURANAME.score;
        case this.qTypeEnum.SURAAYACOUNT.id:
          return this.qTypeEnum.SURAAYACOUNT.score;
        case this.qTypeEnum.MAKKI.id:
          return this.qTypeEnum.MAKKI.score;
        case this.qTypeEnum.AYANUMBER.id:
          return this.qTypeEnum.AYANUMBER.score;
        default:
          // Do nothing!
          break;
      }
    }

    this.getDownScore = function () {
      if (this.qo.qType.id == this.qTypeEnum.NOTSPECIAL.id) {
        return this.qTypeEnum.NOTSPECIAL.score * self.qo.level;
      } else {
        return 0;
      }
    }

    this.DQ = []; // Only used for debugging
    this.dailyStart = [];
    this.dailyIndex = 0;

    this.initDailyQuiz = function(dailyRandom){
       if (isNaN(dailyRandom)) dailyRandom = 100;
      var i, j;
      var partLength, partStart, offset;
      Utils.log("Creating a new daily questionnaire .. rand: " + dailyRandom);
      var sparseQ = Profile.getDailyQuizStudyPartsWeights();
      self.dailyStart = [];
      self.dailyIndex = 0;

      for (i = 1; i < sparseQ.length; i++) {
        partLength = Profile.parts[i].length;
        partStart = Profile.parts[i].start;
        for (j = 0; j < sparseQ[i]; j++) {
          offset = Math.round(Utils.DAILYQUIZ_QPERPART_DIST[j] * partLength + dailyRandom) % partLength;
          self.dailyStart.push(partStart + offset);
        }
      }
      Utils.log("::Daily Starts:: " + JSON.stringify(self.dailyStart));
    }
    this.hasNextDailyQ = function(){
      return !(self.dailyIndex>9);
    }
    this.createNextDailyQ = function() {
      if(self.dailyIndex>9) return Promise.resolve(false);
      return self.createNormalQ(self.dailyStart[self.dailyIndex++],1); //Force Level-1
    }
    this.getDailyQuiz = async function (dailyRandom) {
      await self.initDailyQuiz(dailyRandom);

      for (i = 0; i < Utils.DAILYQUIZ_QPERPART_COUNT; i++) {
        await self.createNormalQ(self.dailyStart[i]);
        self.DQ[i] = Utils.deepCopy(self.qo);
      }
      //Utils.log(":::::::::::::::Daily Object::::::::::::::: "+i+">> "+JSON.stringify(self.DQ));
    }

    var selectSpecial = function () {
      if (self.qo.level == 0)
        return false;
      else if (Profile.isSurasSpecialQuestionEligible())
        return (Math.random() < 0.20);
      else
        return (Math.random() < 0.05);
    }

    /* Constructor*/
    for (var k = 0; k < 10; k++) this.qo.op[k] = []; //Init 2D array
    for (var k = 0; k < 10; k++) this.qo.txt.op[k] = []; //Init 2D array
    for (var k = 0; k < 10; k++) this.DQ.push("");

    return self;
  })
