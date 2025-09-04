import json
import re
import hashlib
from pathlib import Path


class LintCardsCommand:
    def __init__(self, config):
        self.config = config
        self.cards_dir = Path(config['cards_dir'])
        self.index_file = self.cards_dir / 'index.json'
        
        # Ensure cards directory exists
        self.cards_dir.mkdir(parents=True, exist_ok=True)
        (self.cards_dir / 'approved').mkdir(exist_ok=True)
    
    def execute(self, args):
        """Lint and deduplicate cards"""
        input_path = Path(args.input_file)
        output_path = Path(args.out)
        
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        if output_path.exists() and not args.force:
            raise FileExistsError(f"Output file exists (use --force): {output_path}")
        
        # Load candidate cards
        with open(input_path) as f:
            cards = json.load(f)
        
        if not isinstance(cards, list):
            raise ValueError("Input must be a JSON array of cards")
        
        # Load existing index
        card_index = self._load_index()
        
        # Lint and deduplicate
        linted_cards = []
        for card in cards:
            try:
                linted_card = self._lint_card(card)
                if linted_card and not self._is_duplicate(linted_card, card_index):
                    linted_cards.append(linted_card)
                    # Add to index
                    card_hash = self._get_card_hash(linted_card)
                    card_index[card_hash] = {
                        'id': linted_card['id'],
                        'created_at': linted_card['created_at'],
                        'exported_at': None,
                        'export_count': 0
                    }
            except Exception as e:
                print(f"Warning: Skipping card {card.get('id', 'unknown')}: {e}")
        
        # Save approved cards
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(linted_cards, f, indent=2)
        
        # Update index
        self._save_index(card_index)
        
        print(f"Approved {len(linted_cards)} cards (removed {len(cards) - len(linted_cards)} duplicates/invalid)")
    
    def _load_index(self):
        """Load existing card index"""
        if self.index_file.exists():
            with open(self.index_file) as f:
                return json.load(f)
        return {}
    
    def _save_index(self, index):
        """Save card index"""
        with open(self.index_file, 'w') as f:
            json.dump(index, f, indent=2)
    
    def _lint_card(self, card):
        """Apply lint rules to a single card"""
        if not isinstance(card, dict):
            raise ValueError("Card must be an object")
        
        card_type = card.get('type')
        if card_type not in ['basic', 'reverse', 'cloze']:
            raise ValueError(f"Invalid card type: {card_type}")
        
        # Clean null values first
        if card.get('cloze_text') is None:
            card.pop('cloze_text', None)
        if card.get('extra') is None:
            card['extra'] = ''
        
        # Basic validation based on type
        if card_type in ['basic', 'reverse']:
            if not card.get('front') or not card.get('back'):
                raise ValueError("Basic/reverse cards must have front and back")
            
            # Basic cards: front must end with ?
            if card_type == 'basic' and not card['front'].strip().endswith('?'):
                card['front'] = card['front'].strip() + '?'
            
            # Check for vague fronts
            vague_patterns = [
                r'^explain\s+\w+$',
                r'^what\s+is\s+\w+\?$',
                r'^describe\s+\w+$'
            ]
            
            for pattern in vague_patterns:
                if re.match(pattern, card['front'].lower()):
                    raise ValueError(f"Vague front: {card['front']}")
            
            # Check front length
            if len(card['front']) > 200:
                print(f"Warning: Long front in card {card.get('id')}: {len(card['front'])} chars")
        
        elif card_type == 'cloze':
            if not card.get('cloze_text'):
                raise ValueError("Cloze cards must have cloze_text")
            
            # Must contain at least one cloze deletion
            if not re.search(r'\{\{c\d+::[^}]+\}\}', card['cloze_text']):
                raise ValueError("Cloze cards must contain {{cX::...}} markup")
        
        # Strip trailing whitespace
        for field in ['front', 'back', 'cloze_text', 'extra']:
            if field in card and isinstance(card[field], str):
                card[field] = card[field].strip()
        
        # Normalize LaTeX spacing
        for field in ['front', 'back', 'cloze_text']:
            if field in card and card[field] is not None:
                card[field] = re.sub(r'\$\s+', '$', card[field])
                card[field] = re.sub(r'\s+\$', '$', card[field])
        
        # Ensure required fields
        if 'tags' not in card or not card['tags']:
            raise ValueError("Card must have tags")
        
        if 'deck' not in card or not card['deck']:
            card['deck'] = self.config['default_deck']
            print(f"Warning: Added default deck to card {card.get('id')}")
        
        return card
    
    def _get_card_hash(self, card):
        """Generate normalized hash for deduplication"""
        if card['type'] == 'cloze':
            # For cloze cards, hash the cloze_text
            content = self._normalize_text(card['cloze_text'])
        else:
            # For basic/reverse cards, hash the front
            content = self._normalize_text(card['front'])
        
        return hashlib.md5(content.encode()).hexdigest()
    
    def _normalize_text(self, text):
        """Normalize text for hashing"""
        # Remove extra whitespace, convert to lowercase
        normalized = re.sub(r'\s+', ' ', text.lower().strip())
        # Remove common punctuation variations
        normalized = re.sub(r'[.!?]+$', '', normalized)
        return normalized
    
    def _is_duplicate(self, card, index):
        """Check if card is a duplicate"""
        card_hash = self._get_card_hash(card)
        return card_hash in index