---
name: "Aaalice Image Picker"
description: "沉静、精密、以真实图像细节为中心的 ComfyUI 人工校片界面"
colors:
  backdrop: "rgb(5 6 8 / 0.7)"
  background: "var(--comfy-menu-bg, #252629)"
  surface: "color-mix(in srgb, var(--comfy-menu-bg, #252629) 91%, white)"
  surface-raised: "color-mix(in srgb, var(--comfy-menu-bg, #252629) 84%, white)"
  surface-sunken: "color-mix(in srgb, var(--comfy-menu-bg, #252629) 93%, black)"
  text: "var(--fg-color, #f2f2f3)"
  text-muted: "color-mix(in srgb, var(--fg-color, #f2f2f3) 58%, transparent)"
  accent: "var(--p-primary-color, #8b9fff)"
  accent-strong: "color-mix(in srgb, var(--p-primary-color, #8b9fff) 84%, white)"
  danger: "var(--error-text, #ff7c83)"
  preview-shell: "#111214"
  preview-stage: "#0d0e10"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  control:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  numeric:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  code: "5px"
  badge: "6px"
  image: "7px"
  control: "9px"
  timer: "10px"
  card: "12px"
  dialog: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  control-gap: "8px"
  compact: "10px"
  sm: "12px"
  grid-gap: "14px"
  md: "16px"
  gallery: "18px"
  panel: "22px"
  section-gap: "24px"
components:
  button-primary:
    backgroundColor: "color-mix(in srgb, var(--p-primary-color, #8b9fff) 78%, #363940)"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "40px"
  button-secondary:
    backgroundColor: "rgb(255 255 255 / 0.055)"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "40px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "40px"
  button-icon:
    backgroundColor: "rgb(255 255 255 / 0.045)"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    width: "40px"
    height: "40px"
  image-card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.card}"
    padding: "10px"
  countdown:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text}"
    rounded: "{rounded.timer}"
    padding: "9px 12px"
  mode-badge:
    backgroundColor: "rgb(255 255 255 / 0.055)"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 9px"
---

# Design System: Aaalice Image Picker

## Overview

**Creative North Star: "暗房校片台"**

界面像一张嵌入 ComfyUI 工作流的专业校片台：背景沉静，结构清楚，所有视觉层级都为候选图像、局部细节和最终确认让路。整体气质是克制、沉静、精密、可信赖；它不追求品牌展示感，而是用安静且明确的反馈支撑高专注度判断。

视觉语言以深色色调分层、紧凑控制和少量冷光强调构成。模态与预览建立独立工作空间，卡片保持低噪声，状态变化不修改图像本身。高饱和装饰、品牌喧宾夺主、过亮大面积底色和复杂花哨动效都不属于这个系统。

**Key Characteristics:**

- 深色、沉静、图像优先
- 结构化分层而非装饰堆叠
- 冷光强调稀少且有明确语义
- 紧凑控件与完整可见的状态反馈
- 低频动效建立空间，高频检查不受干扰

## Colors

配色以适配 ComfyUI 主题的炭黑表面为主体，用“冷光引导色”标记选择、焦点和主操作，用柔和危险色表达真正紧急的状态。

### Primary

- **冷光引导色** (`var(--p-primary-color, #8b9fff)`): 跟随 ComfyUI 的 primary color，默认呈柔和蓝紫；仅用于选择描边、勾选徽标、主按钮、键盘焦点和 Markdown 链接。
- **冷光高亮色** (`color-mix(in srgb, var(--p-primary-color, #8b9fff) 84%, white)`): 提高选中轮廓和链接的可见度，不扩大强调色的覆盖面积。

### Tertiary

- **警示珊瑚红** (`var(--error-text, #ff7c83)`): 仅用于紧急倒计时、渲染错误和失败状态；不作为普通强调色。

### Neutral

- **暗房遮罩** (`rgb(5 6 8 / 0.7)`): 压低 ComfyUI 背景并建立独立校片空间。
- **暗房底色** (`var(--comfy-menu-bg, #252629)`): 承载整个模态主体，是最稳定的背景层。
- **工作台表面** (`color-mix(in srgb, var(--comfy-menu-bg, #252629) 91%, white)`): 用于 Header、Footer 和说明面板，使控制区与图库分离。
- **抬升卡片面** (`color-mix(in srgb, var(--comfy-menu-bg, #252629) 84%, white)`): 用于图像卡片，在不抢夺图像注意力的前提下建立边界。
- **沉入工作区** (`color-mix(in srgb, var(--comfy-menu-bg, #252629) 93%, black)`): 用于图库、内容区和倒计时容器，制造内嵌工作台感。
- **主文本白** (`var(--fg-color, #f2f2f3)`): 用于标题、主要状态和操作文本。
- **静音文本灰** (`color-mix(in srgb, var(--fg-color, #f2f2f3) 58%, transparent)`): 用于说明、快捷键、标签和次要状态。
- **预览深黑** (`#111214 / #0d0e10`): 用于大图预览外壳与舞台，让图像边缘和真实像素更容易判断。

