// 길드장님의 '환상의 나라' 전용 Firebase 마스터키
const firebaseConfig = {
    apiKey: "AIzaSyApVlmFxaeKGUDY4rtBbc7KEwbu4J5XdVM",
    authDomain: "fantasy-land-c0ffc.firebaseapp.com",
    projectId: "fantasy-land-c0ffc",
    storageBucket: "fantasy-land-c0ffc.firebasestorage.app",
    messagingSenderId: "898927815648",
    appId: "1:898927815648:web:b421a2dc4cf00425625985"
};

// Firebase 및 Firestore 데이터베이스 초기화 (호환 모드)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 전역 데이터 변수 (이제 임시저장소가 아닌 서버에서 불러옵니다)
let usersDB = [];
let mockDefenseDecks = [];
let mockAttackDecks = [];

// 로그인 유지는 기기마다 달라야 하므로 localStorage 유지
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
function saveCurrentUser() { localStorage.setItem('currentUser', JSON.stringify(currentUser)); }

// 🔄 데이터베이스 동기화 함수들
function saveUsersDB() {
    usersDB.forEach(u => db.collection('users').doc(u.id).set(u));
}

function saveDecksDB() { 
    mockDefenseDecks.forEach(d => db.collection('defenseDecks').doc(String(d.id)).set(d)); 
    mockAttackDecks.forEach(d => db.collection('attackDecks').doc(String(d.id)).set(d));
}

// ⏳ 서버에서 데이터를 불러오는 초기화 함수
async function initDB() {
    // 1. 유저 정보 불러오기
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(doc => usersDB.push(doc.data()));

    // DB가 완전히 비어있다면 최고관리자 계정 1개 생성 후 서버에 저장
    if (usersDB.length === 0) {
        const adminData = { id: 'adminadmin', pw: '54775477a.', nickname: '최고관리자', role: 'admin', status: 'approved' };
        await db.collection('users').doc(adminData.id).set(adminData);
        usersDB.push(adminData);
    }

    // 2. 방어 추천 덱 불러오기
    const defSnap = await db.collection('defenseDecks').get();
    defSnap.forEach(doc => mockDefenseDecks.push(doc.data()));

    // 3. 공격 추천 덱(상대 방어덱+카운터) 불러오기
    const attSnap = await db.collection('attackDecks').get();
    attSnap.forEach(doc => mockAttackDecks.push(doc.data()));
}

let boardSlots = [null, null, null, null, null];
let activeSlotIndex = 0; 
let currentSelectedPet = null;
let activeSlotType = 'hero'; 
let heroEquipments = {}; 
let skillQueue = []; 
let currentExCount = 1;

let viewingDeck = null; 
let viewingDeckType = 'defense'; 
let currentMainTab = 'defense'; 
let builderMode = 'defense_new'; 
let currentTargetDeckId = null;
let currentCounterDeckId = null;
let attackSortMode = 'winrate'; 
let openAccordionIds = [];

const formations = { basic: { front: 2, back: 3 }, balance: { front: 3, back: 2 }, attack: { front: 1, back: 4 }, protect: { front: 4, back: 1 } };
const exEquipOptions = ["없음", "모든 공격력(%)", "방어력(%)", "생명력(%)", "효과 적중", "효과 저항", "피해 증폭", "파쇄", "탄성", "재생"];

function resetBuilderState() {
    boardSlots = [null, null, null, null, null]; activeSlotIndex = 0; currentSelectedPet = null; activeSlotType = 'hero'; heroEquipments = {}; skillQueue = []; currentExCount = 1; viewingDeck = null; currentTargetDeckId = null; currentCounterDeckId = null; viewingDeckType = 'defense';
    document.getElementById('deckConceptSelect').value = '상관없음'; document.getElementById('deckNameInput').value = ''; document.getElementById('deckDescInput').value = ''; document.getElementById('attackDeckNameInput').value = ''; document.getElementById('formationType').value = 'basic';
}

function getMiniHeroHTML(name, type="hero") {
    const folder = type === "pet" ? "pets" : "heroes";
    return `<img src="./images/${folder}/${name}.png" class="mini-hero" title="${name}" onerror="this.src='https://via.placeholder.com/40/cccccc/ffffff?text=${name.charAt(0)}'">`;
}
function getRoleName(role) { switch(role) { case 'admin': return '관리자'; case 'master': return '길드장'; case 'elite': return '정예 길드원'; case 'user': return '길드원'; default: return '길드원'; } }
function getConceptClass(concept) { if(concept === '속공') return 'concept-sokgong'; if(concept === '속내실') return 'concept-soknaesil'; if(concept === '내실') return 'concept-naesil'; return 'concept-none'; }
function getRoleColor(role) { switch(role) { case '공격형': return '#e74c3c'; case '마법형': return '#3498db'; case '방어형': return '#8d6e63'; case '지원형': return '#f1c40f'; case '만능형': return '#9b59b6'; default: return '#9b59b6'; } }

function updateHeader() {
    const authArea = document.getElementById('headerAuthArea');
    if (currentUser) {
        let adminBtn = ['admin', 'master'].includes(currentUser.role) ? `<button onclick="toggleView('adminView')" class="btn-sm" style="background:#f39c12;">👑 길드원 관리</button>` : '';
        authArea.innerHTML = `<span style="font-size:14px;">반갑습니다, <b>${currentUser.nickname}</b>님! (${getRoleName(currentUser.role)})</span> <button onclick="openProfileModal()" class="btn-sm" style="background:#8e44ad;">👤 내 정보</button> ${adminBtn} <button onclick="attemptLogout()" class="btn-sm">로그아웃</button>`;
    } else { authArea.innerHTML = `<button onclick="toggleView('loginView')" class="btn-sm" style="background:#3498db;">로그인 / 가입</button>`; }
}

function attemptLogin() {
    const id = document.getElementById('loginId').value.trim(); const pw = document.getElementById('loginPw').value.trim();
    if(!id || !pw) return alert('아이디와 비밀번호를 입력해주세요.');
    const user = usersDB.find(u => u.id === id && u.pw === pw);
    if (!user) return alert('아이디 또는 비밀번호가 틀렸습니다.');
    if (user.status === 'pending') return alert('가입 대기 중입니다. 관리자의 승인을 기다려주세요.');
    if (user.status === 'kicked') return alert('길드에서 강퇴(탈퇴)되어 접속할 수 없습니다.');

    currentUser = user; saveCurrentUser(); alert(`환영합니다, ${user.nickname}님!`);
    document.getElementById('loginId').value = ''; document.getElementById('loginPw').value = ''; toggleView('homeView');
}

