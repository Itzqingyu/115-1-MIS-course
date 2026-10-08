// ==========================================
// 1. DOM 元素選取與全域常數
// ==========================================
const table = document.querySelector("#ticket-table");             // 後台案件表格
const tableBody = table.querySelector("tbody");                    // 表格主體 (tbody)
const emptyState = document.querySelector("#empty-state");         // 無案件提示文字
const message = document.querySelector("#message");               // 操作訊息提示區塊
const refreshButton = document.querySelector("#refresh-button");       // 重新整理按鈕

// 系統允許的案件處理狀態選項
const statuses = ["待處理", "處理中", "已完成"];

/**
 * 顯示提示訊息
 * @param {string} text - 訊息文字內容
 * @param {boolean} isError - 是否為錯誤訊息（true 顯示紅色）
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
  return cell;
}

/**
 * 動態建立案件狀態下拉選單 (<select>)
 * @param {string} currentStatus - 當前案件的狀態值（將其設為 selected）
 * @returns {HTMLSelectElement} 下拉選單元素
 */
function createStatusSelect(currentStatus) {
  const select = document.createElement("select");
  for (const status of statuses) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    option.selected = status === currentStatus; // 預設選中目前案件狀態
    select.appendChild(option);
  }
  return select;
}

/**
 * 渲染管理後台案件列表：
 * 動態產生表格列，並為每筆案件附加「狀態下拉選單」與「儲存」、「刪除」操作按鈕
 * @param {Array<Object>} tickets - 案件物件陣列
 */
function renderTickets(tickets) {
  // 清空現有表格內容
  tableBody.replaceChildren();

  // 控制空狀態文字與表格顯示
  emptyState.hidden = tickets.length > 0;
  table.hidden = tickets.length === 0;

  for (const ticket of tickets) {
    const row = document.createElement("tr");

    // 基本資訊欄位
    addCell(row, ticket.id);
    addCell(row, `${ticket.location}／${ticket.equipment}`);
    addCell(row, ticket.contact);
    addCell(row, ticket.description);
    addCell(row, ticket.created_at);

    // 處理狀態欄位：嵌入下拉選單
    const statusCell = document.createElement("td");
    const select = createStatusSelect(ticket.status);
    statusCell.appendChild(select);
    row.appendChild(statusCell);

    // 操作欄位：包含「儲存狀態」與「刪除」按鈕
    const actionCell = document.createElement("td");
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "action-buttons";

    // 1. 儲存狀態按鈕
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "儲存狀態";
    saveButton.addEventListener("click", () => updateStatus(ticket.id, select.value));
    buttonGroup.appendChild(saveButton);

    // 2. 刪除案件按鈕（套用 danger 紅色樣式）
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "刪除";
    deleteButton.addEventListener("click", () => deleteTicket(ticket.id));
    buttonGroup.appendChild(deleteButton);

    actionCell.appendChild(buttonGroup);
    row.appendChild(actionCell);
    tableBody.appendChild(row);
  }
}

/**
 * [API 呼叫] 向後端 GET /api/tickets 讀取案件清單
 */
async function loadTickets() {
  try {
    const response = await fetch("/api/tickets");
    if (!response.ok) throw new Error("無法讀取案件清單");
    renderTickets(await response.json());
  } catch (error) {
    showMessage(error.message, true);
  }
}

/**
 * [API 呼叫] 更新特定案件狀態：
 * 向後端發送 PATCH /api/tickets/<id> 請求，攜帶新狀態 JSON
 * @param {string} ticketId - 案件編號（例如 T-001）
 * @param {string} status - 欲更新的新狀態
 */
async function updateStatus(ticketId, status) {
  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();

    // 若未授權 (401) 或找不到案件 (404) 會進入錯誤處理
    if (!response.ok) throw new Error(result.message || "更新狀態失敗");

    showMessage(result.message);
    await loadTickets(); // 更新後重新加載列表以維持畫面一致
  } catch (error) {
    showMessage(error.message, true);
  }
}

/**
 * [API 呼叫] 刪除特定案件：
 * 提供防呆確認對話框，經確認後發送 DELETE /api/tickets/<id> 請求
 * @param {string} ticketId - 欲刪除的案件編號
 */
async function deleteTicket(ticketId) {
  // 防呆機制：跳出瀏覽器確認視窗
  if (!confirm(`確定要刪除案件「${ticketId}」嗎？`)) {
    return;
  }

  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: "DELETE",
    });
    const result = await response.json();

    // 檢查 HTTP 狀態碼（例如 401 未授權）
    if (!response.ok) throw new Error(result.message || "刪除案件失敗");

    showMessage(result.message);
    await loadTickets(); // 刪除成功後重新載入列表
  } catch (error) {
    showMessage(error.message, true);
  }
}

// ==========================================
// 2. 初始化與事件綁定
// ==========================================
refreshButton.addEventListener("click", loadTickets); // 綁定重新整理按鈕
loadTickets(); // 進入管理後台時立即載入案件清單
