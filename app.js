// 길드장님의 '환상의 나라' 전용 Firebase 마스터키
const firebaseConfig = {
    apiKey: "AIzaSyApVlmFxaeKGUDY4rtBbc7KEwbu4J5XdVM",
    authDomain: "fantasy-land-c0ffc.firebaseapp.com",
    projectId: "fantasy-land-c0ffc",
    storageBucket: "fantasy-land-c0ffc.firebasestorage.app",
    messagingSenderId: "898927815648",
    appId: "1:898927815648:web:b421a2dc4cf00425625985"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 💡 전역 권한 설정 변수 (추가/관리 분리)
const roleWeight = { 'admin': 4, 'master': 3, 'elite': 2, 'user': 1 };
let permConfig = {
    castleAdd: 'master', castleManage: 'admin',
    gwTargetAdd: 'elite', gwTargetManage: 'master',
    gwDefenseAdd: 'user', gwDefenseManage: 'elite',
    gwCounterAdd: 'user', gwCounterManage: 'elite',
    raidAdd: 'elite', raidManage: 'master'
};

function hasPerm(feature) {
    if (!currentUser) return false;
    const reqRole = permConfig[feature] || 'admin';
    return roleWeight[currentUser.role] >= roleWeight[reqRole];
}

// 전역 데이터 변수
let usersDB = [];
let mockDefenseDecks = [];
let mockAttackDecks = [];
let mockCastleDecks = [];
let mockRaidDecks = [];

const dayNames = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 0: '일' };

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
function saveCurrentUser() { localStorage.setItem('currentUser', JSON.stringify(currentUser)); }

function saveUsersDB() { usersDB.forEach(u => db.collection('users').doc(u.id).set(u)); }
function saveDecksDB() { 
    mockDefenseDecks.forEach(d => db.collection('defenseDecks').doc(String(d.id)).set(d)); 
    mockAttackDecks.forEach(d => db.collection('attackDecks').doc(String(d.id)).set(d));
    mockCastleDecks.forEach(d => db.collection('castleDecks').doc(String(d.id)).set(d)); 
    mockRaidDecks.forEach(d => db.collection('raidDecks').doc(String(d.id)).set(d)); 
}

async function initDB() {
    try {
        // 💡 동적 권한 설정 불러오기
        const permSnap = await db.collection('settings').doc('permissions').get();
        if (permSnap.exists) { permConfig = permSnap.data(); } 
        else { await db.collection('settings').doc('permissions').set(permConfig); }

        const usersSnap = await db.collection('users').get();
        usersSnap.forEach(doc => usersDB.push(doc.data()));
        if (!usersDB.find(u => u.id === 'adminadmin')) {
            const adminData = { id: 'adminadmin', pw: '54775477a.', nickname: '최고관리자', role: 'admin', status: 'approved' };
            await db.collection('users').doc(adminData.id).set(adminData);
            usersDB.push(adminData);
        }
        const defSnap = await db.collection('defenseDecks').get(); defSnap.forEach(doc => mockDefenseDecks.push(doc.data()));
        const attSnap = await db.collection('attackDecks').get(); attSnap.forEach(doc => mockAttackDecks.push(doc.data()));
        const castleSnap = await db.collection('castleDecks').get(); castleSnap.forEach(doc => mockCastleDecks.push(doc.data()));
        const raidSnap = await db.collection('raidDecks').get(); raidSnap.forEach(doc => mockRaidDecks.push(doc.data()));
    } catch (error) { console.error("Firebase 연결 오류:", error); } finally { updateHeader(); toggleView('homeView'); }
}
window.onload = function() { initDB(); };

// 빌더 변수
let boardSlots = [null, null, null, null, null];
let activeSlotIndex = 0; 
let currentSelectedPet = null;
let activeSlotType = 'hero'; 
let heroEquipments = {}; 
let skillQueue = []; 
let currentExCount = 1;

let currentRaidRound = 1; 
let raidDataBuffer = {
    1: { slots: [null,null,null,null,null], pet: null, equips: {}, formation: 'basic', skills: [] },
    2: { slots: [null,null,null,null,null], pet: null, equips: {}, formation: 'basic', skills: [] }
};

let viewingDeck = null; 
let viewingDeckType = 'defense'; 
let currentMainTab = 'defense'; 
let builderMode = 'defense_new'; 
let currentTargetDeckId = null;
let currentCounterDeckId = null;
let currentCastleDay = 1; 
let currentRaidBoss = '태오';
let attackSortMode = 'winrate'; 
let openAccordionIds = [];

const formations = { basic: { front: 2, back: 3 }, balance: { front: 3, back: 2 }, attack: { front: 1, back: 4 }, protect: { front: 4, back: 1 } };
const exEquipOptions = ["없음", "모든 공격력(%)", "방어력(%)", "생명력(%)", "효과 적중", "효과 저항", "피해 증폭", "파쇄", "탄성", "재생"];

function resetBuilderState() {
    boardSlots = [null, null, null, null, null]; activeSlotIndex = 0; currentSelectedPet = null; activeSlotType = 'hero'; heroEquipments = {}; skillQueue = []; currentExCount = 1; viewingDeck = null; currentTargetDeckId = null; currentCounterDeckId = null; viewingDeckType = 'defense';
    raidDataBuffer = { 1: { slots: [null,null,null,null,null], pet: null, equips: {}, formation: 'basic', skills: [] }, 2: { slots: [null,null,null,null,null], pet: null, equips: {}, formation: 'basic', skills: [] } }; currentRaidRound = 1;
    document.getElementById('deckConceptSelect').value = '상관없음'; document.getElementById('deckNameInput').value = ''; document.getElementById('deckDescInput').value = ''; document.getElementById('attackDeckNameInput').value = ''; document.getElementById('formationType').value = 'basic'; document.getElementById('deckSpeedOrderInput').value = '';
    const rSpeed1 = document.getElementById('raidSpeed1'); if(rSpeed1) rSpeed1.value = '';
    const rSpeed2 = document.getElementById('raidSpeed2'); if(rSpeed2) rSpeed2.value = '';
}

function getMiniHeroHTML(name, type="hero") {
    const folder = type === "pet" ? "pets" : "heroes";
    return `<img loading="lazy" src="./images/${folder}/${name}.png" class="mini-hero" title="${name}" onerror="this.src='https://via.placeholder.com/40/cccccc/ffffff?text=${name.charAt(0)}'">`;
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
    
    currentUser = user; 
    currentUser.lastLogin = Date.now(); 
    saveCurrentUser(); 
    db.collection('users').doc(currentUser.id).update({ lastLogin: currentUser.lastLogin }); 
    logActivity('길드 웹사이트에 접속(로그인) 했습니다.'); 
    
    alert(`환영합니다, ${user.nickname}님!`);
    document.getElementById('loginId').value = ''; document.getElementById('loginPw').value = ''; toggleView('homeView');
}

function attemptLogout() { 
    logActivity('길드 웹사이트에서 로그아웃 했습니다.');
    currentUser = null; 
    saveCurrentUser(); 
    alert('로그아웃 되었습니다.'); 
    toggleView('homeView'); 
}

function attemptSignup() {
    const id = document.getElementById('signupId').value.trim(); const pw = document.getElementById('signupPw').value.trim(); const nick = document.getElementById('signupNick').value.trim();
    if(!id || !pw || !nick) return alert('아이디, 비밀번호, 닉네임을 모두 입력해야 합니다.');
    if(usersDB.find(u => u.id === id)) return alert('이미 존재하는 아이디입니다.');
    const newUser = { id: id, pw: pw, nickname: nick, role: 'user', status: 'pending' };
    usersDB.push(newUser); db.collection('users').doc(newUser.id).set(newUser);
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
    mockCastleDecks.forEach(d => { if(d.authorId === currentUser.id) d.authorNick = newNick; });
    mockRaidDecks.forEach(d => { if(d.authorId === currentUser.id) d.authorNick = newNick; });
    currentUser.nickname = newNick; saveUsersDB(); saveCurrentUser(); saveDecksDB();
    alert(`닉네임이 '${newNick}'(으)로 변경되었습니다!`); closeProfileModal(); updateHeader();
    if(document.getElementById('mainListView').style.display === 'block') switchMainTab(currentMainTab);
    if(document.getElementById('castleView').style.display === 'block') renderCastleTab(currentCastleDay);
    if(document.getElementById('raidView').style.display === 'block') renderRaidTab(currentRaidBoss);
    if(document.getElementById('deckDetailView').style.display === 'block') document.getElementById('detailDeckAuthor').innerText = `작성자: ${newNick}`;
}

function leaveGuild() {
    if(confirm("정말 길드를 탈퇴하시겠습니까?\n탈퇴 시 계정이 삭제되며 복구할 수 없습니다.")) {
        const userIndex = usersDB.findIndex(u => u.id === currentUser.id); 
        if(userIndex !== -1) { db.collection('users').doc(currentUser.id).delete(); usersDB.splice(userIndex, 1); }
        currentUser = null; saveCurrentUser();
        alert("길드 탈퇴가 완료되었습니다. 그동안 감사했습니다."); closeProfileModal(); toggleView('homeView');
    }
}

function enterMenu(menu) {
    if (!currentUser) { alert('🚨 길드원 전용 메뉴입니다. 로그인을 먼저 해주세요!'); toggleView('loginView'); return; }
    
    if (menu === 'guildWar') { toggleView('mainListView'); } 
    else if (menu === 'castle') { toggleView('castleView'); renderCastleTab(new Date().getDay()); }
    else if (menu === 'raid') { toggleView('raidView'); renderRaidTab('태오'); }
    else alert('해당 메뉴는 준비 중입니다!');
}

let currentUserPage = 1;
const usersPerPage = 10;

function changeUserPage(delta) {
    currentUserPage += delta;
    renderAdminView();
}

