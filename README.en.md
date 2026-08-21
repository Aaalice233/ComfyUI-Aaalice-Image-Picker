# ComfyUI-Aaalice-Image-Picker

[简体中文](README.md) · [English](README.en.md) · [繁體中文](README.zh-TW.md)

Pause a ComfyUI workflow and manually filter an image batch in an internal modal overlay. It is designed for approval before expensive upscaling, detailing, or saving stages.

![Image picker interface placeholder](docs/images/picker-placeholder.svg)

## Features

- A one-image input batch is checked automatically; both single and multiple modes still require explicit confirmation and never submit automatically.
- A server-authoritative countdown with five actions: cancel, current selection, all, first, or last.
- Responsive thumbnail grid; every card independently supports pointer-anchored zoom (100%–800%) and constrained drag-to-pan for direct detail comparison.
- Card and large-preview zoom redraw only the visible region from the full-resolution lossless temporary PNG instead of stretching an already downscaled on-screen thumbnail.
- Immersive preview inside the same overlay, complete keyboard operation, and focus management.
- Collapsible CommonMark/GFM instructions rendered safely with local `marked` + `DOMPurify` copies.
- Complete `en`, `zh`, and `zh-TW` UI and node localization.
- Active-session recovery after refresh or WebSocket reconnect, with client and session isolation.

## Installation and updates

Install:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Aaalice233/ComfyUI-Aaalice-Image-Picker.git
```

Update:

```bash
cd ComfyUI/custom_nodes/ComfyUI-Aaalice-Image-Picker
git pull
```

Restart ComfyUI afterward. There are no additional Python dependencies and no CDN dependency.

## Node interface

The node ID is `AaaliceImagePicker`; find `🖼️ Aaalice Image Picker` under `Aaalice/image`.

| Direction | Name | Type | Default | Description |
| --- | --- | --- | --- | --- |
| Input | `images` | `IMAGE` | Required | Image batch to review |
| Input | `instructions` | `STRING` | Optional | Socket only; connected text is shown as Markdown in the overlay |
| Input | `selection_mode` | `single` / `multiple` | `multiple` | Single or multiple selection; both require confirmation |
| Input | `timeout` | `INT` | `300` | Server timeout in seconds, range `1–86400` |
| Input | `timeout_action` | See below | `cancel` | Action applied when the countdown expires |
| Output | `images` | `IMAGE` | — | Selected images in ascending source-index order; single selection keeps the batch dimension |

The node is marked non-idempotent, so every queued execution performs manual selection instead of reusing cached output.

### Connecting Markdown instructions

Write instructions in a ComfyUI multiline string node and connect its `STRING` output to `instructions`. For example:

```markdown
## Review criteria

- [ ] Subject structure is complete
- [ ] Lighting looks natural
- [ ] No obvious artifacts

