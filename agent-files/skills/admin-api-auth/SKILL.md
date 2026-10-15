---
name: admin-api-auth
description: 規範 Web 應用中管理員專屬功能（Admin-only）的前後端安全防護原則，包含防止 Broken Object Level Authorization (BOLA) 漏洞、雙層鑑權檢核、API 狀態碼標準、防呆確認機制與會話生命週期管理。當使用者要求實作或重構管理員權限、API 存取控制、刪除/修改敏感工單時觸發此 Skill。
---

# 管理員權限與 API 安全防護規範 (Admin API Auth & Access Control)

本指南固化了在開發「管理員專屬功能」（如管理後台、審核、工單編輯與刪除）時，前後端必須遵循的安全架構、資料流設計與實作注意事項。

---

## 一、 核心架構原則 (Core Security Principles)

### 1. 畫面阻擋不等於後端安全 (UI Routing Guard ≠ API Security)
* **經典盲點**：僅在頁面路由（如 `/admin`）加上登入重定向，誤以為一般用戶看不到畫面就安全。
* **真實風險**：懂技術的使用者或攻擊者能直接透過 `curl`、Postman、Python 腳本或瀏覽器 Console 對後端 API（如 `PATCH`、`DELETE`）發送請求，直接繞過前端畫面進行未授權操作（Broken Object Level Authorization / BOLA 漏洞）。
* **最高準則**：**「每個具備管理特權的 API 端點，都必須具備獨立的後端授權檢核。」**

### 2. 縱深防禦 (Defense in Depth)
* **第一層（介面層）**：未驗證身分者，禁止載入管理畫面（HTML 重定向至 `/login`），且一般用戶面板不渲染敏感操作按鈕。
* **第二層（API 控制層）**：API 端點在處理任何業務邏輯前，置頂驗證呼叫者的 Session / Token 身分。

---

## 二、 後端實作規範 (Backend Implementation)

### 1. Session 驗證機制
* 使用加密簽章 Cookie（Flask 預設 Session）：透過後端 `app.secret_key` 簽名，防止客戶端竄改狀態。
* 狀態儲存標記：驗證成功後於 Session 中記錄（如 `session["is_admin"] = True`）。

### 2. API 端點安全置頂檢查
所有管理專屬端點（如更新狀態 `PATCH`、刪除工單 `DELETE`）進入函數後的**第一行**必須執行權限檢核：
```python
@app.delete("/api/tickets/<ticket_id>")
def delete_ticket(ticket_id):
    # 1. 置頂權限檢核：未授權一律阻擋
    if not session.get("is_admin"):
        return jsonify({"message": "未授權：請先登入管理員帳號"}), 401

    # 2. 業務邏輯與存在性檢查
    ticket = next((item for item in tickets if item["id"] == ticket_id), None)
    if ticket is None:
        return jsonify({"message": "找不到指定案件"}), 404

    # 3. 原地執行操作
    tickets.remove(ticket)
    return jsonify({"message": f"案件 {ticket_id} 已成功刪除"})
```