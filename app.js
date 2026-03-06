/**
 * Time Tracker - Main Application Logic
 * Syncs with Google Sheets via Google Apps Script (GAS)
 */

// State Management (in-memory cache)
const STATE = {
    clients: [],
    tasks: [],
    logs: [],
};

// Backend Integration (Google Apps Script)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxDF8nE7tzWrcsbO-7dqOGJFbnWfIN5CTE6g69imr9iDoaSEgXoxGs0BNrdJhCYKrhWlg/exec';

// Colors for charts
const CHART_COLORS = [
    '#7b9176', '#d9a982', '#7fa8b8', '#d4c594', '#bda3ab', '#e69a8d',
    '#9fb399', '#f2d4bd', '#a8c6db', '#e8dfb7'
];

// Utility: Generate Unique ID
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Utility: Format time (minutes to H:MM)
const formatDuration = (minutes) => {
    const m = parseInt(minutes, 10);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}m`;
    if (rem === 0) return `${h}h`;
    return `${h}h ${rem}m`;
};

// Utility: Calculate minutes between two times (HH:MM)
const calculateMinutes = (start, end) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    if (endTotal < startTotal) {
        endTotal += 24 * 60;
    }

    return endTotal - startTotal;
};

// Utility: Get Today's Date in YYYY-MM-DD
const getToday = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// ==========================================
// GAS API Calls
// ==========================================

// GETリクエスト: 全データをスプレッドシートから読み込む
const gasGet = async () => {
    const response = await fetch(`${GAS_URL}?t=${Date.now()}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message);
    return data;
};

// POSTリクエスト: データの追加・削除
const gasPost = async (action, payload) => {
    await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
    });
};

