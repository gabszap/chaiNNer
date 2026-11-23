from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import TypedDict

DEFAULT_SUBDIRS: tuple[str, ...] = ("inputs", "outputs", "models", "chains")

IMAGE_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".bmp",
        ".gif",
        ".tif",
        ".tiff",
        ".avif",
    }
)

INVALID_NAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


class FileEntry(TypedDict):
    name: str
    path: str
    relativePath: str
    isDir: bool
    size: int
    fileCount: int
    modifiedMs: int
    ext: str
    isImage: bool


class Breadcrumb(TypedDict):
    name: str
    path: str


class ShortcutEntry(TypedDict):
    id: str
    name: str
    path: str


class DirectoryListing(TypedDict):
    root: str
    currentPath: str
    relativePath: str
    parentPath: str | None
    currentFileCount: int
    currentSize: int
    breadcrumbs: list[Breadcrumb]
    shortcuts: list[ShortcutEntry]
    entries: list[FileEntry]


def get_default_web_root(
    configured_root: str | None,
    storage_dir: str | None = None,
) -> Path:
    if configured_root and configured_root.strip():
        return Path(configured_root).expanduser()

    env_root = os.environ.get("CHAINNER_WEB_ROOT", "").strip()
    if env_root:
        return Path(env_root).expanduser()

    if storage_dir and storage_dir.strip():
        return Path(storage_dir).expanduser() / "web-files"

    return Path.home() / "chaiNNer-web"


def ensure_sandbox_dirs(root: Path) -> Path:
    resolved_root = root.resolve()
    resolved_root.mkdir(parents=True, exist_ok=True)
    for sub in DEFAULT_SUBDIRS:
        (resolved_root / sub).mkdir(parents=True, exist_ok=True)
    return resolved_root


def resolve_sandbox_path(root: Path, raw_path: str | None) -> Path:
    """
    Resolves `raw_path` strictly inside `root`.
    Accepts empty/None (returns `root`), relative paths, or absolute paths inside `root`.
    Raises PermissionError if the resolved path escapes `root` (including via symlinks).
    """
    resolved_root = root.resolve()
    if not raw_path or not raw_path.strip():
        return resolved_root

    candidate_input = Path(raw_path.strip())
    if candidate_input.is_absolute():
        resolved = candidate_input.resolve()
    else:
        cleaned = raw_path.strip().lstrip("/\\")
        resolved = (resolved_root / cleaned).resolve()

    if not resolved.is_relative_to(resolved_root):
        raise PermissionError(f"Path '{raw_path}' escapes the allowed web root.")

    return resolved


def sanitize_filename(filename: str) -> str:
    base = Path(filename).name.strip()
    base = INVALID_NAME_CHARS.sub("_", base)
    base = base.strip(". ")
    if not base or base in {".", ".."}:
        return "uploaded_file"
    return base


def _to_relative_posix(root: Path, target: Path) -> str:
    rel = target.relative_to(root)
    return "" if str(rel) == "." else rel.as_posix()


def _normalize_extensions(extensions: list[str] | None) -> set[str] | None:
    if not extensions:
        return None
    normalized: set[str] = set()
    for ext in extensions:
        cleaned = ext.strip().lower()
        if not cleaned or cleaned in {"*", ".*"}:
            return None
        if not cleaned.startswith("."):
            cleaned = f".{cleaned}"
        normalized.add(cleaned)
    return normalized or None


def _compute_dir_stats(directory: Path, resolved_root: Path) -> tuple[int, int]:
    """Returns (file_count, total_size_bytes) recursively inside `directory`."""
    file_count = 0
    total_size = 0
    try:
        for dirpath, _dirnames, filenames in os.walk(directory, followlinks=False):
            current_dir = Path(dirpath).resolve()
            if not current_dir.is_relative_to(resolved_root):
                continue
            for fname in filenames:
                fpath = Path(dirpath) / fname
                try:
                    if fpath.is_symlink():
                        continue
                    total_size += fpath.stat().st_size
                    file_count += 1
                except OSError:
                    continue
    except OSError:
        pass
    return file_count, total_size


