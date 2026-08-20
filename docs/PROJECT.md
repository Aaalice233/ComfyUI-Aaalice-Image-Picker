# ComfyUI-Aaalice-Image-Picker

## 项目定位

本项目是 ComfyUI 的人工图像筛选节点。执行到 `AaaliceImagePicker` 时，后端保存临时预览并暂停当前执行线程；只有用户确认、取消、服务端超时或 ComfyUI 中断后才会进入唯一终态。

首版只处理 `IMAGE` 批次：不提供独立浏览器窗口、iframe、重新排队、提示音、蒙版、文本编辑、索引输出或其他类型透传。

## 架构边界

- `nodes.py`：V3 节点 schema、输入校验、临时预览生成、等待生命周期和 tensor 批次筛选。
- `session_store.py`：不依赖 aiohttp 或前端的线程安全领域状态；拥有 deadline、revision、选择草稿和终态竞争。
- `routes.py`：把 aiohttp JSON 请求规范化为 Session Store 操作，并返回明确 HTTP 错误。
- `web/index.js`：ComfyUI 扩展入口、定向 WebSocket 事件与 session 恢复桥接。
- `web/picker.js`：模态 DOM、焦点、图库、预览和网络交互。
- `web/lib/`：可由 Node 内置测试直接覆盖的选择、deadline、session registry、缩放和 Markdown 逻辑。
- `locales/`：ComfyUI 节点翻译与自绘 UI 翻译，业务组件不分散硬编码英文文案。

原始 tensor 只保留在当前节点执行调用中。Session Store 只保存 UUID、客户端/节点身份、预览描述、纯文本说明和索引状态，不持有 tensor 或跨执行大对象缓存。

## 节点契约

- `node_id`：`AaaliceImagePicker`
- 分类：`Aaalice/image`
- 输入：`images`、可选纯引脚 `instructions`、`selection_mode`、`timeout`、`timeout_action`
- 输出：一个 `IMAGE` 批次
- `not_idempotent=True`，每次排队都执行人工选择
- 单选和多选都必须确认
- 输出索引去重并升序排列；单选保留 batch 维度
- 空批次、错误 tensor 布局和无发起客户端均明确失败

## Session 状态机

```text
ACTIVE
 ├─ confirm(non-empty) ───────────────> CONFIRMED
 ├─ confirm(empty) / cancel ──────────> CANCELLED
 ├─ timeout + submit result ──────────> TIMED_OUT_SUBMIT
 ├─ timeout + empty/cancel ───────────> TIMED_OUT_CANCEL
 └─ ComfyUI interrupt ────────────────> INTERRUPTED
```

每个 session 使用独立 `threading.Condition(RLock)`。确认、取消、超时和中断进入同一把锁，只有第一个写入的终态有效；重复或迟到响应返回 409/410。Store 级锁只保护 session map，所有退出路径都会先发送定向 close 事件，再在 `finally` 中从 map 清理 session。

服务端用 `time.monotonic()` 判定 deadline；payload 同时提供 `deadline_epoch_ms`、当前 `server_epoch_ms` 与基于单调时钟计算的 `remaining_ms`。前端在收到 payload 时用 `remaining_ms` 建立本地显示基准，因此远程浏览器墙钟偏差不会改变倒计时，前端时钟也不参与最终决策。执行线程以低频 Condition wait 周期检查 ComfyUI 中断，不忙轮询。

### 选择草稿与 revision

每次前端选择变化都提交递增 revision。服务端只接受严格大于已接收值的 revision，拒绝乱序旧请求。草稿用于 `submit_selected` 超时策略；最终确认始终携带完整选择，不依赖草稿请求是否先到达。

服务端拒绝：

- 非整数、重复或越界索引；
- 单选模式下超过一个索引；
- 非正整数或陈旧 revision；
- 未知 action、未知/结束/过期 session；
- `client_id` 不匹配。

## 本地 API

命名空间：`/aaalice/image-picker`。

| 方法 | 路径 | 请求 | 成功响应 | 主要错误 |
| --- | --- | --- | --- | --- |
| `GET` | `/sessions?client_id=...` | 当前 ComfyUI client ID | `{ sessions: [...] }` | 400 缺少 client |
| `POST` | `/draft` | `session_id`, `client_id`, `revision`, `selected` | 已接受的 revision/selection | 400/403/404/409/410 |
| `POST` | `/respond` | `session_id`, `client_id`, `action`, 完整 `selected` | 唯一终态与结果 | 400/403/404/409/410 |

错误形状统一为：

```json
{
  "error": {
    "code": "selection_out_of_range",
    "message": "A selected image index is out of range."
  }
}
```

WebSocket 事件 `aaalice-image-picker-open` 与 `aaalice-image-picker-close` 都通过 `PromptServer.send_sync(..., client_id)` 仅发送给发起执行的客户端，不广播。前端初次加载和 `reconnected` 时查询 `/sessions`，恢复仍在 `ACTIVE` 的 session。

## 数据流