function attemptLogout() { currentUser = null; saveCurrentUser(); alert('로그아웃 되었습니다.'); toggleView('homeView'); }
function attemptSignup() {
    const id = document.getElementById('signupId').value.trim(); const pw = document.getElementById('signupPw').value.trim(); const nick = document.getElementById('signupNick').value.trim();
    if(!id || !pw || !nick) return alert('아이디, 비밀번호, 닉네임을 모두 입력해야 합니다.');
    if(usersDB.find(u => u.id === id)) return alert('이미 존재하는 아이디입니다.');
    const newUser = { id: id, pw: pw, nickname: nick, role: 'user', status: 'pending' };
    usersDB.push(newUser); 
    db.collection('users').doc(newUser.id).set(newUser); // DB에 즉시 저장
    alert('가입 신청이 완료되었습니다! 관리자의 승인 후 로그인할 수 있습니다.');
    document.getElementById('signupId').value = ''; document.getElementById('signupPw').value = ''; document.getElementById('signupNick').value = ''; toggleView('loginView');
}

function openProfileModal() { document.getElementById('newNicknameInput').value = currentUser.nickname; document.getElementById('profileModal').style.display = 'flex'; }
function closeProfileModal() { document.getElementById('profileModal').style.display = 'none'; }
function changeNickname() {
    const newNick = document.getElementById('newNicknameInput').value.trim();
    if(!newNick) return alert('새로운 닉네임을 입력해주세요.'); if(newNick === currentUser.nickname) return alert('기존 닉네임과 동일합니다.');
    const userIndex = usersDB.findIndex(u => u.id === currentUser.id); if(userIndex !== -1) usersDB[userIndex].nickname = newNick;
    mockDefenseDecks.forEach(d => { if(d.authorId === currentUser.id) d.authorNick = newNick; });
    mockAttackDecks.forEach(d => { if(d.authorId === currentUser.id) d.authorNick = newNick; d.counters.forEach(c => { if(c.authorId === currentUser.id) c.authorNick = newNick; }); });
    currentUser.nickname = newNick; saveUsersDB(); saveCurrentUser(); saveDecksDB();
    alert(`닉네임이 '${newNick}'(으)로 변경되었습니다!`); closeProfileModal(); updateHeader();
    if(document.getElementById('mainListView').style.display === 'block') switchMainTab(currentMainTab);
    if(document.getElementById('deckDetailView').style.display === 'block') document.getElementById('detailDeckAuthor').innerText = `작성자: ${newNick}`;
}

function leaveGuild() {
    if(confirm("정말 길드를 탈퇴하시겠습니까?\n탈퇴 시 계정이 삭제되며 복구할 수 없습니다.")) {
        const userIndex = usersDB.findIndex(u => u.id === currentUser.id); 
        if(userIndex !== -1) {
            db.collection('users').doc(currentUser.id).delete(); // DB 서버에서 삭제
            usersDB.splice(userIndex, 1);
        }
        currentUser = null; saveCurrentUser();
        alert("길드 탈퇴가 완료되었습니다. 그동안 감사했습니다."); closeProfileModal(); toggleView('homeView');
    }
}

function enterMenu(menu) {
    if (!currentUser) { alert('🚨 길드원 전용 메뉴입니다. 로그인을 먼저 해주세요!'); toggleView('loginView'); return; }
    if (menu === 'guildWar') toggleView('mainListView'); else alert('해당 메뉴는 준비 중입니다!');
}

function renderAdminView() {
    if(!currentUser || !['admin', 'master'].includes(currentUser.role)) { alert('접근 권한이 없습니다.'); toggleView('homeView'); return; }
    const pendingTbody = document.querySelector('#pendingUsersTable tbody'); const approvedTbody = document.querySelector('#approvedUsersTable tbody');
    pendingTbody.innerHTML = ''; approvedTbody.innerHTML = '';
    usersDB.forEach(u => {
        if(u.id === 'adminadmin') return; 
        
        if(u.status === 'pending') {
            pendingTbody.innerHTML += `<tr><td>${u.id}</td><td>${u.nickname}</td><td><span class="badge-status" style="background:#f1c40f; color:#333;">대기중</span></td><td><button class="btn-sm" style="background:#27ae60;" onclick="adminAction('${u.id}', 'approve')">승인</button> <button class="btn-sm" style="background:#c0392b;" onclick="adminAction('${u.id}', 'reject')">거절</button></td></tr>`;
        } else if(u.status === 'approved') {
            let roleDisplay = '';
            if (currentUser.role === 'admin') {
                roleDisplay = `<select onchange="adminAction('${u.id}', 'changeRole', this.value)" style="padding: 3px; font-size: 12px; outline: none; border: 1px solid #bdc3c7;"><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option><option value="master" ${u.role === 'master' ? 'selected' : ''}>길드장</option><option value="elite" ${u.role === 'elite' ? 'selected' : ''}>정예 길드원</option><option value="user" ${u.role === 'user' ? 'selected' : ''}>길드원</option></select>`;
            } else { roleDisplay = getRoleName(u.role); }
            let kickBtn = '';
            if (currentUser.role === 'admin' || (currentUser.role === 'master' && !['admin', 'master'].includes(u.role))) { kickBtn = `<button class="btn-sm" style="background:#c0392b;" onclick="adminAction('${u.id}', 'kick')">강퇴(탈퇴)</button>`; } else { kickBtn = `<span style="color:#7f8c8d; font-size:12px;">권한 없음</span>`; }
            approvedTbody.innerHTML += `<tr><td>${u.id}</td><td>${u.nickname}</td><td>${roleDisplay}</td><td>${kickBtn}</td></tr>`;
        }
    });
    if(pendingTbody.innerHTML === '') pendingTbody.innerHTML = '<tr><td colspan="4">대기 중인 인원이 없습니다.</td></tr>';
    if(approvedTbody.innerHTML === '') approvedTbody.innerHTML = '<tr><td colspan="4">관리 가능한 길드원이 없습니다.</td></tr>';
}