def list_directory(
    root: Path,
    raw_path: str | None = None,
    extensions: list[str] | None = None,
) -> DirectoryListing:
    resolved_root = ensure_sandbox_dirs(root)
    try:
        target = resolve_sandbox_path(resolved_root, raw_path)
    except PermissionError:
        target = resolved_root

    if target.is_file():
        target = target.parent
    if not target.exists() or not target.is_dir():
        target = resolved_root

    allowed_exts = _normalize_extensions(extensions)
    entries: list[FileEntry] = []

    for child in target.iterdir():
        try:
            resolved_child = child.resolve()
            if not resolved_child.is_relative_to(resolved_root):
                continue
            stat = child.stat()
            is_dir = child.is_dir()
        except OSError:
            continue

        ext = "" if is_dir else child.suffix.lower()
        if not is_dir and allowed_exts is not None and ext not in allowed_exts:
            continue

        if is_dir:
            dir_files, dir_size = _compute_dir_stats(resolved_child, resolved_root)
        else:
            dir_files, dir_size = 0, stat.st_size

        entries.append(
            {
                "name": child.name,
                "path": str(resolved_child),
                "relativePath": _to_relative_posix(resolved_root, resolved_child),
                "isDir": is_dir,
                "size": dir_size,
                "fileCount": dir_files,
                "modifiedMs": int(stat.st_mtime * 1000),
                "ext": ext,
                "isImage": (not is_dir) and (ext in IMAGE_EXTENSIONS),
            }
        )

    entries.sort(key=lambda e: (not e["isDir"], e["name"].lower()))

    rel_parts = (
        ()
        if target == resolved_root
        else target.relative_to(resolved_root).parts
    )
    breadcrumbs: list[Breadcrumb] = [{"name": "Raiz", "path": str(resolved_root)}]
    running = resolved_root
    for part in rel_parts:
        running = running / part
        breadcrumbs.append({"name": part, "path": str(running)})

    parent_path: str | None = (
        None if target == resolved_root else str(target.parent.resolve())
    )

    current_files, current_size = _compute_dir_stats(target, resolved_root)

    shortcuts: list[ShortcutEntry] = [
        {"id": "root", "name": "Raiz", "path": str(resolved_root)},
    ]
    for sub in DEFAULT_SUBDIRS:
        sub_path = (resolved_root / sub).resolve()
        shortcuts.append({"id": sub, "name": sub, "path": str(sub_path)})

    return {
        "root": str(resolved_root),
        "currentPath": str(target),
        "relativePath": _to_relative_posix(resolved_root, target),
        "parentPath": parent_path,
        "currentFileCount": current_files,
        "currentSize": current_size,
        "breadcrumbs": breadcrumbs,
        "shortcuts": shortcuts,
        "entries": entries,
    }


def save_uploaded_file(
    root: Path,
    target_dir: str | None,
    filename: str,
    content: bytes,
) -> FileEntry:
    resolved_root = ensure_sandbox_dirs(root)
    dest_dir = resolve_sandbox_path(
        resolved_root, target_dir if target_dir and target_dir.strip() else "inputs"
    )
    dest_dir.mkdir(parents=True, exist_ok=True)
    if not dest_dir.is_dir():
        raise ValueError("Destination path is not a directory.")

    safe_name = sanitize_filename(filename)
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix
    dest_path = dest_dir / safe_name

    counter = 1
    while dest_path.exists():
        dest_path = dest_dir / f"{stem}_{counter}{suffix}"
        counter += 1

    # Re-validate destination remains inside sandbox before writing
    resolved_dest = dest_path.resolve()
    if not resolved_dest.is_relative_to(resolved_root):
        raise PermissionError("Upload destination escapes the allowed web root.")

    resolved_dest.write_bytes(content)
    stat = resolved_dest.stat()
    ext = resolved_dest.suffix.lower()

    return {
        "name": resolved_dest.name,
        "path": str(resolved_dest),
        "relativePath": _to_relative_posix(resolved_root, resolved_dest),
        "isDir": False,
        "size": stat.st_size,
        "fileCount": 0,
        "modifiedMs": int(stat.st_mtime * 1000),
        "ext": ext,
        "isImage": ext in IMAGE_EXTENSIONS,
    }


def create_directory(
    root: Path,
    parent_dir: str | None,
    folder_name: str,
) -> FileEntry:
    resolved_root = ensure_sandbox_dirs(root)
    parent = resolve_sandbox_path(resolved_root, parent_dir)
    if not parent.exists() or not parent.is_dir():
        raise ValueError("Parent directory does not exist.")

    cleaned = sanitize_filename(folder_name)
    if not cleaned or "/" in folder_name or "\\" in folder_name or folder_name in {".", ".."}:
        raise ValueError("Invalid folder name.")

    new_dir = (parent / cleaned).resolve()
    if not new_dir.is_relative_to(resolved_root):
        raise PermissionError("Folder escapes the allowed web root.")

    new_dir.mkdir(parents=True, exist_ok=True)
    stat = new_dir.stat()

    return {
        "name": new_dir.name,
        "path": str(new_dir),
        "relativePath": _to_relative_posix(resolved_root, new_dir),
        "isDir": True,
        "size": 0,
        "fileCount": 0,
        "modifiedMs": int(stat.st_mtime * 1000),
        "ext": "",
        "isImage": False,
    }


