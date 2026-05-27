import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from detect_deploy_scope import (
    Scope,
    apply_service_drift_recovery,
    classify_paths,
    latest_successful_service_deploys,
    release_services,
)


class DeployScopeTests(unittest.TestCase):
    def test_classifies_web_only_change(self):
        scope = classify_paths(["apps/web/app/page.tsx"])

        self.assertEqual(release_services(scope), ["web"])
        self.assertTrue(scope.verify)
        self.assertFalse(scope.api)
        self.assertFalse(scope.mcp)

    def test_database_change_rebuilds_api_and_mcp(self):
        scope = classify_paths(["db/migrations/0002_add_table.sql"])

        self.assertEqual(release_services(scope), ["api", "mcp"])
        self.assertTrue(scope.database)

    def test_latest_successful_service_deploys_tracks_each_service_independently(self):
        runs = [
            {"head_sha": "web-new", "production_success": True, "services": {"web"}},
            {"head_sha": "api-old", "production_success": True, "services": {"api", "mcp"}},
            {"head_sha": "api-failed", "production_success": False, "services": {"api"}},
        ]

        latest = latest_successful_service_deploys(runs, lambda run: run["services"])

        self.assertEqual(
            latest,
            {
                "web": "web-new",
                "api": "api-old",
                "mcp": "api-old",
            },
        )

    def test_drift_recovery_adds_stale_api_to_web_only_deploy(self):
        scope = Scope(web=True, verify=True)
        desired = {
            "web": "web-desired",
            "api": "api-desired",
            "mcp": "mcp-desired",
        }
        latest_success = {
            "web": "web-success",
            "api": "api-old",
            "mcp": "mcp-success",
        }

        def ancestor_check(ancestor, descendant):
            return (ancestor, descendant) in {
                ("web-desired", "web-success"),
                ("mcp-desired", "mcp-success"),
            }

        apply_service_drift_recovery(scope, desired, latest_success, ancestor_check)

        self.assertEqual(release_services(scope), ["web", "api"])
        self.assertTrue(scope.database)
        self.assertTrue(scope.recovery_deploy)
        self.assertEqual(len(scope.recovery_reasons), 1)
        self.assertIn("api", scope.recovery_reasons[0])


if __name__ == "__main__":
    unittest.main()