function renderAdminView() {
    if(!currentUser || !['admin', 'master'].includes(currentUser.role)) { alert('접근 권한이 없습니다.'); toggleView('homeView'); return; }
    
    const permModalBtn = document.getElementById('adminPermModalBtn');
    if (permModalBtn) {
        permModalBtn.style.display = ['admin', 'master'].includes(currentUser.role) ? 'inline-block' : 'none';
    }

    const pendingTbody = document.querySelector('#pendingUsersTable tbody'); const approvedTbody = document.querySelector('#approvedUsersTable tbody');
    pendingTbody.innerHTML = ''; approvedTbody.innerHTML = '';
    
    usersDB.forEach(u => {
        if(u.id === 'adminadmin') return; 
        if(u.status === 'pending') {
            pendingTbody.innerHTML += `<tr><td>${u.id}</td><td>${u.nickname}</td><td><span class="badge-status" style="background:#f1c40f; color:#333;">대기중</span></td><td><button class="btn-sm" style="background:#27ae60;" onclick="adminAction('${u.id}', 'approve')">승인</button> <button class="btn-sm" style="background:#c0392b;" onclick="adminAction('${u.id}', 'reject')">거절</button></td></tr>`;
        }
    });

    let approvedUsers = usersDB.filter(u => u.id !== 'adminadmin' && u.status === 'approved');
    const sortSelect = document.getElementById('userSortSelect');
    const sortType = sortSelect ? sortSelect.value : 'join_asc';

    approvedUsers.sort((a, b) => {
        if (sortType.startsWith('name')) {
            return sortType.endsWith('asc') ? a.nickname.localeCompare(b.nickname) : b.nickname.localeCompare(a.nickname);
        } else if (sortType.startsWith('role')) {
            return sortType.endsWith('asc') ? roleWeight[b.role] - roleWeight[a.role] : roleWeight[a.role] - roleWeight[b.role];
        } else {
            const idxA = usersDB.indexOf(a); const idxB = usersDB.indexOf(b);
            return sortType.endsWith('asc') ? idxA - idxB : idxB - idxA;
        }
    });

    const totalPages = Math.ceil(approvedUsers.length / usersPerPage) || 1;
    if (currentUserPage < 1) currentUserPage = 1;
    if (currentUserPage > totalPages) currentUserPage = totalPages;

    const startIndex = (currentUserPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const pageUsers = approvedUsers.slice(startIndex, endIndex);

    pageUsers.forEach(u => {
        let roleDisplay = '';
        if (currentUser.role === 'admin') { 
            roleDisplay = `<select onchange="adminAction('${u.id}', 'changeRole', this.value)" style="padding: 3px; font-size: 12px; outline: none; border: 1px solid #bdc3c7;"><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option><option value="master" ${u.role === 'master' ? 'selected' : ''}>길드장</option><option value="elite" ${u.role === 'elite' ? 'selected' : ''}>정예 길드원</option><option value="user" ${u.role === 'user' ? 'selected' : ''}>길드원</option></select>`; 
        } else { 
            roleDisplay = getRoleName(u.role); 
        }
        
        const canManage = roleWeight[currentUser.role] > roleWeight[u.role];
        const canViewLog = roleWeight[currentUser.role] >= roleWeight[u.role];
        
        let manageBtns = '<div style="display:flex; flex-direction:row; gap:5px; justify-content:center;">';
        if (canManage) manageBtns += `<button class="btn-sm" style="background:#3498db; margin:0;" onclick="adminAction('${u.id}', 'changeNick')">✏️ 닉네임</button>`;
        if (canViewLog) manageBtns += `<button class="btn-sm" style="background:#27ae60; margin:0;" onclick="viewUserLogs('${u.id}')">📋 로그</button>`;
        if (canManage) manageBtns += `<button class="btn-sm" style="background:#c0392b; margin:0;" onclick="adminAction('${u.id}', 'kick')">🚪 강퇴</button>`;
        manageBtns += '</div>';

        if (!canManage && !canViewLog) { manageBtns = `<span style="color:#7f8c8d; font-size:12px;">권한 없음</span>`; }
        approvedTbody.innerHTML += `<tr><td>${u.id}</td><td>${u.nickname}</td><td>${roleDisplay}</td><td>${manageBtns}</td></tr>`;
    });

    if(pendingTbody.innerHTML === '') pendingTbody.innerHTML = '<tr><td colspan="4">대기 중인 인원이 없습니다.</td></tr>';
    if(approvedTbody.innerHTML === '') approvedTbody.innerHTML = '<tr><td colspan="4">관리 가능한 길드원이 없습니다.</td></tr>';

    const prevBtn = document.getElementById('userPrevBtn');
    const nextBtn = document.getElementById('userNextBtn');
    const pageInfo = document.getElementById('userPageInfo');
    
    if (prevBtn && nextBtn && pageInfo) {
        pageInfo.innerText = `${currentUserPage} / ${totalPages}`;
        pageInfo.style.display = approvedUsers.length > 0 ? 'inline-block' : 'none';
        prevBtn.style.display = currentUserPage > 1 ? 'inline-block' : 'none';
        nextBtn.style.display = currentUserPage < totalPages ? 'inline-block' : 'none';
    }
}

function adminAction(userId, action, extraValue) {
    const userIndex = usersDB.findIndex(u => u.id === userId); if(userIndex === -1) return;
    
    if(action === 'approve') { 
        usersDB[userIndex].status = 'approved'; 
        alert(`${usersDB[userIndex].nickname}님의 가입을 승인했습니다.`); 
        logActivity(`👑 관리자: [${usersDB[userIndex].nickname}] 가입 승인`);
        saveUsersDB(); 
    }
    else if(action === 'reject') { 
        if(confirm(`${usersDB[userIndex].nickname}님의 신청을 거절(삭제)하시겠습니까?`)) { 
            db.collection('users').doc(userId).delete(); 
            logActivity(`👑 관리자: [${usersDB[userIndex].nickname}] 가입 거절`);
            usersDB.splice(userIndex, 1); 
        } 
    }
    else if(action === 'kick') { 
        if(confirm(`정말 ${usersDB[userIndex].nickname}님을 강퇴시키겠습니까?\n강퇴 시 해당 아이디로 접속할 수 없습니다.`)) { 
            usersDB[userIndex].status = 'kicked'; 
            alert('강퇴 처리되었습니다.'); 
            logActivity(`👑 관리자: [${usersDB[userIndex].nickname}] 강퇴 처리`);
            saveUsersDB(); 
        } 
    }
    else if(action === 'changeRole') { 
        usersDB[userIndex].role = extraValue; 
        alert(`${usersDB[userIndex].nickname}님의 권한이 [${getRoleName(extraValue)}]로 변경되었습니다.`); 
        logActivity(`👑 관리자: [${usersDB[userIndex].nickname}] 권한 변경 ➡️ ${getRoleName(extraValue)}`);
        saveUsersDB(); 
    }
    else if(action === 'changeNick') {
        const oldNick = usersDB[userIndex].nickname;
        const newNick = prompt(`'${oldNick}'님의 강제 변경할 새로운 닉네임을 입력하세요:`);
        if (newNick && newNick.trim() !== '' && newNick !== oldNick) {
            const finalNick = newNick.trim();
            usersDB[userIndex].nickname = finalNick;
            
            mockDefenseDecks.forEach(d => { if(d.authorId === userId) d.authorNick = finalNick; });
            mockAttackDecks.forEach(d => { if(d.authorId === userId) d.authorNick = finalNick; d.counters.forEach(c => { if(c.authorId === userId) c.authorNick = finalNick; }); });
            mockCastleDecks.forEach(d => { if(d.authorId === userId) d.authorNick = finalNick; });
            mockRaidDecks.forEach(d => { if(d.authorId === userId) d.authorNick = finalNick; });
            
            alert(`닉네임이 '${finalNick}'(으)로 강제 변경되었습니다.`);
            logActivity(`👑 관리자: [${oldNick}] 닉네임 강제 변경 ➡️ ${finalNick}`);
            saveUsersDB(); saveDecksDB();
        }
    }
    renderAdminView();
}

function toggleView(viewId) {
    const views = ['homeView', 'mainListView', 'deckBuilderView', 'deckDetailView', 'loginView', 'signupView', 'adminView', 'castleView', 'raidView'];
    views.forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    updateHeader();
    
    if(viewId !== 'deckBuilderView' && viewId !== 'deckDetailView') {
        resetBuilderState();
    }
    
    if (viewId === 'mainListView') switchMainTab(currentMainTab);
    if (viewId === 'adminView') renderAdminView(); 
}

/* 🏰 공성전 렌더링 */
function renderCastleTab(dayIdx) {
    currentCastleDay = dayIdx;
    const tabs = document.querySelectorAll('#castleTabsContainer .tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));
    document.getElementById(`c-tab-${dayIdx}`).classList.add('active');

    const contentDiv = document.getElementById('castleListContent'); contentDiv.innerHTML = '';
    const deck = mockCastleDecks.find(d => d.day === dayIdx);
    
    if (deck) {
        const canManageCastle = hasPerm('castleManage') || (currentUser && deck.authorId === currentUser.id);
        let editDeleteBtns = canManageCastle ? `<div style="text-align: right; margin-bottom: 10px;"><button class="btn" style="background-color: #f39c12; color: white; margin-right: 5px;" onclick="openDeckBuilder('castle_edit', null, null, ${dayIdx})">✏️ 수정</button><button class="btn" style="background-color: #e74c3c; color: white;" onclick="deleteCastleDeck(${dayIdx})">🗑️ 삭제</button></div>` : '';
        let boardHtml = `<div class="board-container"><div class="hero-board" id="castleHeroBoard"></div><div class="pet-slot filled" id="castlePetSlot"></div></div>`;
        let skillsHtml = '<div class="skill-grid-20">';
        if (deck.skills && deck.skills.some(s => s !== null)) {
            deck.skills.forEach((s, idx) => {
                if (s !== null) {
                    let hero = s.hero || (typeof s === 'string' ? s.split(' 스킬 ')[0] : '');
                    let skillNum = s.skillNum || (typeof s === 'string' ? s.split(' 스킬 ')[1] : '');
                    let round = s.round || 1;
                    let displayLabel = String(skillNum) === '3' ? '각성 스킬' : (String(skillNum).includes('-') ? `스킬 ${String(skillNum).split('-')[0]}` : `스킬 ${skillNum}`);
                    skillsHtml += `<div class="skill-slot filled round-${round} castle-slot" style="cursor:default;" title="${hero} 스킬 ${skillNum}"><img loading="lazy" src="./images/skills/${hero} 스킬 ${skillNum}.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:100%; height:100%; object-fit:cover; border-radius:5px;"><span class="skill-fallback" style="display:none; font-size:10px; font-weight:bold; color:#333;">${hero}<br>${displayLabel}</span><div class="skill-text-label">${displayLabel}</div></div>`;
                } else { skillsHtml += `<div class="skill-slot empty castle-slot" style="cursor:default;"></div>`; }
            });
        } else { skillsHtml += '<div style="grid-column: span 10; color:#7f8c8d; font-size:14px; padding: 20px; text-align:center;">설정된 스킬 순서가 없습니다.</div>'; }
        skillsHtml += '</div>';
        let speedOrderHtml = deck.speedOrder ? `<div style="text-align: center; color: #e67e22; font-size: 14px; margin-bottom: 20px; font-weight: bold;">⚡ 추천 속공 순서: <span style="color:#d35400;">${deck.speedOrder}</span></div>` : '';

        contentDiv.innerHTML = `
            ${editDeleteBtns}
            <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #ddd;">
                <h3 style="text-align: center; color: #2c3e50; margin-top: 0;">${dayNames[dayIdx]}요일 공성전 빌드</h3>
                <div style="text-align: center; color: #555; font-size: 14px; margin-bottom: 10px; font-weight: bold;">💡 ${deck.desc || '설명이 없습니다.'}</div>
                ${speedOrderHtml}
                <div style="text-align: right; font-size: 12px; color: #95a5a6; margin-bottom: 10px;">작성자: ${deck.authorNick}</div>
                <div style="text-align: center; margin-bottom: 20px; background: #fafafa; padding: 15px; padding-bottom: 30px; border-radius: 10px; border: 1px solid #eee;">
                    <h4 style="color: #8e44ad; margin-top: 0; margin-bottom: 15px;">⚔️ 스킬 순서</h4>${skillsHtml}
                </div>
                ${boardHtml}
                <div class="memo" style="margin-top: 20px; text-align: center;">💡 <b>장비 정보 조회:</b> 위 보드에서 영웅을 클릭하면 해당 영웅의 장비를 볼 수 있습니다.</div>
            </div>`;
        viewingDeck = deck; renderReadonlyBoard('castleHeroBoard', 'castlePetSlot', deck, false, true);
    } else {
        let addBtn = hasPerm('castleAdd') ? `<button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="openDeckBuilder('castle_new', null, null, ${dayIdx})">+ ${dayNames[dayIdx]}요일 공성전 빌드 등록하기</button>` : '';
        contentDiv.innerHTML = `<div style="text-align:center; padding: 40px 20px; background: white; border-radius: 10px; border: 1px dashed #bdc3c7;"><h3 style="color: #7f8c8d; margin-bottom: 10px;">아직 등록된 족보가 없습니다.</h3><p style="font-size: 14px; color: #95a5a6;">권한을 가진 길드원만 등록 가능합니다.</p>${addBtn}</div>`;
    }
}

function deleteCastleDeck(dayIdx) { 
    if(confirm("정말 이 공성전 빌드를 삭제하시겠습니까?")) { 
        const idx = mockCastleDecks.findIndex(d => d.day === dayIdx); 
        if(idx !== -1) { db.collection('castleDecks').doc(String(mockCastleDecks[idx].id)).delete(); mockCastleDecks.splice(idx, 1); } 
        
        logActivity(`🗑️ ${dayNames[dayIdx]}요일 공성전 빌드를 삭제했습니다.`);
        saveDecksDB(); 
        renderCastleTab(dayIdx); 
    } 
}

/* 🐉 강림원정대 렌더링 */
function renderRaidTab(bossName) {
    currentRaidBoss = bossName;
    const tabs = document.querySelectorAll('#raidTabsContainer .tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));
    document.getElementById(`r-tab-${bossName}`).classList.add('active');

    const contentDiv = document.getElementById('raidListContent');
    contentDiv.innerHTML = '';

    document.getElementById('raidAddDeckBtn').style.display = hasPerm('raidAdd') ? 'block' : 'none';

    const decks = mockRaidDecks.filter(d => d.boss === bossName);
    if (decks.length > 0) {
        decks.forEach(deck => {
            const h1 = deck.r1.slots.filter(h=>h).map(h => getMiniHeroHTML(h)).join('');
            const h2 = deck.r2.slots.filter(h=>h).map(h => getMiniHeroHTML(h)).join('');
            contentDiv.innerHTML += `
                <div class="raid-deck" onclick="viewDeckDetail('raid', ${deck.id})">
                    <div>
                        <div style="font-weight: bold; color: #8e44ad; margin-bottom: 5px;">${deck.name}</div>
                        <div style="font-size: 13px; color: #555;">💡 ${deck.desc || '설명이 없습니다.'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size: 11px; color:#7f8c8d; margin-bottom:3px;">1R <span class="mini-hero-list" style="display:inline-flex;">${h1}</span></div>
                        <div style="font-size: 11px; color:#7f8c8d;">2R <span class="mini-hero-list" style="display:inline-flex;">${h2}</span></div>
                    </div>
                </div>
            `;
        });
    } else {
        contentDiv.innerHTML = `<div style="text-align:center; padding: 30px; color: #7f8c8d;">등록된 빌드가 없습니다.</div>`;
    }
}
function handleAddNewRaidBtn() { openDeckBuilder('raid_new', null, null, null, currentRaidBoss); }

function setAttackSortMode(mode) { attackSortMode = mode; switchMainTab('attack'); }

function toggleAccordion(deckId, element) {
    const parent = element.parentElement; parent.classList.toggle('open');
    if (parent.classList.contains('open')) { if (!openAccordionIds.includes(deckId)) openAccordionIds.push(deckId); } else { openAccordionIds = openAccordionIds.filter(id => id !== deckId); }
}

function switchMainTab(tabType) {
    currentMainTab = tabType;
    document.getElementById('tab-attack').classList.remove('active'); document.getElementById('tab-defense').classList.remove('active');
    const content = document.getElementById('deckListContent'); content.innerHTML = '';
    const addBtn = document.getElementById('mainAddDeckBtn'); const sortContainer = document.getElementById('attackSortContainer');

    if(tabType === 'attack') {
        document.getElementById('tab-attack').classList.add('active'); sortContainer.style.display = 'flex';
        document.getElementById('sortWinRateBtn').className = attackSortMode === 'winrate' ? 'sort-btn active' : 'sort-btn';
        document.getElementById('sortLatestBtn').className = attackSortMode === 'latest' ? 'sort-btn active' : 'sort-btn';
        
        addBtn.style.display = hasPerm('gwTargetAdd') ? 'block' : 'none'; 
        addBtn.innerText = '+ 적 방어 덱 등록하기';
        let html = '';
        
        mockAttackDecks.forEach(deck => {
            const targetHtml = (deck.targetHeroes || []).filter(h=>h).map(h => getMiniHeroHTML(h)).join('');
            const canEditTarget = hasPerm('gwTargetManage') || (currentUser && deck.authorId === currentUser.id);
            let targetEditHtml = canEditTarget ? `<div style="text-align: right; margin-bottom: 10px;"><button class="btn-sm" style="background:#f39c12;" onclick="event.stopPropagation(); openDeckBuilder('attack_target_edit', ${deck.id})">수정</button><button class="btn-sm" style="background:#e74c3c;" onclick="event.stopPropagation(); deleteAttackTarget(${deck.id})">삭제</button></div>` : '';

            let sortedCounters = [...(deck.counters || [])];
            if (attackSortMode === 'winrate') {
                sortedCounters.sort((a, b) => { const rateA = (a.wins + a.losses) === 0 ? 0 : a.wins / (a.wins + a.losses); const rateB = (b.wins + b.losses) === 0 ? 0 : b.wins / (b.wins + b.losses); if (rateB !== rateA) return rateB - rateA; return (b.wins + b.losses) - (a.wins + a.losses); });
            } else { sortedCounters.sort((a, b) => b.createdAt - a.createdAt); }

            let counterHtml = sortedCounters.map(c => {
                const canEditCounter = hasPerm('gwCounterManage') || (currentUser && c.authorId === currentUser.id);
                let counterEditHtml = canEditCounter ? `<button class="btn-sm" style="background:#f39c12;" onclick="event.stopPropagation(); openDeckBuilder('attack_counter_edit', ${deck.id}, ${c.id})">수정</button><button class="btn-sm" style="background:#e74c3c;" onclick="event.stopPropagation(); deleteCounterDeck(${deck.id}, ${c.id})">삭제</button>` : '';
                
                const isAdminMaster = currentUser && ['admin', 'master'].includes(currentUser.role);
                let adminVoteHtml = isAdminMaster ? `<button class="btn-sm" style="background:#8e44ad;" onclick="event.stopPropagation(); openAdminVoteModal(${deck.id}, ${c.id})">⚙️ 승패 임의수정</button>` : '';
                
                const totalGames = c.wins + c.losses; const winRate = totalGames === 0 ? 0 : Math.round((c.wins / totalGames) * 100);
                let rateColor = '#7f8c8d'; if (totalGames > 0) { if (winRate >= 80) rateColor = '#3498db'; else if (winRate >= 65) rateColor = '#27ae60'; else if (winRate >= 45) rateColor = '#f39c12'; else rateColor = '#c0392b'; }

                return `
                    <div class="counter-deck" onclick="viewDeckDetail('counter', ${deck.id}, ${c.id})">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div><div style="font-size: 13px; font-weight: bold; color: #e74c3c; margin-bottom: 5px;">🔥 카운터 조합</div><div class="mini-hero-list">${c.heroes.filter(h=>h).map(h => getMiniHeroHTML(h)).join('')}<span style="font-size: 18px; margin: 0 5px;">+</span>${c.pet ? getMiniHeroHTML(c.pet, "pet") : ''}</div></div>
                            <div style="text-align:right;"><div style="font-size: 20px; font-weight: 900; color: ${rateColor};">${winRate}%</div><div style="font-size: 11px; color: #7f8c8d;">${c.wins}승 ${c.losses}패</div></div>
                        </div>
                        <p style="font-size: 13px; color: #555; margin-top: 10px;">💡 ${c.desc}</p><div style="text-align: right; font-size: 11px; color: #95a5a6; margin-top: 5px;">작성자: ${c.authorNick}</div>
                        <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                            <div><button class="vote-btn vote-win" onclick="event.stopPropagation(); voteCounter(${deck.id}, ${c.id}, 'win')">👍 승리</button><button class="vote-btn vote-loss" onclick="event.stopPropagation(); voteCounter(${deck.id}, ${c.id}, 'loss')">👎 패배</button>${adminVoteHtml}</div>
                            <div onclick="event.stopPropagation();">${counterEditHtml}</div>
                        </div>
                    </div>
                `;
            }).join('');
            if(sortedCounters.length === 0) counterHtml = `<div style="text-align:center; color:#7f8c8d; font-size:13px; padding: 10px;">아직 등록된 카운터 덱이 없습니다.</div>`;
            
            let addCounterBtn = (currentUser && hasPerm('gwCounterAdd')) ? `<button class="btn" style="width:100%; margin-top:15px; background:#2ecc71; color:white;" onclick="event.stopPropagation(); openDeckBuilder('attack_counter_new', ${deck.id})">+ 카운터 덱 추가하기</button>` : '';
            const isOpenClass = openAccordionIds.includes(deck.id) ? 'open' : '';
            html += `<div class="deck-card ${isOpenClass}"><div class="deck-card-header" onclick="toggleAccordion(${deck.id}, this)"><div><span style="font-size:12px; color:#7f8c8d; font-weight:normal;">적 방어 덱</span><br><span style="color:#e74c3c;">${deck.targetName}</span></div><div style="display:flex; align-items:center; gap:10px;"><div class="mini-hero-list">${targetHtml}</div><span>▼</span></div></div><div class="deck-card-body" onclick="event.stopPropagation()">${targetEditHtml}<hr style="border:0; border-top:1px dashed #ddd; margin:15px 0;">${counterHtml}${addCounterBtn}</div></div>`;
        });
        if(mockAttackDecks.length === 0) html += '<p style="text-align:center; padding: 20px; color: #7f8c8d;">등록된 적 방어 덱이 없습니다.</p>'; content.innerHTML = html;
    } else {
        document.getElementById('tab-defense').classList.add('active'); sortContainer.style.display = 'none'; 
        
        addBtn.style.display = hasPerm('gwDefenseAdd') ? 'block' : 'none'; 
        addBtn.innerText = '+ 방어 추천 덱 추가하기';
        
        mockDefenseDecks.forEach(deck => {
            const heroHtml = (deck.slots || []).filter(h => h).map(h => `<img loading="lazy" src="./images/heroes/${h}.png" class="mini-hero" onerror="this.src='https://via.placeholder.com/40'">`).join('');
            const conceptClass = getConceptClass(deck.concept); const petHtml = deck.pet ? `<img loading="lazy" src="./images/pets/${deck.pet}.png" class="mini-hero" onerror="this.src='https://via.placeholder.com/40'">` : '';
            content.innerHTML += `<div class="defense-deck" onclick="viewDeckDetail('defense', ${deck.id})"><div><div style="font-weight: bold; color: #2980b9; margin-bottom: 5px;">${deck.name || '이름 없는 방어 덱'} <span class="badge-concept ${conceptClass}" style="font-size:10px;">${deck.concept !== '상관없음' ? deck.concept : ''}</span></div><div style="font-size: 13px; color: #555;">💡 ${deck.desc || '설명이 없습니다.'}</div></div><div class="mini-hero-list">${heroHtml} <span style="font-size: 18px; margin: 0 5px;">+</span> ${petHtml}</div></div>`;
        });
        if(mockDefenseDecks.length === 0) content.innerHTML = '<p style="text-align:center; padding: 20px; color: #7f8c8d;">등록된 방어 덱이 없습니다.</p>';
    }
}

function viewDeckDetail(type, id1, id2) {
    viewingDeckType = type;
    const conceptBadge = document.getElementById('detailDeckConcept');
    const normalContent = document.getElementById('normalDetailContent');
    const raidContent = document.getElementById('raidDetailContent');
    const speedOrderDiv = document.getElementById('detailSpeedOrder');

    if (type === 'raid') {
        viewingDeck = mockRaidDecks.find(d => d.id === id1);
        if(!viewingDeck) return;
        document.getElementById('detailDeckTitle').innerText = viewingDeck.name || '이름 없는 빌드';
        conceptBadge.style.display = 'none';
        
        normalContent.style.display = 'none';
        raidContent.style.display = 'block';
        speedOrderDiv.style.display = 'none';
        
        const r1Skills = viewingDeck.r1.skills || (viewingDeck.skills ? viewingDeck.skills.filter(s => viewingDeck.r1.slots.includes(s.hero)) : []);
        const r2Skills = viewingDeck.r2.skills || (viewingDeck.skills ? viewingDeck.skills.filter(s => viewingDeck.r2.slots.includes(s.hero)) : []);

        const makeSkillHtml = (skillsArr) => {
            let html = '<div class="skill-grid-flex">';
            if(skillsArr.length > 0) {
                skillsArr.forEach(s => {
                    let hero = s.hero; let skillNum = s.skillNum;
                    let displayLabel = String(skillNum) === '3' ? '각성 스킬' : (String(skillNum).includes('-') ? `스킬 ${String(skillNum).split('-')[0]}` : `스킬 ${skillNum}`);
                    html += `<div class="skill-slot filled castle-slot" style="cursor:default;"><img loading="lazy" src="./images/skills/${hero} 스킬 ${skillNum}.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:100%; height:100%; object-fit:cover; border-radius:5px;"><span class="skill-fallback" style="display:none; font-size:10px; font-weight:bold; color:#333;">${hero}<br>${displayLabel}</span><div class="skill-text-label">${displayLabel}</div></div>`;
                });
            } else { html += '<div style="width:100%; text-align:center; color:#7f8c8d; font-size:13px; padding:10px;">설정된 스킬 순서가 없습니다.</div>'; }
            html += '</div>';
            return html;
        };

        raidContent.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #ddd; margin-bottom:20px;">
                <div style="display: flex; flex-direction: column; gap: 30px;">
                    <div style="background: #fafafa; padding: 15px; border-radius: 10px; border: 1px solid #eee;">
                        <h4 style="color: #8e44ad; text-align: center; margin-top: 0; margin-bottom: 15px;">⚔️ 1라운드 스킬 순서</h4>
                        <div style="display: flex; justify-content: center;">${makeSkillHtml(r1Skills)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 10px; border: 1px solid #eee;">
                        <h4 style="color: #8e44ad; text-align: center; margin-top: 0; margin-bottom: 15px;">⚔️ 2라운드 스킬 순서</h4>
                        <div style="display: flex; justify-content: center;">${makeSkillHtml(r2Skills)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 10px; border: 1px solid #eee;">
                        <h4 style="text-align:center; color:#2c3e50; margin-top:0; border-bottom:2px dashed #ddd; padding-bottom:10px;">🎯 1라운드 구성</h4>
                        <div style="text-align: center; color: #e67e22; font-size: 14px; margin-bottom: 15px; font-weight: bold;">⚡ 1R 추천 속공: <span style="color:#d35400;">${viewingDeck.r1.speedOrder || '없음'}</span></div>
                        <div class="board-container"><div class="hero-board castle-layout" id="raidBoard1"></div><div class="pet-slot filled" id="raidPet1"></div></div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 10px; border: 1px solid #eee;">
                        <h4 style="text-align:center; color:#2c3e50; margin-top:0; border-bottom:2px dashed #ddd; padding-bottom:10px;">🎯 2라운드 구성</h4>
                        <div style="text-align: center; color: #e67e22; font-size: 14px; margin-bottom: 15px; font-weight: bold;">⚡ 2R 추천 속공: <span style="color:#d35400;">${viewingDeck.r2.speedOrder || '없음'}</span></div>
                        <div class="board-container"><div class="hero-board castle-layout" id="raidBoard2"></div><div class="pet-slot filled" id="raidPet2"></div></div>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => { 
            renderReadonlyBoard(`raidBoard1`, `raidPet1`, viewingDeck.r1, false, true); 
            renderReadonlyBoard(`raidBoard2`, `raidPet2`, viewingDeck.r2, false, true); 
        }, 10);

        currentTargetDeckId = null; currentCounterDeckId = null;

    } else {
        raidContent.style.display = 'none'; normalContent.style.display = 'block'; 
        if (type === 'defense') {
            viewingDeck = mockDefenseDecks.find(d => d.id === id1);
            if (!viewingDeck) return;
            document.getElementById('detailDeckTitle').innerText = viewingDeck.name || '이름 없는 방어 덱';
            if (viewingDeck.concept && viewingDeck.concept !== '상관없음') { conceptBadge.style.display = 'inline-block'; conceptBadge.className = `badge-concept ${getConceptClass(viewingDeck.concept)}`; conceptBadge.innerText = viewingDeck.concept; } else { conceptBadge.style.display = 'none'; }
            speedOrderDiv.style.display = 'none';
            currentTargetDeckId = null; currentCounterDeckId = null;
        } else {
            currentTargetDeckId = id1; currentCounterDeckId = id2;
            const target = mockAttackDecks.find(d => d.id === id1);
            viewingDeck = target ? target.counters.find(c => c.id === id2) : null;
            if (!viewingDeck) return;
            document.getElementById('detailDeckTitle').innerText = '🔥 카운터 덱 상세정보'; conceptBadge.style.display = 'none'; 
            speedOrderDiv.style.display = 'none';
        }
        
        renderReadonlyBoard('detailHeroBoard', 'detailPetSlot', viewingDeck, false, false);
        const skillDiv = document.getElementById('detailSkillQueue'); skillDiv.className = 'skill-grid-3'; let skillsHtml = '';
        if (viewingDeck.skills && viewingDeck.skills.some(s => s !== null)) {
            viewingDeck.skills.forEach(s => {
                if (s !== null) {
                    let hero = s.hero || (typeof s === 'string' ? s.split(' 스킬 ')[0] : ''); let skillNum = s.skillNum || (typeof s === 'string' ? s.split(' 스킬 ')[1] : '');
                    let displayLabel = String(skillNum) === '3' ? '각성 스킬' : (String(skillNum).includes('-') ? `스킬 ${String(skillNum).split('-')[0]}` : `스킬 ${skillNum}`);
                    skillsHtml += `<div class="skill-slot filled" style="cursor:default;" title="${hero} 스킬 ${skillNum}"><img loading="lazy" src="./images/skills/${hero} 스킬 ${skillNum}.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:100%; height:100%; object-fit:cover; border-radius:5px;"><span class="skill-fallback" style="display:none; font-size:10px; font-weight:bold; color:#333;">${hero}<br>${displayLabel}</span><div class="skill-text-label">${displayLabel}</div></div>`;
                } else { skillsHtml += `<div class="skill-slot empty" style="cursor:default;"></div>`; }
            });
        } else { skillsHtml = '<div style="color:#7f8c8d; font-size:14px; padding: 20px; width:100%; text-align:center;">설정된 스킬 순서가 없습니다.</div>'; }
        skillDiv.innerHTML = skillsHtml;
    }

    document.getElementById('detailDeckDesc').innerText = viewingDeck.desc ? `💡 ${viewingDeck.desc}` : '💡 설명이 없습니다.';
    document.getElementById('detailDeckAuthor').innerText = `작성자: ${viewingDeck.authorNick || '알 수 없음'}`;
    
    let hasPermission = false;
    const isAuthor = currentUser && viewingDeck.authorId === currentUser.id;
    
    if (viewingDeckType === 'defense') hasPermission = isAuthor || hasPerm('gwDefenseManage');
    else if (viewingDeckType === 'raid') hasPermission = isAuthor || hasPerm('raidManage');
    else hasPermission = isAuthor || hasPerm('gwCounterManage');

    document.getElementById('deleteDeckBtn').style.display = hasPermission ? 'inline-block' : 'none'; 
    document.getElementById('editDeckBtn').style.display = hasPermission ? 'inline-block' : 'none';
    
    toggleView('deckDetailView');
}

function handleDetailBackBtn() { if(viewingDeckType === 'raid') toggleView('raidView'); else toggleView('mainListView'); }

function handleAddNewDeckBtn() {
    if (!currentUser) return alert('🚨 로그인이 필요합니다.');
    
    if (currentMainTab === 'attack') {
        if (!hasPerm('gwTargetAdd')) return alert('🚨 적 방어덱 등록 권한이 없습니다.');
        openDeckBuilder('attack_target_new');
    } else {
        if (!hasPerm('gwDefenseAdd')) return alert('🚨 방어 추천 덱 등록 권한이 없습니다.');
        openDeckBuilder('defense_new');
    }
}

function handleBuilderBackBtn() { 
    if (builderMode.startsWith('castle')) { toggleView('castleView'); } 
    else if (builderMode.startsWith('raid')) { toggleView('raidView'); }
    else { toggleView('mainListView'); } 
}

function deleteAttackTarget(targetId) { 
    if(confirm("이 적 방어 덱과 하위의 카운터 덱이 모두 삭제됩니다.\n정말 삭제하시겠습니까?")) { 
        const idx = mockAttackDecks.findIndex(d => d.id === targetId); 
        if(idx !== -1) { db.collection('attackDecks').doc(String(targetId)).delete(); mockAttackDecks.splice(idx, 1); } 
        logActivity(`🗑️ 길드전 적 방어 덱을 삭제했습니다.`);
        saveDecksDB(); switchMainTab('attack'); 
    } 
}

function deleteCounterDeck(targetId, counterId) { 
    if(confirm("이 카운터 덱을 정말 삭제하시겠습니까?")) { 
        const target = mockAttackDecks.find(d => d.id === targetId); 
        const idx = target.counters.findIndex(c => c.id === counterId); 
        if(idx !== -1) target.counters.splice(idx, 1); 
        logActivity(`🗑️ 길드전 카운터 덱을 삭제했습니다.`);
        saveDecksDB(); switchMainTab('attack'); 
    } 
}

function deleteCurrentDeck() {
    if(confirm("정말 이 덱을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) {
        let targetView = 'mainListView';
        if (viewingDeckType === 'defense') { 
            const idx = mockDefenseDecks.findIndex(d => d.id === viewingDeck.id); 
            if(idx !== -1) { db.collection('defenseDecks').doc(String(viewingDeck.id)).delete(); mockDefenseDecks.splice(idx, 1); } 
            logActivity(`🗑️ 길드전 방어 추천 덱을 삭제했습니다.`);
        } 
        else if (viewingDeckType === 'raid') { 
            const idx = mockRaidDecks.findIndex(d => d.id === viewingDeck.id); 
            if(idx !== -1) { db.collection('raidDecks').doc(String(viewingDeck.id)).delete(); mockRaidDecks.splice(idx, 1); } 
            targetView = 'raidView';
            logActivity(`🗑️ 강림원정대 빌드를 삭제했습니다.`);
        }
        else { 
            const target = mockAttackDecks.find(d => d.id === currentTargetDeckId); 
            const idx = target.counters.findIndex(c => c.id === viewingDeck.id); 
            if(idx !== -1) target.counters.splice(idx, 1); 
            logActivity(`🗑️ 길드전 카운터 덱을 삭제했습니다.`);
        }
        saveDecksDB(); alert("✅ 삭제되었습니다."); 
        if (targetView === 'raidView') { toggleView('raidView'); renderRaidTab(currentRaidBoss); } else { toggleView('mainListView'); }
    }
}

function editCurrentDeck() { 
    if (viewingDeckType === 'defense') openDeckBuilder('defense_edit'); 
    else if (viewingDeckType === 'raid') openDeckBuilder('raid_edit', viewingDeck.id, null, null, currentRaidBoss);
    else openDeckBuilder('attack_counter_edit', currentTargetDeckId, viewingDeck.id); 
}

function voteCounter(targetId, counterId, type) {
    if (!currentUser) return alert("로그인이 필요합니다.");
    const isHighRank = Boolean(currentUser && ['admin', 'master'].includes(currentUser.role));
    const target = mockAttackDecks.find(d => d.id === targetId); const counter = target.counters.find(c => c.id === counterId);
    
    if (!isHighRank) { const lastVoteTime = counter.votes ? counter.votes[currentUser.id] : 0; if (lastVoteTime && (Date.now() - lastVoteTime) < 48 * 60 * 60 * 1000) { return alert("승패 기록은 48시간에 한 번만 투표할 수 있습니다."); } }
    if (!counter.votes) counter.votes = {}; counter.votes[currentUser.id] = Date.now();
    if (type === 'win') counter.wins = (counter.wins || 0) + 1; else counter.losses = (counter.losses || 0) + 1;
    
    const voteResult = type === 'win' ? '승리' : '패배';
    logActivity(`투표 ➡️ 카운터 덱 승패 투표에 참여했습니다. (${voteResult})`);
    
    saveDecksDB(); switchMainTab('attack'); 
}

let adminVoteTargetId = null; let adminVoteCounterId = null;
function openAdminVoteModal(targetId, counterId) {
    const target = mockAttackDecks.find(d => d.id === targetId); const counter = target.counters.find(c => c.id === counterId);
    document.getElementById('adminWinsInput').value = counter.wins || 0; document.getElementById('adminLossesInput').value = counter.losses || 0;
    adminVoteTargetId = targetId; adminVoteCounterId = counterId; document.getElementById('adminVoteModal').style.display = 'flex';
}
function closeAdminVoteModal() { document.getElementById('adminVoteModal').style.display = 'none'; }
function saveAdminVote() { const target = mockAttackDecks.find(d => d.id === adminVoteTargetId); const counter = target.counters.find(c => c.id === adminVoteCounterId); counter.wins = parseInt(document.getElementById('adminWinsInput').value, 10) || 0; counter.losses = parseInt(document.getElementById('adminLossesInput').value, 10) || 0; saveDecksDB(); closeAdminVoteModal(); switchMainTab('attack'); }

function openDeckBuilder(mode, targetId = null, counterId = null, dayIdx = null, bossName = null) {
    const backupDeck = viewingDeck; 
    try {
        resetBuilderState();
        if (mode.includes('edit')) viewingDeck = backupDeck; 

        builderMode = mode; currentTargetDeckId = targetId; currentCounterDeckId = counterId;
        
        const nTabs = document.getElementById('normalBuilderTabs'); const rTabs = document.getElementById('raidBuilderTabs');
        const attackNameContainer = document.getElementById('attackDeckNameContainer'); const deckNameContainer = document.getElementById('deckNameContainer'); 
        const conceptContainer = document.getElementById('conceptContainer'); const nextBtn = document.getElementById('builderNextBtn'); 
        const saveAtConfigBtn = document.getElementById('builderSaveBtnAtConfig'); const builderTitle = document.getElementById('builderTitle'); 
        const roundContainer = document.getElementById('roundSelectContainer'); const speedOrderContainer = document.getElementById('speedOrderContainer'); 
        const raidSpeedOrderContainer = document.getElementById('raidSpeedOrderContainer'); const raidToggle = document.getElementById('raidDetailRoundToggle');

        if(nTabs) nTabs.style.display = 'none'; if(rTabs) rTabs.style.display = 'none';
        if(attackNameContainer) attackNameContainer.style.display = 'none'; if(deckNameContainer) deckNameContainer.style.display = 'none';
        if(conceptContainer) conceptContainer.style.display = 'none'; if(nextBtn) nextBtn.style.display = 'inline-block';
        if(saveAtConfigBtn) saveAtConfigBtn.style.display = 'none'; if(roundContainer) roundContainer.style.display = 'none';
        if(speedOrderContainer) speedOrderContainer.style.display = 'none'; if(raidSpeedOrderContainer) raidSpeedOrderContainer.style.display = 'none';
        if(raidToggle) raidToggle.style.display = 'none';

        if (mode.startsWith('raid')) {
            currentRaidBoss = bossName;
            if(rTabs) rTabs.style.display = 'flex'; if(deckNameContainer) deckNameContainer.style.display = 'block';
            if(raidSpeedOrderContainer) raidSpeedOrderContainer.style.display = 'flex'; if(raidToggle) raidToggle.style.display = 'flex';
            if(builderTitle) builderTitle.innerText = `🛠️ 강림원정대 ${currentRaidBoss} 빌드 (최대 5명)`;
            
            if (mode === 'raid_edit' && viewingDeck) {
                document.getElementById('deckNameInput').value = viewingDeck.name || ''; document.getElementById('deckDescInput').value = viewingDeck.desc || ''; 
                document.getElementById('raidSpeed1').value = (viewingDeck.r1 && viewingDeck.r1.speedOrder) || ''; document.getElementById('raidSpeed2').value = (viewingDeck.r2 && viewingDeck.r2.speedOrder) || '';
                raidDataBuffer[1] = JSON.parse(JSON.stringify(viewingDeck.r1 || { slots: [], pet: null, equips: {}, skills: [] })); 
                if(!raidDataBuffer[1].skills && viewingDeck.skills) { raidDataBuffer[1].skills = viewingDeck.skills.filter(s => raidDataBuffer[1].slots.includes(s.hero)); }
                raidDataBuffer[2] = JSON.parse(JSON.stringify(viewingDeck.r2 || { slots: [], pet: null, equips: {}, skills: [] }));
                if(!raidDataBuffer[2].skills && viewingDeck.skills) { raidDataBuffer[2].skills = viewingDeck.skills.filter(s => raidDataBuffer[2].slots.includes(s.hero)); }
            } else { skillQueue = []; }
            loadRaidRoundToBuilder(1);
        } else if (mode.startsWith('castle')) {
            currentCastleDay = dayIdx;
            if(nTabs) nTabs.style.display = 'flex'; if(roundContainer) roundContainer.style.display = 'block';
            if(speedOrderContainer) speedOrderContainer.style.display = 'block'; if(builderTitle) builderTitle.innerText = `🛠️ ${dayNames[currentCastleDay]}요일 공성전 빌드 (최대 5명)`;
            
            if (mode === 'castle_edit' && viewingDeck) {
                document.getElementById('formationType').value = viewingDeck.formation || 'basic'; boardSlots = [...(viewingDeck.slots || [])]; currentSelectedPet = viewingDeck.pet; 
                document.getElementById('deckDescInput').value = viewingDeck.desc || ''; heroEquipments = JSON.parse(JSON.stringify(viewingDeck.equips || {})); 
                document.getElementById('deckSpeedOrderInput').value = viewingDeck.speedOrder || ''; skillQueue = viewingDeck.skills ? [...viewingDeck.skills] : new Array(20).fill(null); 
                while(skillQueue.length < 20) skillQueue.push(null);
            } else { skillQueue = new Array(20).fill(null); }
        } else if (mode.startsWith('attack_target')) {
            if(attackNameContainer) attackNameContainer.style.display = 'block'; if(nextBtn) nextBtn.style.display = 'none';
            if(saveAtConfigBtn) saveAtConfigBtn.style.display = 'inline-block'; if(builderTitle) builderTitle.innerText = mode === 'attack_target_edit' ? '🛠️ 적 방어 덱 수정' : '🛠️ 적 방어 덱 등록';
            if (mode === 'attack_target_edit') { 
                const target = mockAttackDecks.find(d => d.id === targetId); 
                if(target) { document.getElementById('attackDeckNameInput').value = target.targetName || ''; document.getElementById('formationType').value = target.formation || 'basic'; boardSlots = [...(target.targetHeroes || [])]; currentSelectedPet = target.targetPet; }
            }
        } else if (mode.startsWith('attack_counter')) {
            if(nTabs) nTabs.style.display = 'flex'; if(builderTitle) builderTitle.innerText = mode === 'attack_counter_edit' ? '🛠️ 카운터 덱 수정' : '🛠️ 카운터 덱 등록';
            if (mode === 'attack_counter_edit' && viewingDeck) { 
                document.getElementById('formationType').value = viewingDeck.formation || 'basic'; boardSlots = [...(viewingDeck.heroes || [])]; currentSelectedPet = viewingDeck.pet; 
                document.getElementById('deckDescInput').value = viewingDeck.desc || ''; heroEquipments = JSON.parse(JSON.stringify(viewingDeck.equips || {})); 
                skillQueue = viewingDeck.skills ? [...viewingDeck.skills] : new Array(3).fill(null); while(skillQueue.length < 3) skillQueue.push(null); 
            } else { skillQueue = new Array(3).fill(null); }
        } else {
            if(nTabs) nTabs.style.display = 'flex'; if(deckNameContainer) deckNameContainer.style.display = 'block'; if(conceptContainer) conceptContainer.style.display = 'block';
            if(builderTitle) builderTitle.innerText = mode === 'defense_edit' ? '🛠️ 방어 덱 수정' : '🛠️ 방어 추천 덱 구성';
            if (mode === 'defense_edit' && viewingDeck) { 
                document.getElementById('formationType').value = viewingDeck.formation || 'basic'; boardSlots = [...(viewingDeck.slots || [])]; currentSelectedPet = viewingDeck.pet; 
                document.getElementById('deckNameInput').value = viewingDeck.name || ''; document.getElementById('deckDescInput').value = viewingDeck.desc || ''; 
                document.getElementById('deckConceptSelect').value = viewingDeck.concept || '상관없음'; heroEquipments = JSON.parse(JSON.stringify(viewingDeck.equips || {})); 
                skillQueue = viewingDeck.skills ? [...viewingDeck.skills] : new Array(3).fill(null); while(skillQueue.length < 3) skillQueue.push(null); 
            } else { skillQueue = new Array(3).fill(null); }
        }
        
        toggleView('deckBuilderView'); switchBuilderTab(builderMode.startsWith('raid') ? 'r1' : 'config');
    } catch (error) { console.error("openDeckBuilder Error:", error); alert("덱 창을 여는 중 일시적인 오류가 발생했습니다."); }
}

function saveCurrentRaidRound() {
    if(!builderMode.startsWith('raid')) return;
    raidDataBuffer[currentRaidRound] = { slots: [...boardSlots], pet: currentSelectedPet, equips: JSON.parse(JSON.stringify(heroEquipments)), formation: document.getElementById('formationType').value, skills: [...skillQueue] };
}

function loadRaidRoundToBuilder(round) {
    currentRaidRound = round; const data = raidDataBuffer[round];
    boardSlots = [...data.slots]; currentSelectedPet = data.pet; heroEquipments = JSON.parse(JSON.stringify(data.equips)); document.getElementById('formationType').value = data.formation || 'basic';
    skillQueue = data.skills ? [...data.skills] : []; 
    renderBuilderBoard(); applyFilters();
}

function handleBuilderNextBtn() {
    if (builderMode.startsWith('raid')) { saveCurrentRaidRound(); if(currentRaidRound === 1) switchBuilderTab('r2'); else switchBuilderTab('detail'); } else { switchBuilderTab('detail'); }
}

function loadRaidDetailRound(round) {
    saveCurrentRaidRound(); loadRaidRoundToBuilder(round); 
    document.getElementById('btn-detail-r1').style.background = round === 1 ? '#34495e' : '#bdc3c7'; document.getElementById('btn-detail-r1').style.color = round === 1 ? 'white' : '#2c3e50';
    document.getElementById('btn-detail-r2').style.background = round === 2 ? '#34495e' : '#bdc3c7'; document.getElementById('btn-detail-r2').style.color = round === 2 ? 'white' : '#2c3e50';
    const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments };
    renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true, true); renderAvailableSkills();
}

function switchBuilderTab(tab) {
    document.getElementById('builderConfigSection').style.display = 'none'; document.getElementById('builderDetailSection').style.display = 'none';
    if (builderMode.startsWith('raid')) {
        ['b-tab-r1', 'b-tab-r2', 'b-tab-raid-detail'].forEach(id => document.getElementById(id).classList.remove('active'));
        if (tab === 'r1' || tab === 'r2') {
            if(tab === 'r2' && boardSlots.filter(h=>h).length === 0 && currentRaidRound === 1) return alert('1라운드에 영웅을 최소 1명 배치해주세요.');
            saveCurrentRaidRound(); document.getElementById(`b-tab-${tab}`).classList.add('active'); document.getElementById('builderConfigSection').style.display = 'block'; activeSlotType = 'hero'; loadRaidRoundToBuilder(tab === 'r1' ? 1 : 2);
        } else if (tab === 'detail') { saveCurrentRaidRound(); document.getElementById('b-tab-raid-detail').classList.add('active'); document.getElementById('builderDetailSection').style.display = 'block'; loadRaidDetailRound(currentRaidRound); }
    } else {
        if (tab === 'detail' && boardSlots.filter(h => h !== null).length === 0) return alert('🚨 최소 1명의 영웅을 배치해야 합니다.');
        document.getElementById('b-tab-config').classList.remove('active'); document.getElementById('b-tab-detail').classList.remove('active');
        if(tab === 'config') { document.getElementById('b-tab-config').classList.add('active'); document.getElementById('builderConfigSection').style.display = 'block'; activeSlotType = 'hero'; renderBuilderBoard(); applyFilters(); } 
        else { document.getElementById('b-tab-detail').classList.add('active'); document.getElementById('builderDetailSection').style.display = 'block'; const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments }; renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true, builderMode.startsWith('castle')); renderAvailableSkills(); }
    }
}

function renderReadonlyBoard(boardId, petId, deckData, isEditMode = false, isCastle = false) {
    if (!deckData) return;
    const boardEl = document.getElementById(boardId);
    if (isCastle) boardEl.classList.add('castle-layout'); else boardEl.classList.remove('castle-layout');
    const formationType = deckData.formation || 'basic'; const layout = formations[formationType]; const slotsData = deckData.slots || deckData.heroes || [null, null, null, null, null];

    let html = '';
    ['후열', '전열'].forEach((lineName, lineIdx) => {
        html += `<div class="formation-line"><div class="line-title">${lineName}</div>`;
        const start = lineIdx === 0 ? layout.front : 0; const end = lineIdx === 0 ? 5 : layout.front;
        for(let i = start; i < end; i++) {
            const h = slotsData[i]; const eqClass = (deckData.equips && deckData.equips[h]) ? 'has-equip' : ''; let roleStr = ''; if(h) { const heroInfo = heroData.find(x => x.name === h); if(heroInfo) roleStr = heroInfo.role; }
            const bColor = getRoleColor(roleStr);
            if(h) { html += `<div class="hero-slot filled ${eqClass}" style="border-color: ${bColor};" onclick="openEquipModal('${h}', ${!isEditMode})"><img loading="lazy" src="./images/heroes/${h}.png" onerror="this.src='https://via.placeholder.com/75'"><div class="equip-badge">E</div></div>`; } 
            else { html += `<div class="hero-slot">빈자리</div>`; }
        }
        html += '</div>';
    });
    boardEl.innerHTML = html;
    const p = deckData.pet; document.getElementById(petId).innerHTML = p ? `<img loading="lazy" src="./images/pets/${p}.png" onerror="this.src='https://via.placeholder.com/80'">` : '펫 없음';
}

function renderAvailableSkills() {
    const container = document.getElementById('availableSkills'); container.innerHTML = '';
    let heroes = boardSlots.filter(h => h !== null);
    
    if(!builderMode.startsWith('raid')) { 
        for(let i=0; i<skillQueue.length; i++) { 
            let s = skillQueue[i]; 
            if (s !== null) { 
                let heroName = s.hero || (typeof s === 'string' ? s.split(' 스킬 ')[0] : ''); 
                if (!heroes.includes(heroName)) skillQueue[i] = null; 
            } 
        } 
    } else { 
        for(let i = skillQueue.length - 1; i >= 0; i--) { 
            let s = skillQueue[i]; 
            if (s !== null) { 
                let heroName = s.hero; 
                if (!heroes.includes(heroName)) skillQueue.splice(i, 1); 
            } 
        } 
    }
    
    const awakeningHeroes = ['델론즈', '실베스타', '스쿨드', '클레미스'];
    
    let html = '';
    heroes.forEach(h => {
        html += `<div style="display: flex; flex-direction: column; gap: 8px; justify-content: flex-end;">`;
        
        if (awakeningHeroes.includes(h)) {
            html += `<button class="skill-btn" style="background-color: #d35400;" onclick="addSkill('${h}', 3)">${h} 각성 스킬</button>`;
        }

        if (h === '쥬피') {
            html += `<button class="skill-btn" style="background-color: #8e44ad;" onclick="addSkill('${h}', '1-1')">${h} 스킬 1-1</button>`;
        }
        
        html += `<button class="skill-btn" style="background-color: #2980b9;" onclick="addSkill('${h}', 2)">${h} 스킬 2</button>`;
        
        if (h === '세인' || h === '발리스타') { 
            html += `<div style="height: 31px;"></div>`; 
        } else { 
            html += `<button class="skill-btn" style="background-color: #34495e;" onclick="addSkill('${h}', 1)">${h} 스킬 1</button>`; 
        }
        html += `</div>`;
    });
    
    container.innerHTML = html; renderSkillQueue();
}

function addSkill(hero, skillNum) {
    if (builderMode.startsWith('raid')) {
        if (skillQueue.length >= 20) return alert(`🚨 강림원정대 스킬 예약은 각 라운드당 최대 20개까지만 가능합니다.`);
        skillQueue.push({ hero: hero, skillNum: skillNum }); 
    } else {
        const limit = builderMode.startsWith('castle') ? 20 : 3;
        const firstEmptyIdx = skillQueue.findIndex(s => s === null || s === undefined);
        if (firstEmptyIdx === -1) return alert(`🚨 스킬 예약은 최대 ${limit}개까지만 가능합니다.`);
        let roundVal = 1; if (builderMode.startsWith('castle')) { const roundRadio = document.querySelector('input[name="skillRound"]:checked'); if (roundRadio) roundVal = parseInt(roundRadio.value); }
        skillQueue[firstEmptyIdx] = { hero: hero, skillNum: skillNum, round: roundVal }; 
    }
    renderSkillQueue();
}

function removeSkill(index) { if (index < skillQueue.length) { if (builderMode.startsWith('raid')) { skillQueue.splice(index, 1); } else { skillQueue[index] = null; } renderSkillQueue(); } }

function renderSkillQueue() {
    const queueDiv = document.getElementById('skillQueue'); 
    if (builderMode.startsWith('raid')) {
        queueDiv.className = 'skill-grid-flex'; let html = '';
        for (let i = 0; i < skillQueue.length; i++) {
            const s = skillQueue[i]; let hero = s.hero; let skillNum = s.skillNum;
            let displayLabel = String(skillNum) === '3' ? '각성 스킬' : (String(skillNum).includes('-') ? `스킬 ${String(skillNum).split('-')[0]}` : `스킬 ${skillNum}`);
            html += `<div class="skill-slot filled castle-slot" onclick="removeSkill(${i})" title="${hero} 스킬 ${skillNum} (클릭 시 취소)"><img loading="lazy" src="./images/skills/${hero} 스킬 ${skillNum}.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:100%; height:100%; object-fit:cover; border-radius:5px;"><span class="skill-fallback" style="display:none; font-size:10px; font-weight:bold; color:#333;">${hero}<br>${displayLabel}</span><div class="skill-text-label">${displayLabel}</div></div>`;
        }
        queueDiv.innerHTML = html;
    } else {
        const limit = builderMode.startsWith('castle') ? 20 : 3;
        queueDiv.className = builderMode.startsWith('castle') ? 'skill-grid-20' : 'skill-grid-3'; let html = '';
        for (let i = 0; i < limit; i++) {
            const s = skillQueue[i];
            if (s !== null && s !== undefined) { 
                let hero = s.hero || (typeof s === 'string' ? s.split(' 스킬 ')[0] : ''); let skillNum = s.skillNum || (typeof s === 'string' ? s.split(' 스킬 ')[1] : ''); let round = s.round || 1;
                let roundClass = builderMode.startsWith('castle') ? `round-${round}` : ''; let slotClass = builderMode.startsWith('castle') ? 'castle-slot' : '';
                let displayLabel = String(skillNum) === '3' ? '각성 스킬' : (String(skillNum).includes('-') ? `스킬 ${String(skillNum).split('-')[0]}` : `스킬 ${skillNum}`);
                html += `<div class="skill-slot filled ${roundClass} ${slotClass}" onclick="removeSkill(${i})" title="${hero} 스킬 ${skillNum} (클릭 시 취소)"><img loading="lazy" src="./images/skills/${hero} 스킬 ${skillNum}.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:100%; height:100%; object-fit:cover; border-radius:5px;"><span class="skill-fallback" style="display:none; font-size:10px; font-weight:bold; color:#333;">${hero}<br>${displayLabel}</span><div class="skill-text-label">${displayLabel}</div></div>`;
            } else { let slotClass = builderMode.startsWith('castle') ? 'castle-slot' : ''; html += `<div class="skill-slot empty ${slotClass}" onclick="removeSkill(${i})"><span style="color:#bdc3c7; font-weight:900;">${i+1}</span></div>`; }
        }
        queueDiv.innerHTML = html;
    }
}

function clickSlot(index) { activeSlotType = 'hero'; if (boardSlots[index]) boardSlots[index] = null; else activeSlotIndex = index; renderBuilderBoard(); applyFilters(); }
function clickPetSlot() { activeSlotType = 'pet'; if(currentSelectedPet) currentSelectedPet = null; renderBuilderBoard(); applyFilters(); }

function selectHero(heroName) {
    if (boardSlots.includes(heroName)) return boardSlots[boardSlots.indexOf(heroName)] = null, renderBuilderBoard();
    const limit = (builderMode.startsWith('castle') || builderMode.startsWith('raid')) ? 5 : 3;
    if (boardSlots.filter(h => h).length >= limit) return alert(`최대 ${limit}명만 배치 가능합니다!`);
    if (builderMode.startsWith('raid')) {
        let otherRound = currentRaidRound === 1 ? 2 : 1;
        if (raidDataBuffer[otherRound].slots.includes(heroName)) { return alert(`🚨 '${heroName}' 영웅은 이미 ${otherRound}라운드에 배치되어 있습니다. (중복 불가)`); }
    }
    if (!boardSlots[activeSlotIndex]) boardSlots[activeSlotIndex] = heroName;
    else { const firstEmpty = boardSlots.findIndex(h => !h); if (firstEmpty !== -1) boardSlots[firstEmpty] = heroName, activeSlotIndex = firstEmpty; }
    const nextEmpty = boardSlots.findIndex(h => !h); if (nextEmpty !== -1) activeSlotIndex = nextEmpty;
    renderBuilderBoard();
}

function selectPet(petName) { 
    if (builderMode.startsWith('raid')) {
        let otherRound = currentRaidRound === 1 ? 2 : 1;
        if (raidDataBuffer[otherRound].pet === petName) { return alert(`🚨 '${petName}' 펫은 이미 ${otherRound}라운드에 배치되어 있습니다. (중복 불가)`); }
    }
    currentSelectedPet = petName; renderBuilderBoard(); 
}

function renderBuilderBoard() {
    const boardEl = document.getElementById('builderHeroBoard');
    if (builderMode.startsWith('castle') || builderMode.startsWith('raid')) boardEl.classList.add('castle-layout'); else boardEl.classList.remove('castle-layout');
    const layout = formations[document.getElementById('formationType').value]; let html = '';
    ['후열', '전열'].forEach((lineName, lineIdx) => {
        html += `<div class="formation-line"><div class="line-title">${lineName}</div>`;
        const start = lineIdx === 0 ? layout.front : 0; const end = lineIdx === 0 ? 5 : layout.front;
        for(let i = start; i < end; i++) {
            const h = boardSlots[i]; const isActive = (i === activeSlotIndex && !h && activeSlotType === 'hero') ? 'active-slot' : '';
            let roleStr = ''; if(h) { const heroInfo = heroData.find(x => x.name === h); if(heroInfo) roleStr = heroInfo.role; }
            const bColor = getRoleColor(roleStr);
            html += h ? `<div class="hero-slot filled" style="border-color: ${bColor};" onclick="clickSlot(${i})"><img loading="lazy" src="./images/heroes/${h}.png" onerror="this.src='https://via.placeholder.com/75'"></div>` : `<div class="hero-slot ${isActive}" onclick="clickSlot(${i})"><span style="color:${isActive?'#c0392b':'#7f8c8d'};">선택</span></div>`;
        }
        html += '</div>';
    });
    boardEl.innerHTML = html;
    const pSlot = document.getElementById('builderPetSlot');
    if (currentSelectedPet) { pSlot.className = 'pet-slot filled'; pSlot.innerHTML = `<img loading="lazy" src="./images/pets/${currentSelectedPet}.png" onerror="this.src='https://via.placeholder.com/80'">`; } 
    else { pSlot.className = `pet-slot ${activeSlotType === 'pet' ? 'active-slot' : ''}`; pSlot.innerHTML = `<div class="pet-slot-title">펫 슬롯</div>`; }
}

function applyFilters() {
    const pool = document.getElementById('charPool'); const searchText = document.getElementById('searchInput').value.trim().toLowerCase(); pool.innerHTML = '';
    if (activeSlotType === 'hero') {
        document.getElementById('raritySelect').style.display = 'inline-block'; document.getElementById('roleSelect').style.display = 'inline-block';
        const sortType = document.getElementById('sortSelect').value, filterRarity = document.getElementById('raritySelect').value, filterRole = document.getElementById('roleSelect').value;
        let filtered = heroData.filter(c => c.name.toLowerCase().includes(searchText) && (filterRarity==='all'||c.rarity===filterRarity) && (filterRole==='all'||c.role===filterRole));
        filtered.sort((a,b) => sortType==='rarity' ? (rarityRank[a.rarity]-rarityRank[b.rarity] || a.name.localeCompare(b.name)) : a.name.localeCompare(b.name));
        filtered.forEach(c => { pool.innerHTML += `<div class="char-card" onclick="selectHero('${c.name}')"><div class="badge badge-${c.rarity}">${c.rarity}</div><img loading="lazy" src="./images/heroes/${c.name}.png" onerror="this.src='https://via.placeholder.com/60'"><div class="char-name">${c.name}</div></div>`; });
    } else {
        document.getElementById('raritySelect').style.display = 'none'; document.getElementById('roleSelect').style.display = 'none';
        let filtered = petData.filter(p => p.name.toLowerCase().includes(searchText)).sort((a,b)=>a.name.localeCompare(b.name));
        filtered.forEach(p => { pool.innerHTML += `<div class="char-card" onclick="selectPet('${p.name}')"><div class="badge badge-펫">펫</div><img loading="lazy" src="./images/pets/${p.name}.png" onerror="this.src='https://via.placeholder.com/60'"><div class="char-name">${p.name}</div></div>`; });
    }
}

function renderExFields(values = []) {
    const container = document.getElementById('exContainer'); container.innerHTML = '';
    currentExCount = values.length > 0 ? values.length : 1;
    for(let i=0; i<currentExCount; i++) container.innerHTML += createExSelectHTML(i, values[i] || '없음');
    updateAddExBtn();
}
function createExSelectHTML(index, val) { let options = exEquipOptions.map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join(''); return `<select id="eqEx${index}" class="ex-select">${options}</select>`; }
function addExField() { if(currentExCount < 4) { document.getElementById('exContainer').insertAdjacentHTML('beforeend', createExSelectHTML(currentExCount, '없음')); currentExCount++; updateAddExBtn(); } }
function updateAddExBtn() { document.getElementById('addExBtn').style.display = currentExCount >= 4 ? 'none' : 'inline-block'; }

let currentEditingHero = null;
function openEquipModal(heroName, isReadOnly) {
    currentEditingHero = heroName; document.getElementById('equipModalTitle').innerText = `${heroName} 장비 세팅`; document.getElementById('saveEquipBtn').style.display = isReadOnly ? 'none' : 'inline-block';
    let safeEquips = {};
    if (isReadOnly) {
        if (viewingDeckType === 'raid' && viewingDeck) { const r1Equips = (viewingDeck.r1 && viewingDeck.r1.equips) || {}; const r2Equips = (viewingDeck.r2 && viewingDeck.r2.equips) || {}; safeEquips = r1Equips[heroName] ? r1Equips : (r2Equips[heroName] ? r2Equips : {}); } 
        else { safeEquips = (viewingDeck && viewingDeck.equips) || {}; }
    } else { safeEquips = heroEquipments || {}; }
    const eq = safeEquips[heroName] || {};
    
    document.getElementById('eqSet').value = eq.set || '없음'; document.getElementById('eqMain').value = eq.mainOpt || ''; document.getElementById('eqAccMain').value = eq.accMain || '없음'; document.getElementById('eqAccSub').value = eq.accSub || '없음'; document.getElementById('eqDetail').value = eq.detail || '';
    renderExFields(eq.ex || []);
    if(isReadOnly) { document.getElementById('addExBtn').style.display = 'none'; } else { document.getElementById('addExBtn').style.display = currentExCount >= 4 ? 'none' : 'inline-block'; }
    const inputs = document.querySelectorAll('.equip-form select, .equip-form input'); inputs.forEach(input => input.disabled = isReadOnly);
    document.getElementById('equipModal').style.display = 'flex';
}
function closeEquipModal() { document.getElementById('equipModal').style.display = 'none'; }
function saveEquipData() {
    const exValues = []; for(let i=0; i<currentExCount; i++) exValues.push(document.getElementById(`eqEx${i}`).value);
    heroEquipments[currentEditingHero] = { set: document.getElementById('eqSet').value, mainOpt: document.getElementById('eqMain').value, accMain: document.getElementById('eqAccMain').value, accSub: document.getElementById('eqAccSub').value, detail: document.getElementById('eqDetail').value, ex: exValues };
    closeEquipModal(); const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments };
    renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true, builderMode.startsWith('castle') || builderMode.startsWith('raid'));
}