function adminAction(userId, action, extraValue) {
    const userIndex = usersDB.findIndex(u => u.id === userId); if(userIndex === -1) return;
    if(action === 'approve') { usersDB[userIndex].status = 'approved'; alert(`${usersDB[userIndex].nickname}님의 가입을 승인했습니다.`); saveUsersDB(); }
    else if(action === 'reject') { 
        if(confirm(`${usersDB[userIndex].nickname}님의 신청을 거절(삭제)하시겠습니까?`)) { 
            db.collection('users').doc(userId).delete(); // DB 삭제
            usersDB.splice(userIndex, 1); 
        } 
    }
    else if(action === 'kick') { 
        if(confirm(`정말 ${usersDB[userIndex].nickname}님을 강퇴시키겠습니까?\n강퇴 시 해당 아이디로 접속할 수 없습니다.`)) { 
            usersDB[userIndex].status = 'kicked'; alert('강퇴 처리되었습니다.'); saveUsersDB();
        } 
    }
    else if(action === 'changeRole') { usersDB[userIndex].role = extraValue; alert(`${usersDB[userIndex].nickname}님의 권한이 [${getRoleName(extraValue)}]로 변경되었습니다.`); saveUsersDB(); }
    renderAdminView();
}

function toggleView(viewId) {
    const views = ['homeView', 'mainListView', 'deckBuilderView', 'deckDetailView', 'loginView', 'signupView', 'adminView'];
    views.forEach(id => document.getElementById(id).style.display = 'none');
    
    document.getElementById(viewId).style.display = 'block';
    localStorage.setItem('currentView', viewId);
    updateHeader();
    
    if(viewId !== 'deckBuilderView') resetBuilderState();
    if (viewId === 'mainListView') switchMainTab(currentMainTab);
    if (viewId === 'adminView') renderAdminView(); 
}

// ⏳ 웹페이지가 열릴 때 DB를 먼저 싹 불러온 후 화면을 띄웁니다
window.onload = async function() { 
    await initDB(); 
    updateHeader();
    const savedView = localStorage.getItem('currentView') || 'homeView';
    toggleView(savedView);
};

function setAttackSortMode(mode) { attackSortMode = mode; switchMainTab('attack'); }

function toggleAccordion(deckId, element) {
    const parent = element.parentElement;
    parent.classList.toggle('open');
    if (parent.classList.contains('open')) {
        if (!openAccordionIds.includes(deckId)) openAccordionIds.push(deckId);
    } else {
        openAccordionIds = openAccordionIds.filter(id => id !== deckId);
    }
}

