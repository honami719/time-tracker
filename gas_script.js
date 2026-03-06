// ==========================================
// Google Apps Script (GAS) コード
// 
// 1. Googleスプレッドシートを開き、「拡張機能」＞「Apps Script」を選択
// 2. このコードを貼り付けて保存
// 3. 「デプロイ」＞「新しいデプロイ」から「ウェブアプリ」として公開
//    ※アクセスできるユーザーを「全員」に設定してください
// ==========================================

const SHEET_NAME = 'Logs'; // スプレッドシートのシート名

function doPost(e) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

        // シートが存在しない場合は作成してヘッダーを設定
        if (!sheet) {
            const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
            newSheet.appendRow(['送信日時', '日付', 'クライアント名', 'タスク名', '開始時間', '終了時間', '作業時間(分)', 'メモ']);
            // 1行目の書式設定（太字、背景色など）
            newSheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f3f3f3');
            newSheet.setFrozenRows(1);
        }

        const targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

        // アプリからのPOSTデータ（JSON）を取得
        const postData = JSON.parse(e.postData.contents);
        const log = postData.log;
        const clientName = postData.clientName;
        const taskName = postData.taskName;

        // シートの最終行の次に追加
        targetSheet.appendRow([
            new Date(),       // 送信日時
            log.date,         // 日付
            clientName,       // クライアント名（分かりやすく名前で保存）
            taskName,         // タスク名
            log.start,        // 開始時間
            log.end,          // 終了時間
            log.duration,     // 作業時間(分)
            log.memo          // メモ
        ]);

        // 成功レスポンスを返す
        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Logged to Google Sheets'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // エラーレスポンスを返す
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// 動作確認用
function doGet() {
    return ContentService.createTextOutput("GAS Web App is running.");
}
