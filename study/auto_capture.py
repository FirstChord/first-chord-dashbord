#!/usr/bin/env python3
"""
Auto-capture system for TutorMe sessions
"""

import time
import pyperclip
import requests
import json
import re
from datetime import datetime
from pathlib import Path

class AutoCapture:
    def __init__(self, dashboard_url="http://127.0.0.1:8080"):
        self.dashboard_url = dashboard_url
        self.last_clipboard = ""
        self.session_dir = Path("data/sessions")
        self.session_dir.mkdir(parents=True, exist_ok=True)
        
    def is_tutorme_conversation(self, text):
        """Detect if clipboard contains a TutorMe conversation"""
        if len(text.strip()) < 50:  # Too short
            return False
            
        # Look for conversation patterns
        patterns = [
            r'(user|student|me):\s*.*?\n.*(tutor|teacher|assistant|ai):\s*',
            r'(q|question):\s*.*?\n.*(a|answer):\s*',
            r'^\s*(what|how|why|can you|explain)\s+.*\?.*\n.*[.!]',
        ]
        
        text_lower = text.lower()
        for pattern in patterns:
            if re.search(pattern, text_lower, re.MULTILINE | re.DOTALL):
                return True
                
        # Check for common tutoring keywords
        tutor_keywords = ['explain', 'solve', 'formula', 'equation', 'theorem', 'proof']
        if any(keyword in text_lower for keyword in tutor_keywords):
            # And has Q&A structure
            if text.count('\n') >= 4 and ('?' in text or ':' in text):
                return True
                
        return False
    
    def extract_topic_from_text(self, text):
        """Try to auto-detect topic from conversation content"""
        text_lower = text.lower()
        
        # Math topics
        math_topics = {
            'algebra': ['equation', 'variable', 'solve', 'quadratic', 'linear'],
            'calculus': ['derivative', 'integral', 'limit', 'differential'],
            'geometry': ['triangle', 'circle', 'angle', 'area', 'volume'],
            'statistics': ['mean', 'median', 'probability', 'distribution']
        }
        
        for topic, keywords in math_topics.items():
            if any(keyword in text_lower for keyword in keywords):
                return f"math.{topic}"
        
        # Science topics
        if any(word in text_lower for word in ['physics', 'force', 'energy', 'mass']):
            return "science.physics"
        if any(word in text_lower for word in ['chemistry', 'reaction', 'molecule']):
            return "science.chemistry"
        
        return "general.tutoring"
    
    def auto_capture_session(self, text, topic=None):
        """Automatically capture a detected TutorMe session"""
        if not topic:
            topic = self.extract_topic_from_text(text)
        
        # Create session data
        today = datetime.now().strftime('%Y-%m-%d')
        session_file = self.session_dir / f"{today}.jsonl"
        
        # Parse the text into turns (simple version)
        turns = self._parse_simple_transcript(text)
        
        # Create session objects
        session_objects = []
        for i, turn in enumerate(turns):
            session_obj = {
                "id": f"{today}_auto_{len(session_objects) + 1}",
                "timestamp": datetime.now().isoformat(),
                "topic": topic,
                "source": "TutorMe_AutoCapture",
                "tags": ["auto-captured", topic.split('.')[0]],
                "notes": "Auto-captured from clipboard",
                "turn_number": i + 1,
                **turn
            }
            session_objects.append(session_obj)
        
        # Append to JSONL
        with open(session_file, 'a') as f:
            for obj in session_objects:
                f.write(json.dumps(obj) + '\n')
        
        return len(session_objects), session_file
    
    def _parse_simple_transcript(self, text):
        """Simple transcript parsing for auto-capture"""
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        turns = []
        current_turn = None
        
        for line in lines:
            # Check if it looks like a new question/prompt
            if (line.endswith('?') or 
                re.match(r'^(user|student|me|q|question):', line.lower()) or
                re.match(r'^(what|how|why|can you|explain)', line.lower())):
                
                if current_turn:
                    turns.append(current_turn)
                current_turn = {"prompt": line, "assistant_reply": ""}
            
            # Check if it looks like an answer
            elif (re.match(r'^(tutor|teacher|assistant|ai|a|answer):', line.lower()) or
                  (current_turn and len(line) > 20)):
                
                if current_turn:
                    if current_turn["assistant_reply"]:
                        current_turn["assistant_reply"] += " " + line
                    else:
                        current_turn["assistant_reply"] = line
                else:
                    # No current turn, treat as standalone
                    current_turn = {"prompt": "General question", "assistant_reply": line}
        
        if current_turn:
            turns.append(current_turn)
        
        # If no turns were parsed, treat entire text as one turn
        if not turns:
            turns = [{"prompt": text[:200] + "..." if len(text) > 200 else text, "assistant_reply": ""}]
        
        return turns
    
    def monitor_clipboard(self):
        """Monitor clipboard for TutorMe conversations"""
        print("🎯 Auto-Capture Monitor Started")
        print("Copy TutorMe conversations and they'll be auto-captured!")
        print("Press Ctrl+C to stop monitoring\n")
        
        try:
            while True:
                try:
                    current_clipboard = pyperclip.paste()
                    
                    # Check if clipboard changed and contains potential conversation
                    if (current_clipboard != self.last_clipboard and 
                        current_clipboard.strip() and
                        self.is_tutorme_conversation(current_clipboard)):
                        
                        print(f"🔍 Detected TutorMe conversation! ({len(current_clipboard)} chars)")
                        
                        # Auto-capture
                        turns_count, session_file = self.auto_capture_session(current_clipboard)
                        
                        print(f"✅ Auto-captured {turns_count} turns to {session_file}")
                        print(f"💡 Topic detected: {self.extract_topic_from_text(current_clipboard)}")
                        print("   Ready for AI card extraction!\n")
                        
                        # Update dashboard via API
                        try:
                            response = requests.get(f"{self.dashboard_url}/api/status", timeout=2)
                            if response.status_code == 200:
                                print("📊 Dashboard updated automatically\n")
                        except:
                            pass  # Dashboard might not be running
                    
                    self.last_clipboard = current_clipboard
                    
                except Exception as e:
                    print(f"⚠️  Clipboard error: {e}")
                
                time.sleep(1)  # Check every second
                
        except KeyboardInterrupt:
            print("\n👋 Auto-capture stopped")

def main():
    """Run the auto-capture monitor"""
    monitor = AutoCapture()
    monitor.monitor_clipboard()

if __name__ == "__main__":
    main()