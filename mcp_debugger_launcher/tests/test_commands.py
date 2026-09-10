"""Unit tests for the launch-command builders (issue #345) and the CLI's
pass-through of server flags (issue #676).

These builders are the single source of truth for both the real launch and
--dry-run output. Run standalone:

    python -m unittest mcp_debugger_launcher.tests.test_commands  # from repo root
    python -m unittest tests.test_commands                        # from mcp_debugger_launcher/
"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mcp_debugger_launcher.launcher import DebugMCPLauncher  # noqa: E402

try:  # click is a runtime dependency of the package, not of these builder tests
    import click  # noqa: F401
    from click.testing import CliRunner
    HAVE_CLICK = True
except ImportError:  # pragma: no cover - CI runs the builders without installing the package
    HAVE_CLICK = False


class TestBuildNpxCommand(unittest.TestCase):
    def setUp(self):
        self.launcher = DebugMCPLauncher()

    def test_stdio(self):
        self.assertEqual(
            self.launcher.build_npx_command("stdio"),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "stdio"],
        )

    def test_sse_without_port_omits_port_flag(self):
        # Deliberate asymmetry with Docker: the npx-run server applies its own
        # default port, so no --port is forwarded unless the caller gave one.
        self.assertEqual(
            self.launcher.build_npx_command("sse"),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "sse"],
        )

    def test_sse_with_port(self):
        self.assertEqual(
            self.launcher.build_npx_command("sse", 8080),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "sse", "--port", "8080"],
        )

    def test_http_with_port(self):
        self.assertEqual(
            self.launcher.build_npx_command("http", 8080),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "http", "--port", "8080"],
        )

    def test_http_without_port_omits_port_flag(self):
        self.assertEqual(
            self.launcher.build_npx_command("http"),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "http"],
        )

    def test_extra_args_follow_mode_and_port(self):
        # Server flags the launcher does not know are forwarded verbatim,
        # after everything the launcher composes itself (issue #676).
        self.assertEqual(
            self.launcher.build_npx_command("http", 8080, extra_args=("--allowed-host", "mcp-debugger")),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "http", "--port", "8080", "--allowed-host", "mcp-debugger"],
        )

    def test_extra_args_forwarded_for_stdio_too(self):
        self.assertEqual(
            self.launcher.build_npx_command("stdio", extra_args=("--log-level", "debug")),
            ["npx", DebugMCPLauncher.NPM_PACKAGE, "stdio", "--log-level", "debug"],
        )


class TestBuildDockerCommand(unittest.TestCase):
    WORKSPACE = "/tmp/proj"

    def setUp(self):
        self.launcher = DebugMCPLauncher()

    def docker_prefix(self):
        # -i without -t (a TTY against piped stdio fails; -i/--rm is the
        # clean-exit pairing post-#633) plus the workspace mount that makes
        # the caller's files debuggable in the container (issue #641).
        return ["docker", "run", "-i", "--rm", "-v", f"{self.WORKSPACE}:/workspace"]

    def build(self, mode, port=None, **kwargs):
        # The builder reads the launcher's environment for MCP_HTTP_ALLOWED_HOSTS;
        # tests pass an explicit mapping so the host's shell never leaks in.
        kwargs.setdefault("env", {})
        return self.launcher.build_docker_command(mode, port, workspace_dir=self.WORKSPACE, **kwargs)

    def test_stdio_has_no_port_plumbing(self):
        self.assertEqual(
            self.build("stdio"),
            self.docker_prefix() + [DebugMCPLauncher.DOCKER_IMAGE, "stdio"],
        )

    def test_workspace_defaults_to_cwd(self):
        cmd = self.launcher.build_docker_command("stdio", env={})
        self.assertIn(f"{os.getcwd()}:/workspace", cmd)

    def test_sse_defaults_port_and_publishes_it_on_loopback(self):
        default = DebugMCPLauncher.DEFAULT_SSE_PORT
        self.assertEqual(
            self.build("sse"),
            self.docker_prefix() + [
                "-p", f"127.0.0.1:{default}:{default}",
                DebugMCPLauncher.DOCKER_IMAGE, "sse",
                "--port", str(default),
            ],
        )

    def test_http_defaults_port_and_publishes_it_on_loopback(self):
        # Loopback by default (issue #676): the server's Host allowlist stops
        # browsers, not a direct client that forges Host: localhost, so
        # publishing on every interface was real exposure.
        default = DebugMCPLauncher.DEFAULT_SSE_PORT
        self.assertEqual(
            self.build("http"),
            self.docker_prefix() + [
                "-p", f"127.0.0.1:{default}:{default}",
                DebugMCPLauncher.DOCKER_IMAGE, "http",
                "--port", str(default),
            ],
        )

    def test_sse_custom_port_keeps_mapping_and_flag_in_sync(self):
        cmd = self.build("sse", 4711)
        self.assertIn("-p", cmd)
        self.assertIn("127.0.0.1:4711:4711", cmd)
        # The in-container server must listen on the same port the -p mapping
        # exposes (the drift that motivated issue #345's precursor fix).
        self.assertEqual(cmd[-2:], ["--port", "4711"])

    def test_bind_chooses_the_publish_address(self):
        cmd = self.build("http", 3001, bind="0.0.0.0")
        self.assertIn("0.0.0.0:3001:3001", cmd)
        self.assertNotIn("127.0.0.1:3001:3001", cmd)

    def test_forwards_allowed_hosts_env_into_the_container(self):
        # The npx child inherits the environment; the container does not
        # (issue #676). The variable travels as an explicit -e so --dry-run
        # shows exactly what the server will see.
        cmd = self.build("http", env={"MCP_HTTP_ALLOWED_HOSTS": "mcp-debugger, api.internal"})
        image_at = cmd.index(DebugMCPLauncher.DOCKER_IMAGE)
        self.assertIn("-e", cmd[:image_at])
        self.assertEqual(cmd[cmd.index("-e") + 1], "MCP_HTTP_ALLOWED_HOSTS=mcp-debugger, api.internal")

    def test_no_env_forwarding_when_variable_unset(self):
        cmd = self.build("http", env={"OTHER": "x"})
        self.assertNotIn("-e", cmd)

    def test_extra_args_follow_mode_and_port(self):
        cmd = self.build("http", 3001, extra_args=("--allowed-host", "mcp-debugger"))
        self.assertEqual(cmd[-4:], ["--port", "3001", "--allowed-host", "mcp-debugger"])

    def test_stdio_ignores_bind_and_env(self):
        cmd = self.build("stdio", bind="0.0.0.0", env={"MCP_HTTP_ALLOWED_HOSTS": "x"})
        self.assertNotIn("-p", cmd)
        self.assertNotIn("-e", cmd)


@unittest.skipUnless(HAVE_CLICK, "click is not installed; CLI pass-through covered by the builder tests")
class TestCliPassThrough(unittest.TestCase):
    """The CLI forwards unrecognised flags after the mode to the server (issue #676)."""

    NODE_ONLY = {
        "nodejs": {"available": True, "version": "v22", "npx_available": True, "package_accessible": True},
        "docker": {"available": False, "version": None, "image_exists": False},
    }
    DOCKER_ONLY = {
        "nodejs": {"available": False, "version": None, "npx_available": False, "package_accessible": False},
        "docker": {"available": True, "version": "27.0", "image_exists": True},
    }

    def invoke(self, args, runtimes):
        from mcp_debugger_launcher import cli
        with mock.patch.object(cli.RuntimeDetector, "detect_available_runtimes", return_value=runtimes):
            return CliRunner().invoke(cli.main, args)

    def test_unknown_flags_after_mode_reach_the_npx_command(self):
        result = self.invoke(["http", "--npm", "--dry-run", "--allowed-host", "mcp-debugger"], self.NODE_ONLY)
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("--allowed-host mcp-debugger", result.output)
        self.assertTrue(result.output.rstrip().endswith("--allowed-host mcp-debugger"), result.output)

    def test_bind_controls_docker_publishing(self):
        result = self.invoke(["http", "--docker", "--dry-run", "--bind", "0.0.0.0", "--allowed-host", "myhost"], self.DOCKER_ONLY)
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("0.0.0.0:3001:3001", result.output)
        self.assertIn("--allowed-host myhost", result.output)

    def test_docker_forwards_allowed_hosts_env(self):
        with mock.patch.dict(os.environ, {"MCP_HTTP_ALLOWED_HOSTS": "svc.internal"}):
            result = self.invoke(["http", "--docker", "--dry-run"], self.DOCKER_ONLY)
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("MCP_HTTP_ALLOWED_HOSTS=svc.internal", result.output)
        self.assertIn("127.0.0.1:3001:3001", result.output)

    def test_docker_dry_run_does_not_need_the_daemon(self):
        # Printing the command is exactly what one wants before starting
        # Docker Desktop; only a real launch needs the daemon.
        daemon_down = {
            "nodejs": self.DOCKER_ONLY["nodejs"],
            "docker": {"available": True, "version": "Docker installed but daemon not running", "image_exists": False},
        }
        result = self.invoke(["http", "--docker", "--dry-run"], daemon_down)
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("docker run", result.output)

    def test_docker_launch_still_needs_the_daemon(self):
        daemon_down = {
            "nodejs": self.DOCKER_ONLY["nodejs"],
            "docker": {"available": True, "version": "Docker installed but daemon not running", "image_exists": False},
        }
        result = self.invoke(["http", "--docker"], daemon_down)
        self.assertEqual(result.exit_code, 1)
        self.assertIn("daemon is not running", result.output)


if __name__ == "__main__":
    unittest.main()
