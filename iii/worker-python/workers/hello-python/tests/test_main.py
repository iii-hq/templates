"""Unit tests for hello-python — no engine or iii-sdk required."""
import unittest

from src.main import build_greeting


class TestBuildGreeting(unittest.TestCase):
    """Tests for the pure build_greeting helper."""

    def test_greet_world(self):
        result = build_greeting("World")
        self.assertEqual(result, {"message": "Hello, World!"})

    def test_greet_custom_name(self):
        result = build_greeting("Alice")
        self.assertEqual(result, {"message": "Hello, Alice!"})


if __name__ == "__main__":
    unittest.main()
