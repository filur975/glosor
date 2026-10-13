import json
import os
import tempfile
import unittest

import app as glosor


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        glosor.DATA_FILE = os.path.join(self.tmp.name, "lists.json")
        self.client = glosor.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_example_list_created(self):
        lists = self.client.get("/api/lists").get_json()
        self.assertEqual(len(lists), 1)

    def test_crud_and_counters(self):
        r = self.client.post("/api/lists", json={"name": "Test", "words": [
            {"sv": "bil", "en": "car"}, {"sv": "", "en": "x"}]})
        self.assertEqual(r.status_code, 201)
        lst = r.get_json()
        self.assertEqual(len(lst["words"]), 1)  # empty row dropped
        r = self.client.post(f"/api/lists/{lst['id']}/result",
                             json={"sv": "bil", "en": "car", "correct": True})
        self.assertEqual(r.get_json()["correct"], 1)
        r = self.client.put(f"/api/lists/{lst['id']}", json={"name": "Nytt", "words": [
            {"sv": "bil", "en": "car"}, {"sv": "hus", "en": "house"}]})
        words = r.get_json()["words"]
        self.assertEqual(words[0]["correct"], 1)  # counters kept
        self.assertEqual(self.client.delete(f"/api/lists/{lst['id']}").status_code, 204)
        self.assertEqual(self.client.get("/api/lists/nope/result").status_code, 405)

    def test_validation(self):
        self.assertEqual(self.client.post("/api/lists", json={"name": " "}).status_code, 400)
        self.assertEqual(self.client.put("/api/lists/zzz", json={"name": "a"}).status_code, 404)

    def test_corrupt_file_backed_up(self):
        with open(glosor.DATA_FILE, "w") as f:
            f.write("{not json")
        self.assertEqual(len(self.client.get("/api/lists").get_json()), 1)
        self.assertTrue(os.path.exists(glosor.DATA_FILE + ".bak"))


if __name__ == "__main__":
    unittest.main()
