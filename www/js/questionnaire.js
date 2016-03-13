/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/
angular.module('starter.questionnaire', [])
    .factory('Questionnaire', function (Profile, Q, Utils) {
        var self = this;
        var sparsed;
        var QLEN_EXTRA_LIMIT = 2;
        var previousSeed = Profile.lastSeed;
        var rand = new Math.seedrandom(previousSeed);

        this.qTypeEnum = {
            NOTSPECIAL: { id: 1, score: 0, txt: 'اختر التكملة الصحيحة' },
            SURANAME: { id: 2, score: 5, txt: 'اختر اسم السورة' },
            SURAAYACOUNT: { id: 3, score: 25, txt: 'اختر عدد ايات السورة' },
            MAKKI: { id: 4, score: 15, txt: 'اختر بيان السورة' },
            AYANUMBER: { id: 5, score: 35, txt: 'اختر رقم الاية' }
        };

        this.qo = {
            /******** Questions parameters to be set: Start **********/
            rounds: 10, 	// How many rounds a question has: 10 for normal, 1 for special
            validCount: 1, 	// Number of correct options at the first round
            op: [], 		// Holds all 5 options x 10 rounds
            startIdx: 1, 	// Precise Position near seed, valid options
            qLen: 3, 		// Number of words to display to start the Question
            oLen: 2, 		// Number of words of each option
            qType: 0, 		// Question Type: NOTSPECIAL or <Special Type>
            currentPart: {},// Current Study Part
            txt: {
                question: "",
                op: []
            }
        };

        this.createNextQ = function (s) {
            var start = -1;
            if (isFinite(s) && s > 0 && s <= Utils.QuranWords) {
                start = s;
            }
            if (Profile.specialEnabled && selectSpecial() && false) { //TODO: remove!
                Utils.log('Creating a special question ..');
                return this.createSpecialQ(start);
            } else {
                Utils.log('Creating a normal question ..');
                return this.createNormalQ(start);
            }
        }

        this.createSpecialQ = function (start) {
            this.qo.rounds = 1;

            if (Profile.isSurasSpecialQuestionEligible()) {
                if (Math.random() > 0.5)
                    this.qo.qType = this.qTypeEnum.SURANAME.id;
                else if (Math.random() > 0.3)
                    this.qo.qType = this.qTypeEnum.SURAAYACOUNT.id;
                else
                    this.qo.qType = this.qTypeEnum.AYANUMBER.id;
            } else {
                this.qo.qType = this.qTypeEnum.AYANUMBER.id;
            }

            switch (this.qo.qType) {
                case this.qTypeEnum.SURANAME.id:
                    this.createQSuraName();
                    break;
                case this.qTypeEnum.SURAAYACOUNT.id:
                    this.createQSuraAyaCount();
                    break;
                case this.qTypeEnum.AYANUMBER.id:
                    this.createQAyaNumber();
                    break;
                //TODO: Implement others	
                default:
                    this.qo.qType = this.qTypeEnum.SURANAME.id;
                    this.createQSuraName();
                    break;
            }
        }

        this.createQSuraName = function () {
            do {
                this.sparsed = Profile.getSparsePoint(rand.int32() % Profile.getTotalStudyLength());
                Profile.lastSeed = this.sparsed.idx;
                this.qo.currentPart = this.sparsed.part;
                // +1 to compensate the rand-gen integer [0-QuranWords-1]
                this.qo.startIdx = this.getValidUniqueStartNear(this.sparsed.idx + 1);
            } while (!1); //!session.addIfNew(qo.startIdx)); // TODO: Skip duplicates

            this.qo.validCount = 1; //Number of correct options at the first round
            this.qo.qLen = (Profile.level == 1) ? 3 : 2;
            this.qo.oLen = 1;
            //Correct Answer:
            this.qo.op[0][0] = Utils.getSuraIdx(this.qo.startIdx);
            //Incorrect Answers		
            this.fillIncorrectRandomIdx(this.qo.op[0][0], 114);
        }

        this.createQSuraAyaCount = function () {
            do {
                this.sparsed = Profile.getSparsePoint(rand.int32() % Profile.getTotalStudyLength());
                Profile.lastSeed = this.sparsed.idx;
                this.qo.currentPart = this.sparsed.part;
                // +1 to compensate the rand-gen integer [0-QuranWords-1]
                this.qo.startIdx = this.getValidUniqueStartNear(this.sparsed.idx + 1);
            } while (!1); //!session.addIfNew(qo.startIdx)); TODO

            this.qo.validCount = 1; //Number of correct options at the first round
            this.qo.qLen = (Profile.level == 1) ? 3 : 2;
            this.qo.oLen = 1;
            //Correct Answer:
            this.qo.op[0][0] = Q.ayaCountOfSuraAt(this.qo.startIdx);
            //Incorrect Answers		
            this.fillIncorrectRandomNonZeroIdx(this.qo.op[0][0], 50);
        }

        this.createQAyaNumber = function () {
            do {
                this.sparsed = Profile.getSparsePoint(rand.int32() % Profile.getTotalStudyLength());
                Profile.lastSeed = this.sparsed.idx;
                this.qo.currentPart = this.sparsed.part;
                // +1 to compensate the rand-gen integer [0-QuranWords-1]
                this.qo.startIdx = this.getValidUniqueStartNear(this.sparsed.idx + 1);
            } while (!1);//!session.addIfNew(qo.startIdx)); TODO
		
            this.qo.validCount = 1; //Number of correct options at the first round
            this.qo.qLen = (Profile.level == 1) ? 3 : 2;
            this.qo.oLen = 1;
            //Correct Answer:
            this.qo.op[0][0] = Q.ayaNumberOf(this.qo.startIdx);
            //Incorrect Answers		
            this.fillIncorrectRandomNonZeroIdx(this.qo.op[0][0], 50);
        }

        this.getValidUniqueStartNear = function (start) {
            // Search for a correct neighbor unique start
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
                    srch_cond = Q.sim2cnt(start_shadow) > 0;
                }

                start = start_shadow;
            }
            return start;
        }

        this.createNormalQ = function (start) {
            this.qo.rounds = 10;
            this.qo.qType = this.qTypeEnum.NOTSPECIAL.id;

            if (start < 0) {
                // +1 to compensate the rand-gen integer [0-QuranWords-1]
                this.sparsed = Profile.getSparsePoint(Math.abs(rand.int32()) % Profile.getTotalStudyLength() + 1);
                Profile.lastSeed = this.sparsed.idx;
                Utils.log('Set Profile seed = ' + Profile.lastSeed);
            } else {
                this.sparsed = { idx: start, part: 0 };
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
                    Utils.log(JSON.stringify(self.qo));
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
            if (Profile.level > 1) { //TODO: Port async
                if (this.qo.qLen == 1) { // A 2-word Question
                    tmp = Q.sim2idx(this.qo.startIdx);
                    for (var i = 1; i < qo.validCount; i++)
                        this.qo.op[0][i] = tmp[i];
                } else { // A 3-word Question
                    tmp = Q.sim3idx(this.qo.startIdx);
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
            return Utils.promiseWhile(function () { return (i < 9); }, function () {
                i++;
                last_correct = self.qo.op[i][0] - 1;

                // We want to remove redundant correct choices from the given
                // options, this is made by removing subset sim2 from sim1
                // then finding the next unique set of words
                return Q.uniqueSim1Not2Plus1(last_correct)
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
                            return Q.randomUnique4NotMatching(self.qo.op[i][0]);
                        }
                        return this;
                    }).then(function (randList) {
                        for (var i = 0; i < 10; i++) { if (self.qo.op[i][0] == randList.i) break; }
                        if (i < 10) {
                            Utils.log('Adding ' + (4 - uniq_cnt) + ' random inc_op at round ' + i);
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
                                    self.qo.op[i][j] = randList.set[j - uniq_cnt - 1];
                            }
                        }
                    });
            });//.then(function(){Utils.log('Done with incorrect options');});
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
                    break;
                }

            this.qo.op[0][1] = (correctIdxPerm + rndIdx[perm[1]]) % mod;
            this.qo.op[0][2] = (correctIdxPerm + rndIdx[perm[2]]) % mod;
            this.qo.op[0][3] = (correctIdxPerm + rndIdx[perm[3]]) % mod;
            this.qo.op[0][4] = (correctIdxPerm + rndIdx[perm[4]]) % mod;
        }

        this.getValidStartNear = function (start) {
            // Search for a correct neighbor start according to level
            var dir = 1; // search down = +1
            var disp2, disp3;
            var start_shadow = start - dir;
            var extraLength;
            var srch_cond = true;
		
            //while (srch_cond) {
            return Utils.promiseWhile(function () { return (srch_cond); }, function () {

                start_shadow += dir;
                if (start_shadow == 0 || start_shadow == (Utils.QuranWords - 1)) {
                    //Need to start over searching the opposite direction
                    start_shadow = start;
                    dir = -dir;
                    return; //break;
                }
                if (Profile.level == 0) { // Get a non-motashabehat at aya start
                    self.qo.validCount = 1; // \
                    self.qo.qLen = 3;       // -|-> Default Constants for level-0
                    self.qo.oLen = 2;       // /
                    return Q.isAyaStart(start_shadow).then(function (t) { srch_cond = !t; });
                } else if (Profile.level == 1) { // Get a Motashabehat near selected index
                    self.qo.validCount = 1; // \
                    self.qo.qLen = 3;       // -|-> Default Constants for level-1
                    self.qo.oLen = 2;       // /
                    return Q.sim2cnt(start_shadow).then(function (t) { srch_cond = (t > 1); });
                } else if (Profile.level == 2) {
                    return Q.sim2cnt(start_shadow)
                        .then(function (t) {
                            //srch_cond = (t>1);
                            if (!(t > 1)) {
                                self.qo.validCount = 1; // \
                                self.qo.qLen = 2;       // -|-> Default Constants for level-2
                                self.qo.oLen = 1;       // /
                                return self.extraQLength(start_shadow, qo.qLen)
                                    .then(function (extraLength) {
                                        if (extraLength > -1) {
                                            self.qo.qLen += extraLength;
                                            self.start_shadow -= extraLength;
                                            srch_cond = false;
                                        } else {
                                            // Too Long Motashabehat, cannot start within, non-unique answer
                                            srch_cond = true;
                                        }
                                    });
                            }
                        });
                } else {
                    // TODO: Port!!
                    // Profile.level == 3
                    // Search for a motashabehat near selected index
                    // Specify # Words to display
                    disp2 = 0;
                    disp3 = 0;

                    if (Q.sim3cnt(start_shadow) < 5
                        && Q.sim3cnt(start_shadow) > 0)
                        disp3 = Q.sim3cnt(start_shadow);

                    if (Q.sim2cnt(start_shadow) < 5
                        && Q.sim2cnt(start_shadow) > 0)
                        disp2 = Q.sim2cnt(start_shadow);

                    // Motashabehat not found,continue!
                    srch_cond = (disp3 == 0 && disp2 == 0);

                    if (srch_cond == false) { // Found!
                        self.qo.validCount = (disp2 > disp3) ? disp2 : disp3;// TODO:
                        // Check,
                        // +1
                        // caused
                        // bound
                        // excep
                        self.qo.qLen = (disp2 > disp3) ? 1 : 2;
                    }
                    self.qo.oLen = 1;
                }
            }).then(function (ctx) {
                self.qo.startIdx = start_shadow; //return start;
            });
        }

        this.extraQLength = function (start, qLen) {
            // TODO: Port!!
            var extra = 0;
            while ((extra < QLEN_EXTRA_LIMIT) && (Q.sim3cnt(--start) > 0))
                extra++;

            if (extra == QLEN_EXTRA_LIMIT)
                return -1;
            else if (extra == 0)
                return 0;
            else
                return extra + 1;
        }

        this.fillText = function () {
            var qop = [], qtmp;
            for (var i = 0; i < self.qo.qLen; i++) {
                qtmp = Utils.modQWords(this.qo.startIdx + i);
                qop.push(qtmp);
            }
            return Q.txts(qop)
                .then(function (txt) {
                    self.qo.txt.question = txt.slice(0, self.qo.qLen).join(' ');

                    var op = [], tmp;
                    for (var k = 0; k < self.qo.rounds; k++) {
                        for (var l = 0; l < 5; l++) {
                            for (var m = 0; m < self.qo.oLen; m++) {
                                tmp = Utils.modQWords(self.qo.op[k][l] + m);
                                if (!isFinite(tmp)) { tmp = 0; console.warn('Bad op[' + k + '][' + l + ']'); }
                                op.push(tmp);
                            }
                        }
                    }
                    return Q.txts(op);
                })
                .then(function (txt) {
                    for (var k = 0; k < self.qo.rounds; k++) {
                        for (var l = 0; l < 5; l++) {
                            self.qo.txt.op[k][l] = txt.slice((5 * k + l) * self.qo.oLen, (5 * k + (l + 1)) * self.qo.oLen).join(' ');
                        }
                    }
                });

        }
        var selectSpecial = function () {
            if (Profile.level == 0)
                return false;
            else if (Profile.isSurasSpecialQuestionEligible())
                return (Math.random() < 0.20);
            else
                return (Math.random() < 0.05);
        }
	
        /* Constructor*/
        for (var k = 0; k < 10; k++) this.qo.op[k] = []; //Init 2D array
        for (var k = 0; k < 10; k++) this.qo.txt.op[k] = []; //Init 2D array

		
        return self;
    })

/*
  	public static QQQuestionObject createDefinedQuestion(int part) {
		QQProfile profileSinglePart;
		profileSinglePart = new QQProfile(null, new Random().nextInt(),
											QQUtils.getRandomLevel(),
											QQProfileHandler.getStudyPartFromIndex(part),
											QQScoreRecord.getInitScoreRecordPack(),
											0);
		QQQuestionaire tmp = new QQQuestionaire(profileSinglePart, null, null);
		return tmp.qo ;
	}
*/	