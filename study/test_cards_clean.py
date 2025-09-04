#!/usr/bin/env python3
"""
Create clean test cards without null values
"""

import json
from datetime import datetime
from pathlib import Path

# Create properly formatted cards
clean_cards = [
    {
        "id": "test_card_1",
        "type": "basic",
        "front": "What is the discriminant in the quadratic formula",
        "back": "b² - 4ac",
        "tags": ["algebra", "quadratic"],
        "deck": "Masters::Math::Algebra",
        "source": "TutorMe",
        "created_at": datetime.now().isoformat(),
        "difficulty": "easy",
        "extra": ""
    },
    {
        "id": "test_card_2",
        "type": "basic", 
        "front": "When discriminant > 0, what does this tell us",
        "back": "Two distinct real solutions",
        "tags": ["algebra", "quadratic"],
        "deck": "Masters::Math::Algebra",
        "source": "TutorMe",
        "created_at": datetime.now().isoformat(),
        "difficulty": "easy", 
        "extra": ""
    },
    {
        "id": "test_card_3",
        "type": "basic",
        "front": "When discriminant = 0, what does this mean",
        "back": "One repeated real solution",
        "tags": ["algebra", "quadratic"],
        "deck": "Masters::Math::Algebra",
        "source": "TutorMe",
        "created_at": datetime.now().isoformat(),
        "difficulty": "easy",
        "extra": ""
    }
]

# Save to candidates
candidates_dir = Path("data/cards/candidates")
candidates_dir.mkdir(parents=True, exist_ok=True)

output_file = candidates_dir / "clean_test.cards.json"
with open(output_file, 'w') as f:
    json.dump(clean_cards, f, indent=2)

print(f"Created {len(clean_cards)} clean test cards at {output_file}")