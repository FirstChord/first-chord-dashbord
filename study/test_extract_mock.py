#!/usr/bin/env python3
"""
Test script to create mock extracted cards for testing the lint and export functionality
"""

import json
from datetime import datetime
from pathlib import Path

# Create mock extracted cards
mock_cards = [
    {
        "id": "card_20250904_001",
        "type": "basic",
        "front": "What is the quadratic formula?",
        "back": "x = (-b ± √(b² - 4ac)) / (2a), used to solve quadratic equations of the form ax² + bx + c = 0",
        "tags": ["algebra", "quadratic", "formula"],
        "deck": "Masters::Math::Algebra",
        "source": "TutorMe",
        "created_at": datetime.now().isoformat(),
        "difficulty": "med",
        "extra": "Remember: a, b, c are coefficients"
    },
    {
        "id": "card_20250904_002", 
        "type": "cloze",
        "cloze_text": "The discriminant {{c1::b² - 4ac}} tells us about the nature of solutions in a quadratic equation.",
        "tags": ["algebra", "discriminant", "quadratic"],
        "deck": "Masters::Math::Algebra",
        "source": "TutorMe", 
        "created_at": datetime.now().isoformat(),
        "difficulty": "med",
        "extra": "If > 0: two real solutions, = 0: one solution, < 0: no real solutions"
    },
    {
        "id": "card_20250904_003",
        "type": "reverse",
        "front": "What does a discriminant > 0 indicate?",
        "back": "Two distinct real solutions",
        "tags": ["algebra", "discriminant"],
        "deck": "Masters::Math::Algebra", 
        "source": "TutorMe",
        "created_at": datetime.now().isoformat(),
        "difficulty": "easy",
        "extra": ""
    }
]

# Ensure candidates directory exists
candidates_dir = Path("data/cards/candidates")
candidates_dir.mkdir(parents=True, exist_ok=True)

# Save mock cards
output_file = candidates_dir / "2025-09-04.cards.json"
with open(output_file, 'w') as f:
    json.dump(mock_cards, f, indent=2)

print(f"Created {len(mock_cards)} mock cards at {output_file}")