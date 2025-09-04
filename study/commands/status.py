import json
from pathlib import Path
from collections import Counter


class StatusCommand:
    def __init__(self, config):
        self.config = config
        self.session_dir = Path(config['session_dir'])
        self.cards_dir = Path(config['cards_dir'])
        self.index_file = self.cards_dir / 'index.json'
    
    def execute(self, args):
        """Show quick statistics"""
        print("=== Tutor Me CLI Status ===\n")
        
        # Sessions stats
        session_files = list(self.session_dir.glob('*.jsonl'))
        session_count = len(session_files)
        last_session = max(session_files, key=lambda f: f.stem).stem if session_files else "None"
        
        print(f"Sessions: {session_count} files (last: {last_session})")
        
        # Cards stats
        candidates_dir = self.cards_dir / 'candidates'
        approved_dir = self.cards_dir / 'approved'
        
        candidate_files = list(candidates_dir.glob('*.cards.json')) if candidates_dir.exists() else []
        approved_files = list(approved_dir.glob('*.cards.json')) if approved_dir.exists() else []
        
        candidate_count = sum(self._count_cards_in_file(f) for f in candidate_files)
        approved_count = sum(self._count_cards_in_file(f) for f in approved_files)
        
        # Exported count from index
        exported_count = 0
        if self.index_file.exists():
            with open(self.index_file) as f:
                index = json.load(f)
                exported_count = sum(1 for entry in index.values() if entry.get('exported_at'))
        
        print(f"Cards: {candidate_count} candidates, {approved_count} approved, {exported_count} exported")
        
        # Topic breakdown
        print("\nBy Topic:")
        topics = self._get_topic_stats()
        for topic, count in topics.most_common(5):
            print(f"  {topic}: {count}")
        
        if not topics:
            print("  (No topics found)")
    
    def _count_cards_in_file(self, card_file):
        """Count cards in a JSON file"""
        try:
            with open(card_file) as f:
                cards = json.load(f)
                return len(cards) if isinstance(cards, list) else 0
        except:
            return 0
    
    def _get_topic_stats(self):
        """Get topic statistics from session files"""
        topics = []
        
        for session_file in self.session_dir.glob('*.jsonl'):
            try:
                with open(session_file) as f:
                    for line in f:
                        if not line.strip():
                            continue
                        try:
                            obj = json.loads(line)
                            if 'topic' in obj:
                                topics.append(obj['topic'])
                        except json.JSONDecodeError:
                            continue
            except:
                continue
        
        return Counter(topics)