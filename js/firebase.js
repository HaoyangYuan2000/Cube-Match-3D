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

    // 用 Firebase Installations 获取稳定 device ID，失败则降级到 UUID
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

async function saveProgress(key, value) {
  if (!_db || !_deviceId) return;
  try {
    await _db.collection('players').doc(_deviceId).set({ [key]: value }, { merge: true });
  } catch (e) {}
}
