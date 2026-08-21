# ComfyUI-Aaalice-Image-Picker

[简体中文](README.md) · [English](README.en.md) · [繁體中文](README.zh-TW.md)

在 ComfyUI 工作流中暂停执行，通过内部模态浮层人工筛选图像批次。适合在高清放大、细化或保存等高成本步骤之前进行人工确认。

![图像选择器界面占位图](docs/images/picker-placeholder.svg)

## 功能

- 输入批次只有一张图时自动勾选；单选与多选均为“选择后确认”，不会自动提交。
- 服务端可信倒计时，以及取消、当前选择、全部、第一张、最后一张五种超时策略。
- 自适应缩略图网格；每张卡片都能独立进行鼠标位置锚定缩放（100%–800%）与拖拽平移，便于直接对比局部细节。
- 卡片与大图放大直接从完整分辨率的无损临时 PNG 按可见区域重绘，不会把屏幕上已经缩小的缩略图再次拉伸。
- 同一浮层内的大图预览、完整键盘操作和焦点管理。
- 可折叠的 CommonMark/GFM Markdown 说明，使用本地 `marked` + `DOMPurify` 安全渲染。
- `en`、`zh`、`zh-TW` 完整界面与节点本地化。
- 刷新或 WebSocket 重连后恢复仍在等待的 session；多客户端和多个选择器相互隔离。

## 安装与更新

安装：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Aaalice233/ComfyUI-Aaalice-Image-Picker.git
```

更新：

```bash
cd ComfyUI/custom_nodes/ComfyUI-Aaalice-Image-Picker
git pull
```

重启 ComfyUI 后生效。不需要额外 Python 依赖，也不依赖 CDN。

## 节点接口

节点 ID 为 `AaaliceImagePicker`，位于 `Aaalice/image`，名称为 `🖼️ Aaalice Image Picker`。

| 方向 | 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| 输入 | `images` | `IMAGE` | 必需 | 需要筛选的图像批次 |
| 输入 | `instructions` | `STRING` | 可选 | 纯输入引脚；连接字符串节点后在浮层中显示 Markdown |
| 输入 | `selection_mode` | `single` / `multiple` | `multiple` | 单选或多选，均需确认 |
| 输入 | `timeout` | `INT` | `300` | 服务端超时秒数，范围 `1–86400` |
| 输入 | `timeout_action` | 见下表 | `cancel` | 倒计时结束时执行的策略 |
| 输出 | `images` | `IMAGE` | — | 按原批次索引升序排列的已选图像；单选保留 batch 维度 |

节点被标记为非幂等，每次排队都会执行人工选择，不会复用缓存跳过。

### 连接 Markdown 说明

使用 ComfyUI 多行字符串节点编写说明，并把它的 `STRING` 输出连接到 `instructions`。例如：

```markdown
## 筛选标准

- [ ] 主体结构完整
- [ ] 光影自然
- [ ] 没有明显伪影

