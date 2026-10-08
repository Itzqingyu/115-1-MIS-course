from datetime import datetime

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

# ==========================================
# 1. 應用程式初始化與設定
# ==========================================
app = Flask(__name__)

# Session 密鑰：Flask 預設使用客戶端 Cookie 儲存 Session，
# 透過此密鑰對 Cookie 進行加密簽章，防止客戶端竄改登入狀態。
app.secret_key = "mis-secret-key-for-demo"

# 教學用資料庫：資料僅暫存於 Python 執行階段的記憶體列表中。
# 重新啟動伺服器或停止程式後，資料會被清空還原。
tickets = []


# ==========================================
# 2. 網頁頁面路由 (HTML Pages)
# ==========================================

@app.get("/")
def index():
    """前台首頁：提供一般使用者填寫報修單與瀏覽現有案件清單。"""
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    """
    管理員身分驗證頁面：
    - GET: 顯示登入表單（若已登入則直接導向後台）。
    - POST: 接收表單帳號密碼進行比對，成功則寫入 Session，失敗則回傳錯誤訊息。
    """
    if request.method == "POST":
        # 取得使用者送出的表單資料並去除首尾空白
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        # 課堂演示：寫死固定帳號與密碼為 admin / admin
        if username == "admin" and password == "admin":
            # 登入成功：在 Session 中記錄管理員身分標記
            session["is_admin"] = True
            return redirect(url_for("admin"))

        # 登入失敗：重新渲染登入頁面並傳遞錯誤提示文字
        return render_template("login.html", error="帳號或密碼錯誤，請重新輸入。")

    # GET 請求：如果使用者已經是登入狀態，直接跳轉到管理後台
    if session.get("is_admin"):
        return redirect(url_for("admin"))

    return render_template("login.html")


@app.get("/logout")
def logout():
    """管理員登出：清除 Session 中的登入標記，並重定向至登入頁。"""
    session.pop("is_admin", None)
    return redirect(url_for("login"))


@app.get("/admin")
def admin():
    """
    管理員後台頁面（受保護路由）：
    進入前檢查 Session 是否具備 is_admin 權限，未登入者重定向至 /login。
    """
    if not session.get("is_admin"):
        return redirect(url_for("login"))
    return render_template("admin.html")


# ==========================================
# 3. RESTful API 端點 (JSON Data)
# ==========================================

@app.get("/api/tickets")
def list_tickets():
    """
    [API] 查詢所有報修案件：
    公開端點，前台與後台皆可呼叫，以 JSON 陣列格式回傳全部案件。
    """
    return jsonify(tickets)


@app.post("/api/tickets")
def create_ticket():
    """
    [API] 建立報修案件：
    公開端點，接收前台送來的 JSON 資料。
    包含後端資料驗證（防呆）、自動生成案件編號（T-001）、時間戳記並存入列表。
    """
    data = request.get_json(silent=True) or {}

    location = str(data.get("location", "")).strip()
    equipment = str(data.get("equipment", "")).strip()
    description = str(data.get("description", "")).strip()
    urgency = str(data.get("urgency", "一般")).strip()
    contact = str(data.get("contact", "")).strip()

    # 欄位完整性檢查（後端資料驗證）
    missing = []
    if not location:
        missing.append("地點")
    if not equipment:
        missing.append("設備")
    if not description:
        missing.append("問題描述")
    if not contact:
        missing.append("聯絡方式")

    if missing:
        # 若有必填欄位缺失，回傳 HTTP 400 Bad Request
        return jsonify({"message": f"請填寫：{'、'.join(missing)}"}), 400

    # 建立新案件資料物件
    ticket = {
        "id": f"T-{len(tickets) + 1:03d}",
        "location": location,
        "equipment": equipment,
        "description": description,
        "urgency": urgency or "一般",
        "contact": contact,
        "status": "待處理",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    tickets.append(ticket)

    # 建立成功，回傳 HTTP 201 Created 與新建立的案件內容
    return jsonify(
        {
            "message": f"報修已建立，案件編號為 {ticket['id']}",
            "ticket": ticket,
        }
    ), 201


@app.patch("/api/tickets/<ticket_id>")
def update_ticket(ticket_id):
    """
    [API] 更新案件處理狀態：
    受保護端點（僅限管理員）：
    1. 驗證 Session 登入狀態（若未登入回傳 HTTP 401 Unauthorized）。
    2. 驗證欲更新的狀態值是否合法（待處理、處理中、已完成）。
    3. 找到指定案件並更新其狀態。
    """
    # 權限驗證：確保未經登入的腳本無法竄改狀態
    if not session.get("is_admin"):
        return jsonify({"message": "未授權：請先登入管理員帳號"}), 401

    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).strip()
    allowed_statuses = {"待處理", "處理中", "已完成"}

    # 狀態值合法性檢查
    if status not in allowed_statuses:
        return jsonify({"message": "案件狀態不正確"}), 400

    # 搜尋對應 ID 的案件
    ticket = next((item for item in tickets if item["id"] == ticket_id), None)
    if ticket is None:
        return jsonify({"message": "找不到指定案件"}), 404

    # 更新狀態並回傳成功訊息
    ticket["status"] = status
    return jsonify({"message": f"{ticket_id} 已更新為「{status}」", "ticket": ticket})


@app.delete("/api/tickets/<ticket_id>")
def delete_ticket(ticket_id):
    """
    [API] 刪除報修案件：
    受保護端點（僅限管理員）：
    1. 驗證 Session 登入狀態（未登入回傳 HTTP 401）。
    2. 檢查案件是否存在（不存在回傳 HTTP 404）。
    3. 從記憶體列表中移除該案件。
    """
    # 權限驗證
    if not session.get("is_admin"):
        return jsonify({"message": "未授權：請先登入管理員帳號"}), 401

    # 搜尋指定案件
    ticket = next((item for item in tickets if item["id"] == ticket_id), None)
    if ticket is None:
        return jsonify({"message": "找不到指定案件"}), 404

    # 從列表中就地刪除案件物件
    tickets.remove(ticket)
    return jsonify({"message": f"案件 {ticket_id} 已成功刪除"})


# ==========================================
# 4. 主程式啟動入口
# ==========================================
if __name__ == "__main__":
    # 以除錯模式啟動伺服器（預設監聽 http://127.0.0.1:5000）
    app.run(debug=True)
