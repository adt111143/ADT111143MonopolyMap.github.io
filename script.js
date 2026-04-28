// --- 1. 真實抽獎機率設定 ---
const prizeWeights = {
    '杯套': 5,
    '吊飾 (骰子款)': 5, '吊飾 (棋子款)': 5,
    'L夾': 15,
    '貼紙 (骰子款)': 20, '貼紙 (棋子款)': 20,
    '再來一次': 10, '謝謝惠顧': 10
};

// --- 初始庫存 ---
let currentInventory = {
    '杯套': 20, '吊飾 (骰子款)': 10, '吊飾 (棋子款)': 10,
    'L夾': 20, '貼紙 (骰子款)': 10, '貼紙 (棋子款)': 10
};

// --- 2. 版面配置：11 個獎品 (加上起點剛好 12 格) ---
const prizePool = [
    '杯套',                      
    '吊飾 (骰子款)',              
    '吊飾 (棋子款)',              
    'L夾', 'L夾', 
    '貼紙 (骰子款)', '貼紙 (骰子款)', 
    '貼紙 (棋子款)', '貼紙 (棋子款)', 
    '再來一次',                  
    '謝謝惠顧'                   
];

// 單一佔位的稀有項目，絕對不能出現在起點後面一格
const singleSlotItems = ['杯套', '吊飾 (骰子款)', '吊飾 (棋子款)', '再來一次', '謝謝惠顧'];

let currentBoardLayout = [];
let playerPosition = 0; 
let isMoving = false;
const gridSize = 85;

// --- 3. 座標計算 (4x4 矩形外框 = 12格) ---
const cellCoordinates = [];
for (let x = 0; x <= 3; x++) cellCoordinates.push({ x: x * gridSize, y: 0 }); // 上
for (let y = 1; y <= 2; y++) cellCoordinates.push({ x: 3 * gridSize, y: y * gridSize }); // 右
for (let x = 3; x >= 0; x--) cellCoordinates.push({ x: x * gridSize, y: 3 * gridSize }); // 下
for (let y = 2; y >= 1; y--) cellCoordinates.push({ x: 0, y: y * gridSize }); // 左

// --- 取得 DOM 元素 ---
const sceneEl = document.getElementById('scene-container');
const boardEl = document.getElementById('monopoly-board');
const flagEl = document.getElementById('player-flag');
const diceContainerEl = document.getElementById('dice-container');
const diceEls = document.querySelectorAll('.die');
const prizeModalEl = document.getElementById('prize-modal'); 

// 庫存面板相關
const inventoryToggleBtn = document.getElementById('inventory-toggle-btn');
const inventoryPanelEl = document.getElementById('inventory-modal-overlay');


// --- 4. 核心演算法：絕對安全的洗牌 (防呆) ---
function shuffleWithConstraints() {
    let result = new Array(12).fill(null);
    result[0] = "起點";

    // 過濾出安全獎品放在第一格
    let safeItems = prizePool.filter(item => !singleSlotItems.includes(item));
    let idx1 = Math.floor(Math.random() * safeItems.length);
    result[1] = safeItems.splice(idx1, 1)[0];

    // 扣除已經放置在第一格的獎品
    let remainingPool = [...prizePool];
    remainingPool.splice(remainingPool.indexOf(result[1]), 1);

    // 剩下的獎品徹底洗牌
    for (let i = remainingPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingPool[i], remainingPool[j]] = [remainingPool[j], remainingPool[i]];
    }

    // 填入剩下的格子 (Index 2 ~ 11)
    for (let i = 2; i < 12; i++) result[i] = remainingPool.pop();
    return result;
}

// 繪製地圖格子
function renderBoard() {
    boardEl.querySelectorAll('.square').forEach(sq => sq.remove());
    currentBoardLayout.forEach((name, index) => {
        const sq = document.createElement('div');
        sq.className = `square ${index === 0 ? 'start-node' : ''}`;
        sq.style.left = `${cellCoordinates[index].x}px`;
        sq.style.top = `${cellCoordinates[index].y}px`;
        sq.textContent = name;
        boardEl.appendChild(sq);
    });
}