| Priority | Check |
| --- | --- |
| High | Hands and face |
| Medium | Background detail |
```

The instructions region is omitted when the socket is disconnected or empty. Markdown supports headings, paragraphs, emphasis, lists, task lists, quotes, rules, code blocks, strikethrough, tables, links, and images. Dangerous HTML, event attributes, inline styles, and unsafe protocols are removed. Images are limited to safe same-origin URLs so opening a workflow cannot automatically request third-party resources.

## Selection and timeout behavior

### Selection modes

- A one-image input batch starts with that image checked, but the picker still opens and waits for confirmation.
- `single`: only one image stays selected; clicking another replaces it, and “Confirm selection” is still required.
- `multiple`: select any number of images and use “Select all” or “Clear”.
- Output is always sorted by original batch index, not click order.

### Timeout actions

| Value | Behavior |
| --- | --- |
| `cancel` | Cancel this execution |
| `submit_selected` | Submit the latest selection received by the server; cancel if empty |
| `submit_all` | Submit every image |
| `submit_first` | Submit the first image |
| `submit_last` | Submit the last image |

The final deadline decision uses the server's monotonic clock. Browser throttling, suspension, or delayed rendering cannot extend the execution deadline.

## Mouse and keyboard

### Gallery

- Click a thumbnail: toggle selection; dragging never toggles it accidentally.
- Wheel upward over the displayed image: begin zooming around the point under the pointer; once zoomed, the wheel continuously zooms between 100% and 800%.
- Drag while zoomed: pan within that card's constrained bounds; every card keeps an independent view position.
- Wheel downward at 100%: return control to gallery scrolling; `Shift+wheel` always scrolls the gallery to avoid a scroll trap.
- Click the restrained expand button on a thumbnail: open the large preview.
- Arrow keys: move thumbnail focus.
- `Space`: toggle the focused image.
- `+` / `-`: zoom the focused card; `Shift+arrow keys`: pan it while zoomed; `0`: reset it.
- Touch devices: use the always-visible large-preview button at the card's top right, then zoom with the preview toolbar; the touch entry point never depends on hover.
- `Enter`: preview the focused image.
- `Tab` / `Shift+Tab`: cycle focus inside the modal.
- `Escape`: explicitly cancel and interrupt this execution; clicking the backdrop does nothing.

### Large preview

- Wheel: continuously zoom around the image point under the pointer.
- Drag while zoomed: pan within constrained bounds.
- `←` / `→`: move to the previous/next image and reset the view.
- `Space`: toggle the current image.
- `+` / `-`: zoom in/out.
- `0`: reset to fit.
- `Escape`: return to the gallery without cancelling the workflow.

## Cancellation, interruption, and limits

User cancellation, empty confirmation, a `cancel` timeout, empty `submit_selected`, or a ComfyUI interruption raises `InterruptProcessingException`; the node never fabricates an empty image batch. If confirm, cancel, timeout, and interruption race, the server accepts only the first terminal state.

The picker is mounted only in the initiating ComfyUI client page. It does not open a browser window, use an iframe, rerun a prompt, play sounds, edit masks, or edit text. If every initiating page is closed, the workflow can only continue through its timeout action or after reconnecting with the same client ID.

## FAQ

**Why does execution stop at this node?**
That is expected. The workflow waits for confirmation, cancellation, interruption, or the server timeout.

**Why does single mode not continue immediately?**
Single mode and one-image batches still require confirmation so expensive downstream work never starts without approval.

**Can I continue after refreshing the page?**
Yes. A reconnect with the same ComfyUI client ID queries and restores any session that is still waiting.

**Can Markdown execute HTML or scripts?**
No. Rendered output passes through an explicit allowlist; external links open in a new tab with `noopener noreferrer`.

**Why can pixels become visible at extreme zoom?**
Once display magnification exceeds the source's native pixels, the preview stops applying blur interpolation instead of inventing detail that is not present. The result reflects the input image's actual pixel resolution.

## Development checks

```bash
python -m unittest discover -s tests -v
npm test
npm run check
python -m compileall -q .
```

Run Python tests with the Python environment used by ComfyUI.

## Acknowledgements and references

Thanks to the following projects for inspiring the product concept:

- [`chrisgoringe/cg-image-filter`](https://github.com/chrisgoringe/cg-image-filter): batch image filtering and execution-pausing interaction.
- [`TechnoWarrior2/comfyui-image-picker`](https://github.com/TechnoWarrior2/comfyui-image-picker): a concise image-selection and large-preview experience.

This project combines those product ideas, while its node architecture, session state machine, frontend interaction, and UI are independently implemented without copying their code or interface.

## License

Project code uses the [MIT License](LICENSE). Local vendor versions are listed in [`web/vendor/versions.json`](web/vendor/versions.json): `marked 15.0.11` (MIT) and `DOMPurify 3.4.12` (MPL-2.0 or Apache-2.0). Full third-party license texts are in [`web/vendor/`](web/vendor/).
