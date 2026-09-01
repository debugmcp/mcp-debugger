"""Unit tests for the launch-command builders (issue #345).

These builders are the single source of truth for both the real launch and
--dry-run output. Run standalone:

    python -m unittest mcp_debugger_launcher.tests.test_commands  # from repo root
    python -m unittest tests.test_commands                        # from mcp_debugger_launcher/
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mcp_debugger_launcher.launcher import DebugMCPLauncher  # noqa: E402


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


class TestBuildDockerCommand(unittest.TestCase):
    WORKSPACE = "/tmp/proj"

    def setUp(self):
        self.launcher = DebugMCPLauncher()

    def docker_prefix(self):
        # -i without -t (a TTY against piped stdio fails; -i/--rm is the
        # clean-exit pairing post-#633) plus the workspace mount that makes
        # the caller's files debuggable in the container (issue #641).
        return ["docker", "run", "-i", "--rm", "-v", f"{self.WORKSPACE}:/workspace"]

    def test_stdio_has_no_port_plumbing(self):
        self.assertEqual(
            self.launcher.build_docker_command("stdio", workspace_dir=self.WORKSPACE),
            self.docker_prefix() + [DebugMCPLauncher.DOCKER_IMAGE, "stdio"],
        )

    def test_workspace_defaults_to_cwd(self):
        cmd = self.launcher.build_docker_command("stdio")
        self.assertIn(f"{os.getcwd()}:/workspace", cmd)

    def test_sse_defaults_port_and_pins_it_both_sides(self):
        default = DebugMCPLauncher.DEFAULT_SSE_PORT
        self.assertEqual(
            self.launcher.build_docker_command("sse", workspace_dir=self.WORKSPACE),
            self.docker_prefix() + [
                "-p", f"{default}:{default}",
                DebugMCPLauncher.DOCKER_IMAGE, "sse",
                "--port", str(default),
            ],
        )

    def test_http_defaults_port_and_pins_it_both_sides(self):
        default = DebugMCPLauncher.DEFAULT_SSE_PORT
        self.assertEqual(
            self.launcher.build_docker_command("http", workspace_dir=self.WORKSPACE),
            self.docker_prefix() + [
                "-p", f"{default}:{default}",
                DebugMCPLauncher.DOCKER_IMAGE, "http",
                "--port", str(default),
            ],
        )

    def test_sse_custom_port_keeps_mapping_and_flag_in_sync(self):
        cmd = self.launcher.build_docker_command("sse", 4711, workspace_dir=self.WORKSPACE)
        self.assertIn("-p", cmd)
        self.assertIn("4711:4711", cmd)
        # The in-container server must listen on the same port the -p mapping
        # exposes (the drift that motivated issue #345's precursor fix).
        self.assertEqual(cmd[-2:], ["--port", "4711"])


if __name__ == "__main__":
    unittest.main()
