import json
import sys
import re
from datetime import datetime
from pathlib import Path


class CaptureSessionCommand:
    def __init__(self, config):
        self.config = config
        self.session_dir = Path(config['session_dir'])
        self.session_dir.mkdir(parents=True, exist_ok=True)
    
    def execute(self, args):
        """Capture a study session from file or STDIN"""
        # Read input
        if args.input_file:
            with open(args.input_file, 'r') as f:
                content = f.read().strip()
        else:
            content = sys.stdin.read().strip()
        
        if not content:
            raise ValueError("No content provided")
        
        # Split into Q&A turns if possible
        turns = self._parse_transcript(content)
        
        # Create session objects
        today = datetime.now().strftime('%Y-%m-%d')
        session_file = self.session_dir / f"{today}.jsonl"
        
        tags = [tag.strip() for tag in args.tags.split(',')] if args.tags else []
        
        session_objects = []
        for i, turn in enumerate(turns):
            session_obj = {
                "id": f"{today}_{len(session_objects) + 1}",
                "timestamp": datetime.now().isoformat(),
                "topic": args.topic,
                "source": args.source,
                "tags": tags,
                "notes": args.notes or "",
                "turn_number": i + 1,
                **turn
            }
            session_objects.append(session_obj)
        
        # Append to JSONL file
        with open(session_file, 'a') as f:
            for obj in session_objects:
                f.write(json.dumps(obj) + '\n')
        
        print(f"Appended {len(session_objects)} turns to {session_file}")
    
    def _parse_transcript(self, content):
        """Parse transcript into Q&A turns"""
        # Try to detect Q&A pattern
        lines = content.split('\n')
        turns = []
        current_turn = None
        
        # Look for common patterns like "Q:", "User:", "Human:", etc.
        question_patterns = [
            r'^(Q|Question|User|Human|Student):\s*(.+)',
            r'^(.+\?)\s*$'
        ]
        answer_patterns = [
            r'^(A|Answer|Assistant|Tutor|Teacher):\s*(.+)',
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if it's a question
            is_question = False
            for pattern in question_patterns:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    if current_turn:
                        turns.append(current_turn)
                    # Use the last group that was captured
                    groups = match.groups()
                    prompt_text = groups[-1].strip() if groups else line.strip()
                    current_turn = {
                        "prompt": prompt_text,
                        "assistant_reply": ""
                    }
                    is_question = True
                    break
            
            if is_question:
                continue
            
            # Check if it's an answer
            is_answer = False
            for pattern in answer_patterns:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    if current_turn:
                        groups = match.groups()
                        reply_text = groups[-1].strip() if groups else line.strip()
                        current_turn["assistant_reply"] = reply_text
                    is_answer = True
                    break
            
            if is_answer:
                continue
            
            # Otherwise, append to current context
            if current_turn:
                if current_turn["assistant_reply"]:
                    current_turn["assistant_reply"] += " " + line
                else:
                    current_turn["prompt"] += " " + line
            else:
                # No clear pattern detected, treat as single turn
                current_turn = {
                    "prompt": line,
                    "assistant_reply": ""
                }
        
        if current_turn:
            turns.append(current_turn)
        
        # If no turns were parsed, treat entire content as one turn
        if not turns:
            turns = [{
                "prompt": content,
                "assistant_reply": ""
            }]
        
        return turns