### Named Rules

**The Cold-Light Scarcity Rule.** 冷光引导色只服务于选择、焦点、主操作和链接；它的稀少本身就是信息层级。

**The Image Neutrality Rule.** 选中状态不得改变图像亮度、饱和度或透明度，只能通过外描边、勾选徽标、ARIA 和状态文本表达。

## Typography

**Display Font:** 不设独立展示字体；产品没有营销型大标题。

**Body Font:** Inter，回退到系统无衬线字体。

**Label/Mono Font:** SFMono-Regular，回退到 Consolas 和 Liberation Mono。

**Character:** 无衬线字体保持界面清晰、紧凑和平台兼容；等宽数字只出现在倒计时、图像编号和缩放比例中，使不断变化的数据保持稳定宽度。

### Hierarchy

- **Title** (650, 20px, 1.25, -0.015em): 仅用于模态主标题，紧凑但有足够视觉锚点。
- **Body** (400, 14px, 1.65): 用于 Markdown 说明，强调长内容的可读性。
- **Control** (600, 13px): 用于主次按钮和操作文本，保证紧凑界面中的清晰点击意图。
- **Label** (600, 12px): 用于模式标签、倒计时标签和小型状态信息。
- **Numeric** (600, 15px, tabular-nums): 用于倒计时主值；图像编号和缩放比例沿用等宽体系但使用更小字号。

### Named Rules

**The Stable Numbers Rule.** 所有会变化的时间、序号和倍率使用等宽字体与 tabular numerals，避免状态更新引发布局跳动。

## Layout

界面是固定全屏遮罩中的三段式工作台。桌面模态占 `96vw × 94vh`，由 Header、可伸缩内容区和 Footer 组成；图像始终占据最大的弹性区域。说明为空时完全省略说明面板；有说明时，桌面端使用约 `260–330px` 的左栏，图库占据剩余空间。

图库采用自适应 CSS Grid。常规卡片以约 `245px` 为最小列宽，行高在 `220–390px` 之间随视口变化；1 张图填满工作区，2–4 张图使用更宽的卡片以提高比较质量。桌面间距以紧凑的 `8–24px` 节奏组织，其中图库使用 `14px` 间隔和 `18px` 内边距。

在 `800px` 及以下，模态变为 `100vw × 100dvh` 并取消圆角；说明面板从左栏切换为顶部区域，Footer 改为纵向，操作按钮变为两列，大图工具栏换行。粗指针设备的关键图标按钮和大图入口至少为 `44×44px`。

**The Image-First Space Rule.** 响应式压缩优先隐藏模式标签、快捷键摘要等辅助信息，不压缩图像检查和确认所需的核心空间。

## Elevation & Depth

系统采用已确认的“结构化分层”：深浅表面先建立区域关系，克制的环境阴影再强化模态、栏位和卡片。主模态拥有最深、最宽的阴影；Header、Footer 和说明面板以方向性阴影与细微高光边界分隔；卡片只有低调抬升；沉入式计时器主要依赖内阴影。大图进入拖拽状态后移除图像浮影，避免运动中的虚假层级。

### Shadow Vocabulary

- **主模态深度** (`0 0 0 1px rgb(255 255 255 / 0.055), 0 2px 3px rgb(0 0 0 / 0.34), 0 18px 46px rgb(0 0 0 / 0.42), 0 44px 110px rgb(0 0 0 / 0.34)`): 一层细微亮边、近距离接触阴影和两层宽幅环境阴影，把工作台从 ComfyUI 背景中抬起。
- **Header 结构栏位** (`0 1px 0 rgb(255 255 255 / 0.045), 0 8px 24px rgb(0 0 0 / 0.12)`): 向下投射轻微阴影，明确固定控制区与滚动内容区的边界。
- **Footer 结构栏位** (`0 -1px 0 rgb(255 255 255 / 0.04), 0 -10px 28px rgb(0 0 0 / 0.13)`): 向上投射轻微阴影，明确固定操作区与滚动内容区的边界。
- **卡片静态抬升** (`0 1px 1px rgb(0 0 0 / 0.25), 0 7px 22px rgb(0 0 0 / 0.16), inset 0 0 0 1px rgb(255 255 255 / 0.035)`): 短接触阴影、柔和环境阴影和极弱 inset 高光共同界定卡片。
- **预览图像悬浮** (`0 18px 50px rgb(0 0 0 / 0.32)`): 静止时用宽幅低透明阴影标记图像边缘；可拖拽时保持平坦。