function saveDeck() {
    const deckName = document.getElementById('deckNameInput').value.trim() || '이름 없는 빌드';
    const deckDesc = document.getElementById('deckDescInput').value.trim();
    const speedOrder = document.getElementById('deckSpeedOrderInput').value.trim(); 
    
    if (builderMode.startsWith('raid')) {
        saveCurrentRaidRound();
        if (builderMode === 'raid_edit') {
            const deck = mockRaidDecks.find(d => d.id === currentTargetDeckId);
            if(deck) {
                deck.name = deckName; deck.desc = deckDesc; deck.r1 = JSON.parse(JSON.stringify(raidDataBuffer[1])); deck.r2 = JSON.parse(JSON.stringify(raidDataBuffer[2]));
                deck.r1.speedOrder = document.getElementById('raidSpeed1').value.trim(); deck.r2.speedOrder = document.getElementById('raidSpeed2').value.trim();
                delete deck.skills; alert(`✅ 강림원정대 빌드가 수정되었습니다!`); logActivity('🛠️ 강림원정대 빌드를 수정했습니다.');
            }
        } else {
            const newR1 = JSON.parse(JSON.stringify(raidDataBuffer[1])); const newR2 = JSON.parse(JSON.stringify(raidDataBuffer[2]));
            newR1.speedOrder = document.getElementById('raidSpeed1').value.trim(); newR2.speedOrder = document.getElementById('raidSpeed2').value.trim();
            mockRaidDecks.push({ id: Date.now(), boss: currentRaidBoss, name: deckName, desc: deckDesc, r1: newR1, r2: newR2, authorId: currentUser.id, authorNick: currentUser.nickname });
            alert(`✅ 강림원정대 빌드가 등록되었습니다!`); logActivity('✨ 새로운 강림원정대 빌드를 등록했습니다.');
        }
        saveDecksDB(); toggleView('raidView'); renderRaidTab(currentRaidBoss); return;
    }

    if (builderMode.startsWith('castle')) {
        if(builderMode === 'castle_edit') {
            const deck = mockCastleDecks.find(d => d.day === currentCastleDay);
            if(deck) { deck.desc = deckDesc; deck.speedOrder = speedOrder; deck.formation = document.getElementById('formationType').value; deck.slots = [...boardSlots]; deck.pet = currentSelectedPet; deck.equips = JSON.parse(JSON.stringify(heroEquipments)); deck.skills = [...skillQueue]; alert(`✅ ${dayNames[currentCastleDay]}요일 공성전 빌드가 수정되었습니다!`); logActivity('🛠️ 공성전 빌드를 수정했습니다.'); }
        } else {
            mockCastleDecks.push({ id: Date.now(), day: currentCastleDay, desc: deckDesc, speedOrder: speedOrder, formation: document.getElementById('formationType').value, slots: [...boardSlots], pet: currentSelectedPet, equips: JSON.parse(JSON.stringify(heroEquipments)), skills: [...skillQueue], authorId: currentUser.id, authorNick: currentUser.nickname }); 
            alert(`✅ ${dayNames[currentCastleDay]}요일 공성전 빌드가 등록되었습니다!`); logActivity('✨ 새로운 공성전 빌드를 등록했습니다.'); 
        }
        saveDecksDB(); toggleView('castleView'); renderCastleTab(currentCastleDay); return;
    }

    if (builderMode.startsWith('attack_target')) {
        const targetName = document.getElementById('attackDeckNameInput').value.trim();
        if(!targetName) return alert('적 방어 덱 이름을 입력해주세요.'); if(boardSlots.filter(h => h !== null).length === 0) return alert("🚨 최소 1명 이상의 영웅을 배치해주세요.");
        if (builderMode === 'attack_target_edit') { 
            const target = mockAttackDecks.find(d => d.id === currentTargetDeckId); target.targetName = targetName; target.formation = document.getElementById('formationType').value; target.targetHeroes = [...boardSlots]; target.targetPet = currentSelectedPet; 
            alert(`✅ '${targetName}' 덱이 성공적으로 수정되었습니다!`); logActivity('🛠️ 길드전 적 방어 덱을 수정했습니다.'); 
        } else { 
            mockAttackDecks.push({ id: Date.now(), targetName: targetName, formation: document.getElementById('formationType').value, targetHeroes: [...boardSlots], targetPet: currentSelectedPet, counters: [], authorId: currentUser.id, authorNick: currentUser.nickname }); 
            alert(`✅ 적 방어 덱 '${targetName}'이(가) 등록되었습니다!`); logActivity('✨ 길드전 새로운 적 방어 덱을 등록했습니다.'); 
        }
        saveDecksDB(); toggleView('mainListView'); return;
    }

    if (builderMode.startsWith('attack_counter')) {
        const target = mockAttackDecks.find(d => d.id === currentTargetDeckId);
        if (builderMode === 'attack_counter_edit') { 
            const counter = target.counters.find(c => c.id === currentCounterDeckId); counter.desc = deckDesc; counter.formation = document.getElementById('formationType').value; counter.heroes = [...boardSlots]; counter.pet = currentSelectedPet; counter.equips = JSON.parse(JSON.stringify(heroEquipments)); counter.skills = [...skillQueue]; 
            alert(`✅ 카운터 덱이 성공적으로 수정되었습니다!`); logActivity('🛠️ 길드전 카운터 덱을 수정했습니다.'); 
        } else { 
            target.counters.push({ id: Date.now(), desc: deckDesc, formation: document.getElementById('formationType').value, heroes: [...boardSlots], pet: currentSelectedPet, equips: JSON.parse(JSON.stringify(heroEquipments)), skills: [...skillQueue], authorId: currentUser.id, authorNick: currentUser.nickname, wins: 0, losses: 0, createdAt: Date.now(), votes: {} }); 
            alert(`✅ 카운터 덱이 성공적으로 등록되었습니다!`); logActivity('✨ 길드전 새로운 카운터 덱을 등록했습니다.'); 
        }
        saveDecksDB(); toggleView('mainListView'); return;
    }

    const deckConcept = document.getElementById('deckConceptSelect').value;
    if(builderMode === 'defense_edit' && viewingDeck) { 
        viewingDeck.name = deckName; viewingDeck.desc = deckDesc; viewingDeck.concept = deckConcept; viewingDeck.formation = document.getElementById('formationType').value; viewingDeck.slots = [...boardSlots]; viewingDeck.pet = currentSelectedPet; viewingDeck.equips = JSON.parse(JSON.stringify(heroEquipments)); viewingDeck.skills = [...skillQueue]; 
        alert(`✅ '${deckName}' 덱이 성공적으로 수정되었습니다!`); logActivity('🛠️ 길드전 방어 추천 덱을 수정했습니다.'); 
    } else { 
        mockDefenseDecks.push({ id: Date.now(), name: deckName, desc: deckDesc, concept: deckConcept, formation: document.getElementById('formationType').value, slots: [...boardSlots], pet: currentSelectedPet, equips: JSON.parse(JSON.stringify(heroEquipments)), skills: [...skillQueue], authorId: currentUser.id, authorNick: currentUser.nickname }); 
        alert(`✅ '${deckName}' 덱이 성공적으로 추가되었습니다!`); logActivity('✨ 길드전 새로운 방어 추천 덱을 등록했습니다.'); 
    }
    saveDecksDB(); toggleView('mainListView');
}

