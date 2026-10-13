import importlib.util
import os
import random
import tempfile
import unittest

import app as glosor
import quiz

HAS_TK = importlib.util.find_spec("tkinter") is not None


class QuizTests(unittest.TestCase):
    def test_is_correct(self):
        self.assertTrue(quiz.is_correct("  Strawberry   JAM ", "strawberry jam"))
        self.assertTrue(quiz.is_correct("film", "film/movie"))
        self.assertFalse(quiz.is_correct("", "dog"))
        self.assertFalse(quiz.is_correct("cat", "dog"))

    def test_combine_skips_duplicates(self):
        words = quiz.combine([
            {"id": "a", "words": [{"sv": "hund", "en": "dog"}]},
            {"id": "b", "words": [{"sv": "hund", "en": "dog"}, {"sv": "katt", "en": "cat"}]},
        ])
        self.assertEqual([(w["sv"], w["list_id"]) for w in words], [("hund", "a"), ("katt", "b")])

    def test_session_flow(self):
        words = [{"sv": "hund", "en": "dog"}, {"sv": "katt", "en": "cat"}]
        s = quiz.Session(words, "sv-en", rng=random.Random(1))
        first = s.current.word
        self.assertEqual(s.check("wrong"), (False, True))
        self.assertIsNot(s.current.word, first)  # missed word moved back
        self.assertEqual(s.check(s.answer_of(s.current.word)), (True, True))
        self.assertIs(s.current.word, first)
        self.assertEqual(s.check(s.answer_of(first)), (True, False))  # retry doesn't count
        self.assertIsNone(s.current)
        self.assertEqual((s.mastered, s.hits, s.missed), (2, 1, [first]))

    def test_reveal_counts_as_miss(self):
        s = quiz.Session([{"sv": "hund", "en": "dog"}], "en-sv")
        self.assertEqual(s.question(s.current.word), "dog")
        self.assertTrue(s.reveal())
        self.assertEqual(s.check("hund"), (True, False))
        self.assertEqual(s.hits, 0)


@unittest.skipUnless(HAS_TK, "tkinter not installed")
class DesktopDataTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_file = glosor.DATA_FILE
        glosor.DATA_FILE = os.path.join(self.tmp.name, "lists.json")

    def tearDown(self):
        glosor.DATA_FILE = self.old_file
        self.tmp.cleanup()

    def test_save_record_delete(self):
        import glosor_tk
        lst = glosor_tk.save_list(None, "Test", [{"sv": "bil", "en": "car"}, {"sv": "", "en": "x"}])
        self.assertEqual(len(lst["words"]), 1)
        glosor_tk.record_result({**lst["words"][0], "list_id": lst["id"]}, True)
        lst = glosor_tk.save_list(lst["id"], "Nytt", [{"sv": "bil", "en": "car"}])
        self.assertEqual(lst["words"][0]["correct"], 1)
        glosor_tk.delete_list(lst["id"])
        self.assertEqual(len(glosor_tk.load_lists()), 1)  # only the example list left


if __name__ == "__main__":
    unittest.main()
