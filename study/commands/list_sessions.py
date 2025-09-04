import json
from datetime import datetime
from pathlib import Path
from collections import Counter


class ListSessionsCommand:
    def __init__(self, config):
        self.config = config
        self.session_dir = Path(config['session_dir'])
    
    def execute(self, args):
        """List recent session files with metadata"""
        session_files = sorted(self.session_dir.glob('*.jsonl'), reverse=True)
        
        if not session_files:
            print("No session files found.")
            return
        
        print(f"{'Date':<12} {'Lines':<6} {'Topics (top 3)':<30} {'Tags (top 3)':<30}")
        print("-" * 80)
        
        for i, session_file in enumerate(session_files[:args.limit]):
            if not session_file.is_file():
                continue
                
            try:
                lines = self._count_lines(session_file)
                topics, tags = self._extract_metadata(session_file)
                
                date_str = session_file.stem
                top_topics = ', '.join(topics[:3])
                top_tags = ', '.join(tags[:3])
                
                print(f"{date_str:<12} {lines:<6} {top_topics:<30} {top_tags:<30}")
                
            except Exception as e:
                print(f"{session_file.stem:<12} ERROR  {str(e):<60}")
    
    def _count_lines(self, session_file):
        """Count lines in JSONL file"""
        with open(session_file) as f:
            return sum(1 for line in f if line.strip())
    
    def _extract_metadata(self, session_file):
        """Extract topics and tags from session file"""
        topics = []
        all_tags = []
        
        with open(session_file) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                    if 'topic' in obj:
                        topics.append(obj['topic'])
                    if 'tags' in obj and isinstance(obj['tags'], list):
                        all_tags.extend(obj['tags'])
                except json.JSONDecodeError:
                    continue
        
        # Get top topics and tags
        topic_counts = Counter(topics)
        tag_counts = Counter(all_tags)
        
        return ([t for t, _ in topic_counts.most_common(3)], 
                [t for t, _ in tag_counts.most_common(3)])