| 优先级 | 检查项 |
| --- | --- |
| 高 | 手部与面部 |
| 中 | 背景细节 |
```

未连接或内容为空时，说明区域完全省略。Markdown 支持标题、段落、强调、列表、任务列表、引用、分隔线、代码块、删除线、表格、链接和图片；危险 HTML、事件属性、内联样式及危险协议会被清除；图片仅允许安全的同源地址，避免打开工作流时自动请求第三方资源。

## 选择与超时

### 选择模式

- 输入批次只有一张图时会默认勾选该图，但仍显示选择器并等待确认。
- `single`：只能保留一张选择；点击另一张会替换当前选择，仍需按“确认选择”。
- `multiple`：可切换任意多张，并可使用“全选”和“清空”。
- 输出始终按原批次索引排序，不按点击顺序排序。

### 超时策略

| 值 | 行为 |
| --- | --- |
| `cancel` | 取消本次执行 |
| `submit_selected` | 提交服务端最后收到的选择；为空时取消 |
| `submit_all` | 提交全部图像 |
| `submit_first` | 提交第一张图像 |
| `submit_last` | 提交最后一张图像 |

倒计时的最终判定来自服务端单调时钟。浏览器标签页被降频、挂起或前端显示延迟不会延长执行期限。

## 鼠标与键盘

### 图库

- 单击缩略图：切换选择；拖拽操作不会误触选择。
- 在缩略图的实际图像区域向上滚动：以鼠标位置为锚点开始缩放；放大后滚轮可连续放大或缩小，范围为 100%–800%。
- 放大后拖拽：在当前卡片内平移并约束边界；每张卡片保留各自独立的查看位置。
- 缩回 100% 后向下滚动：自动交还图库滚动；`Shift+滚轮` 可随时直接滚动图库，避免滚动陷阱。
- 单击缩略图上的放大按钮：进入大图预览。
- 方向键：在缩略图间移动焦点。
- `Space`：切换焦点图像的选择状态。
- `+` / `-`：缩放焦点卡片；`Shift+方向键`：平移已放大的焦点卡片；`0`：重置焦点卡片。
- 触控设备：使用卡片右上角始终可见的大图按钮，并通过大图工具栏缩放；触控入口不依赖 hover。
- `Enter`：打开焦点图像的大图预览。
- `Tab` / `Shift+Tab`：在浮层内循环焦点。
- `Escape`：明确取消并终止本次执行；点击遮罩不会取消。

### 大图预览

- 滚轮：以鼠标对应的图像位置为锚点连续缩放。
- 放大后拖拽：平移图像，边界自动约束。
- `←` / `→`：切换上一张/下一张并重置视图。
- `Space`：切换当前图像选择状态。
- `+` / `-`：放大/缩小。
- `0`：重置到完整适配。
- `Escape`：返回图库，不取消工作流。

## 取消、中断与限制

用户取消、空选择确认、`cancel` 超时、空的 `submit_selected` 或 ComfyUI 中断都会抛出 `InterruptProcessingException`，不会伪造空图像批次。确认、取消、超时与中断发生竞态时，服务端只接受第一个终态。

选择器仅挂载在发起执行的当前 ComfyUI 客户端页面中：不打开独立窗口，不使用 iframe，也不提供重新排队、提示音、蒙版或文本编辑。关闭或离开所有发起执行的客户端页面后，只能等待超时策略或从相同客户端 ID 重连恢复。

## 常见问题

**为什么执行到节点后停住？**
这是预期行为。工作流会等待确认、取消、中断或服务端超时。

**为什么单选没有立即继续？**
单选和只有一张图的批次也必须确认，避免后续高成本步骤未经确认立即执行。

**刷新页面后还能继续吗？**
可以。相同 ComfyUI 客户端 ID 重连后会查询并恢复仍处于等待状态的 session。

**Markdown 能运行 HTML 或脚本吗？**
不能。渲染结果经过显式 allowlist 清洗；外链使用新标签页并带 `noopener noreferrer`。

**为什么极高倍率下会看到像素格？**
当显示倍率超过源图原生像素后，预览会停止模糊插值，不伪造不存在的细节；看到的是输入图像的真实像素分辨率。

## 开发验证

```bash
python -m unittest discover -s tests -v
npm test
npm run check
python -m compileall -q .
```

Python 测试应使用安装 ComfyUI 的 Python 环境。

## 致谢与参考

感谢以下项目为本项目的产品构想提供参考：

- [`chrisgoringe/cg-image-filter`](https://github.com/chrisgoringe/cg-image-filter)：批次图像筛选及执行暂停交互。
- [`TechnoWarrior2/comfyui-image-picker`](https://github.com/TechnoWarrior2/comfyui-image-picker)：简洁的图像选择与大图查看体验。

本项目结合了上述产品思路，但节点架构、Session 状态机、前端交互和 UI 均为独立实现，未复制其代码或界面。

## 许可证

项目代码使用 [MIT License](LICENSE)。本地 vendor 依赖版本见 [`web/vendor/versions.json`](web/vendor/versions.json)：`marked 15.0.11`（MIT）与 `DOMPurify 3.4.12`（MPL-2.0 或 Apache-2.0）；完整第三方许可证位于 [`web/vendor/`](web/vendor/)。