// ローディング表示
const showLoading = (msg = '読み込み中...') => {
    let el = document.getElementById('global-loading');
    if (!el) {
        el = document.createElement('div');
        el.id = 'global-loading';
        el.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0;
            background: rgba(139, 119, 100, 0.9);
            color: white; text-align: center;
            padding: 10px; z-index: 9999;
            font-size: 14px; letter-spacing: 0.5px;
        `;
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
};

const hideLoading = () => {
    const el = document.getElementById('global-loading');
    if (el) el.style.display = 'none';
};

// ==========================================
// 初回データロード (GASから全データ取得)
// ==========================================
const loadAllData = async () => {
    showLoading('スプレッドシートからデータを読み込み中...');
    try {
        const data = await gasGet();
        STATE.clients = data.clients || [];
        STATE.tasks = data.tasks || [];
        STATE.logs = (data.logs || []).map(log => ({
            ...log,
            duration: parseInt(log.duration, 10) || 0
        }));

        // ソート
        STATE.logs.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.start || '').localeCompare(b.start || '');
        });

        // 全UIを更新
        renderClients();
        renderTasks();
        renderLogs();
        updateTrackerDropdowns();
        updateDashboard();

    } catch (err) {
        console.error('データ読み込みエラー:', err);
        alert('データの読み込みに失敗しました。ページを再読み込みしてください。\n' + err.message);
    } finally {
        hideLoading();
    }
};

// ==========================================
// Navigation Logic
// ==========================================
const initNavigation = () => {
    const navItems = document.querySelectorAll('.nav-links li');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const pageId = item.getAttribute('data-page');
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');

            if (pageId === 'dashboard') {
                updateDashboard();
            } else if (pageId === 'tracker') {
                updateTrackerDropdowns();
                renderLogs();
            }
        });
    });
};

// ==========================================
// Client Management Logic
// ==========================================
const initClients = () => {
    const form = document.getElementById('client-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('client-name');
        const memoInput = document.getElementById('client-memo');
        const btn = form.querySelector('button[type="submit"]');

        const newClient = {
            id: generateId(),
            name: nameInput.value.trim(),
            memo: memoInput.value.trim(),
            createdAt: new Date().toISOString()
        };

        STATE.clients.push(newClient);
        nameInput.value = '';
        memoInput.value = '';
        renderClients();

        // GASへ保存
        btn.textContent = '保存中...';
        btn.disabled = true;
        try {
            await gasPost('addClient', { data: newClient });
        } catch (err) {
            console.error('クライアント保存エラー:', err);
        } finally {
            btn.textContent = '登録する';
            btn.disabled = false;
        }
    });

    renderClients();
};

const renderClients = () => {
    const tbody = document.getElementById('clients-list');
    const emptyState = document.getElementById('clients-empty');

    tbody.innerHTML = '';

    if (STATE.clients.length === 0) {
        tbody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    tbody.parentElement.classList.remove('hidden');
    emptyState.classList.add('hidden');

    STATE.clients.forEach(client => {
        const tr = document.createElement('tr');
        tr.id = `client-row-${client.id}`;
        tr.innerHTML = `
            <td><strong>${client.name}</strong></td>
            <td>${client.memo || '-'}</td>
            <td>
                <button class="btn-icon" onclick="editClient('${client.id}')" title="編集">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteClient('${client.id}')" title="削除">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
};

// インライン編集モードに切り替え
window.editClient = (id) => {
    const client = STATE.clients.find(c => c.id === id);
    if (!client) return;
    const tr = document.getElementById(`client-row-${id}`);
    tr.innerHTML = `
        <td><input id="edit-client-name-${id}" class="glass-input" value="${client.name}" style="width:100%"></td>
        <td><input id="edit-client-memo-${id}" class="glass-input" value="${client.memo || ''}" style="width:100%"></td>
        <td>
            <button class="btn-icon" onclick="saveClient('${id}')" title="保存" style="color:var(--primary-color)">
                <i data-lucide="check"></i>
            </button>
            <button class="btn-icon" onclick="renderClients()" title="キャンセル">
                <i data-lucide="x"></i>
            </button>
        </td>
    `;
    lucide.createIcons();
};

window.saveClient = async (id) => {
    const name = document.getElementById(`edit-client-name-${id}`).value.trim();
    const memo = document.getElementById(`edit-client-memo-${id}`).value.trim();
    if (!name) { alert('クライアント名を入力してください'); return; }

    const client = STATE.clients.find(c => c.id === id);
    client.name = name;
    client.memo = memo;
    renderClients();
    updateTrackerDropdowns();
    try {
        await gasPost('updateClient', { id, data: { name, memo } });
    } catch (err) {
        console.error('クライアント更新エラー:', err);
    }
};

window.deleteClient = async (id) => {
    if (confirm('このクライアントを削除しますか？\n※関連する作業ログのクライアント名が表示されなくなります。')) {
        STATE.clients = STATE.clients.filter(c => c.id !== id);
        renderClients();
        try {
            await gasPost('deleteClient', { id });
        } catch (err) {
            console.error('クライアント削除エラー:', err);
        }
    }
};

// ==========================================
// Task Management Logic
// ==========================================
const initTasks = () => {
    const form = document.getElementById('task-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('task-name');
        const categoryInput = document.getElementById('task-category');
        const memoInput = document.getElementById('task-memo');
        const btn = form.querySelector('button[type="submit"]');

        const newTask = {
            id: generateId(),
            name: nameInput.value.trim(),
            category: categoryInput.value,
            memo: memoInput.value.trim(),
            createdAt: new Date().toISOString()
        };

        STATE.tasks.push(newTask);
        nameInput.value = '';
        categoryInput.value = '';
        memoInput.value = '';
        renderTasks();

        // GASへ保存
        btn.textContent = '保存中...';
        btn.disabled = true;
        try {
            await gasPost('addTask', { data: newTask });
        } catch (err) {
            console.error('タスク保存エラー:', err);
        } finally {
            btn.textContent = '登録する';
            btn.disabled = false;
        }
    });

    renderTasks();
};