// --- 庫存面板事件 (支援點擊外側關閉) ---
inventoryToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止點擊按鈕時觸發外側關閉
    inventoryPanelEl.classList.remove('hidden');
});


// 【關鍵修改】只有庫存面板可以透過點擊灰色外側區域來關閉
inventoryPanelEl.addEventListener('click', (e) => {
    // 檢查點擊的是不是外層的半透明遮罩本體
    if (e.target === inventoryPanelEl) {
        inventoryPanelEl.classList.add('hidden');
    }
});
// 註：prizeModalEl 沒有綁定這個點擊事件，所以得獎框不能點擊外側關閉！


// --- 動態生成帶有增減按鈕的庫存清單 ---
function updateInventoryDisplay() {
    const inventoryListEl = document.getElementById('inventory-list');
    inventoryListEl.innerHTML = '';
    
    for (const [name, count] of Object.entries(currentInventory)) {
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = name;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'item-controls';

        // 減量按鈕
        const minusBtn = document.createElement('button');
        minusBtn.className = 'ctrl-btn';
        minusBtn.textContent = '-';
        minusBtn.disabled = count <= 0;
        minusBtn.onclick = () => {
            if (currentInventory[name] > 0) {
                currentInventory[name]--;
                updateInventoryDisplay();
            }
        };

        const countSpan = document.createElement('span');
        countSpan.className = 'item-count';
        countSpan.textContent = count;

        // 增量按鈕
        const plusBtn = document.createElement('button');
        plusBtn.className = 'ctrl-btn';
        plusBtn.textContent = '+';
        plusBtn.onclick = () => {
            currentInventory[name]++;
            updateInventoryDisplay();
        };

        controlsDiv.appendChild(minusBtn);
        controlsDiv.appendChild(countSpan);
        controlsDiv.appendChild(plusBtn);
        li.appendChild(nameSpan);
        li.appendChild(controlsDiv);
        
        inventoryListEl.appendChild(li);
    }
}

// 啟動與重置遊戲
function initGame() {
    currentBoardLayout = shuffleWithConstraints();
    renderBoard();
    updateInventoryDisplay();
    moveFlag(0, true);
}

// --- 5. 視角推擠 (配合 4x4 外框中心跟隨) ---
function updateCameraFollow(targetX, targetY) {
    const viewW = document.getElementById('game-viewport').clientWidth;
    const viewH = document.getElementById('game-viewport').clientHeight;
    const padding = 60; 
    const boundX = (viewW / 2) - padding;
    const boundY = (viewH / 2) - padding;

    const flagX = targetX - (2 * gridSize) + (gridSize / 2);
    const flagY = targetY - (2 * gridSize) + (gridSize / 2);

    const scale = 1.2;
    const cos45 = 0.7071, cos60 = 0.5;
    const screenX = scale * (flagX * cos45 + flagY * cos45); 
    const screenY = scale * cos60 * (flagY * cos45 - flagX * cos45); 

    let shiftX = 0, shiftY = 0;
    if (screenX > boundX) shiftX = boundX - screenX;
    else if (screenX < -boundX) shiftX = -boundX - screenX;
    if (screenY > boundY) shiftY = boundY - screenY;
    else if (screenY < -boundY) shiftY = -boundY - screenY;

    let cx = 0, cy = 0;
    if (shiftX !== 0 || shiftY !== 0) {
        const u = shiftX / (scale * cos45); 
        const v = shiftY / (scale * cos60 * cos45); 
        cy = (u + v) / 2; cx = (u - v) / 2;
    }
    sceneEl.style.transform = `scale(${scale}) rotateX(60deg) rotateZ(-45deg) translate(${cx}px, ${cy}px)`;
}

// 移動旗子
function moveFlag(cellIndex, instant = false) {
    playerPosition = cellIndex % 12;
    const { x, y } = cellCoordinates[playerPosition];
    flagEl.style.transition = instant ? 'none' : 'left 0.4s ease-out, top 0.4s ease-out';
    flagEl.style.left = `${x}px`;
    flagEl.style.top = `${y}px`;
    updateCameraFollow(x, y);
}

