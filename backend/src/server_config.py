from __future__ import annotations

import argparse
from dataclasses import dataclass


@dataclass
class ServerConfig:
    port: int
    """Port to run the server on."""

    close_after_start: bool
    """
    Whether to close the server after starting it.

    This is useful for testing the server.

    Usage: `--close-after-start`
    """

    install_builtin_packages: bool
    """
    Whether to install all built-in packages.

    Usage: `--install-builtin-packages`
    """

    error_on_failed_node: bool
    """
    Errors and exits the server with a non-zero exit code if a node fails to import.

    Usage: `--error-on-failed-node`
    """

    storage_dir: str | None
    """
    Directory to store for nodes to store files in.

    Usage: `--storage-dir /foo/bar`
    """

    logs_dir: str | None
    """
    Directory to store log files in.

    Usage: `--logs-dir /foo/bar`
    """

    trace: bool
    """
    Whether to enable tracing using VizTracer.

    Usage: `--trace`
    """

    dev_mode: bool
    """
    Whether to run in development mode.

    Usage: `--dev`
    """

    web_root: str | None = None
    """
    Root sandbox directory for WebUI file browsing, uploads, and downloads.

    Usage: `--web-root /data/chainner`
    """

    host: str = "127.0.0.1"
    """
    Host interface to bind the HTTP server to.

    Usage: `--host 127.0.0.1`
    """

    web_mode: bool = False
    """
    Enable hardened WebUI server mode (disables /shutdown and package install/uninstall
    unless --allow-package-manage is set, and disables wildcard CORS).

    Usage: `--web-mode`
    """

    allow_package_manage: bool = False
    """
    Allow /packages/install and /packages/uninstall endpoints when running in --web-mode.

    Usage: `--allow-package-manage`
    """

    cors_origins: tuple[str, ...] = ()
    """
    Explicit allowed CORS origins (comma-separated or repeated --cors-origin flags).

    Usage: `--cors-origin https://chainner.example.com`
    """

    @staticmethod
    def parse_argv() -> ServerConfig:
        parser = argparse.ArgumentParser(description="ChaiNNer's server.")
        parser.add_argument(
            "port",
            type=int,
            nargs="?",
            default=8000,
            help="Port to run the server on.",
        )
        parser.add_argument(
            "--close-after-start",
            action="store_true",
            help="Close the server after starting Useful for CI.",
        )
        parser.add_argument(
            "--install-builtin-packages",
            action="store_true",
            help="Install all built-in packages.",
        )
        parser.add_argument(
            "--error-on-failed-node",
            action="store_true",
            help="Errors and exits the server with a non-zero exit code if a node fails to import.",
        )
        parser.add_argument(
            "--storage-dir",
            type=str,
            help="Directory to store for nodes to store files in.",
        )
        parser.add_argument(
            "--logs-dir",
            type=str,
            help="Directory to store log files in.",
        )
        parser.add_argument(
            "--trace",
            action="store_true",
            help="Enable tracing using VizTracer.",
        )
        parser.add_argument(
            "--dev",
            action="store_true",
            help="Run in development mode.",
        )
        parser.add_argument(
            "--web-root",
            type=str,
            help="Root sandbox directory for WebUI file browsing, uploads, and downloads.",
        )
        parser.add_argument(
            "--host",
            type=str,
            default="127.0.0.1",
            help="Host interface to bind the server to (default: 127.0.0.1).",
        )
        parser.add_argument(
            "--web-mode",
            action="store_true",
            help="Enable hardened WebUI server mode (restricts CORS and admin endpoints).",
        )
        parser.add_argument(
            "--allow-package-manage",
            action="store_true",
            help="Allow package install/uninstall endpoints in --web-mode.",
        )
        parser.add_argument(
            "--cors-origin",
            action="append",
            default=[],
            help="Allowed CORS origin (can be repeated or comma-separated).",
        )

        parsed = parser.parse_args()

        cors_origins: list[str] = []
        for raw_origin in parsed.cors_origin:
            for item in raw_origin.split(","):
                cleaned = item.strip().rstrip("/")
                if cleaned:
                    cors_origins.append(cleaned)

        return ServerConfig(
            port=parsed.port,
            close_after_start=parsed.close_after_start,
            install_builtin_packages=parsed.install_builtin_packages,
            error_on_failed_node=parsed.error_on_failed_node,
            storage_dir=parsed.storage_dir or None,
            logs_dir=parsed.logs_dir or None,
            trace=parsed.trace,
            dev_mode=parsed.dev,
            web_root=parsed.web_root or None,
            host=parsed.host or "127.0.0.1",
            web_mode=parsed.web_mode,
            allow_package_manage=parsed.allow_package_manage,
            cors_origins=tuple(cors_origins),
        )
