'use strict';

const firebaseConfig = {
  apiKey: "AIzaSyD1EpNFzx9nBhjpXXjucYkpfsK5aRIVylE",
  authDomain: "cube-match-3d-nextai.firebaseapp.com",
  projectId: "cube-match-3d-nextai",
  storageBucket: "cube-match-3d-nextai.firebasestorage.app",
  messagingSenderId: "525393991475",
  appId: "1:525393991475:android:54cff6749d84265b801046"
};

let _db = null;
let _auth = null;
let _uid = null;
let _initPromise = null;

function initFirebase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    firebase.initializeApp(firebaseConfig);
    _db = firebase.firestore();
    _auth = firebase.auth();

    // Wait for auth state, sign in anonymously if no user
    await new Promise((resolve) => {
      const unsub = _auth.onAuthStateChanged(async (user) => {
        unsub();
        if (!user) {
          try { await _auth.signInAnonymously(); } catch (e) {}
        }
        _uid = _auth.currentUser ? _auth.currentUser.uid : _legacyDeviceId();
        resolve();
      });
    });
  })();
  return _initPromise;
}

function _legacyDeviceId() {
  let id = localStorage.getItem('cb3d_did');
  if (!id) {
    id = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    localStorage.setItem('cb3d_did', id);
  }
  return id;
}

function isAnonymousUser() {
  return !_auth || !_auth.currentUser || _auth.currentUser.isAnonymous;
}

// Link anonymous account with Google. Returns {success, displayName, error}
// After UID switch: update nickname ownership to new UID
async function _updateNicknameOwnership(newUid) {
  if (!_db) return;
  const nickname = localStorage.getItem('cb3d_nickname');
  if (!nickname) return;
  try {
    // Only transfer if the Google account doesn't already own a different nickname
    const newPlayerDoc = await _db.collection('players').doc(newUid).get();
    const existingNick = newPlayerDoc.exists && newPlayerDoc.data().nickname;
    if (existingNick && existingNick !== nickname) return;
    await _db.collection('nicknames').doc(nickname).set({ uid: newUid }, { merge: true });
  } catch (e) {}
}

// Copy anonymous progress to Google account if Google account has no data
async function _migrateProgressIfNeeded(oldUid, newUid) {
  if (!_db || !oldUid || oldUid === newUid) return;
  try {
    const [newDoc, oldDoc] = await Promise.all([
      _db.collection('players').doc(newUid).get(),
      _db.collection('players').doc(oldUid).get(),
    ]);
    if (!oldDoc.exists) return; // nothing to migrate
    if (!newDoc.exists) {
      // Google account has no data — copy everything from anonymous
      await _db.collection('players').doc(newUid).set(oldDoc.data());
      return;
    }
    // Both exist — merge, taking the better value for scores
    const o = oldDoc.data(), n = newDoc.data();
    const merged = {};
    if ((o.classicBest || 0) > (n.classicBest || 0)) merged.classicBest = o.classicBest;
    if ((o.taBest || 0) > (n.taBest || 0)) merged.taBest = o.taBest;

    if ((o.blocksElim || 0) > (n.blocksElim || 0)) merged.blocksElim = o.blocksElim;
    if (Object.keys(merged).length > 0) {
      await _db.collection('players').doc(newUid).set(merged, { merge: true });
    }
  } catch (e) {}
}