### Named Rules

**The Tonal-First Rule.** 先用表面明度建立结构，只有需要表达真实空间层级时才增加阴影。

## Shapes

形状语言是柔和但不圆润过度的工具几何。主模态使用较大的 `18px` 圆角；图像卡片使用 `12px`；按钮和图标控件使用 `9px`；图像内容使用 `7px`，让外层容器与内部媒体形成清楚的圆角递进。模式标签使用胶囊形，选择徽标使用圆形，其余状态徽标保持紧凑的小圆角矩形。

边界主要由 1px inset 高光、outline 和色调差形成，而不是大量实体 border。键盘焦点统一使用 2px 冷光外描边并留出 2px 间距。

**The Nested Radius Rule.** 内层媒体的圆角必须小于承载它的卡片或控件圆角，保持可读的嵌套轮廓。

## Components

组件整体遵循“精确而安静”：控件紧凑、状态明确，所有组件都服务于图像判断，不制造额外视觉事件。

### Buttons

- **Shape:** 轻柔工具圆角（9px），文本按钮最小高度 40px；粗指针下图标按钮至少 44px。
- **Primary:** 冷光引导色与深灰混合的背景、白色文本、轻微强调色环境阴影；只用于确认选择或当前图像的主操作。
- **Secondary:** 半透明浅表面与细微 inset 高光，用于取消等明确但非主导的动作。
- **Quiet:** 透明背景与静音文本，用于全选、清空等低权重批量操作。
- **Hover / Focus / Active:** hover 仅在精确指针设备启用；focus-visible 使用 2px 冷光描边；active 缩放到 0.96；disabled 降至 0.38 opacity 且不位移。

### Chips

- **Style:** 模式标签采用低对比半透明表面、静音文本和胶囊轮廓。
- **State:** 只展示上下文，不伪装成可点击筛选器；窄屏时可隐藏。

### Cards / Containers

- **Corner Style:** 图像卡片使用 12px 圆角，内部图像使用 7px 圆角。
- **Background:** 使用抬升卡片面，图像四周保留 10px 呼吸空间。
- **Shadow Strategy:** 静态低调抬升，选中时不增加夸张投影。
- **Selection:** 2px 冷光外描边加右上角外悬圆形勾选徽标；图像像素本身保持不变。
- **Interaction:** 卡片缩放、平移和重绘不使用 CSS transition；hover 提示只对精确指针显示。

### Countdown

- **Style:** 10px 圆角的沉入式容器，标签使用静音文本，主值使用等宽数字。
- **Urgent:** 仅剩 10 秒时切换为警示珊瑚红并显示轻微同色边界，不闪烁、不加入夸张动画。

### Instructions Panel

- **Style:** 使用工作台表面与结构阴影同图库分离；正文采用 14px / 1.65 的阅读节奏。
- **Markdown:** 标题保持紧凑；链接与引用只用少量冷光色；代码块、表格和图片使用小半径与微弱边界。
- **Responsive:** 桌面为可折叠左栏，窄屏为可折叠顶部区域；空内容时不创建面板。

### Preview Overlay

- **Style:** 在主模态内部覆盖为更深的大图检视空间，顶部工具栏、中央舞台和底部快捷键提示构成三段布局。
- **Stage:** 使用接近黑色的舞台与极弱径向亮度，让不同长宽比的图像边缘可辨而不影响色彩判断。
- **Controls:** 图标按钮保持统一 40px/44px 触控尺寸，倍率使用等宽文本；窄屏时工具栏换行而不移除核心控制。

## Do's and Don'ts

### Do:

- **Do** 让图像始终占据最大、最安静的视觉区域。
- **Do** 使用色调分层先建立结构，再用克制阴影补充真实层级。
- **Do** 只在选择、焦点、主操作和链接上使用冷光引导色。
- **Do** 用外描边、徽标、ARIA 和文本共同表达选择状态，保持图像像素不变。
- **Do** 为键盘、触控、窄屏和 reduced motion 保留等价且完整的操作路径。

### Don't:

- **Don't** 使用高饱和装饰、过亮大面积底色或品牌元素抢夺图像注意力。
- **Don't** 给滚轮缩放、拖拽平移或连续重绘添加过渡动画。
- **Don't** 依赖 hover 暴露关键操作，或把关键触控目标做小于 44×44px。
- **Don't** 用模糊放大的缩略图替代完整分辨率细节检查。
- **Don't** 用复杂花哨动效、发光或多余阴影制造不存在的层级。