function switchMainTab(tabType) {
    currentMainTab = tabType;
    document.getElementById('tab-attack').classList.remove('active');
    document.getElementById('tab-defense').classList.remove('active');
    const content = document.getElementById('deckListContent');
    content.innerHTML = '';
    
    const addBtn = document.getElementById('mainAddDeckBtn');
    const sortContainer = document.getElementById('attackSortContainer');

    if(tabType === 'attack') {
        document.getElementById('tab-attack').classList.add('active');
        sortContainer.style.display = 'flex';
        document.getElementById('sortWinRateBtn').className = attackSortMode === 'winrate' ? 'sort-btn active' : 'sort-btn';
        document.getElementById('sortLatestBtn').className = attackSortMode === 'latest' ? 'sort-btn active' : 'sort-btn';
        
        const isHighRank = currentUser && ['admin', 'master', 'elite'].includes(currentUser.role);
        addBtn.style.display = isHighRank ? 'block' : 'none';
        addBtn.innerText = '+ 적 방어 덱 등록하기';

        let html = '';
        mockAttackDecks.forEach(deck => {
            const targetHtml = (deck.targetHeroes || []).filter(h=>h).map(h => getMiniHeroHTML(h)).join('');
            const canEditTarget = isHighRank || (currentUser && deck.authorId === currentUser.id);
            
            let targetEditHtml = canEditTarget ? `
                <div style="text-align: right; margin-bottom: 10px;">
                    <button class="btn-sm" style="background:#f39c12;" onclick="event.stopPropagation(); openDeckBuilder('attack_target_edit', ${deck.id})">수정</button>
                    <button class="btn-sm" style="background:#e74c3c;" onclick="event.stopPropagation(); deleteAttackTarget(${deck.id})">삭제</button>
                </div>
            ` : '';

            let sortedCounters = [...(deck.counters || [])];
            if (attackSortMode === 'winrate') {
                sortedCounters.sort((a, b) => {
                    const rateA = (a.wins + a.losses) === 0 ? 0 : a.wins / (a.wins + a.losses);
                    const rateB = (b.wins + b.losses) === 0 ? 0 : b.wins / (b.wins + b.losses);
                    if (rateB !== rateA) return rateB - rateA;
                    return (b.wins + b.losses) - (a.wins + a.losses);
                });
            } else { sortedCounters.sort((a, b) => b.createdAt - a.createdAt); }

            let counterHtml = sortedCounters.map(c => {
                const canEditCounter = isHighRank || (currentUser && c.authorId === currentUser.id);
                let counterEditHtml = canEditCounter ? `
                    <button class="btn-sm" style="background:#f39c12;" onclick="event.stopPropagation(); openDeckBuilder('attack_counter_edit', ${deck.id}, ${c.id})">수정</button>
                    <button class="btn-sm" style="background:#e74c3c;" onclick="event.stopPropagation(); deleteCounterDeck(${deck.id}, ${c.id})">삭제</button>
                ` : '';

                const isAdminMaster = currentUser && ['admin', 'master'].includes(currentUser.role);
                let adminVoteHtml = isAdminMaster ? `<button class="btn-sm" style="background:#8e44ad;" onclick="event.stopPropagation(); openAdminVoteModal(${deck.id}, ${c.id})">⚙️ 승패 임의수정</button>` : '';

                const totalGames = c.wins + c.losses;
                const winRate = totalGames === 0 ? 0 : Math.round((c.wins / totalGames) * 100);

                let rateColor = '#7f8c8d'; 
                if (totalGames > 0) {
                    if (winRate >= 80) rateColor = '#3498db'; 
                    else if (winRate >= 65) rateColor = '#27ae60'; 
                    else if (winRate >= 45) rateColor = '#f39c12'; 
                    else rateColor = '#c0392b'; 
                }

                return `
                    <div class="counter-deck" onclick="viewDeckDetail('counter', ${deck.id}, ${c.id})">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-size: 13px; font-weight: bold; color: #e74c3c; margin-bottom: 5px;">🔥 카운터 조합</div>
                                <div class="mini-hero-list">${c.heroes.filter(h=>h).map(h => getMiniHeroHTML(h)).join('')}<span style="font-size: 18px; margin: 0 5px;">+</span>${c.pet ? getMiniHeroHTML(c.pet, "pet") : ''}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size: 20px; font-weight: 900; color: ${rateColor};">${winRate}%</div>
                                <div style="font-size: 11px; color: #7f8c8d;">${c.wins}승 ${c.losses}패</div>
                            </div>
                        </div>
                        <p style="font-size: 13px; color: #555; margin-top: 10px;">💡 ${c.desc}</p>
                        <div style="text-align: right; font-size: 11px; color: #95a5a6; margin-top: 5px;">작성자: ${c.authorNick}</div>
                        <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <button class="vote-btn vote-win" onclick="event.stopPropagation(); voteCounter(${deck.id}, ${c.id}, 'win')">👍 승리</button>
                                <button class="vote-btn vote-loss" onclick="event.stopPropagation(); voteCounter(${deck.id}, ${c.id}, 'loss')">👎 패배</button>
                                ${adminVoteHtml}
                            </div>
                            <div onclick="event.stopPropagation();">${counterEditHtml}</div>
                        </div>
                    </div>
                `;
            }).join('');

            if(sortedCounters.length === 0) counterHtml = `<div style="text-align:center; color:#7f8c8d; font-size:13px; padding: 10px;">아직 등록된 카운터 덱이 없습니다.</div>`;
            
            let addCounterBtn = currentUser ? `<button class="btn" style="width:100%; margin-top:15px; background:#2ecc71; color:white;" onclick="event.stopPropagation(); openDeckBuilder('attack_counter_new', ${deck.id})">+ 카운터 덱 추가하기</button>` : '';

            const isOpenClass = openAccordionIds.includes(deck.id) ? 'open' : '';

            html += `
                <div class="deck-card ${isOpenClass}">
                    <div class="deck-card-header" onclick="toggleAccordion(${deck.id}, this)">
                        <div>
                            <span style="font-size:12px; color:#7f8c8d; font-weight:normal;">적 방어 덱</span><br>
                            <span style="color:#e74c3c;">${deck.targetName}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="mini-hero-list">${targetHtml}</div>
                            <span>▼</span>
                        </div>
                    </div>
                    <div class="deck-card-body" onclick="event.stopPropagation()">
                        ${targetEditHtml}
                        <hr style="border:0; border-top:1px dashed #ddd; margin:15px 0;">
                        ${counterHtml}
                        ${addCounterBtn}
                    </div>
                </div>
            `;
        });
        
        if(mockAttackDecks.length === 0) html += '<p style="text-align:center; padding: 20px; color: #7f8c8d;">등록된 적 방어 덱이 없습니다.</p>';
        content.innerHTML = html;

    } else {
        document.getElementById('tab-defense').classList.add('active');
        sortContainer.style.display = 'none';
        
        addBtn.style.display = 'block';
        addBtn.innerText = '+ 방어 추천 덱 추가하기';

        mockDefenseDecks.forEach(deck => {
            const heroHtml = (deck.slots || []).filter(h => h).map(h => `<img src="./images/heroes/${h}.png" class="mini-hero" onerror="this.src='https://via.placeholder.com/40'">`).join('');
            const conceptClass = getConceptClass(deck.concept);
            const petHtml = deck.pet ? `<img src="./images/pets/${deck.pet}.png" class="mini-hero" onerror="this.src='https://via.placeholder.com/40'">` : '';
            
            content.innerHTML += `
                <div class="defense-deck" onclick="viewDeckDetail('defense', ${deck.id})">
                    <div>
                        <div style="font-weight: bold; color: #2980b9; margin-bottom: 5px;">${deck.name || '이름 없는 방어 덱'} <span class="badge-concept ${conceptClass}" style="font-size:10px;">${deck.concept !== '상관없음' ? deck.concept : ''}</span></div>
                        <div style="font-size: 13px; color: #555;">💡 ${deck.desc || '설명이 없습니다.'}</div>
                    </div>
                    <div class="mini-hero-list">
                        ${heroHtml} <span style="font-size: 18px; margin: 0 5px;">+</span> ${petHtml}
                    </div>
                </div>
            `;
        });
        if(mockDefenseDecks.length === 0) content.innerHTML = '<p style="text-align:center; padding: 20px; color: #7f8c8d;">등록된 방어 덱이 없습니다.</p>';
    }
}