// ==========================================
// 📊 길드원 접속 및 활동 로그 시스템
// ==========================================
let currentLogData = []; let currentLogPage = 1; const logsPerPage = 10;
function logActivity(actionDesc) { if (!currentUser) return; const logEntry = { userId: currentUser.id, nickname: currentUser.nickname, action: actionDesc, timestamp: Date.now() }; db.collection('activityLogs').add(logEntry); }

async function viewUserLogs(userId) {
    const user = usersDB.find(u => u.id === userId); if (!user) return;
    if (roleWeight[currentUser.role] < roleWeight[user.role]) { alert('본인보다 높은 권한의 길드원 로그는 확인할 수 재접속할 수 없습니다.'); return; }
    
    document.getElementById('logModalTitle').innerText = `[${user.nickname}] 님의 활동 로그`;
    const lastLoginDate = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '기록 없음';
    document.getElementById('logModalLastLogin').innerHTML = `<strong>최근 접속 일시:</strong> <span style="color:#3498db;">${lastLoginDate}</span>`;
    
    const logListEl = document.getElementById('logModalList'); logListEl.innerHTML = '<div style="text-align:center; padding: 20px; color:#7f8c8d;">로그 데이터를 불러오는 중입니다... ⏳</div>';
    document.getElementById('userLogModal').style.display = 'flex'; document.getElementById('logPrevBtn').style.display = 'none'; document.getElementById('logNextBtn').style.display = 'none'; document.getElementById('logPageInfo').style.display = 'none';

    try {
        const snap = await db.collection('activityLogs').where('userId', '==', userId).orderBy('timestamp', 'desc').limit(100).get();
        currentLogData = []; snap.forEach(doc => currentLogData.push(doc.data()));
        currentLogPage = 1; renderLogPage();
    } catch(error) { console.error(error); logListEl.innerHTML = '<div style="text-align:center; padding: 20px; color:#e74c3c;">로그 데이터를 불러오는데 실패했습니다. (콘솔의 에러 메시지를 확인해주세요)</div>'; }
}

