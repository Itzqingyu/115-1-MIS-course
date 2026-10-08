// ==========================================
// 1. DOM 元素選取
// ==========================================
const form = document.querySelector("#ticket-form");         // 報修單表單
const message = document.querySelector("#message");         // 狀態/錯誤提示訊息區塊
const table = document.querySelector("#ticket-table");       // 報修案件表格
const tableBody = table.querySelector("tbody");              // 表格內容主體 (tbody)
const emptyState = document.querySelector("#empty-state");   // 無案件時顯示的提示文字
const refreshButton = document.querySelector("#refresh-button"); // 手動重新整理按鈕

/**
 * 顯示提示訊息
 * @param {string} text - 訊息文字內容
 * @param {boolean} isError - 是否為錯誤訊息（若為 true 則套用紅色樣式）
 */
function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

/**
 * 在表格列 (<tr>) 中新增一個儲存格 (<td>)
 * @param {HTMLTableRowElement} row - 目標表格列
 * @param {string} value - 儲存格文字內容
 */
function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
}

/**
 * 渲染報修案件列表：
 * 將後端回傳的案件陣列動態生成為 HTML <table> 內容
 * @param {Array<Object>} tickets - 案件物件陣列
 */
function renderTickets(tickets) {
  // 清空現有表格內容
  tableBody.replaceChildren();

  // 若無資料顯示「目前尚無報修案件」，有資料則顯示表格
  emptyState.hidden = tickets.length > 0;
  table.hidden = tickets.length === 0;

  // 逐筆巡訪案件並建立對應的表格列與欄位
  for (const ticket of tickets) {
    const row = document.createElement("tr");
    addCell(row, ticket.id);
    addCell(row, ticket.location);
    addCell(row, ticket.equipment);
    addCell(row, ticket.urgency);
    addCell(row, ticket.contact);
    addCell(row, ticket.status);
    addCell(row, ticket.description);
    addCell(row, ticket.created_at);
    tableBody.appendChild(row);
  }
}

/**
 * [API 呼叫] 向後端 GET /api/tickets 取得最新案件清單
 */
async function loadTickets() {
  try {
    const response = await fetch("/api/tickets");
    if (!response.ok) throw new Error("無法讀取案件清單");
    const data = await response.json();
    renderTickets(data);
  } catch (error) {
    showMessage(error.message, true);
  }
}

/**
 * [表單事件監聽] 處理報修單送出：
 * 攔截原生瀏覽器頁面跳轉，改以 Fetch API 發送 JSON 格式 POST 請求
 */
form.addEventListener("submit", async (event) => {
  event.preventDefault(); // 阻止瀏覽器預設的表單送出刷新頁面行為
  showMessage("正在建立報修單…");

  // 從 HTML 表單中提取所有欄位值並封裝為 JavaScript 物件
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    // 發送非同步 POST 請求至後端 API
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    // 處理 400 等驗證失敗情況
    if (!response.ok) throw new Error(result.message || "建立報修單失敗");

    // 成功建立：提示訊息、清空輸入表單，並重新載入案件清單
    showMessage(result.message);
    form.reset();
    await loadTickets();
  } catch (error) {
    showMessage(error.message, true);
  }
});

// ==========================================
// 2. 初始化與事件綁定
// ==========================================
refreshButton.addEventListener("click", loadTickets); // 綁定重新整理按鈕
loadTickets(); // 網頁開啟時立即載入一次清單