function viewDeckDetail(type, id1, id2) {
    viewingDeckType = type;
    const conceptBadge = document.getElementById('detailDeckConcept');
    
    if (type === 'defense') {
        viewingDeck = mockDefenseDecks.find(d => d.id === id1);
        if (!viewingDeck) return;
        document.getElementById('detailDeckTitle').innerText = viewingDeck.name || '이름 없는 방어 덱';
        if (viewingDeck.concept && viewingDeck.concept !== '상관없음') {
            conceptBadge.style.display = 'inline-block';
            conceptBadge.className = `badge-concept ${getConceptClass(viewingDeck.concept)}`;
            conceptBadge.innerText = viewingDeck.concept;
        } else { conceptBadge.style.display = 'none'; }
        currentTargetDeckId = null;
        currentCounterDeckId = null;
    } else {
        currentTargetDeckId = id1;
        currentCounterDeckId = id2;
        const target = mockAttackDecks.find(d => d.id === id1);
        viewingDeck = target ? target.counters.find(c => c.id === id2) : null;
        if (!viewingDeck) return;
        
        document.getElementById('detailDeckTitle').innerText = '🔥 카운터 덱 상세정보';
        conceptBadge.style.display = 'none'; 
    }

    document.getElementById('detailDeckDesc').innerText = viewingDeck.desc ? `💡 ${viewingDeck.desc}` : '💡 설명이 없습니다.';
    document.getElementById('detailDeckAuthor').innerText = `작성자: ${viewingDeck.authorNick || '알 수 없음'}`;

    const isAuthor = currentUser && viewingDeck.authorId === currentUser.id;
    const isHighRank = currentUser && ['admin', 'master', 'elite'].includes(currentUser.role);
    const hasPermission = isAuthor || isHighRank;

    document.getElementById('deleteDeckBtn').style.display = hasPermission ? 'inline-block' : 'none';
    document.getElementById('editDeckBtn').style.display = hasPermission ? 'inline-block' : 'none';

    renderReadonlyBoard('detailHeroBoard', 'detailPetSlot', viewingDeck);
    
    const skillDiv = document.getElementById('detailSkillQueue');
    skillDiv.innerHTML = '';
    if (viewingDeck.skills && viewingDeck.skills.length > 0) {
        viewingDeck.skills.forEach(s => {
            const text = s.replace(' 스킬 ', '<br>스킬 ');
            skillDiv.innerHTML += `<div class="skill-slot filled" style="cursor:default;">${text}</div>`;
        });
    } else {
        skillDiv.innerHTML = '<div style="color:#7f8c8d; font-size:14px; padding: 20px;">설정된 스킬 예약이 없습니다.</div>';
    }

    toggleView('deckDetailView');
}

function handleAddNewDeckBtn() {
    if (currentMainTab === 'attack') {
        if (!currentUser || !['admin', 'master', 'elite'].includes(currentUser.role)) return alert('🚨 적 방어덱 등록은 정예 길드원 이상만 가능합니다.');
        openDeckBuilder('attack_target_new');
    } else {
        if (!currentUser) return alert('로그인이 필요합니다.');
        openDeckBuilder('defense_new');
    }
}

function deleteAttackTarget(targetId) {
    if(confirm("이 적 방어 덱과 하위의 카운터 덱이 모두 삭제됩니다.\n정말 삭제하시겠습니까?")) {
        const idx = mockAttackDecks.findIndex(d => d.id === targetId);
        if(idx !== -1) {
            db.collection('attackDecks').doc(String(targetId)).delete(); // 서버에서 문서 삭제
            mockAttackDecks.splice(idx, 1);
        }
        saveDecksDB(); switchMainTab('attack');
    }
}

function deleteCounterDeck(targetId, counterId) {
    if(confirm("이 카운터 덱을 정말 삭제하시겠습니까?")) {
        const target = mockAttackDecks.find(d => d.id === targetId);
        const idx = target.counters.findIndex(c => c.id === counterId);
        if(idx !== -1) target.counters.splice(idx, 1);
        saveDecksDB(); switchMainTab('attack');
    }
}

