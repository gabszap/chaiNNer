"""Tests for sandboxed WebUI filesystem operations."""

from __future__ import annotations

from pathlib import Path

import pytest

from web_fs import (
    create_directory,
    delete_entry,
    ensure_sandbox_dirs,
    list_directory,
    read_text_file,
    rename_entry,
    resolve_sandbox_path,
    sanitize_filename,
    save_uploaded_file,
    write_text_file,
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


def test_rename_and_delete_entry_protects_defaults(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")
    saved = save_uploaded_file(root, "inputs", "old.png", b"IMG")

    renamed = rename_entry(root, saved["path"], "new.png")
    assert renamed["name"] == "new.png"
    assert Path(renamed["path"]).is_file()
    assert not Path(saved["path"]).exists()

    delete_entry(root, renamed["path"])
    assert not Path(renamed["path"]).exists()

    with pytest.raises(PermissionError):
        delete_entry(root, str(root / "inputs"))

    with pytest.raises(PermissionError):
        rename_entry(root, str(root / "outputs"), "renamed_outputs")


def test_write_and_read_text_chain_file(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")
    written = write_text_file(root, "chains/upscale.chn", '{"version":"0.26.1"}')
    assert written["name"] == "upscale.chn"
    assert written["relativePath"] == "chains/upscale.chn"

    loaded = read_text_file(root, written["path"])
    assert loaded["content"] == '{"version":"0.26.1"}'

    with pytest.raises(PermissionError):
        write_text_file(root, "../escape.chn", "{}")


def test_directory_file_count_and_total_size(tmp_path: Path):
    root = ensure_sandbox_dirs(tmp_path / "sandbox")
    save_uploaded_file(root, "inputs", "a.png", b"12345")
    save_uploaded_file(root, "inputs/sub", "b.png", b"1234567890")

    root_listing = list_directory(root, "")
    inputs_entry = next(e for e in root_listing["entries"] if e["name"] == "inputs")
    assert inputs_entry["isDir"] is True
    assert inputs_entry["fileCount"] == 2
    assert inputs_entry["size"] == 15

    inputs_shortcut = next(s for s in root_listing["shortcuts"] if s["id"] == "inputs")
    assert inputs_shortcut["fileCount"] == 2
    assert inputs_shortcut["size"] == 15

    root_shortcut = next(s for s in root_listing["shortcuts"] if s["id"] == "root")
    assert root_shortcut["fileCount"] == 2
    assert root_shortcut["size"] == 15