def _is_protected_sandbox_dir(resolved_root: Path, target: Path) -> bool:
    if target == resolved_root:
        return True
    return any(target == (resolved_root / sub).resolve() for sub in DEFAULT_SUBDIRS)


def delete_entry(root: Path, raw_path: str) -> dict[str, str]:
    resolved_root = ensure_sandbox_dirs(root)
    target = resolve_sandbox_path(resolved_root, raw_path)
    if _is_protected_sandbox_dir(resolved_root, target):
        raise PermissionError("Cannot delete the sandbox root or default folders.")
    if not target.exists():
        raise FileNotFoundError("File or directory not found.")

    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()

    return {"deleted": str(target)}


def rename_entry(root: Path, raw_path: str, new_name: str) -> FileEntry:
    resolved_root = ensure_sandbox_dirs(root)
    target = resolve_sandbox_path(resolved_root, raw_path)
    if _is_protected_sandbox_dir(resolved_root, target):
        raise PermissionError("Cannot rename the sandbox root or default folders.")
    if not target.exists():
        raise FileNotFoundError("File or directory not found.")

    if (
        not new_name
        or not new_name.strip()
        or "/" in new_name
        or "\\" in new_name
        or new_name.strip() in {".", ".."}
    ):
        raise ValueError("Invalid target name.")

    cleaned = sanitize_filename(new_name)
    dest = (target.parent / cleaned).resolve()
    if not dest.is_relative_to(resolved_root):
        raise PermissionError("Target path escapes the allowed web root.")
    if dest.exists() and dest != target:
        raise FileExistsError(f"'{cleaned}' already exists in this folder.")

    target.rename(dest)
    stat = dest.stat()
    is_dir = dest.is_dir()
    ext = "" if is_dir else dest.suffix.lower()
    if is_dir:
        dir_files, dir_size = _compute_dir_stats(dest, resolved_root)
    else:
        dir_files, dir_size = 0, stat.st_size

    return {
        "name": dest.name,
        "path": str(dest),
        "relativePath": _to_relative_posix(resolved_root, dest),
        "isDir": is_dir,
        "size": dir_size,
        "fileCount": dir_files,
        "modifiedMs": int(stat.st_mtime * 1000),
        "ext": ext,
        "isImage": (not is_dir) and (ext in IMAGE_EXTENSIONS),
    }


def read_text_file(
    root: Path,
    raw_path: str,
    max_bytes: int = 25 * 1024 * 1024,
) -> dict[str, str]:
    resolved_root = ensure_sandbox_dirs(root)
    target = resolve_sandbox_path(resolved_root, raw_path)
    if not target.exists() or not target.is_file():
        raise FileNotFoundError("File not found.")
    if target.stat().st_size > max_bytes:
        raise ValueError("File exceeds maximum allowed text read size.")

    content = target.read_text(encoding="utf-8")
    return {
        "name": target.name,
        "path": str(target),
        "relativePath": _to_relative_posix(resolved_root, target),
        "content": content,
    }


def write_text_file(root: Path, target_path: str, content: str) -> FileEntry:
    resolved_root = ensure_sandbox_dirs(root)
    if not target_path or not target_path.strip():
        raise ValueError("Target path is required.")

    raw = Path(target_path.strip())
    if raw.is_absolute():
        parent = resolve_sandbox_path(resolved_root, str(raw.parent))
        safe_name = sanitize_filename(raw.name)
    else:
        rel_parent = str(raw.parent) if str(raw.parent) not in {"", "."} else "chains"
        parent = resolve_sandbox_path(resolved_root, rel_parent)
        safe_name = sanitize_filename(raw.name)

    parent.mkdir(parents=True, exist_ok=True)
    dest = (parent / safe_name).resolve()
    if not dest.is_relative_to(resolved_root):
        raise PermissionError("Target path escapes the allowed web root.")

    dest.write_text(content, encoding="utf-8")
    stat = dest.stat()
    ext = dest.suffix.lower()

    return {
        "name": dest.name,
        "path": str(dest),
        "relativePath": _to_relative_posix(resolved_root, dest),
        "isDir": False,
        "size": stat.st_size,
        "fileCount": 0,
        "modifiedMs": int(stat.st_mtime * 1000),
        "ext": ext,
        "isImage": ext in IMAGE_EXTENSIONS,
    }