function deleteCurrentDeck() {
    if(confirm("정말 이 덱을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) {
        if (viewingDeckType === 'defense') {
            const idx = mockDefenseDecks.findIndex(d => d.id === viewingDeck.id);
            if(idx !== -1) {
                db.collection('defenseDecks').doc(String(viewingDeck.id)).delete(); // 서버에서 삭제
                mockDefenseDecks.splice(idx, 1);
            }
        } else {
            const target = mockAttackDecks.find(d => d.id === currentTargetDeckId);
            const idx = target.counters.findIndex(c => c.id === viewingDeck.id);
            if(idx !== -1) target.counters.splice(idx, 1);
        }
        saveDecksDB(); 
        alert("✅ 덱이 정상적으로 삭제되었습니다.");
        resetBuilderState();
        toggleView('mainListView');
    }
}

function editCurrentDeck() { 
    if (viewingDeckType === 'defense') openDeckBuilder('defense_edit');
    else openDeckBuilder('attack_counter_edit', currentTargetDeckId, viewingDeck.id);
}

function voteCounter(targetId, counterId, type) {
    if (!currentUser) return alert("로그인이 필요합니다.");
    const target = mockAttackDecks.find(d => d.id === targetId);
    const counter = target.counters.find(c => c.id === counterId);

    const isHighRank = ['admin', 'master'].includes(currentUser.role);
    if (!isHighRank) {
        const lastVoteTime = counter.votes ? counter.votes[currentUser.id] : 0;
        if (lastVoteTime && (Date.now() - lastVoteTime) < 48 * 60 * 60 * 1000) {
            return alert("승패 기록은 48시간에 한 번만 투표할 수 있습니다.");
        }
    }

    if (!counter.votes) counter.votes = {};
    counter.votes[currentUser.id] = Date.now();

    if (type === 'win') counter.wins = (counter.wins || 0) + 1;
    else counter.losses = (counter.losses || 0) + 1;

    saveDecksDB(); // DB 자동 업데이트
    switchMainTab('attack'); 
}

let adminVoteTargetId = null; let adminVoteCounterId = null;
function openAdminVoteModal(targetId, counterId) {
    const target = mockAttackDecks.find(d => d.id === targetId);
    const counter = target.counters.find(c => c.id === counterId);
    document.getElementById('adminWinsInput').value = counter.wins || 0;
    document.getElementById('adminLossesInput').value = counter.losses || 0;
    adminVoteTargetId = targetId; adminVoteCounterId = counterId;
    document.getElementById('adminVoteModal').style.display = 'flex';
}
function closeAdminVoteModal() { document.getElementById('adminVoteModal').style.display = 'none'; }
function saveAdminVote() {
    const target = mockAttackDecks.find(d => d.id === adminVoteTargetId);
    const counter = target.counters.find(c => c.id === adminVoteCounterId);
    counter.wins = parseInt(document.getElementById('adminWinsInput').value, 10) || 0;
    counter.losses = parseInt(document.getElementById('adminLossesInput').value, 10) || 0;
    saveDecksDB(); closeAdminVoteModal(); switchMainTab('attack');
}

function openDeckBuilder(mode, targetId = null, counterId = null) {
    resetBuilderState();
    builderMode = mode;
    currentTargetDeckId = targetId;
    currentCounterDeckId = counterId;

    const attackNameContainer = document.getElementById('attackDeckNameContainer');
    const deckNameContainer = document.getElementById('deckNameContainer');
    const conceptContainer = document.getElementById('conceptContainer');
    const detailTabBtn = document.getElementById('b-tab-detail');
    const nextBtn = document.getElementById('builderNextBtn');
    const saveAtConfigBtn = document.getElementById('builderSaveBtnAtConfig');
    const builderTitle = document.getElementById('builderTitle');

    if (mode.startsWith('attack_target')) {
        attackNameContainer.style.display = 'block'; deckNameContainer.style.display = 'none'; conceptContainer.style.display = 'none'; detailTabBtn.style.display = 'none'; nextBtn.style.display = 'none'; saveAtConfigBtn.style.display = 'inline-block';
        builderTitle.innerText = mode === 'attack_target_edit' ? '🛠️ 적 방어 덱 수정' : '🛠️ 적 방어 덱 등록';
        if (mode === 'attack_target_edit') {
            const target = mockAttackDecks.find(d => d.id === targetId);
            document.getElementById('attackDeckNameInput').value = target.targetName;
            document.getElementById('formationType').value = target.formation || 'basic';
            boardSlots = [...(target.targetHeroes || [])]; currentSelectedPet = target.targetPet;
        }
    } else if (mode.startsWith('attack_counter')) {
        attackNameContainer.style.display = 'none'; deckNameContainer.style.display = 'none'; conceptContainer.style.display = 'none'; detailTabBtn.style.display = 'block'; nextBtn.style.display = 'inline-block'; saveAtConfigBtn.style.display = 'none';
        builderTitle.innerText = mode === 'attack_counter_edit' ? '🛠️ 카운터 덱 수정' : '🛠️ 카운터 덱 등록';
        if (mode === 'attack_counter_edit') {
            const target = mockAttackDecks.find(d => d.id === targetId);
            const counter = target.counters.find(c => c.id === counterId);
            document.getElementById('formationType').value = counter.formation || 'basic';
            boardSlots = [...(counter.heroes || [])]; currentSelectedPet = counter.pet;
            document.getElementById('deckDescInput').value = counter.desc || '';
            heroEquipments = JSON.parse(JSON.stringify(counter.equips || {})); skillQueue = [...(counter.skills || [])];
        }
    } else {
        attackNameContainer.style.display = 'none'; deckNameContainer.style.display = 'block'; conceptContainer.style.display = 'block'; detailTabBtn.style.display = 'block'; nextBtn.style.display = 'inline-block'; saveAtConfigBtn.style.display = 'none';
        builderTitle.innerText = mode === 'defense_edit' ? '🛠️ 방어 덱 수정' : '🛠️ 방어 추천 덱 구성';
        if (mode === 'defense_edit') {
            document.getElementById('formationType').value = viewingDeck.formation || 'basic'; boardSlots = [...(viewingDeck.slots || [])]; currentSelectedPet = viewingDeck.pet;
            document.getElementById('deckNameInput').value = viewingDeck.name || ''; document.getElementById('deckDescInput').value = viewingDeck.desc || ''; document.getElementById('deckConceptSelect').value = viewingDeck.concept || '상관없음';
            heroEquipments = JSON.parse(JSON.stringify(viewingDeck.equips || {})); skillQueue = [...(viewingDeck.skills || [])];
        }
    }
    
    toggleView('deckBuilderView');
    switchBuilderTab('config');
}

function switchBuilderTab(tab) {
    if (tab === 'detail' && boardSlots.filter(h => h !== null).length === 0) return alert('🚨 최소 1명의 영웅을 배치해야 합니다.');
    document.getElementById('b-tab-config').classList.remove('active'); document.getElementById('b-tab-detail').classList.remove('active');
    document.getElementById('builderConfigSection').style.display = 'none'; document.getElementById('builderDetailSection').style.display = 'none';

    if(tab === 'config') {
        document.getElementById('b-tab-config').classList.add('active'); document.getElementById('builderConfigSection').style.display = 'block'; activeSlotType = 'hero'; renderBuilderBoard(); applyFilters();
    } else {
        document.getElementById('b-tab-detail').classList.add('active'); document.getElementById('builderDetailSection').style.display = 'block';
        const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments };
        renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true);
        renderAvailableSkills();
    }
}

function renderReadonlyBoard(boardId, petId, deckData, isEditMode = false) {
    if (!deckData) return;
    const formationType = deckData.formation || 'basic'; 
    const layout = formations[formationType];
    const slotsData = deckData.slots || deckData.heroes || [null, null, null, null, null];

    let html = '';
    ['후열', '전열'].forEach((lineName, lineIdx) => {
        html += `<div class="formation-line"><div class="line-title">${lineName}</div>`;
        const start = lineIdx === 0 ? layout.front : 0; const end = lineIdx === 0 ? 5 : layout.front;
        for(let i = start; i < end; i++) {
            const h = slotsData[i];
            const eqClass = (deckData.equips && deckData.equips[h]) ? 'has-equip' : '';
            let roleStr = ''; if(h) { const heroInfo = heroData.find(x => x.name === h); if(heroInfo) roleStr = heroInfo.role; }
            const bColor = getRoleColor(roleStr);

            if(h) { html += `<div class="hero-slot filled ${eqClass}" style="border-color: ${bColor};" onclick="openEquipModal('${h}', ${!isEditMode})"><img src="./images/heroes/${h}.png" onerror="this.src='https://via.placeholder.com/75'"><div class="equip-badge">E</div></div>`; } 
            else { html += `<div class="hero-slot">빈자리</div>`; }
        }
        html += '</div>';
    });
    document.getElementById(boardId).innerHTML = html;
    const p = deckData.pet; document.getElementById(petId).innerHTML = p ? `<img src="./images/pets/${p}.png" onerror="this.src='https://via.placeholder.com/80'">` : '펫 없음';
}

