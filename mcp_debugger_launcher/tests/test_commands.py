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


class TestBuildDockerCommand(unittest.TestCase):
    def setUp(self):
        self.launcher = DebugMCPLauncher()

    def test_stdio_has_no_port_plumbing(self):
        self.assertEqual(
            self.launcher.build_docker_command("stdio"),
            ["docker", "run", "-it", "--rm", DebugMCPLauncher.DOCKER_IMAGE, "stdio"],
        )

    def test_sse_defaults_port_and_pins_it_both_sides(self):
        default = DebugMCPLauncher.DEFAULT_SSE_PORT
        self.assertEqual(
            self.launcher.build_docker_command("sse"),
            [
                "docker", "run", "-it", "--rm",
                "-p", f"{default}:{default}",
                DebugMCPLauncher.DOCKER_IMAGE, "sse",
                "--port", str(default),
            ],
        )

    def test_sse_custom_port_keeps_mapping_and_flag_in_sync(self):
        cmd = self.launcher.build_docker_command("sse", 4711)
        self.assertIn("-p", cmd)
        self.assertIn("4711:4711", cmd)
        # The in-container server must listen on the same port the -p mapping
        # exposes (the drift that motivated issue #345's precursor fix).
        self.assertEqual(cmd[-2:], ["--port", "4711"])


if __name__ == "__main__":
    unittest.main()