1. ComfyUI 执行 V3 节点并提供 `images` 与 `unique_id`。
2. `PreviewImage` 把 batch 写入 ComfyUI temp，返回安全的预览描述。
3. 后端创建带完整 UUID、client、deadline 和策略的 session。
4. 定向 open 事件让对应页面挂载模态；刷新时由恢复 API 补发等价 payload。
5. 前端选择变化发送 revision 草稿；确认发送完整选择。
6. 执行线程被 Condition 唤醒，得到终态索引或抛出 `InterruptProcessingException`。
7. `images[selected_indexes]` 生成保持 dtype/device 和 batch 维度的新批次。
8. `finally` 定向关闭浮层并清理 session；ComfyUI 自身管理 temp 预览生命周期。

## 前端交互与可访问性

模态直接挂载在当前 ComfyUI 页面，约 `96vw × 94vh`。图库使用完整显示的 lazy/async 图像；说明为空时不创建侧栏，非空时默认展开且可折叠，窄窗口切换为顶部区域。

焦点打开时被保存并移动到图库，Tab 被限制在模态内，关闭后恢复。图库使用 roving tabindex 和 `listbox/option` 语义；选择状态同时使用阴影、灰阶覆盖、勾选和 ARIA，不只依赖颜色。遮罩点击没有行为。

大图以 fit 尺寸为 100%，缩放状态只更新 `transform`。滚轮用指针对应的中心坐标计算锚点；Pointer Events 平移使用预览边界 clamp。切图和 resize 重新 fit，缩放范围为 1–8 倍。

进入动效只服务于低频模态空间建立：180ms opacity + `scale(.97→1)`，使用强 `ease-out`。高频选择只做 120ms 颜色、阴影和透明度过渡，滚轮/拖拽不加过渡。按钮按压为 `scale(.96)`；`prefers-reduced-motion` 移除位移动效，hover 只在精确指针设备启用。

## Markdown 安全

- vendor：`marked 15.0.11`、`DOMPurify 3.4.12`，不使用 CDN。
- 支持 CommonMark/GFM 常用结构、表格、任务列表、删除线、链接和图片。
- DOMPurify 使用明确标签/属性 allowlist；不允许 data attribute、`style`、事件属性、自定义元素或脚本。
- URL 二次校验允许 `http:` / `https:` 链接与安全同源路径，拒绝 `javascript:`、`data:` 等协议；Markdown 图片进一步限制为同源资源，避免加载工作流时自动请求第三方地址。
- 所有链接强制 `target="_blank" rel="noopener noreferrer"`。
- Markdown 解析失败时仅显示本地化纯文本错误。
- 第三方版本与许可证保存在 `web/vendor/versions.json` 和相邻许可证文件中。

## i18n 约束

`locales/en`、`locales/zh`、`locales/zh-TW` 必须同时维护：

- `nodeDefs.json`：节点名、描述、所有输入输出名与 tooltip；
- `main.json`：按钮、状态、错误、倒计时、超时策略、Markdown、预览、快捷键、ARIA 与 tooltip。

语言跟随 `Comfy.Locale`，繁中可回退简中，最终回退英文。自动测试递归比较三种语言的完整键集合，并拒绝空翻译。三份 README 也必须保持章节、命令、参数和行为等价。

## 测试矩阵

| 层级 | 自动覆盖 |
| --- | --- |
| Python Session | 创建、恢复、revision、索引/单选校验、客户端隔离、重复响应、清理 |
| Python 竞态 | 确认/取消唯一赢家、中断终态、五种 timeout 与空 `submit_selected` |
| Python tensor/schema | 非幂等 V3 schema、输出顺序、batch、dtype/device、空批次和布局错误 |
| JavaScript selection | 单选替换、多选切换、全选/清空、payload 排序、键盘网格移动、deadline |
| JavaScript preview | 鼠标锚点不变量、1–8 倍范围、平移边界和 reset |
| JavaScript security | GFM 结构、URL 协议策略、DOMPurify 显式 allowlist 静态约束 |
| JavaScript lifecycle/i18n | 重复 open/close、恢复队列、清理，以及三语键集合/空值 |

发布前还需在真实 ComfyUI 页面验收：1 张、2–4 张、10+ 张、横竖混合、长 Markdown；两种模式和五种策略；取消、中断、刷新恢复、连续节点、双客户端；明暗主题、三种语言、窄窗口、reduced motion、完整键盘流程和大图手势。

## 未来扩展点

保持首版接口不变时，可在现有边界内扩展：

- Session Store 增加可观测但不含 tensor 的诊断快照；
- 前端图库针对超大批次增加虚拟化；
- 在不改变输出契约的前提下增加更多本地布局偏好。

LATENT、MASK、索引、提示文本或透传输出属于新的节点契约，不能以兼容参数偷偷加入；独立窗口、rerun、提示音、蒙版和文本编辑仍是明确非目标。

## 参考项目

项目参考以下开源项目的产品思路，但没有复制其实现或 UI：

- [`chrisgoringe/cg-image-filter`](https://github.com/chrisgoringe/cg-image-filter)：批次图像筛选能力。
- [`TechnoWarrior2/comfyui-image-picker`](https://github.com/TechnoWarrior2/comfyui-image-picker)：简洁的图像选择与大图查看交互。
