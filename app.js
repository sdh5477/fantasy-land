// 💡 현재 접속 중인 사용자를 흉내 내는 가짜 데이터입니다.
// role을 'user'로 바꾸시면 삭제 버튼이 보이지 않게 됩니다.
let currentUser = { id: 'admin1', role: 'admin' };

let boardSlots = [null, null, null, null, null];
let activeSlotIndex = 0; 
let currentSelectedPet = null;
let activeSlotType = 'hero'; 
let heroEquipments = {}; 
let skillQueue = []; 

const formations = { basic: { front: 2, back: 3 }, balance: { front: 3, back: 2 }, attack: { front: 1, back: 4 }, protect: { front: 4, back: 1 } };
const exEquipOptions = ["없음", "모든 공격력(%)", "방어력(%)", "생명력(%)", "효과 적중", "효과 저항", "피해 증폭", "파쇄", "탄성", "재생"];

let currentExCount = 1;

// 💡 덱 데이터에 작성자 ID(authorId)가 추가되었습니다.
let mockDefenseDecks = [
    { 
        id: Date.now(), 
        name: "국민 밸런스 방덱", 
        concept: "속내실", 
        formation: "balance", 
        slots: ["루디", "카린", null, "제이브", null], 
        pet: "루", 
        desc: "가장 무난하고 생존력이 높은 방어 덱입니다.",
        equips: {
            "루디": { set: "수호자", mainOpt: "방방받받", accMain: "불사", accSub: "권능", ex: ["방어력(%)","생명력(%)"] },
            "제이브": { set: "추적자", mainOpt: "치확치피", accMain: "권능", accSub: "없음", ex: ["모든 공격력(%)"] }
        },
        skills: ["루디 스킬 1", "제이브 스킬 2", "카린 스킬 1"],
        authorId: "user_123" // 이 덱을 쓴 사람의 아이디
    }
];

let viewingDeck = null; 

function getRoleColor(role) {
    switch(role) {
        case '공격형': return '#e74c3c'; 
        case '마법형': return '#3498db'; 
        case '방어형': return '#8d6e63'; 
        case '지원형': return '#f1c40f'; 
        case '만능형': return '#9b59b6'; 
        default: return '#3498db';
    }
}

function switchMainTab(tabType) {
    document.getElementById('tab-attack').classList.remove('active');
    document.getElementById('tab-defense').classList.remove('active');
    const content = document.getElementById('deckListContent');
    content.innerHTML = '';
    
    if(tabType === 'attack') {
        document.getElementById('tab-attack').classList.add('active');
        content.innerHTML = '<p style="text-align:center; padding: 20px; color: #7f8c8d;">⚔️ 공격 탭 업데이트 대기 중</p>';
    } else {
        document.getElementById('tab-defense').classList.add('active');
        mockDefenseDecks.forEach(deck => {
            const heroHtml = deck.slots.filter(h => h).map(h => `<img src="./images/heroes/${h}.png" class="mini-hero" onerror="this.src='https://via.placeholder.com/40'">`).join('');
            content.innerHTML += `
                <div class="defense-deck" onclick="viewDeckDetail(${deck.id})">
                    <div>
                        <div style="font-weight: bold; color: #2980b9; margin-bottom: 5px;">${deck.name || '이름 없는 방어 덱'} <span class="badge-concept" style="font-size:10px;">${deck.concept}</span></div>
                        <div style="font-size: 13px; color: #555;">💡 ${deck.desc || '설명이 없습니다.'}</div>
                    </div>
                    <div class="mini-hero-list">
                        ${heroHtml} <span style="font-size: 18px; margin: 0 5px;">+</span> <img src="./images/pets/${deck.pet}.png" class="mini-hero" onerror="this.src='https://via.placeholder.com/40'">
                    </div>
                </div>
            `;
        });
    }
}

