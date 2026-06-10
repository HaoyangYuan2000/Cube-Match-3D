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
let _deviceId = null;
let _initPromise = null;

function initFirebase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    firebase.initializeApp(firebaseConfig);
    _db = firebase.firestore();
    try {
      _deviceId = await firebase.installations().getId();
    } catch (e) {
      _deviceId = localStorage.getItem('cb3d_did');
      if (!_deviceId) {
        _deviceId = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
        localStorage.setItem('cb3d_did', _deviceId);
      }
    }
  })();
  return _initPromise;
}

async function loadProgress() {
  if (!_db || !_deviceId) return null;
  try {
    const doc = await _db.collection('players').doc(_deviceId).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

// 存单个字段（用于实时保存）
async function saveProgress(key, value) {
  if (!_db || !_deviceId) return;
  try {
    await _db.collection('players').doc(_deviceId).set({ [key]: value }, { merge: true });
  } catch (e) {}
}

async function markTutorialDone() {
  await saveProgress('tutorialDone', true);
}

// 通关时批量保存所有进度
async function saveAllProgress() {
  if (!_db || !_deviceId) return;

  // 计算累计星星
  const totalStars = LEVELS.reduce((sum, _, i) => sum + getStars(i), 0);

  // 最远解锁关卡（最后一个 stars>0 的关卡 +1，最少0）
  let maxLevel = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (getStars(i) > 0) { maxLevel = i + 1; break; }
  }

  // 每一关的最多剩余步数
  const bestLeft = {};
  LEVELS.forEach((_, i) => {
    const v = +localStorage.getItem('cb3d_bl' + i) || 0;
    if (v > 0) bestLeft[i] = v;
  });

  // 每一关星星
  const stars = {};
  LEVELS.forEach((_, i) => {
    const v = getStars(i);
    if (v > 0) stars[i] = v;
  });

  try {
    await _db.collection('players').doc(_deviceId).set({
      stars,
      bestLeft,
      totalStars,
      maxLevel,
      tools: { slice: sliceUses },
      blocksElim: totalBlocksElim
    }, { merge: true });
  } catch (e) {}
}