const renderTasks = () => {
    const tbody = document.getElementById('tasks-list');
    const emptyState = document.getElementById('tasks-empty');

    tbody.innerHTML = '';

    if (STATE.tasks.length === 0) {
        tbody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    tbody.parentElement.classList.remove('hidden');
    emptyState.classList.add('hidden');

    STATE.tasks.forEach(task => {
        const tr = document.createElement('tr');
        tr.id = `task-row-${task.id}`;
        tr.innerHTML = `
            <td><strong>${task.name}</strong></td>
            <td><span class="badge">${task.category}</span></td>
            <td>${task.memo || '-'}</td>
            <td>
                <button class="btn-icon" onclick="editTask('${task.id}')" title="編集">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteTask('${task.id}')" title="削除">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
};

window.editTask = (id) => {
    const task = STATE.tasks.find(t => t.id === id);
    if (!task) return;
    const categoryOptions = ['プロデュース', 'マーケ', 'サポート', 'リサーチ', '学習', '運営', 'その他']
        .map(c => `<option value="${c}" ${c === task.category ? 'selected' : ''}>${c}</option>`).join('');
    const tr = document.getElementById(`task-row-${id}`);
    tr.innerHTML = `
        <td><input id="edit-task-name-${id}" class="glass-input" value="${task.name}" style="width:100%"></td>
        <td><select id="edit-task-cat-${id}" class="glass-input">${categoryOptions}</select></td>
        <td><input id="edit-task-memo-${id}" class="glass-input" value="${task.memo || ''}" style="width:100%"></td>
        <td>
            <button class="btn-icon" onclick="saveTask('${id}')" title="保存" style="color:var(--primary-color)">
                <i data-lucide="check"></i>
            </button>
            <button class="btn-icon" onclick="renderTasks()" title="キャンセル">
                <i data-lucide="x"></i>
            </button>
        </td>
    `;
    lucide.createIcons();
};

window.saveTask = async (id) => {
    const name = document.getElementById(`edit-task-name-${id}`).value.trim();
    const category = document.getElementById(`edit-task-cat-${id}`).value;
    const memo = document.getElementById(`edit-task-memo-${id}`).value.trim();
    if (!name) { alert('タスク名を入力してください'); return; }

    const task = STATE.tasks.find(t => t.id === id);
    task.name = name;
    task.category = category;
    task.memo = memo;
    renderTasks();
    updateTrackerDropdowns();
    try {
        await gasPost('updateTask', { id, data: { name, category, memo } });
    } catch (err) {
        console.error('タスク更新エラー:', err);
    }
};

window.deleteTask = async (id) => {
    if (confirm('このタスクを削除しますか？\n※関連する作業ログのタスク名が表示されなくなります。')) {
        STATE.tasks = STATE.tasks.filter(t => t.id !== id);
        renderTasks();
        try {
            await gasPost('deleteTask', { id });
        } catch (err) {
            console.error('タスク削除エラー:', err);
        }
    }
};

// ==========================================
// Time Tracker Logic
// ==========================================
const initTracker = () => {
    const dateInput = document.getElementById('log-date');
    const filterInput = document.getElementById('log-date-filter');
    const startInput = document.getElementById('log-start');
    const endInput = document.getElementById('log-end');
    const durationInput = document.getElementById('log-duration');
    const form = document.getElementById('log-form');

    const today = getToday();
    dateInput.value = today;
    filterInput.value = today;

    const updateDuration = () => {
        if (startInput.value && endInput.value) {
            const minutes = calculateMinutes(startInput.value, endInput.value);
            durationInput.value = formatDuration(minutes);
        } else {
            durationInput.value = '';
        }
    };

    startInput.addEventListener('change', updateDuration);
    endInput.addEventListener('change', updateDuration);

    filterInput.addEventListener('change', () => {
        dateInput.value = filterInput.value;
        renderLogs();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const button = e.submitter || form.querySelector('button[type="submit"]');
        const date = dateInput.value;
        const clientId = document.getElementById('log-client').value;
        const taskId = document.getElementById('log-task').value;
        const start = startInput.value;
        const end = endInput.value;
        const memo = document.getElementById('log-memo').value.trim();
        const minutes = calculateMinutes(start, end);

        if (minutes <= 0) {
            alert('終了時間は開始時間より後に設定してください。');
            return;
        }

        const newLog = {
            id: generateId(),
            date,
            clientId,
            taskId,
            start,
            end,
            duration: minutes,
            memo,
            createdAt: new Date().toISOString()
        };

        STATE.logs.push(newLog);
        STATE.logs.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.start.localeCompare(b.start);
        });

        startInput.value = end;
        endInput.value = '';
        durationInput.value = '';
        document.getElementById('log-memo').value = '';

        renderLogs();

        // GASへ保存
        button.textContent = '送信中...';
        button.disabled = true;
        try {
            await gasPost('addLog', { data: newLog });
            console.log('Successfully sent to Google Sheets');
        } catch (err) {
            console.error('ログ保存エラー:', err);
        } finally {
            button.textContent = '追加する';
            button.disabled = false;
        }
    });

    updateTrackerDropdowns();
    renderLogs();
};

const updateTrackerDropdowns = () => {
    const clientSelect = document.getElementById('log-client');
    const taskSelect = document.getElementById('log-task');

    const currentClient = clientSelect.value;
    const currentTask = taskSelect.value;

    clientSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
    STATE.clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        clientSelect.appendChild(opt);
    });

    taskSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
    STATE.tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.category})`;
        taskSelect.appendChild(opt);
    });

    if (STATE.clients.some(c => c.id === currentClient)) clientSelect.value = currentClient;
    if (STATE.tasks.some(t => t.id === currentTask)) taskSelect.value = currentTask;
};

const renderLogs = () => {
    const dateFilter = document.getElementById('log-date-filter').value;
    const tbody = document.getElementById('logs-list');
    const emptyState = document.getElementById('logs-empty');

    tbody.innerHTML = '';

    const filteredLogs = STATE.logs.filter(log => log.date === dateFilter);

    if (filteredLogs.length === 0) {
        tbody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    tbody.parentElement.classList.remove('hidden');
    emptyState.classList.add('hidden');

    filteredLogs.forEach(log => {
        const client = STATE.clients.find(c => c.id === log.clientId);
        const task = STATE.tasks.find(t => t.id === log.taskId);

        const clientName = client ? client.name : '<span class="text-muted">不明/削除済み</span>';
        const taskContent = task
            ? `<strong>${task.name}</strong> <span class="badge">${task.category}</span>`
            : '<span class="text-muted">不明/削除済み</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${clientName}</td>
            <td>${taskContent}</td>
            <td><code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;">${log.start} - ${log.end}</code></td>
            <td><strong style="color: var(--primary-color)">${formatDuration(log.duration)}</strong></td>
            <td>${log.memo || '-'}</td>
            <td>
                <button class="btn-icon danger" onclick="deleteLog('${log.id}')" title="削除">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
};

window.deleteLog = async (id) => {
    if (confirm('このログを削除しますか？')) {
        STATE.logs = STATE.logs.filter(l => l.id !== id);
        renderLogs();
        try {
            await gasPost('deleteLog', { id });
        } catch (err) {
            console.error('ログ削除エラー:', err);
        }
    }
};

// ==========================================
// Dashboard Logic (Charts)
// ==========================================
let charts = {};

const initDashboard = () => {
    Chart.defaults.color = '#8c8a86';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#4a4a4a';
    Chart.defaults.plugins.tooltip.bodyColor = '#4a4a4a';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;

    updateDashboard();
};

const updateDashboard = () => {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const monthLogs = STATE.logs.filter(log => log.date.startsWith(currentMonth));
    const totalMonthMinutes = monthLogs.reduce((acc, log) => acc + log.duration, 0);
    document.getElementById('month-total-time').textContent = formatDuration(totalMonthMinutes);

    if (charts.daily) charts.daily.destroy();
    if (charts.client) charts.client.destroy();
    if (charts.task) charts.task.destroy();

    if (STATE.logs.length === 0) return;

    // Daily Data
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;
        const dayTotal = STATE.logs
            .filter(log => log.date === dateStr)
            .reduce((acc, log) => acc + log.duration, 0);
        dailyData[shortDate] = (dayTotal / 60).toFixed(1);
    }

    // Client Data
    const clientData = {};
    STATE.logs.forEach(log => {
        const client = STATE.clients.find(c => c.id === log.clientId);
        const name = client ? client.name : 'Unknown';
        clientData[name] = (clientData[name] || 0) + log.duration;
    });

    // Task Data
    const taskData = {};
    STATE.logs.forEach(log => {
        const task = STATE.tasks.find(t => t.id === log.taskId);
        const name = task ? task.name : 'Unknown';
        taskData[name] = (taskData[name] || 0) + log.duration;
    });

    // Daily Chart
    const ctxDaily = document.getElementById('dailyChart').getContext('2d');
    charts.daily = new Chart(ctxDaily, {
        type: 'bar',
        data: {
            labels: Object.keys(dailyData),
            datasets: [{
                label: '作業時間 (時間)',
                data: Object.values(dailyData),
                backgroundColor: 'rgba(55, 120, 185, 0.8)',
                borderColor: 'rgba(55, 120, 185, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Client Chart
    const ctxClient = document.getElementById('clientChart').getContext('2d');
    charts.client = new Chart(ctxClient, {
        type: 'doughnut',
        data: {
            labels: Object.keys(clientData),
            datasets: [{
                data: Object.values(clientData).map(v => (v / 60).toFixed(1)),
                backgroundColor: CHART_COLORS,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { color: '#4a4a4a', padding: 20 } }
            }
        }
    });

    // Task Chart
    const ctxTask = document.getElementById('taskChart').getContext('2d');
    charts.task = new Chart(ctxTask, {
        type: 'doughnut',
        data: {
            labels: Object.keys(taskData),
            datasets: [{
                data: Object.values(taskData).map(v => (v / 60).toFixed(1)),
                backgroundColor: CHART_COLORS.slice().reverse(),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { color: '#4a4a4a', padding: 20 } }
            }
        }
    });
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initClients();
    initTasks();
    initTracker();
    initDashboard();

    // GASから全データを読み込む
    await loadAllData();
});