let _googleLinking = false;
let _googleInitialized = false;
async function linkWithGoogle() {
  if (_googleLinking) return { success: false, error: 'in_progress' };
  if (!_auth) return { success: false, error: 'not_init' };
  if (_auth.currentUser && !_auth.currentUser.isAnonymous) {
    return { success: true, displayName: _auth.currentUser.displayName, email: _auth.currentUser.email };
  }
  _googleLinking = true;
  try {
    const GoogleAuth = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth;
    if (GoogleAuth) {
      if (!_googleInitialized) {
        await GoogleAuth.initialize({
          clientId: '525393991475-6j5dhsua8jkor4rj3476dsqh45fvbaa6.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true
        });
        _googleInitialized = true;
      }
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication && googleUser.authentication.idToken;
      if (!idToken) return { success: false, error: 'no_token' };
      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      let authResult;
      const oldDeviceId = _uid; // save anonymous UID before switching
      let isNewAccount = true;
      try {
        if (_auth.currentUser && _auth.currentUser.isAnonymous) {
          // Upgrade anonymous → Google, UID stays the same, no migration needed
          authResult = await _auth.currentUser.linkWithCredential(credential);
          _uid = authResult.user.uid;
        } else {
          authResult = await _auth.signInWithCredential(credential);
          _uid = authResult.user.uid;
        }
      } catch (e) {
        if (e.code === 'auth/credential-already-in-use') {
          // Google account already exists — sign in and migrate if needed
          authResult = await _auth.signInWithCredential(credential);
          _uid = authResult.user.uid;
          isNewAccount = false;
          await _migrateProgressIfNeeded(oldDeviceId, _uid);
          await _updateNicknameOwnership(_uid);
        } else throw e;
      }
      return { success: true, isNewAccount, displayName: authResult.user.displayName, email: authResult.user.email };
    }
    // Web fallback (browser testing) — use popup
    const provider = new firebase.auth.GoogleAuthProvider();
    const oldDeviceId = _uid;
    let result;
    let isNewAccount = true;
    try {
      if (_auth.currentUser && _auth.currentUser.isAnonymous) {
        result = await _auth.currentUser.linkWithPopup(provider);
        _uid = result.user.uid;
      } else {
        result = await _auth.signInWithPopup(provider);
        _uid = result.user.uid;
      }
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') {
        result = await _auth.signInWithPopup(provider);
        _uid = result.user.uid;
        isNewAccount = false;
        await _migrateProgressIfNeeded(oldDeviceId, _uid);
        await _updateNicknameOwnership(_uid);
      } else throw e;
    }
    return { success: true, isNewAccount, displayName: result.user.displayName, email: result.user.email };
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ||
        e.message === 'The user canceled the sign-in flow.') {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: e.code || e.message };
  } finally {
    _googleLinking = false;
  }
}