// 依權重抽出獎品
function drawPrize() {
    let pool = [];
    for (const [p, w] of Object.entries(prizeWeights)) {
        if (currentInventory[p] === 0) continue;
        for (let i = 0; i < w; i++) pool.push(p);
    }
    if (pool.length === 0) return '謝謝惠顧';
    return pool[Math.floor(Math.random() * pool.length)];
}

// 【神級防呆：確保 2 顆骰子走到合法格數】
function getValidTargetAndSteps() {
    let maxAttempts = 50; 
    while(maxAttempts-- > 0) {
        const prize = drawPrize();
        let possibleIndices = [];
        currentBoardLayout.forEach((p, i) => { if(p === prize) possibleIndices.push(i); });
        
        let targetIdx = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
        let s = (targetIdx - playerPosition + 12) % 12;
        if (s === 0) s = 12; 
        
        if (s > 1 && s <= 12) {
            return { finalPrize: prize, steps: s };
        }
    }
    for (let i = 0; i < 12; i++) {
        let s = (i - playerPosition + 12) % 12;
        if (s > 1 && s <= 12) return { finalPrize: currentBoardLayout[i], steps: s === 0 ? 12 : s };
    }
}

// ==========================================
// 6. 事件監聽：點擊骰子抽獎
// ==========================================
diceContainerEl.addEventListener('click', () => {
    if (isMoving) return;
    isMoving = true;
    
    // 加入搖骰子動畫
    diceEls.forEach(el => el.classList.add('rolling'));
    
    // 取得合法目標與步數
    const { finalPrize, steps } = getValidTargetAndSteps();
    
    // 分配給 2 顆骰子的假數字
    const d = [1, 1]; 
    let rem = steps - 2; 
    while(rem > 0) { 
        let r = Math.floor(Math.random() * 2); 
        if(d[r] < 6) { d[r]++; rem--; } 
    }

    setTimeout(() => {
        // 顯示數字並停止動畫
        diceEls.forEach((el, i) => { el.classList.remove('rolling'); el.textContent = d[i]; });
        
        let cur = 0;
        let intv = setInterval(() => {
            moveFlag(playerPosition + 1); cur++;
            
            // 走到終點時觸發彈出框
            if(cur === steps) {
                clearInterval(intv);
                
                // 扣除庫存並刷新左上角列表
                if(currentInventory[finalPrize] !== undefined && currentInventory[finalPrize] > 0) {
                    currentInventory[finalPrize]--;
                }
                updateInventoryDisplay(); 
                
                // 設定彈出框訊息
                let modalTitle = "恭喜中獎！";
                let modalMsg = `獲得 ${finalPrize}`;
                
                if (finalPrize === '再來一次') {
                    modalTitle = "運氣真好！"; modalMsg = "獲得 再來一次！";
                } else if (finalPrize === '謝謝惠顧') {
                    modalTitle = "再接再厲！"; modalMsg = "命運：謝謝惠顧";
                }
                
                document.getElementById('modal-title').textContent = modalTitle;
                document.getElementById('modal-message').innerHTML = modalMsg;
                
                // 停頓一下後彈出得獎框
                setTimeout(() => {
                    prizeModalEl.classList.remove('hidden');
                    isMoving = false;
                }, 400); 
            }
        }, 400);
    }, 800);
});

// ==========================================
// 7. 得獎彈出框：重新一局按鈕
// ==========================================
const restartBtn = document.getElementById('modal-restart-btn');
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        prizeModalEl.classList.add('hidden'); // 關閉框框
        initGame(); // 重置地圖與位置
        diceEls.forEach(el => el.textContent = '1'); // 骰子歸位
    });
}

// 監聽視窗尺寸改變時重算鏡頭
window.addEventListener('resize', () => moveFlag(playerPosition, true));

// 一打開網頁立刻執行載入
initGame();