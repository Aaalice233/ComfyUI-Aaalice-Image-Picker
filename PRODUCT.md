# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要用户是使用 ComfyUI 批量生成图像的个人工作流作者和操作人员。他们需要在高清放大、细化、保存等高成本步骤之前检查候选图像、比较局部细节，并决定哪些结果继续进入后续流程。

## Product Purpose

Aaalice Image Picker 在 ComfyUI 工作流执行过程中建立一个可靠的人工确认节点：工作流运行到节点时暂停，在当前 ComfyUI 页面展示输入图像批次，等待用户检查、选择并明确确认后，再把选中的 `IMAGE` 批次传递给后续节点。

产品成功意味着减少不合格图像进入高成本后续步骤，同时让图像筛选足够准确、高效，并保证暂停、恢复、取消和超时行为可靠可预期。

## Positioning

产品不是工作流外部的图库，也不是重新发起任务的队列工具。它把服务端拥有的暂停状态机、当前 ComfyUI 客户端内的人工确认、完整分辨率细节检查和原批次 tensor 筛选组合在同一节点中：浏览器只负责交互，服务端负责可信 deadline 与唯一终态，确认后的工作流从原执行位置继续。

## Operating Context

1. ComfyUI 执行 `AaaliceImagePicker` 节点并传入 `IMAGE` 批次。
2. 后端生成完整分辨率临时 PNG 预览并创建与发起客户端绑定的 session。
3. 当前 ComfyUI 页面通过定向 WebSocket 事件挂载内部模态浮层。
4. 用户通过缩略图、卡片缩放或大图预览检查结果，并在单选或多选模式下建立选择。
5. 用户明确确认、取消，或由服务端按配置的超时策略结束等待。
6. 节点按原批次索引升序筛选 tensor，保持 batch 维度、dtype 和 device，并继续原工作流。

页面刷新或 WebSocket 重连后，同一 ComfyUI client ID 可以恢复仍在等待的 session。多个客户端和多个选择器 session 相互隔离。

## Capabilities and Constraints

- 节点 ID 为 `AaaliceImagePicker`，显示名为 `🖼️ Aaalice Image Picker`，分类为 `Aaalice/image`。
- 支持 `single` 与 `multiple` 选择模式；两种模式都必须明确确认。
- 单图批次默认勾选唯一图像，但不会自动提交。
- 支持取消、提交当前选择、提交全部、提交第一张和提交最后一张五种服务端超时策略。
- 服务端使用单调时钟判定 deadline；浏览器降频、挂起或本地墙钟偏差不能延长执行期限。
- 图库卡片支持独立的 100%–800% 锚点缩放和平移，并提供同一模态内的大图预览。
- 放大检查使用完整分辨率临时 PNG 的可见区域栅格化，不把已缩小的屏幕缩略图再次放大来伪造细节。
- 可选 `instructions` 输入支持经本地 `marked` 与 `DOMPurify` 清洗的 CommonMark/GFM Markdown。
- 节点非幂等，每次排队都进入人工选择，不通过缓存跳过。
- 确认、取消、服务端超时和 ComfyUI 中断竞争时只接受第一个终态。
- 当前节点契约只处理并输出 `IMAGE` 批次，不提供 `LATENT`、`MASK`、索引或其他类型透传。
- 选择器只挂载在发起执行的当前 ComfyUI 页面，不打开独立窗口或 iframe，不负责重新排队、提示音、蒙版编辑或文本编辑。
- 不加入额外 Python 依赖，不依赖 CDN，不从核心路径发起互联网请求。
- `en`、`zh`、`zh-TW` 三种节点、界面和文档本地化必须同步维护，英文为最终回退。

## Brand Commitments

- 产品名保持为 `Aaalice Image Picker`，节点显示名保持为 `🖼️ Aaalice Image Picker`。
- 用户文案保持简短、直接、以当前操作和结果为中心。
- 产品参考 `chrisgoringe/cg-image-filter` 的批次筛选思路和 `TechnoWarrior2/comfyui-image-picker` 的简洁交互，但节点架构、Session 状态机、前端交互和 UI 保持独立实现，不复制其代码或界面。

## Evidence on Hand

- 产品说明与行为契约：`README.md`、`README.en.md`、`README.zh-TW.md`
- 架构、状态机、API、交互和测试矩阵：`docs/PROJECT.md`
- Python 节点与服务端实现：`nodes.py`、`session_store.py`、`routes.py`
- ComfyUI 前端实现：`web/index.js`、`web/picker.js`、`web/picker.css`、`web/lib/`
- 三语本地化：`locales/en/`、`locales/zh/`、`locales/zh-TW/`
- Python 与 JavaScript 自动测试：`tests/`、`tests-js/`
- 当前文档图像 `docs/images/picker-placeholder.svg` 只是占位图，不得作为真实界面或产品效果证据；未来展示材料不得虚构用户、客户、评价或性能数据。

## Product Principles

1. **明确确认优先于自动化捷径**：选择可以被预填，但继续工作流必须来自用户确认或明确配置的服务端超时策略。
2. **真实细节优先于预览假象**：图像检查必须尽可能忠实于原始分辨率，不用模糊放大的缩略图误导判断。
3. **执行可靠性优先于前端便利**：deadline、客户端归属、选择草稿和唯一终态由服务端保证，前端刷新或延迟不能改变执行事实。
4. **保持原工作流语义**：筛选结果维持 ComfyUI 的 batch、索引、dtype、device 和节点执行契约，不把无关能力塞进节点接口。
5. **简洁交互必须覆盖真实边界**：界面保持克制，但键盘、触控、窄窗口、重连、多实例、取消、超时和中断都必须有完整可预期的路径。

## Accessibility & Inclusion

- 模态必须具备正确的 dialog 语义、焦点进入/限制/恢复和完整键盘操作。
- 图库选择状态不能只依赖颜色，需同步提供 `aria-pressed`、焦点状态和可读播报。
- 触控设备的关键入口不能依赖 hover，交互目标至少保持 44×44px。
- 遵循 `prefers-reduced-motion`，减少非必要位移动效。
- 响应式布局应保证窄窗口仍能完成说明阅读、图像检查、选择、确认和取消。
- `en`、`zh`、`zh-TW` 用户获得等价的功能文案、ARIA 文案和操作说明。