function toggleView(viewId) {
    ['homeView', 'mainListView', 'deckBuilderView', 'deckDetailView'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    localStorage.setItem('currentView', viewId);
    if (viewId === 'mainListView') switchMainTab('defense');
}

window.onload = function() { toggleView(localStorage.getItem('currentView') || 'homeView'); };

function viewDeckDetail(deckId) {
    viewingDeck = mockDefenseDecks.find(d => d.id === deckId);
    document.getElementById('detailDeckTitle').innerText = viewingDeck.name || '이름 없는 방어 덱';
    document.getElementById('detailDeckConcept').innerText = viewingDeck.concept + ' 컨셉';
    document.getElementById('detailDeckDesc').innerText = viewingDeck.desc ? `💡 ${viewingDeck.desc}` : '💡 설명이 없습니다.';

    // 💡 권한 체크 로직 (관리자이거나 작성자 본인일 때만 삭제 버튼 노출)
    const hasPermission = (currentUser.role === 'admin' || viewingDeck.authorId === currentUser.id);
    document.getElementById('deleteDeckBtn').style.display = hasPermission ? 'inline-block' : 'none';

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

// 💡 덱 삭제 함수 추가
function deleteCurrentDeck() {
    if(confirm("정말 이 덱을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) {
        // 배열에서 해당 덱 찾아 제거
        const deckIndex = mockDefenseDecks.findIndex(d => d.id === viewingDeck.id);
        if(deckIndex !== -1) mockDefenseDecks.splice(deckIndex, 1);
        
        alert("✅ 덱이 정상적으로 삭제되었습니다.");
        viewingDeck = null;
        toggleView('mainListView');
    }
}

function renderReadonlyBoard(boardId, petId, deckData, isEditMode = false) {
    const layout = formations[deckData.formation];
    let html = '';
    ['후열', '전열'].forEach((lineName, lineIdx) => {
        html += `<div class="formation-line"><div class="line-title">${lineName}</div>`;
        const start = lineIdx === 0 ? layout.front : 0;
        const end = lineIdx === 0 ? 5 : layout.front;
        for(let i = start; i < end; i++) {
            const h = deckData.slots[i];
            const eqClass = (deckData.equips && deckData.equips[h]) ? 'has-equip' : '';
            
            let roleStr = '';
            if(h) {
                const heroInfo = heroData.find(x => x.name === h);
                if(heroInfo) roleStr = heroInfo.role;
            }
            const bColor = getRoleColor(roleStr);

            if(h) {
                html += `<div class="hero-slot filled ${eqClass}" style="border-color: ${bColor};" onclick="openEquipModal('${h}', ${!isEditMode})">
                            <img src="./images/heroes/${h}.png" onerror="this.src='https://via.placeholder.com/75'">
                            <div class="equip-badge">E</div>
                         </div>`;
            } else {
                html += `<div class="hero-slot">빈자리</div>`;
            }
        }
        html += '</div>';
    });
    document.getElementById(boardId).innerHTML = html;
    const p = deckData.pet;
    document.getElementById(petId).innerHTML = p ? `<img src="./images/pets/${p}.png" onerror="this.src='https://via.placeholder.com/80'">` : '펫 없음';
}

function editCurrentDeck() {
    boardSlots = [...viewingDeck.slots];
    currentSelectedPet = viewingDeck.pet;
    heroEquipments = JSON.parse(JSON.stringify(viewingDeck.equips || {})); 
    skillQueue = [...(viewingDeck.skills || [])]; 
    document.getElementById('formationType').value = viewingDeck.formation;
    document.getElementById('deckConceptSelect').value = viewingDeck.concept;
    
    // 수정 시 이름과 설명 불러오기
    document.getElementById('deckNameInput').value = viewingDeck.name || '';
    document.getElementById('deckDescInput').value = viewingDeck.desc || '';

    openDeckBuilder();
}

function openDeckBuilder() {
    if(!viewingDeck) {
        boardSlots = [null, null, null, null, null];
        currentSelectedPet = null;
        heroEquipments = {};
        skillQueue = []; 
        document.getElementById('deckConceptSelect').value = '상관없음';
        document.getElementById('deckNameInput').value = '';
        document.getElementById('deckDescInput').value = '';
    }
    toggleView('deckBuilderView');
    switchBuilderTab('config');
}

function switchBuilderTab(tab) {
    document.getElementById('b-tab-config').classList.remove('active');
    document.getElementById('b-tab-detail').classList.remove('active');
    document.getElementById('builderConfigSection').style.display = 'none';
    document.getElementById('builderDetailSection').style.display = 'none';

    if(tab === 'config') {
        document.getElementById('b-tab-config').classList.add('active');
        document.getElementById('builderConfigSection').style.display = 'block';
        activeSlotType = 'hero'; 
        renderBuilderBoard();
        applyFilters();
    } else {
        if(boardSlots.filter(h=>h).length === 0) return alert('최소 1명의 영웅을 배치해야 합니다.');
        document.getElementById('b-tab-detail').classList.add('active');
        document.getElementById('builderDetailSection').style.display = 'block';
        const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments };
        renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true);
        
        renderAvailableSkills();
    }
}

function renderAvailableSkills() {
    const container = document.getElementById('availableSkills');
    container.innerHTML = '';
    
    const heroes = boardSlots.filter(h => h !== null);
    skillQueue = skillQueue.filter(s => heroes.some(h => s.startsWith(h)));

    heroes.forEach(h => {
        if (h === '세인') {
            container.innerHTML += `<button class="skill-btn" onclick="addSkill('${h}', 2)">${h} 스킬 2</button>`;
        } else {
            container.innerHTML += `<button class="skill-btn" onclick="addSkill('${h}', 1)">${h} 스킬 1</button>`;
            container.innerHTML += `<button class="skill-btn" onclick="addSkill('${h}', 2)">${h} 스킬 2</button>`;
        }
    });
    renderSkillQueue();
}

function addSkill(hero, skillNum) {
    if (skillQueue.length >= 3) return alert('🚨 스킬 예약은 최대 3개까지만 가능합니다.');
    const skillName = `${hero} 스킬 ${skillNum}`;
    if (skillQueue.includes(skillName)) return alert('🚨 이미 예약된 스킬입니다.');
    skillQueue.push(skillName);
    renderSkillQueue();
}

function removeSkill(index) {
    if (index < skillQueue.length) {
        skillQueue.splice(index, 1);
        renderSkillQueue();
    }
}

function renderSkillQueue() {
    const queueDiv = document.getElementById('skillQueue');
    let html = '';
    for (let i = 0; i < 3; i++) {
        if (i < skillQueue.length) {
            const text = skillQueue[i].replace(' 스킬 ', '<br>스킬 ');
            html += `<div class="skill-slot filled" onclick="removeSkill(${i})">${text}</div>`;
        } else {
            html += `<div class="skill-slot" onclick="removeSkill(${i})">${i+1}순위</div>`;
        }
    }
    queueDiv.innerHTML = html;
}

function clickSlot(index) {
    activeSlotType = 'hero';
    if (boardSlots[index]) boardSlots[index] = null;
    else activeSlotIndex = index;
    renderBuilderBoard();
    applyFilters();
}

function clickPetSlot() {
    activeSlotType = 'pet';
    if(currentSelectedPet) currentSelectedPet = null;
    renderBuilderBoard();
    applyFilters();
}

function selectHero(heroName) {
    if (boardSlots.includes(heroName)) return boardSlots[boardSlots.indexOf(heroName)] = null, renderBuilderBoard();
    if (boardSlots.filter(h => h).length >= 3) return alert('최대 3명만 배치 가능합니다!');
    
    if (!boardSlots[activeSlotIndex]) boardSlots[activeSlotIndex] = heroName;
    else {
        const firstEmpty = boardSlots.findIndex(h => !h);
        if (firstEmpty !== -1) boardSlots[firstEmpty] = heroName, activeSlotIndex = firstEmpty;
    }
    const nextEmpty = boardSlots.findIndex(h => !h);
    if (nextEmpty !== -1) activeSlotIndex = nextEmpty;
    renderBuilderBoard();
}

function selectPet(petName) { currentSelectedPet = petName; renderBuilderBoard(); }

function renderBuilderBoard() {
    const layout = formations[document.getElementById('formationType').value];
    let html = '';
    ['후열', '전열'].forEach((lineName, lineIdx) => {
        html += `<div class="formation-line"><div class="line-title">${lineName}</div>`;
        const start = lineIdx === 0 ? layout.front : 0;
        const end = lineIdx === 0 ? 5 : layout.front;
        for(let i = start; i < end; i++) {
            const h = boardSlots[i];
            const isActive = (i === activeSlotIndex && !h && activeSlotType === 'hero') ? 'active-slot' : '';
            
            let roleStr = '';
            if(h) {
                const heroInfo = heroData.find(x => x.name === h);
                if(heroInfo) roleStr = heroInfo.role;
            }
            const bColor = getRoleColor(roleStr);

            html += h ? `<div class="hero-slot filled" style="border-color: ${bColor};" onclick="clickSlot(${i})"><img src="./images/heroes/${h}.png" onerror="this.src='https://via.placeholder.com/75'"></div>` 
                      : `<div class="hero-slot ${isActive}" onclick="clickSlot(${i})"><span style="color:${isActive?'#c0392b':'#7f8c8d'};">선택</span></div>`;
        }
        html += '</div>';
    });
    document.getElementById('builderHeroBoard').innerHTML = html;

    const pSlot = document.getElementById('builderPetSlot');
    if (currentSelectedPet) {
        pSlot.className = 'pet-slot filled';
        pSlot.innerHTML = `<img src="./images/pets/${currentSelectedPet}.png" onerror="this.src='https://via.placeholder.com/80'">`;
    } else {
        const isActive = (activeSlotType === 'pet') ? 'active-slot' : '';
        pSlot.className = `pet-slot ${isActive}`;
        pSlot.innerHTML = `<div class="pet-slot-title">펫 슬롯</div>`;
    }
}

function applyFilters() {
    const pool = document.getElementById('charPool');
    const searchText = document.getElementById('searchInput').value.trim().toLowerCase();
    pool.innerHTML = '';

    if (activeSlotType === 'hero') {
        document.getElementById('raritySelect').style.display = 'inline-block';
        document.getElementById('roleSelect').style.display = 'inline-block';
        const sortType = document.getElementById('sortSelect').value, filterRarity = document.getElementById('raritySelect').value, filterRole = document.getElementById('roleSelect').value;
        let filtered = heroData.filter(c => c.name.toLowerCase().includes(searchText) && (filterRarity==='all'||c.rarity===filterRarity) && (filterRole==='all'||c.role===filterRole));
        filtered.sort((a,b) => sortType==='rarity' ? (rarityRank[a.rarity]-rarityRank[b.rarity] || a.name.localeCompare(b.name)) : a.name.localeCompare(b.name));
        
        filtered.forEach(c => {
            let badgeText = c.rarity;

            pool.innerHTML += `
                <div class="char-card" onclick="selectHero('${c.name}')">
                    <div class="badge badge-${c.rarity}">${badgeText}</div>
                    <img src="./images/heroes/${c.name}.png" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="char-name">${c.name}</div>
                </div>`;
        });
    } else {
        document.getElementById('raritySelect').style.display = 'none';
        document.getElementById('roleSelect').style.display = 'none';
        let filtered = petData.filter(p => p.name.toLowerCase().includes(searchText)).sort((a,b)=>a.name.localeCompare(b.name));
        
        filtered.forEach(p => {
            pool.innerHTML += `
                <div class="char-card" onclick="selectPet('${p.name}')">
                    <div class="badge badge-펫">펫</div>
                    <img src="./images/pets/${p.name}.png" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="char-name">${p.name}</div>
                </div>`;
        });
    }
}

function renderExFields(values = []) {
    const container = document.getElementById('exContainer');
    container.innerHTML = '';
    currentExCount = values.length > 0 ? values.length : 1;
    
    for(let i=0; i<currentExCount; i++) {
        container.innerHTML += createExSelectHTML(i, values[i] || '없음');
    }
    updateAddExBtn();
}

function createExSelectHTML(index, val) {
    let options = exEquipOptions.map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
    return `<select id="eqEx${index}" class="ex-select">${options}</select>`;
}

function addExField() {
    if(currentExCount < 4) {
        document.getElementById('exContainer').insertAdjacentHTML('beforeend', createExSelectHTML(currentExCount, '없음'));
        currentExCount++;
        updateAddExBtn();
    }
}

function updateAddExBtn() {
    document.getElementById('addExBtn').style.display = currentExCount >= 4 ? 'none' : 'inline-block';
}

let currentEditingHero = null;
function openEquipModal(heroName, isReadOnly) {
    currentEditingHero = heroName;
    document.getElementById('equipModalTitle').innerText = `${heroName} 장비 세팅`;
    document.getElementById('saveEquipBtn').style.display = isReadOnly ? 'none' : 'inline-block';
    
    const eq = (isReadOnly && viewingDeck) ? viewingDeck.equips[heroName] : heroEquipments[heroName];
    document.getElementById('eqSet').value = eq?.set || '없음';
    document.getElementById('eqMain').value = eq?.mainOpt || '';
    document.getElementById('eqAccMain').value = eq?.accMain || '없음';
    document.getElementById('eqAccSub').value = eq?.accSub || '없음';
    
    renderExFields(eq?.ex || []);
    
    if(isReadOnly) document.getElementById('addExBtn').style.display = 'none';
    const inputs = document.querySelectorAll('.equip-form select, .equip-form input');
    inputs.forEach(input => input.disabled = isReadOnly);
    
    document.getElementById('equipModal').style.display = 'flex';
}

function closeEquipModal() { document.getElementById('equipModal').style.display = 'none'; }

function saveEquipData() {
    const exValues = [];
    for(let i=0; i<currentExCount; i++) {
        exValues.push(document.getElementById(`eqEx${i}`).value);
    }
    heroEquipments[currentEditingHero] = {
        set: document.getElementById('eqSet').value,
        mainOpt: document.getElementById('eqMain').value,
        accMain: document.getElementById('eqAccMain').value,
        accSub: document.getElementById('eqAccSub').value,
        ex: exValues
    };
    closeEquipModal();
    const tempDeck = { formation: document.getElementById('formationType').value, slots: boardSlots, pet: currentSelectedPet, equips: heroEquipments };
    renderReadonlyBoard('detailInputHeroBoard', 'detailInputPetSlot', tempDeck, true);
}

// 💡 덱 저장 시 실제 리스트(mockDefenseDecks)에 반영되도록 기능 완성
function saveDeck() {
    const deckName = document.getElementById('deckNameInput').value.trim() || '이름 없는 방어 덱';
    const deckDesc = document.getElementById('deckDescInput').value.trim();
    const deckConcept = document.getElementById('deckConceptSelect').value;

    if(viewingDeck) {
        // 기존 덱 수정
        viewingDeck.name = deckName;
        viewingDeck.desc = deckDesc;
        viewingDeck.concept = deckConcept;
        viewingDeck.formation = document.getElementById('formationType').value;
        viewingDeck.slots = [...boardSlots];
        viewingDeck.pet = currentSelectedPet;
        viewingDeck.equips = JSON.parse(JSON.stringify(heroEquipments));
        viewingDeck.skills = [...skillQueue];
        alert(`✅ '${deckName}' 덱이 성공적으로 수정되었습니다!`);
    } else {
        // 새로운 덱 추가
        const newDeck = {
            id: Date.now(),
            name: deckName,
            desc: deckDesc,
            concept: deckConcept,
            formation: document.getElementById('formationType').value,
            slots: [...boardSlots],
            pet: currentSelectedPet,
            equips: JSON.parse(JSON.stringify(heroEquipments)),
            skills: [...skillQueue],
            authorId: currentUser.id // 작성자 ID 기록 (삭제 권한용)
        };
        mockDefenseDecks.push(newDeck);
        alert(`✅ '${deckName}' 덱이 성공적으로 추가되었습니다!`);
    }

    viewingDeck = null;
    toggleView('mainListView');
}