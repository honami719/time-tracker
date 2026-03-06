// ==========================================
// Google Apps Script (GAS) コード - 双方向連動版
//
// 【使い方】
// 1. Googleスプレッドシートを開き、「拡張機能」＞「Apps Script」を選択
// 2. このコードを全て貼り付けて保存
// 3. 「デプロイ」＞「新しいデプロイ」から「ウェブアプリ」として公開
//    ※アクセスできるユーザーを「全員」に設定してください
// 4. 発行されたURLをapp.jsのGAS_URLに設定してください
// ==========================================

const SHEETS = {
    CLIENTS: 'Clients',
    TASKS: 'Tasks',
    LOGS: 'Logs'
};

// シートの初期化（ヘッダー設定）
function initSheet(ss, sheetName, headers) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
        sheet.setFrozenRows(1);
    }
    return sheet;
}

// ==========================================
// doGet: 全データを読み込んでJSONで返す
// ==========================================
function doGet(e) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // 各シートを初期化（存在しなければ作成）
        const clientSheet = initSheet(ss, SHEETS.CLIENTS, ['id', 'name', 'memo', 'createdAt']);
        const taskSheet = initSheet(ss, SHEETS.TASKS, ['id', 'name', 'category', 'memo', 'createdAt']);
        const logSheet = initSheet(ss, SHEETS.LOGS, ['id', 'date', 'clientId', 'taskId', 'start', 'end', 'duration', 'memo', 'createdAt']);

        // 全データ取得
        const clients = sheetToObjects(clientSheet);
        const tasks = sheetToObjects(taskSheet);
        const logs = sheetToObjects(logSheet);

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            clients: clients,
            tasks: tasks,
            logs: logs
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// シートのデータをオブジェクト配列に変換
function sheetToObjects(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // ヘッダーのみ or 空

    const headers = data[0];
    return data.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });
        return obj;
    });
}

// ==========================================
// doPost: データの追加・削除を処理する
// ==========================================
function doPost(e) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const postData = JSON.parse(e.postData.contents);
        const action = postData.action;

        let result;

        switch (action) {
            case 'addClient':
                result = addRow(ss, SHEETS.CLIENTS,
                    ['id', 'name', 'memo', 'createdAt'],
                    postData.data);
                break;

            case 'deleteClient':
                result = deleteRow(ss, SHEETS.CLIENTS, postData.id);
                break;

            case 'addTask':
                result = addRow(ss, SHEETS.TASKS,
                    ['id', 'name', 'category', 'memo', 'createdAt'],
                    postData.data);
                break;

            case 'deleteTask':
                result = deleteRow(ss, SHEETS.TASKS, postData.id);
                break;

            case 'addLog':
                result = addRow(ss, SHEETS.LOGS,
                    ['id', 'date', 'clientId', 'taskId', 'start', 'end', 'duration', 'memo', 'createdAt'],
                    postData.data);
                break;

            case 'deleteLog':
                result = deleteRow(ss, SHEETS.LOGS, postData.id);
                break;

            case 'updateClient':
                result = updateRow(ss, SHEETS.CLIENTS, postData.id, postData.data);
                break;

            case 'updateTask':
                result = updateRow(ss, SHEETS.TASKS, postData.id, postData.data);
                break;

            default:
                result = { status: 'error', message: 'Unknown action: ' + action };
        }

        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// 行を追加する
function addRow(ss, sheetName, headers, data) {
    const sheet = ss.getSheetByName(sheetName) ||
        initSheet(ss, sheetName, headers);

    const row = headers.map(h => data[h] !== undefined ? data[h] : '');
    sheet.appendRow(row);

    return { status: 'success', message: 'Added to ' + sheetName };
}

// IDで行を更新する
function updateRow(ss, sheetName, id, data) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: 'Sheet not found: ' + sheetName };

    const sheetData = sheet.getDataRange().getValues();
    const headers = sheetData[0];
    const idCol = headers.indexOf('id');
    if (idCol === -1) return { status: 'error', message: 'id column not found' };

    for (let i = 1; i < sheetData.length; i++) {
        if (String(sheetData[i][idCol]) === String(id)) {
            Object.keys(data).forEach(key => {
                const col = headers.indexOf(key);
                if (col !== -1) {
                    sheet.getRange(i + 1, col + 1).setValue(data[key]);
                }
            });
            return { status: 'success', message: 'Updated in ' + sheetName };
        }
    }
    return { status: 'error', message: 'Row not found: ' + id };
}

// IDで行を削除する
function deleteRow(ss, sheetName, id) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: 'Sheet not found: ' + sheetName };

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('id');
    if (idCol === -1) return { status: 'error', message: 'id column not found' };

    for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][idCol]) === String(id)) {
            sheet.deleteRow(i + 1);
            return { status: 'success', message: 'Deleted from ' + sheetName };
        }
    }

    return { status: 'error', message: 'Row not found: ' + id };
}
