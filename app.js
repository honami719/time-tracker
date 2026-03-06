/**
 * Time Tracker - Main Application Logic
 * Uses LocalStorage for data persistence
 */

// State Management
const STATE = {
    clients: JSON.parse(localStorage.getItem('tt_clients')) || [],
    tasks: JSON.parse(localStorage.getItem('tt_tasks')) || [],
    logs: JSON.parse(localStorage.getItem('tt_logs')) || [],
};

// Backend Integration (Google Apps Script)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxDF8nE7tzWrcsbO-7dqOGJFbnWfIN5CTE6g69imr9iDoaSEgXoxGs0BNrdJhCYKrhWlg/exec';

// Colors for charts
const CHART_COLORS = [
    '#7b9176', '#d9a982', '#7fa8b8', '#d4c594', '#bda3ab', '#e69a8d',
    '#9fb399', '#f2d4bd', '#a8c6db', '#e8dfb7'
];

// Utility: Save to LocalStorage
const saveData = (key, data) => {
    localStorage.setItem(`tt_${key}`, JSON.stringify(data));
};

// Utility: Generate Unique ID
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Utility: Format time (minutes to H:MM)
const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// Utility: Calculate minutes between two times (HH:MM)
const calculateMinutes = (start, end) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    // Handle overnight (e.g., 23:00 to 01:00)
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
// Navigation Logic
// ==========================================
const initNavigation = () => {
    const navItems = document.querySelectorAll('.nav-links li');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show active page
            const pageId = item.getAttribute('data-page');
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');

            // Trigger updates based on page
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

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('client-name');
        const memoInput = document.getElementById('client-memo');

        const newClient = {
            id: generateId(),
            name: nameInput.value.trim(),
            memo: memoInput.value.trim(),
            createdAt: new Date().toISOString()
        };

        STATE.clients.push(newClient);
        saveData('clients', STATE.clients);

        // Reset form
        nameInput.value = '';
        memoInput.value = '';

        renderClients();
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
        tr.innerHTML = `
            <td><strong>${client.name}</strong></td>
            <td>${client.memo || '-'}</td>
            <td>
                <button class="btn-icon danger" onclick="deleteClient('${client.id}')" title="削除">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
};

window.deleteClient = (id) => {
    if (confirm('このクライアントを削除しますか？\n※関連する作業ログは削除されませんが、クライアント名が表示されなくなります。')) {
        STATE.clients = STATE.clients.filter(c => c.id !== id);
        saveData('clients', STATE.clients);
        renderClients();
    }
};

// ==========================================
// Task Management Logic
// ==========================================
const initTasks = () => {
    const form = document.getElementById('task-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('task-name');
        const categoryInput = document.getElementById('task-category');
        const memoInput = document.getElementById('task-memo');

        const newTask = {
            id: generateId(),
            name: nameInput.value.trim(),
            category: categoryInput.value,
            memo: memoInput.value.trim(),
            createdAt: new Date().toISOString()
        };

        STATE.tasks.push(newTask);
        saveData('tasks', STATE.tasks);

        // Reset form
        nameInput.value = '';
        categoryInput.value = '';
        memoInput.value = '';

        renderTasks();
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
        tr.innerHTML = `
            <td><strong>${task.name}</strong></td>
            <td><span class="badge">${task.category}</span></td>
            <td>${task.memo || '-'}</td>
            <td>
                <button class="btn-icon danger" onclick="deleteTask('${task.id}')" title="削除">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
};

