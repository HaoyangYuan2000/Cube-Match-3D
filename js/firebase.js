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

async function linkWithGoogle() {
  if (!_auth) return { success: false, error: 'not_init' };
  if (_auth.currentUser && !_auth.currentUser.isAnonymous) {
    return { success: true, displayName: _auth.currentUser.displayName };
  }
  try {
    const GoogleAuth = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth;
    if (GoogleAuth) {
      // Native path (Android) — must initialize before signIn
      await GoogleAuth.initialize({
        clientId: '525393991475-6j5dhsua8jkor4rj3476dsqh45fvbaa6.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true
      });
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication && googleUser.authentication.idToken;
      if (!idToken) return { success: false, error: 'no_token' };
      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      let authResult;
      const oldDeviceId = _uid; // save anonymous UID before switching
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
          await _migrateProgressIfNeeded(oldDeviceId, _uid);
          await _updateNicknameOwnership(_uid);
        } else throw e;
      }
      return { success: true, displayName: authResult.user.displayName };
    }
    // Web fallback (browser testing) — use popup
    const provider = new firebase.auth.GoogleAuthProvider();
    const oldDeviceId = _uid;
    let result;
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
        await _migrateProgressIfNeeded(oldDeviceId, _uid);
        await _updateNicknameOwnership(_uid);
      } else throw e;
    }
    return { success: true, displayName: result.user.displayName };
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ||
        e.message === 'The user canceled the sign-in flow.') {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: e.code || e.message };
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
    await _db.collection('nicknames').doc(name).set({ uid: _uid });
    await saveProgress('nickname', name);
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
