import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  registerQuizCode, watchFriendRequests, watchFriends, acceptFriendRequest,
  declineFriendRequest, sendPvpInvite, watchPresence, type FriendRequestEntry, type FriendEntry,
} from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import { DEFAULT_GUEST_NAME } from '../../src/models/constants';
import { Avatar } from '../../src/components/Avatar';
import { useTheme, radii } from '../../src/theme/tokens';
import { useDirection, rowDir, alignDir, mirror } from '../../src/theme/direction';
import PressScale from '../../src/components/PressScale';

import { scopeFromParts } from '../../src/services/pvpService';

function FriendRow({
  friendUid,
  friend,
  isRTL,
  colors,
  t,
  onChallenge,
}: {
  friendUid: string;
  friend: FriendEntry;
  isRTL: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string) => string;
  onChallenge: (uid: string, friend: FriendEntry) => void;
}) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const unsub = watchPresence(friendUid, (presence) => {
      setOnline(!!presence?.online);
    });
    return unsub;
  }, [friendUid]);

  return (
    <View
      style={[s.rowCard, { backgroundColor: colors.card, borderColor: colors.line, flexDirection: rowDir(isRTL) }]}
    >
      <View style={s.avatarContainer}>
        <Avatar
          uri={friend.photoURL}
          fallback={require('../../assets/images/app-icon.png')}
          style={s.rowAvatar}
        />
        {online && (
          <View style={[s.onlineDot, { backgroundColor: colors.correct, borderColor: colors.card }]} />
        )}
      </View>
      <View style={[s.rowInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <Text style={[s.rowName, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
          {friend.name || t('common.guestName')}
        </Text>
      </View>
      <View style={[s.actionRow, { flexDirection: rowDir(isRTL) }]}>
        <PressScale
          style={[s.actionBtn, { backgroundColor: colors.goldPale }]}
          onPress={() => onChallenge(friendUid, friend)}
        >
          <Ionicons name="flash-outline" size={16} color={colors.goldDeep} />
          <Text style={[s.actionTxt, { color: colors.goldDeep }]}>{t('friends.challenge')}</Text>
        </PressScale>
      </View>
    </View>
  );
}

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const { colors } = useTheme();
  const router = useRouter();
  const social = useProfileStore((s) => s.social);
  const parts = useProfileStore((s) => s.parts);
  const level = useProfileStore((s) => s.level);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [requests, setRequests] = useState<Record<string, FriendRequestEntry>>({});
  const [friends, setFriends] = useState<Record<string, FriendEntry>>({});
  const [loadingCode, setLoadingCode] = useState(true);

  // Step 3: Call registerQuizCode once, lazily, when friends screen mounts
  useEffect(() => {
    if (!social.uid) return;
    let cancelled = false;
    setLoadingCode(true);
    registerQuizCode(social.uid)
      .then((code) => {
        if (!cancelled) {
          setMyCode(code);
          setLoadingCode(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingCode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [social.uid]);

  // Subscribe to incoming friend requests and friend list
  useEffect(() => {
    if (!social.uid) return;
    const unsubRequests = watchFriendRequests(social.uid, setRequests);
    const unsubFriends = watchFriends(social.uid, setFriends);
    return () => {
      unsubRequests();
      unsubFriends();
    };
  }, [social.uid]);

  async function handleShareCode() {
    if (!myCode) return;
    // A real link (not just the bare code as text) so tapping it on the
    // recipient's end resolves and sends the request automatically — see
    // (app)/add/[code].tsx, which this path already routes to.
    const link = `https://quranquiz.net/add/${myCode}`;
    try {
      // message already embeds the link; don't also pass `url`, or share
      // targets that surface both (e.g. iMessage) duplicate it.
      await Share.share({
        message: t('friends.shareMessage', { code: myCode, link }),
      });
    } catch { /* ignore */ }
  }

  function handleAddByCode() {
    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) return;
    setInputCode('');
    router.push({ pathname: '/(app)/add/[code]', params: { code: trimmed } });
  }

  async function handleAccept(fromUid: string, req: FriendRequestEntry) {
    if (!social.uid) return;
    const myName = social.displayName || DEFAULT_GUEST_NAME;
    await acceptFriendRequest(fromUid, social.uid, myName, social.photoURL, req.fromName, req.fromPhotoURL);
  }

  async function handleDecline(fromUid: string) {
    if (!social.uid) return;
    await declineFriendRequest(fromUid, social.uid);
  }

  async function handleChallenge(friendUid: string, friend: FriendEntry) {
    if (!social.uid) return;
    const scope = scopeFromParts(parts);
    const myName = social.displayName || DEFAULT_GUEST_NAME;
    await sendPvpInvite(friendUid, social.uid, myName, social.photoURL, level, scope);
    router.push({
      pathname: '/(app)/pvp-lobby',
      params: {
        recipientUid: friendUid,
        role: 'challenger',
        opponentName: friend.name ?? '',
        opponentPhoto: friend.photoURL ?? '',
      },
    });
  }

  const requestEntries = Object.entries(requests);
  const friendEntries = Object.entries(friends);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      {/* In-page Header */}
      <View style={[s.header, { borderColor: colors.line, flexDirection: rowDir(isRTL) }]}>
        <PressScale onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name={mirror(isRTL, 'chevron-back', 'chevron-forward')} size={22} color={colors.ink} />
        </PressScale>
        <Text style={[s.title, { color: colors.ink }]}>{t('friends.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── My Quiz Code Card ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={[s.cardHeaderRow, { flexDirection: rowDir(isRTL) }]}>
            <Ionicons name="qr-code-outline" size={20} color={colors.goldDeep} />
            <Text style={[s.cardTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
              {t('friends.myCodeTitle')}
            </Text>
          </View>
          <View style={[s.codeBox, { backgroundColor: colors.goldPale, borderColor: colors.gold }]}>
            {loadingCode ? (
              <ActivityIndicator size="small" color={colors.goldDeep} />
            ) : (
              <Text style={[s.codeText, { color: colors.navy }]}>{myCode ?? '--------'}</Text>
            )}
          </View>
          <PressScale
            style={[s.shareBtn, { backgroundColor: colors.gold }]}
            onPress={handleShareCode}
            disabled={!myCode}
          >
            <Ionicons name="share-social-outline" size={18} color={colors.navy} />
            <Text style={[s.shareBtnTxt, { color: colors.navy }]}>{t('friends.shareBtn')}</Text>
          </PressScale>
        </View>

        {/* ── Enter Code Section ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[s.cardTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
            {t('friends.addFriendTitle')}
          </Text>
          <View style={[s.inputRow, { flexDirection: rowDir(isRTL) }]}>
            <TextInput
              style={[s.input, { borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper }]}
              placeholder={t('friends.placeholderCode')}
              placeholderTextColor={colors.inkSoft}
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="characters"
              maxLength={12}
            />
            <PressScale
              style={[s.addBtn, { backgroundColor: colors.navy }, !inputCode.trim() && { opacity: 0.5 }]}
              onPress={handleAddByCode}
              disabled={!inputCode.trim()}
            >
              <Text style={s.addBtnTxt}>{t('friends.addBtn')}</Text>
            </PressScale>
          </View>
        </View>

        {/* ── Incoming Friend Requests ── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
            {t('friends.incomingRequests')} ({requestEntries.length})
          </Text>
        </View>

        {requestEntries.length === 0 ? (
          <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Ionicons name="mail-unread-outline" size={24} color={colors.inkSoft} />
            <Text style={[s.emptyText, { color: colors.inkSoft, textAlign: alignDir(isRTL) }]}>
              {t('friends.noRequests')}
            </Text>
          </View>
        ) : (
          requestEntries.map(([fromUid, req]) => (
            <View
              key={fromUid}
              style={[s.rowCard, { backgroundColor: colors.card, borderColor: colors.line, flexDirection: rowDir(isRTL) }]}
            >
              <Avatar
                uri={req.fromPhotoURL}
                fallback={require('../../assets/images/app-icon.png')}
                style={s.rowAvatar}
              />
              <View style={[s.rowInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[s.rowName, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
                  {req.fromName || t('common.guestName')}
                </Text>
              </View>
              <View style={[s.actionRow, { flexDirection: rowDir(isRTL) }]}>
                <PressScale
                  style={[s.actionBtn, { backgroundColor: colors.correctPale }]}
                  onPress={() => handleAccept(fromUid, req)}
                >
                  <Ionicons name="checkmark" size={16} color={colors.correct} />
                  <Text style={[s.actionTxt, { color: colors.correct }]}>{t('friends.accept')}</Text>
                </PressScale>
                <PressScale
                  style={[s.actionBtn, { backgroundColor: colors.wrongPale }]}
                  onPress={() => handleDecline(fromUid)}
                >
                  <Ionicons name="close" size={16} color={colors.wrong} />
                  <Text style={[s.actionTxt, { color: colors.wrong }]}>{t('friends.decline')}</Text>
                </PressScale>
              </View>
            </View>
          ))
        )}

        {/* ── Friend List ── */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
            {t('friends.friendList')} ({friendEntries.length})
          </Text>
        </View>

        {friendEntries.length === 0 ? (
          <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Ionicons name="people-outline" size={24} color={colors.inkSoft} />
            <Text style={[s.emptyText, { color: colors.inkSoft, textAlign: alignDir(isRTL) }]}>
              {t('friends.noFriends')}
            </Text>
          </View>
        ) : (
          friendEntries.map(([friendUid, friend]) => (
            <FriendRow
              key={friendUid}
              friendUid={friendUid}
              friend={friend}
              isRTL={isRTL}
              colors={colors}
              t={t}
              onChallenge={handleChallenge}
            />
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 2 },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PlexArabic-Bold',
    textAlign: 'center',
  },
  scroll: {
    padding: 14,
    gap: 12,
    paddingBottom: 36,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'PlexArabic-Bold',
  },
  codeBox: {
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 22,
    fontFamily: 'PlexArabic-Bold',
    letterSpacing: 3,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  shareBtnTxt: {
    fontSize: 14,
    fontFamily: 'PlexArabic-Bold',
  },
  inputRow: {
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'PlexArabic-SemiBold',
  },
  addBtn: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnTxt: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'PlexArabic-Bold',
  },
  sectionHeader: {
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlexArabic-Bold',
  },
  emptyBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 14.5,
    fontFamily: 'PlexArabic-SemiBold',
  },
  actionRow: {
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  actionTxt: {
    fontSize: 12,
    fontFamily: 'PlexArabic-Bold',
  },
});
