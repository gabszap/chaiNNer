"""Tests for sandboxed WebUI filesystem operations."""

from __future__ import annotations

from pathlib import Path

import pytest

from web_fs import (
    create_directory,
    ensure_sandbox_dirs,
    list_directory,
    resolve_sandbox_path,
    sanitize_filename,
    save_uploaded_file,
)


def test_ensure_sandbox_dirs_creates_defaults(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")
    for sub in ("inputs", "outputs", "models", "chains"):
        assert (root / sub).is_dir()


def test_resolve_sandbox_path_blocks_traversal(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")
    outside = tmp_path / "secret.txt"
    outside.write_text("secret", encoding="utf-8")

    with pytest.raises(PermissionError):
        resolve_sandbox_path(root, "../secret.txt")

    with pytest.raises(PermissionError):
        resolve_sandbox_path(root, str(outside))


def test_upload_list_and_extension_filtering(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")

    saved1 = save_uploaded_file(root, "inputs", "photo.png", b"PNGDATA")
    saved2 = save_uploaded_file(root, "inputs", "photo.png", b"PNGDATA2")
    save_uploaded_file(root, "inputs", "notes.txt", b"hello")

    assert saved1["name"] == "photo.png"
    assert saved2["name"] == "photo_1.png"
    assert saved1["isImage"] is True

    listing_all = list_directory(root, "inputs")
    names_all = [e["name"] for e in listing_all["entries"]]
    assert names_all == ["notes.txt", "photo.png", "photo_1.png"]

    listing_png = list_directory(root, "inputs", extensions=["png"])
    names_png = [e["name"] for e in listing_png["entries"]]
    assert names_png == ["photo.png", "photo_1.png"]


def test_create_directory_and_sanitize(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")
    folder = create_directory(root, "outputs", "run-01")
    assert folder["isDir"] is True
    assert Path(folder["path"]).is_dir()

    assert sanitize_filename("../../evil:name?.png") == "evil_name_.png"

    with pytest.raises(ValueError):
        create_directory(root, "outputs", "../escape")