window.deleteTask = (id) => {
    if (confirm('このタスクを削除しますか？\n※関連する作業ログは削除されませんが、タスク名が表示されなくなります。')) {
        STATE.tasks = STATE.tasks.filter(t => t.id !== id);
        saveData('tasks', STATE.tasks);
        renderTasks();
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

    // Set default dates
    const today = getToday();
    dateInput.value = today;
    filterInput.value = today;

    // Auto calculate duration
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

    // Filter change
    filterInput.addEventListener('change', () => {
        dateInput.value = filterInput.value;
        renderLogs();
    });

    // Submit Log
    form.addEventListener('submit', (e) => {
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

        // Sort logs by date and start time
        STATE.logs.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.start.localeCompare(b.start);
        });

        saveData('logs', STATE.logs);

        // --- [NEW] Send Data to Google Sheets via GAS ---
        const clientObj = STATE.clients.find(c => c.id === clientId);
        const taskObj = STATE.tasks.find(t => t.id === taskId);
        const submitBtn = button; // Reference from event

        // Simple visual feedback
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '送信中...';
        submitBtn.disabled = true;

        fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // Ignore CORS response blocks (Gas often blocks reading the response)
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                log: newLog,
                clientName: clientObj ? clientObj.name : 'Unknown',
                taskName: taskObj ? taskObj.name : 'Unknown'
            })
        }).then(() => {
            console.log('Successfully sent to Google Sheets');
        }).catch(err => {
            console.error('Failed to send to Google Sheets:', err);
        }).finally(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
        // ------------------------------------------------

        // Reset specific fields but keep date, client, task (for quick entry)
        startInput.value = end; // Next start is previous end
        endInput.value = '';
        durationInput.value = '';
        document.getElementById('log-memo').value = '';

        renderLogs();
    });

    updateTrackerDropdowns();
    renderLogs();
};

const updateTrackerDropdowns = () => {
    const clientSelect = document.getElementById('log-client');
    const taskSelect = document.getElementById('log-task');

    // Save current values
    const currentClient = clientSelect.value;
    const currentTask = taskSelect.value;

    // Rebuild Clients
    clientSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
    STATE.clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        clientSelect.appendChild(opt);
    });

    // Rebuild Tasks
    taskSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
    STATE.tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.category})`;
        taskSelect.appendChild(opt);
    });

    // Restore values if still exist
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
        const taskContent = task ? `<strong>${task.name}</strong> <span class="badge">${task.category}</span>` : '<span class="text-muted">不明/削除済み</span>';

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

window.deleteLog = (id) => {
    if (confirm('このログを削除しますか？')) {
        STATE.logs = STATE.logs.filter(l => l.id !== id);
        saveData('logs', STATE.logs);
        renderLogs();
    }
};

// ==========================================
// Dashboard Logic (Charts)
// ==========================================
let charts = {};

const initDashboard = () => {
    // Configure Chart.js defaults for light theme glassmorphism
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

    // 1. Calculate Total Month Time
    const monthLogs = STATE.logs.filter(log => log.date.startsWith(currentMonth));
    const totalMonthMinutes = monthLogs.reduce((acc, log) => acc + log.duration, 0);
    document.getElementById('month-total-time').textContent = formatDuration(totalMonthMinutes);

    // Destroy existing charts
    if (charts.daily) charts.daily.destroy();
    if (charts.client) charts.client.destroy();
    if (charts.task) charts.task.destroy();

    // If no data, show empty state or just empty charts
    if (STATE.logs.length === 0) return;

    // 2. Prepare Daily Data (Last 7 days)
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;

        const dayTotal = STATE.logs
            .filter(log => log.date === dateStr)
            .reduce((acc, log) => acc + log.duration, 0);

        dailyData[shortDate] = (dayTotal / 60).toFixed(1); // Hours
    }

    // 3. Prepare Client Data
    const clientData = {};
    STATE.logs.forEach(log => {
        const client = STATE.clients.find(c => c.id === log.clientId);
        const name = client ? client.name : 'Unknown';
        clientData[name] = (clientData[name] || 0) + log.duration;
    });

    // 4. Prepare Task Data
    const taskData = {};
    STATE.logs.forEach(log => {
        const task = STATE.tasks.find(t => t.id === log.taskId);
        const name = task ? task.name : 'Unknown';
        taskData[name] = (taskData[name] || 0) + log.duration;
    });

    // Render Daily Chart (Bar)
    const ctxDaily = document.getElementById('dailyChart').getContext('2d');
    charts.daily = new Chart(ctxDaily, {
        type: 'bar',
        data: {
            labels: Object.keys(dailyData),
            datasets: [{
                label: '作業時間 (時間)',
                data: Object.values(dailyData),
                backgroundColor: 'rgba(55, 120, 185, 0.8)', // Distinct Navy color
                borderColor: 'rgba(55, 120, 185, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Render Client Chart (Doughnut)
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
                legend: {
                    position: 'right',
                    labels: { color: '#4a4a4a', padding: 20 }
                }
            }
        }
    });

    // Render Task Chart (Doughnut)
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
                legend: {
                    position: 'right',
                    labels: { color: '#4a4a4a', padding: 20 }
                }
            }
        }
    });
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initClients();
    initTasks();
    initTracker();
    initDashboard();
});