function renderAvailableSkills() {
    const container = document.getElementById('availableSkills'); container.innerHTML = '';
    const heroes = boardSlots.filter(h => h !== null);
    skillQueue = skillQueue.filter(s => heroes.some(h => s.startsWith(h)));
    heroes.forEach(h => {
        if (h === '세인') { container.innerHTML += `<button class="skill-btn" onclick="addSkill('${h}', 2)">${h} 스킬 2</button>`; } 
        else { container.innerHTML += `<button class="skill-btn" onclick="addSkill('${h}', 1)">${h} 스킬 1</button><button class="skill-btn" onclick="addSkill('${h}', 2)">${h} 스킬 2</button>`; }
    });
    renderSkillQueue();
}
function addSkill(hero, skillNum) {
    if (skillQueue.length >= 3) return alert('🚨 스킬 예약은 최대 3개까지만 가능합니다.');
    const skillName = `${hero} 스킬 ${skillNum}`;
    if (skillQueue.includes(skillName)) return alert('🚨 이미 예약된 스킬입니다.');
    skillQueue.push(skillName); renderSkillQueue();
}
function removeSkill(index) { if (index < skillQueue.length) { skillQueue.splice(index, 1); renderSkillQueue(); } }
function renderSkillQueue() {
    const queueDiv = document.getElementById('skillQueue'); let html = '';
    for (let i = 0; i < 3; i++) {
        if (i < skillQueue.length) { const text = skillQueue[i].replace(' 스킬 ', '<br>스킬 '); html += `<div class="skill-slot filled" onclick="removeSkill(${i})">${text}</div>`; } 
        else { html += `<div class="skill-slot" onclick="removeSkill(${i})">${i+1}순위</div>`; }
    }
    queueDiv.innerHTML = html;
}

function clickSlot(index) { activeSlotType = 'hero'; if (boardSlots[index]) boardSlots[index] = null; else activeSlotIndex = index; renderBuilderBoard(); applyFilters(); }
function clickPetSlot() { activeSlotType = 'pet'; if(currentSelectedPet) currentSelectedPet = null; renderBuilderBoard(); applyFilters(); }
function selectHero(heroName) {
    if (boardSlots.includes(heroName)) return boardSlots[boardSlots.indexOf(heroName)] = null, renderBuilderBoard();
    if (boardSlots.filter(h => h).length >= 3) return alert('최대 3명만 배치 가능합니다!');
    if (!boardSlots[activeSlotIndex]) boardSlots[activeSlotIndex] = heroName;
    else { const firstEmpty = boardSlots.findIndex(h => !h); if (firstEmpty !== -1) boardSlots[firstEmpty] = heroName, activeSlotIndex = firstEmpty; }
    const nextEmpty = boardSlots.findIndex(h => !h); if (nextEmpty !== -1) activeSlotIndex = nextEmpty;
    renderBuilderBoard();
}
function selectPet(petName) { currentSelectedPet = petName; renderBuilderBoard(); }

function renderBuilderBoard() {
    const layout = formations[document.getElementById('formationType').value];
    let html = '';
    ['후열', '전열'].forEach((lineName, lineIdx) => {
        html += `<div class="formation-line"><div class="line-title">${lineName}</div>`;
        const start = lineIdx === 0 ? layout.front : 0; const end = lineIdx === 0 ? 5 : layout.front;
        for(let i = start; i < end; i++) {
            const h = boardSlots[i];
            const isActive = (i === activeSlotIndex && !h && activeSlotType === 'hero') ? 'active-slot' : '';
            let roleStr = ''; if(h) { const heroInfo = heroData.find(x => x.name === h); if(heroInfo) roleStr = heroInfo.role; }
            const bColor = getRoleColor(roleStr);
            html += h ? `<div class="hero-slot filled" style="border-color: ${bColor};" onclick="clickSlot(${i})"><img src="./images/heroes/${h}.png" onerror="this.src='https://via.placeholder.com/75'"></div>` 
                      : `<div class="hero-slot ${isActive}" onclick="clickSlot(${i})"><span style="color:${isActive?'#c0392b':'#7f8c8d'};">선택</span></div>`;
        }
        html += '</div>';
    });
    document.getElementById('builderHeroBoard').innerHTML = html;
    const pSlot = document.getElementById('builderPetSlot');
    if (currentSelectedPet) { pSlot.className = 'pet-slot filled'; pSlot.innerHTML = `<img src="./images/pets/${currentSelectedPet}.png" onerror="this.src='https://via.placeholder.com/80'">`; } 
    else { pSlot.className = `pet-slot ${activeSlotType === 'pet' ? 'active-slot' : ''}`; pSlot.innerHTML = `<div class="pet-slot-title">펫 슬롯</div>`; }
}

function applyFilters() {
    const pool = document.getElementById('charPool'); const searchText = document.getElementById('searchInput').value.trim().toLowerCase(); pool.innerHTML = '';
    if (activeSlotType === 'hero') {
        document.getElementById('raritySelect').style.display = 'inline-block'; document.getElementById('roleSelect').style.display = 'inline-block';
        const sortType = document.getElementById('sortSelect').value, filterRarity = document.getElementById('raritySelect').value, filterRole = document.getElementById('roleSelect').value;
        let filtered = heroData.filter(c => c.name.toLowerCase().includes(searchText) && (filterRarity==='all'||c.rarity===filterRarity) && (filterRole==='all'||c.role===filterRole));
        filtered.sort((a,b) => sortType==='rarity' ? (rarityRank[a.rarity]-rarityRank[b.rarity] || a.name.localeCompare(b.name)) : a.name.localeCompare(b.name));
        filtered.forEach(c => { pool.innerHTML += `<div class="char-card" onclick="selectHero('${c.name}')"><div class="badge badge-${c.rarity}">${c.rarity}</div><img src="./images/heroes/${c.name}.png" onerror="this.src='https://via.placeholder.com/60'"><div class="char-name">${c.name}</div></div>`; });
    } else {
        document.getElementById('raritySelect').style.display = 'none'; document.getElementById('roleSelect').style.display = 'none';
        let filtered = petData.filter(p => p.name.toLowerCase().includes(searchText)).sort((a,b)=>a.name.localeCompare(b.name));
        filtered.forEach(p => { pool.innerHTML += `<div class="char-card" onclick="selectPet('${p.name}')"><div class="badge badge-펫">펫</div><img src="./images/pets/${p.name}.png" onerror="this.src='https://via.placeholder.com/60'"><div class="char-name">${p.name}</div></div>`; });
    }
}