function renderLogPage() {
    const logListEl = document.getElementById('logModalList'); const totalPages = Math.ceil(currentLogData.length / logsPerPage) || 1;
    const startIndex = (currentLogPage - 1) * logsPerPage; const endIndex = startIndex + logsPerPage; const pageData = currentLogData.slice(startIndex, endIndex);
    
    let html = '<ul style="list-style:none; padding:0; margin:0; font-size:13px;">';
    if (pageData.length === 0) { html += '<li style="padding:10px; text-align:center; color:#7f8c8d;">활동 내역이 없습니다.</li>'; } else { pageData.forEach(data => { const timeStr = new Date(data.timestamp).toLocaleString(); html += `<li style="padding:10px 0; border-bottom:1px dashed #ddd;"><span style="color:#95a5a6; font-size:11px; display:block; margin-bottom:3px;">🕒 ${timeStr}</span><span style="color:#2c3e50; font-weight:bold;">${data.action}</span></li>`; }); } html += '</ul>';
    logListEl.innerHTML = html;
    document.getElementById('logPageInfo').innerText = `${currentLogPage} / ${totalPages}`; document.getElementById('logPageInfo').style.display = 'inline-block';
    document.getElementById('logPrevBtn').style.display = currentLogPage > 1 ? 'inline-block' : 'none'; document.getElementById('logNextBtn').style.display = currentLogPage < totalPages ? 'inline-block' : 'none';
}

