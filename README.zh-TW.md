# ComfyUI-Aaalice-Image-Picker

[简体中文](README.md) · [English](README.en.md) · [繁體中文](README.zh-TW.md)

在 ComfyUI 工作流程中暫停執行，透過內部模態浮層人工篩選圖像批次。適合在高清放大、細化或儲存等高成本步驟之前進行人工確認。

![圖像選擇器介面預留圖](docs/images/picker-placeholder.svg)

## 功能

- 單選與多選均為「選擇後確認」，不會因單擊直接提交。
- 伺服器可信倒數，以及取消、目前選擇、全部、第一張、最後一張五種逾時策略。
- 自適應縮圖網格、完整鍵盤操作和焦點管理。
- 同一浮層內的大圖預覽，支援滑鼠位置錨定縮放（100%–800%）與拖曳平移。
- 可收合的 CommonMark/GFM Markdown 說明，使用本地 `marked` + `DOMPurify` 安全呈現。
- `en`、`zh`、`zh-TW` 完整介面與節點本地化。
- 重新整理或 WebSocket 重連後還原仍在等待的 session；多用戶端和多個選擇器彼此隔離。

## 安裝與更新

安裝：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Aaalice233/ComfyUI-Aaalice-Image-Picker.git
```

更新：

```bash
cd ComfyUI/custom_nodes/ComfyUI-Aaalice-Image-Picker
git pull
```

重新啟動 ComfyUI 後生效。不需要額外 Python 相依套件，也不依賴 CDN。

## 節點介面

節點 ID 為 `AaaliceImagePicker`，位於 `Aaalice/image`，名稱為 `🖼️ Aaalice Image Picker`。

| 方向 | 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| 輸入 | `images` | `IMAGE` | 必需 | 需要篩選的圖像批次 |
| 輸入 | `instructions` | `STRING` | 可選 | 純輸入接腳；連接字串節點後在浮層中顯示 Markdown |
| 輸入 | `selection_mode` | `single` / `multiple` | `multiple` | 單選或多選，均需確認 |
| 輸入 | `timeout` | `INT` | `300` | 伺服器逾時秒數，範圍 `1–86400` |
| 輸入 | `timeout_action` | 見下表 | `cancel` | 倒數結束時執行的策略 |
| 輸出 | `images` | `IMAGE` | — | 按原批次索引升冪排列的已選圖像；單選保留 batch 維度 |

節點被標記為非冪等，每次排隊都會執行人工選擇，不會重用快取而跳過。

### 連接 Markdown 說明

使用 ComfyUI 多行字串節點編寫說明，並把它的 `STRING` 輸出連接到 `instructions`。例如：

```markdown
## 篩選標準

- [ ] 主體結構完整
- [ ] 光影自然
- [ ] 沒有明顯偽影

| 優先級 | 檢查項目 |
| --- | --- |
| 高 | 手部與臉部 |
| 中 | 背景細節 |
```

未連接或內容為空時，說明區域完全省略。Markdown 支援標題、段落、強調、清單、工作清單、引用、分隔線、程式碼區塊、刪除線、表格、連結和圖片；危險 HTML、事件屬性、行內樣式及危險協定會被清除；圖片僅允許安全的同源網址，避免開啟工作流程時自動要求第三方資源。

## 選擇與逾時

### 選擇模式

- `single`：只能保留一張選擇；點擊另一張會取代目前選擇，仍需按「確認選擇」。
- `multiple`：可切換任意多張，並可使用「全選」和「清空」。
- 輸出始終按原批次索引排序，不按點擊順序排序。

### 逾時策略

| 值 | 行為 |
| --- | --- |
| `cancel` | 取消本次執行 |
| `submit_selected` | 提交伺服器最後收到的選擇；為空時取消 |
| `submit_all` | 提交全部圖像 |
| `submit_first` | 提交第一張圖像 |
| `submit_last` | 提交最後一張圖像 |

倒數的最終判定來自伺服器單調時鐘。瀏覽器分頁被降頻、暫停或前端顯示延遲不會延長執行期限。

## 滑鼠與鍵盤

### 圖庫

- 單擊縮圖：切換選擇。
- 單擊縮圖上的放大按鈕：進入大圖預覽。
- 方向鍵：在縮圖間移動焦點。
- `Space`：切換焦點圖像的選擇狀態。
- `Enter`：開啟焦點圖像的大圖預覽。
- `Tab` / `Shift+Tab`：在浮層內循環焦點。
- `Escape`：明確取消並終止本次執行；點擊遮罩不會取消。

### 大圖預覽

- 滾輪：以滑鼠對應的圖像位置為錨點連續縮放。
- 放大後拖曳：平移圖像，邊界自動約束。
- `←` / `→`：切換上一張/下一張並重設視圖。
- `Space`：切換目前圖像選擇狀態。
- `+` / `-`：放大/縮小。
- `0`：重設為完整適配。
- `Escape`：返回圖庫，不取消工作流程。

## 取消、中斷與限制

使用者取消、空選擇確認、`cancel` 逾時、空的 `submit_selected` 或 ComfyUI 中斷都會拋出 `InterruptProcessingException`，不會偽造空圖像批次。確認、取消、逾時與中斷發生競態時，伺服器只接受第一個終態。

選擇器只掛載在發起執行的目前 ComfyUI 用戶端頁面中：不開啟獨立視窗，不使用 iframe，也不提供重新排隊、提示音、遮罩或文字編輯。關閉或離開所有發起執行的用戶端頁面後，只能等待逾時策略，或使用相同用戶端 ID 重連還原。

## 常見問題

**為什麼執行到節點後停住？**
這是預期行為。工作流程會等待確認、取消、中斷或伺服器逾時。

**為什麼單選沒有立即繼續？**
單選也必須確認，避免誤觸導致後續高成本步驟立即執行。

**重新整理頁面後還能繼續嗎？**
可以。相同 ComfyUI 用戶端 ID 重連後會查詢並還原仍處於等待狀態的 session。

**Markdown 能執行 HTML 或指令碼嗎？**
不能。呈現結果經過明確 allowlist 清洗；外部連結使用新分頁並帶 `noopener noreferrer`。

## 開發驗證

```bash
python -m unittest discover -s tests -v
npm test
npm run check
python -m compileall -q .
```

Python 測試應使用安裝 ComfyUI 的 Python 環境。

## 授權

專案程式碼使用 [MIT License](LICENSE)。本地 vendor 版本見 [`web/vendor/versions.json`](web/vendor/versions.json)：`marked 15.0.11`（MIT）與 `DOMPurify 3.4.12`（MPL-2.0 或 Apache-2.0）；完整第三方授權位於 [`web/vendor/`](web/vendor/)。