function renderExFields(values = []) {
    const container = document.getElementById('exContainer'); container.innerHTML = '';
    currentExCount = values.length > 0 ? values.length : 1;
    for(let i=0; i<currentExCount; i++) container.innerHTML += createExSelectHTML(i, values[i] || '없음');
    updateAddExBtn();
}
function createExSelectHTML(index, val) {
    let options = exEquipOptions.map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
    return `<select id="eqEx${index}" class="ex-select">${options}</select>`;
}
function addExField() { if(currentExCount < 4) { document.getElementById('exContainer').insertAdjacentHTML('beforeend', createExSelectHTML(currentExCount, '없음')); currentExCount++; updateAddExBtn(); } }
function updateAddExBtn() { document.getElementById('addExBtn').style.display = currentExCount >= 4 ? 'none' : 'inline-block'; }

let currentEditingHero = null;
function openEquipModal(heroName, isReadOnly) {
    currentEditingHero = heroName; 
    document.getElementById('equipModalTitle').innerText = `${heroName} 장비 세팅`; 
    document.getElementById('saveEquipBtn').style.display = isReadOnly ? 'none' : 'inline-block';
    
    const safeEquips = isReadOnly ? ((viewingDeck && viewingDeck.equips) || {}) : (heroEquipments || {});
    const eq = safeEquips[heroName] || {};
    
    document.getElementById('eqSet').value = eq.set || '없음'; 
    document.getElementById('eqMain').value = eq.mainOpt || ''; 
    document.getElementById('eqAccMain').value = eq.accMain || '없음'; 
    document.getElementById('eqAccSub').value = eq.accSub || '없음';
    
    renderExFields(eq.ex || []);
    
    if(isReadOnly) {
        document.getElementById('addExBtn').style.display = 'none';
    } else {
        document.getElementById('addExBtn').style.display = currentExCount >= 4 ? 'none' : 'inline-block';
    }

    const inputs = document.querySelectorAll('.equip-form select, .equip-form input'); 
    inputs.forEach(input => input.disabled = isReadOnly);
    
    document.getElementById('equipModal').style.display = 'flex';
}

function closeEquipModal() { document.getElementById('equipModal').style.display = 'none'; }
function saveEquipData() {
    const exValues = []; for(let i=0; i<currentExCount; i++) exValues.push(document.getElementById(`eqEx${i}`).value);
    heroEquipments[currentEditingHero] = { set: document.getElementById('eqSet').value, mainOpt: document.getElementById('eqMain').value, accMain: document.getElementById('eqAccMain').value, accSub: document.getElementById('eqAccSub').value, ex: exValues };
    closeEquipModal(); const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments };
    renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true);
}

function saveDeck() {
    if (builderMode.startsWith('attack_target')) {
        const targetName = document.getElementById('attackDeckNameInput').value.trim();
        if(!targetName) return alert('적 방어 덱 이름을 입력해주세요.');
        if(boardSlots.filter(h => h !== null).length === 0) return alert("🚨 최소 1명 이상의 영웅을 배치해주세요.");
        
        if (builderMode === 'attack_target_edit') {
            const target = mockAttackDecks.find(d => d.id === currentTargetDeckId);
            target.targetName = targetName; target.formation = document.getElementById('formationType').value; target.targetHeroes = [...boardSlots]; target.targetPet = currentSelectedPet;
            alert(`✅ '${targetName}' 덱이 성공적으로 수정되었습니다!`);
        } else {
            mockAttackDecks.push({ id: Date.now(), targetName: targetName, formation: document.getElementById('formationType').value, targetHeroes: [...boardSlots], targetPet: currentSelectedPet, counters: [], authorId: currentUser.id, authorNick: currentUser.nickname });
            alert(`✅ 적 방어 덱 '${targetName}'이(가) 등록되었습니다!`);
        }
        saveDecksDB(); toggleView('mainListView'); return;
    }

    if (builderMode.startsWith('attack_counter')) {
        const target = mockAttackDecks.find(d => d.id === currentTargetDeckId);
        const deckDesc = document.getElementById('deckDescInput').value.trim();
        if (builderMode === 'attack_counter_edit') {
            const counter = target.counters.find(c => c.id === currentCounterDeckId);
            counter.desc = deckDesc; counter.formation = document.getElementById('formationType').value; counter.heroes = [...boardSlots]; counter.pet = currentSelectedPet; counter.equips = JSON.parse(JSON.stringify(heroEquipments)); counter.skills = [...skillQueue];
            alert(`✅ 카운터 덱이 성공적으로 수정되었습니다!`);
        } else {
            target.counters.push({ id: Date.now(), desc: deckDesc, formation: document.getElementById('formationType').value, heroes: [...boardSlots], pet: currentSelectedPet, equips: JSON.parse(JSON.stringify(heroEquipments)), skills: [...skillQueue], authorId: currentUser.id, authorNick: currentUser.nickname, wins: 0, losses: 0, createdAt: Date.now(), votes: {} });
            alert(`✅ 카운터 덱이 성공적으로 등록되었습니다!`);
        }
        saveDecksDB(); toggleView('mainListView'); return;
    }

    const deckName = document.getElementById('deckNameInput').value.trim() || '이름 없는 방어 덱';
    const deckDesc = document.getElementById('deckDescInput').value.trim();
    const deckConcept = document.getElementById('deckConceptSelect').value;

    if(builderMode === 'defense_edit' && viewingDeck) {
        viewingDeck.name = deckName; viewingDeck.desc = deckDesc; viewingDeck.concept = deckConcept; viewingDeck.formation = document.getElementById('formationType').value; viewingDeck.slots = [...boardSlots]; viewingDeck.pet = currentSelectedPet; viewingDeck.equips = JSON.parse(JSON.stringify(heroEquipments)); viewingDeck.skills = [...skillQueue];
        alert(`✅ '${deckName}' 덱이 성공적으로 수정되었습니다!`);
    } else {
        mockDefenseDecks.push({ id: Date.now(), name: deckName, desc: deckDesc, concept: deckConcept, formation: document.getElementById('formationType').value, slots: [...boardSlots], pet: currentSelectedPet, equips: JSON.parse(JSON.stringify(heroEquipments)), skills: [...skillQueue], authorId: currentUser.id, authorNick: currentUser.nickname });
        alert(`✅ '${deckName}' 덱이 성공적으로 추가되었습니다!`);
    }
    saveDecksDB(); toggleView('mainListView');
}