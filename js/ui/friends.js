'use strict';

let _suggestionsCache = null;

async function prefetchSuggestions() {
  if (isAnonymousUser()) return;
  _suggestionsCache = await fetchSuggestedPlayers(3);
}

async function _openFriends() {
  document.getElementById('friendSearchInput').value = '';
  document.getElementById('friendSearchResult').innerHTML = '';
  document.getElementById('friendsOv').classList.remove('hidden');
  _loadSuggestedPlayers();
  await Promise.all([_loadPendingRequests(), _loadFriendsList()]);
}

async function _loadPendingRequests() {
  const [incoming, outgoing] = await Promise.all([loadFriendRequests(), loadSentRequests()]);
  const sec = document.getElementById('pendingSection');
  const list = document.getElementById('pendingList');
  const badge = document.getElementById('friendReqBadge');
  if (badge) { badge.textContent = incoming.length; badge.style.display = incoming.length ? '' : 'none'; }
  if (!incoming.length && !outgoing.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  const inRows = incoming.map(r => `
    <div data-id="${r.id}" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(124,111,255,.15)">
      <div style="font-size:14px;font-weight:600;color:var(--text)">${r.fromNickname || '?'}</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-p" style="font-size:11px;padding:5px 12px" onclick="doAccept('${r.from}','${r.id}',this)">Accept</button>
        <button class="btn btn-s" style="font-size:11px;padding:5px 12px" onclick="doReject('${r.id}',this)">Reject</button>
      </div>
    </div>`);
  const outRows = outgoing.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(124,111,255,.15)">
      <div style="font-size:14px;font-weight:600;color:var(--text)">${r.toNickname || '?'}</div>
      <span style="font-size:11px;color:var(--muted)">Sent</span>
    </div>`);
  list.innerHTML = [...inRows, ...outRows].join('');
}

async function showFriendsFromSplash() {
  if (isAnonymousUser()) { showBindPrompt(); return; }
  if (!localStorage.getItem('cb3d_nickname')) {
    await _progressPromise;
    const displayName = _auth && _auth.currentUser && _auth.currentUser.displayName;
    if (displayName) await _autoAssignNickname(displayName);
  }
  document.getElementById('splashOv').classList.add('hidden');
  await _openFriends();
}

function hideFriends() {
  document.getElementById('friendsOv').classList.add('hidden');
  document.getElementById('splashOv').classList.remove('hidden');
}

async function _loadSuggestedPlayers() {
  const el = document.getElementById('friendSearchResult');
  el.innerHTML = '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.8px">Suggested Players</div>';
  const suggestions = _suggestionsCache !== null ? _suggestionsCache : await fetchSuggestedPlayers(3);
  if (!suggestions.length) { el.innerHTML = ''; return; }
  el.innerHTML += suggestions.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(124,111,255,.2);margin-bottom:6px">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${p.nickname}</div>
        <div style="font-size:11px;color:var(--muted)">🏆 Classic: ${p.classicBest} &nbsp;⏱ Timed: ${p.taBest}</div>
      </div>
      <button class="btn btn-p" style="font-size:12px;padding:7px 14px" onclick="doSendRequest('${p.uid}','${p.nickname}',this)">Add</button>
    </div>`).join('');
}

function onFriendSearchInput() {
  if (!document.getElementById('friendSearchInput').value.trim()) _loadSuggestedPlayers();
}

async function doFriendSearch() {
  const nick = document.getElementById('friendSearchInput').value.trim();
  const el = document.getElementById('friendSearchResult');
  if (!nick) { el.innerHTML = ''; _loadSuggestedPlayers(); return; }
  el.innerHTML = '<div style="font-size:13px;color:var(--muted)">Searching…</div>';
  const result = await searchPlayer(nick);
  if (!result) { el.innerHTML = '<div style="font-size:13px;color:var(--muted)">Player not found.</div>'; return; }
  if (result === 'self') { el.innerHTML = '<div style="font-size:13px;color:var(--muted)">That\'s you!</div>'; return; }
  const isFriend = await checkAlreadyFriends(result.uid);
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(124,111,255,.2)">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${result.nickname}</div>
      <div style="font-size:11px;color:var(--muted)">🏆 Classic: ${result.classicBest} &nbsp;⏱ Timed: ${result.taBest}</div>
    </div>
    ${isFriend
      ? '<span style="font-size:12px;color:var(--muted)">Already friends</span>'
      : `<button class="btn btn-p" style="font-size:12px;padding:7px 14px" onclick="doSendRequest('${result.uid}','${result.nickname}',this)">Add Friend</button>`}
  </div>`;
}

async function doSendRequest(uid, nickname, btn) {
  btn.disabled = true; btn.textContent = '...';
  const result = await sendFriendRequest(uid, nickname);
  logEvent('friend_request_sent', { result });
  btn.textContent = result === 'accepted' ? 'Friends!' : 'Sent!';
}

async function doAccept(fromUid, docId, btn) {
  btn.closest('[data-id]').style.opacity = '0.4';
  await acceptFriendRequest(fromUid, docId);
  logEvent('friend_request_accepted');
  await _loadPendingRequests();
  await _loadFriendsList();
}

async function doReject(docId, btn) {
  btn.closest('[data-id]').style.opacity = '0.4';
  await rejectFriendRequest(docId);
  logEvent('friend_request_rejected');
  await _loadPendingRequests();
}

async function _loadFriendsList() {
  const el = document.getElementById('friendsList');
  el.innerHTML = '<div style="font-size:13px;color:var(--muted)">Loading…</div>';
  const rows = await fetchFriendsLeaderboard('classic');
  const myNick = localStorage.getItem('cb3d_nickname');
  const friends = rows.filter(r => r.name !== myNick);
  if (!friends.length) { el.innerHTML = '<div style="font-size:13px;color:var(--muted)">No friends yet. Search above to add some!</div>'; return; }
  el.innerHTML = friends.map(f => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(124,111,255,.15)">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">${f.name}</div>
        <div style="font-size:11px;color:var(--muted)">🏆 ${f.score}</div>
      </div>
      <button class="btn btn-s" style="font-size:11px;padding:5px 12px;border-color:rgba(255,80,80,.3);color:#ff8080" onclick="doRemoveFriend('${f.uid}','${f.name}',this)">Remove</button>
    </div>`).join('');
}

async function doRemoveFriend(uid, name, btn) {
  if (!confirm('Remove ' + name + ' from friends?')) return;
  btn.disabled = true;
  logEvent('friend_removed');
  await removeFriend(uid);
  await _loadFriendsList();
}