async function loadProgress() {
  if (!_db || !_uid) return null;
  try {
    const doc = await _db.collection('players').doc(_uid).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

async function saveProgress(key, value) {
  if (!_db || !_uid) return;
  try {
    await _db.collection('players').doc(_uid).set({ [key]: value }, { merge: true });
  } catch (e) {}
}


// ── Nickname uniqueness ──

async function checkNickname(name) {
  if (!_db) return 'available';
  try {
    const doc = await _db.collection('nicknames').doc(name).get();
    if (!doc.exists) return 'available';
    const data = doc.data();
    if (data.uid === _uid) return 'yours';
    return 'taken';
  } catch (e) { return 'taken'; }
}

async function claimNickname(name) {
  if (!_db || !_uid) return;
  try {
    const oldNick = localStorage.getItem('cb3d_nickname') || null;
    const ops = [_db.collection('nicknames').doc(name).set({ uid: _uid })];
    if (oldNick && oldNick !== name) {
      ops.push(_db.collection('nicknames').doc(oldNick).delete());
      const [lbClassic, lbTimed] = await Promise.all([
        _db.collection('leaderboard_classic').doc(oldNick).get(),
        _db.collection('leaderboard_timed').doc(oldNick).get(),
      ]);
      if (lbClassic.exists) {
        ops.push(_db.collection('leaderboard_classic').doc(name).set({ ...lbClassic.data(), name }));
        ops.push(_db.collection('leaderboard_classic').doc(oldNick).delete());
      }
      if (lbTimed.exists) {
        ops.push(_db.collection('leaderboard_timed').doc(name).set({ ...lbTimed.data(), name }));
        ops.push(_db.collection('leaderboard_timed').doc(oldNick).delete());
      }
    }
    await Promise.all(ops);
    await saveProgress('nickname', name);
    delete _lbCache['classic'];
    delete _lbCache['timed'];

  } catch (e) {}
}

// ── Leaderboard ──

async function submitScore(mode, score) {
  if (!_db) return;
  const nickname = localStorage.getItem('cb3d_nickname');
  if (!nickname) return;
  const col = mode === 'classic' ? 'leaderboard_classic' : 'leaderboard_timed';
  try {
    const ref = _db.collection(col).doc(nickname);
    const doc = await ref.get();
    if (doc.exists && (doc.data().score || 0) >= score) return;
    await ref.set({
      name: nickname,
      score,
      uid: _uid,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    delete _lbCache[mode]; // invalidate cache so next open shows fresh data
  } catch (e) { console.error('submitScore error:', e); }
}

const _lbCache = {};
const LB_TTL = 60000; // 60 seconds

async function fetchLeaderboard(mode) {
  if (!_db) return [];
  const cached = _lbCache[mode];
  if (cached && Date.now() - cached.ts < LB_TTL) return cached.data;
  const col = mode === 'classic' ? 'leaderboard_classic' : 'leaderboard_timed';
  try {
    const snap = await _db.collection(col)
      .orderBy('score', 'desc')
      .limit(10)
      .get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _lbCache[mode] = { data, ts: Date.now() };
    return data;
  } catch (e) {
    return cached ? cached.data : []; // return stale cache on error rather than empty
  }
}

// ── Social / Friends ──

async function fetchSuggestedPlayers(count) {
  if (!_db || !_uid) return [];
  try {
    const [friendUids, classicSnap, timedSnap] = await Promise.all([
      _fetchFriendUids(),
      _db.collection('leaderboard_classic').orderBy('score', 'desc').limit(50).get(),
      _db.collection('leaderboard_timed').orderBy('score', 'desc').limit(50).get(),
    ]);
    const excluded = new Set([...friendUids, _uid]);
    const byUid = {};
    for (const d of classicSnap.docs) {
      const { uid, name, score } = d.data();
      if (!uid || !name || excluded.has(uid)) continue;
      byUid[uid] = { uid, nickname: name, classicBest: score || 0, taBest: 0 };
    }
    for (const d of timedSnap.docs) {
      const { uid, name, score } = d.data();
      if (!uid || !name || excluded.has(uid)) continue;
      if (byUid[uid]) { byUid[uid].taBest = score || 0; }
      else byUid[uid] = { uid, nickname: name, classicBest: 0, taBest: score || 0 };
    }
    const pool = Object.values(byUid)
      .sort((a, b) => (b.classicBest + b.taBest) - (a.classicBest + a.taBest))
      .slice(0, 30);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).map(p => ({
      uid: p.uid, nickname: p.nickname,
      classicBest: p.classicBest, taBest: p.taBest
    }));
  } catch (e) { return []; }
}

async function searchPlayer(nickname) {
  if (!_db) return null;
  try {
    const doc = await _db.collection('nicknames').doc(nickname).get();
    if (!doc.exists) return null;
    const uid = doc.data().uid;
    if (uid === _uid) return 'self';
    const player = await _db.collection('players').doc(uid).get();
    const d = player.exists ? player.data() : {};
    return { uid, nickname, classicBest: d.classicBest || 0, taBest: d.taBest || 0 };
  } catch (e) { return null; }
}

async function sendFriendRequest(toUid, toNickname) {
  if (!_db || !_uid) return 'sent';
  const myNick = localStorage.getItem('cb3d_nickname') || '?';
  const reverseDocId = _uid + '_' + toUid;
  try {
    const reverseDoc = await _db.collection('friendRequests').doc(reverseDocId).get();
    if (reverseDoc.exists) {
      await acceptFriendRequest(toUid, reverseDocId);
      return 'accepted';
    }
    const docId = toUid + '_' + _uid;
    await _db.collection('friendRequests').doc(docId).set({
      from: _uid, fromNickname: myNick,
      toUid, toNickname,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    return 'sent';
  } catch (e) { return 'sent'; }
}

async function loadFriendRequests() {
  if (!_db || !_uid) return [];
  try {
    const snap = await _db.collection('friendRequests')
      .where('toUid', '==', _uid).limit(20).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

function _friendshipId(a, b) {
  return a < b ? a + '_' + b : b + '_' + a;
}

async function acceptFriendRequest(fromUid, docId) {
  if (!_db || !_uid) return;
  const fsId = _friendshipId(_uid, fromUid);
  try {
    await Promise.all([
      _db.collection('friendships').doc(fsId).set({ uid1: _uid, uid2: fromUid }),
      _db.collection('friendRequests').doc(docId).delete(),
      _db.collection('friendRequests').doc(_uid + '_' + fromUid).delete()
    ]);
  } catch (e) {}
}

async function rejectFriendRequest(docId) {
  if (!_db) return;
  try { await _db.collection('friendRequests').doc(docId).delete(); } catch (e) {}
}

async function removeFriend(friendUid) {
  if (!_db || !_uid) return;
  try {
    await _db.collection('friendships').doc(_friendshipId(_uid, friendUid)).delete();
  } catch (e) {}
}

async function _fetchFriendUids() {
  if (!_db || !_uid) return [];
  const [snap1, snap2] = await Promise.all([
    _db.collection('friendships').where('uid1', '==', _uid).get(),
    _db.collection('friendships').where('uid2', '==', _uid).get()
  ]);
  return [...snap1.docs, ...snap2.docs].map(d => {
    const { uid1, uid2 } = d.data();
    return uid1 === _uid ? uid2 : uid1;
  });
}

async function fetchFriendsLeaderboard(mode) {
  if (!_db || !_uid) return [];
  try {
    const [friendUids, myDoc] = await Promise.all([
      _fetchFriendUids(),
      _db.collection('players').doc(_uid).get()
    ]);
    if (!friendUids.length) return [];
    const chunks = [];
    for (let i = 0; i < friendUids.length; i += 10) chunks.push(friendUids.slice(i, i + 10));
    const snaps = await Promise.all(chunks.map(chunk =>
      _db.collection('players').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
    ));
    const players = [];
    snaps.forEach(snap => snap.docs.forEach(d => players.push({ uid: d.id, ...d.data() })));
    const field = mode === 'classic' ? 'classicBest' : 'taBest';
    const myData = myDoc.data() || {};
    players.push({ uid: _uid, nickname: localStorage.getItem('cb3d_nickname') || '?', [field]: myData[field] || 0 });
    return players
      .filter(p => p.nickname)
      .sort((a, b) => (b[field] || 0) - (a[field] || 0))
      .slice(0, 20)
      .map(p => ({ id: p.nickname, name: p.nickname, score: p[field] || 0, uid: p.uid }));
  } catch (e) { return []; }
}

async function claimFriendBlockRewards() {
  if (!_db || !_uid) return 0;
  try {
    const [myDoc, friendUids] = await Promise.all([
      _db.collection('players').doc(_uid).get(),
      _fetchFriendUids()
    ]);
    if (!myDoc.exists || !friendUids.length) return 0;
    const data = myDoc.data();
    const rewardLog = data.friendRewardLog || {};
    let totalReward = 0;
    const newLog = { ...rewardLog };
    const chunks = [];
    for (let i = 0; i < friendUids.length; i += 10) chunks.push(friendUids.slice(i, i + 10));
    const friendDocs = [];
    const snaps = await Promise.all(chunks.map(chunk =>
      _db.collection('players').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
    ));
    snaps.forEach(snap => snap.docs.forEach(d => friendDocs.push({ uid: d.id, ...d.data() })));
    for (const f of friendDocs) {
      const current = f.blocksElim || 0;
      const last = rewardLog[f.uid] || 0;
      const newElim = current - last;
      if (newElim < 0) { newLog[f.uid] = current; continue; }
      if (newElim >= 100) {
        const reward = Math.floor(newElim / 100);
        totalReward += reward;
        newLog[f.uid] = last + reward * 100;
      }
    }
    if (totalReward > 0) {
      await _db.collection('players').doc(_uid).set({ friendRewardLog: newLog }, { merge: true });
    }
    return totalReward;
  } catch (e) { return 0; }
}

async function loadSentRequests() {
  if (!_db || !_uid) return [];
  try {
    const snap = await _db.collection('friendRequests').where('from', '==', _uid).limit(20).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

async function getFriendRequestCount() {
  if (!_db || !_uid) return 0;
  try {
    const snap = await _db.collection('friendRequests').where('toUid', '==', _uid).limit(20).get();
    return snap.size;
  } catch (e) { return 0; }
}

async function checkAlreadyFriends(targetUid) {
  if (!_db || !_uid) return false;
  try {
    const doc = await _db.collection('friendships').doc(_friendshipId(_uid, targetUid)).get();
    return doc.exists;
  } catch (e) { return false; }
}

async function signOutUser() {
  if (!_auth) return;
  try { await _auth.signOut(); } catch (e) {}
  _uid = null;
}

async function saveAllProgress() {
  if (!_db || !_uid) return;
  const totalStars = LEVELS.reduce((sum, _, i) => sum + getStars(i), 0);
  let maxLevel = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (getStars(i) > 0) { maxLevel = i + 1; break; }
  }
  const bestLeft = {};
  LEVELS.forEach((_, i) => {
    const v = +localStorage.getItem('cb3d_bl' + i) || 0;
    if (v > 0) bestLeft[i] = v;
  });
  const stars = {};
  LEVELS.forEach((_, i) => {
    const v = getStars(i);
    if (v > 0) stars[i] = v;
  });
  try {
    await _db.collection('players').doc(_uid).set({
      stars, bestLeft, totalStars, maxLevel,
      tools: { slice: sliceUses },
      sliceDay: localStorage.getItem('cb3d_sliceday') || null,
      blocksElim: totalBlocksElim
    }, { merge: true });
  } catch (e) {}
}
