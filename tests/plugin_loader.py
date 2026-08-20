from __future__ import annotations

import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
COMFY_ROOT = ROOT.parents[1]


def load_plugin():
    root_text = str(ROOT)
    comfy_text = str(COMFY_ROOT)
    original_path = list(sys.path)
    try:
        sys.path = [path for path in sys.path if path not in {"", root_text, comfy_text}]
        sys.path.insert(0, comfy_text)
        __import__("nodes")

        package_name = "aaalice_image_picker"
        if package_name in sys.modules:
            return sys.modules[package_name]
        spec = importlib.util.spec_from_file_location(
            package_name,
            ROOT / "__init__.py",
            submodule_search_locations=[root_text],
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules[package_name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path = original_path


plugin_module = load_plugin()