function changeLogPage(delta) { const totalPages = Math.ceil(currentLogData.length / logsPerPage) || 1; currentLogPage += delta; if (currentLogPage < 1) currentLogPage = 1; if (currentLogPage > totalPages) currentLogPage = totalPages; renderLogPage(); }
function closeUserLogModal() { document.getElementById('userLogModal').style.display = 'none'; }

// ==========================================
// 💡 시스템 권한 설정 모달 제어 로직
// ==========================================
function openPermModal() {
    if (!currentUser || !['admin', 'master'].includes(currentUser.role)) return alert('권한이 없습니다.');
    renderPermSelects();
    document.getElementById('permModal').style.display = 'flex';
}

function closePermModal() { document.getElementById('permModal').style.display = 'none'; }

function renderPermSelects() {
    const keys = ['castleAdd', 'castleManage', 'gwTargetAdd', 'gwTargetManage', 'gwDefenseAdd', 'gwDefenseManage', 'gwCounterAdd', 'gwCounterManage', 'raidAdd', 'raidManage'];
    keys.forEach(k => {
        const el = document.getElementById('perm' + k.charAt(0).toUpperCase() + k.slice(1));
        if(el) el.value = permConfig[k] || 'admin';
    });
}

function savePermConfig() {
    if (!currentUser || !['admin', 'master'].includes(currentUser.role)) return alert('권한이 없습니다.');
    
    const keys = ['castleAdd', 'castleManage', 'gwTargetAdd', 'gwTargetManage', 'gwDefenseAdd', 'gwDefenseManage', 'gwCounterAdd', 'gwCounterManage', 'raidAdd', 'raidManage'];
    keys.forEach(k => {
        const el = document.getElementById('perm' + k.charAt(0).toUpperCase() + k.slice(1));
        if(el) permConfig[k] = el.value;
    });
    
    db.collection('settings').doc('permissions').set(permConfig)
        .then(() => { 
            logActivity('👑 관리자: 시스템 메뉴 권한 설정을 변경했습니다.');
            alert('✅ 권한 설정이 성공적으로 저장 및 적용되었습니다!');
            closePermModal(); 
            toggleView(document.getElementById('adminView').style.display === 'block' ? 'adminView' : 'homeView'); 
        })
        .catch(e => alert('권한 설정 저장 실패: ' + e));
}