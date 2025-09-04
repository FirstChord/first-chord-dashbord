import csv
import json
from datetime import datetime, date
from pathlib import Path


class ExportAnkiCommand:
    def __init__(self, config):
        self.config = config
        self.cards_dir = Path(config['cards_dir'])
        self.exports_dir = Path(config['exports_dir'])
        self.index_file = self.cards_dir / 'index.json'
        
        # Ensure exports directory exists
        self.exports_dir.mkdir(parents=True, exist_ok=True)
    
    def execute(self, args):
        """Export approved cards to Anki CSV"""
        # Load card index
        if not self.index_file.exists():
            raise FileNotFoundError("No card index found. Run lint-cards first.")
        
        with open(self.index_file) as f:
            card_index = json.load(f)
        
        # Find approved card files
        approved_cards = []
        approved_dir = self.cards_dir / 'approved'
        
        for card_file in approved_dir.glob('*.cards.json'):
            with open(card_file) as f:
                cards = json.load(f)
                approved_cards.extend(cards)
        
        if not approved_cards:
            print("No approved cards found.")
            return
        
        # Filter cards based on criteria
        cards_to_export = []
        since_date = datetime.strptime(args.since, '%Y-%m-%d').date() if args.since else None
        
        for card in approved_cards:
            card_hash = self._get_card_hash(card)
            index_entry = card_index.get(card_hash, {})
            
            # Skip already exported cards unless --reexport
            if not args.reexport and index_entry.get('exported_at'):
                continue
            
            # Filter by date if specified
            if since_date:
                card_date = datetime.fromisoformat(card['created_at']).date()
                if card_date < since_date:
                    continue
            
            # Filter by deck
            if card.get('deck', '').startswith(args.deck.split('::')[0]):
                cards_to_export.append(card)
        
        if not cards_to_export:
            print("No cards to export.")
            return
        
        # Export to CSV
        output_path = Path(args.out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        exported_count = self._write_csv(cards_to_export, output_path)
        
        # Update index with export information
        now = datetime.now().isoformat()
        for card in cards_to_export:
            card_hash = self._get_card_hash(card)
            if card_hash in card_index:
                card_index[card_hash]['exported_at'] = now
                card_index[card_hash]['export_count'] = card_index[card_hash].get('export_count', 0) + 1
        
        # Save updated index
        with open(self.index_file, 'w') as f:
            json.dump(card_index, f, indent=2)
        
        print(f"Exported {exported_count} card rows to {output_path}")
    
    def _write_csv(self, cards, output_path):
        """Write cards to CSV file"""
        rows_written = 0
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            # Define CSV columns for Anki import
            fieldnames = ['Front', 'Back', 'Type', 'Deck', 'Tags', 'Extra', 'Guid']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for card in cards:
                if card['type'] == 'basic':
                    writer.writerow({
                        'Front': card['front'],
                        'Back': card['back'],
                        'Type': 'Basic',
                        'Deck': card['deck'],
                        'Tags': self._format_tags(card.get('tags', [])),
                        'Extra': card.get('extra', ''),
                        'Guid': card['id']
                    })
                    rows_written += 1
                
                elif card['type'] == 'reverse':
                    # Create two rows for reverse cards
                    writer.writerow({
                        'Front': card['front'],
                        'Back': card['back'],
                        'Type': 'Basic',
                        'Deck': card['deck'],
                        'Tags': self._format_tags(card.get('tags', [])),
                        'Extra': card.get('extra', ''),
                        'Guid': card['id'] + '_forward'
                    })
                    writer.writerow({
                        'Front': card['back'],
                        'Back': card['front'],
                        'Type': 'Basic',
                        'Deck': card['deck'],
                        'Tags': self._format_tags(card.get('tags', [])),
                        'Extra': card.get('extra', ''),
                        'Guid': card['id'] + '_reverse'
                    })
                    rows_written += 2
                
                elif card['type'] == 'cloze':
                    writer.writerow({
                        'Front': card['cloze_text'],
                        'Back': card.get('extra', ''),
                        'Type': 'Cloze',
                        'Deck': card['deck'],
                        'Tags': self._format_tags(card.get('tags', [])),
                        'Extra': card.get('extra', ''),
                        'Guid': card['id']
                    })
                    rows_written += 1
        
        return rows_written
    
    def _format_tags(self, tags):
        """Format tags for Anki import"""
        if not tags:
            return ''
        
        if self.config.get('tag_separator') == 'comma':
            return ', '.join(tags)
        else:
            return ' '.join(tags)
    
    def _get_card_hash(self, card):
        """Generate hash for card (same as lint_cards)"""
        import hashlib
        import re
        
        if card['type'] == 'cloze':
            content = self._normalize_text(card['cloze_text'])
        else:
            content = self._normalize_text(card['front'])
        
        return hashlib.md5(content.encode()).hexdigest()
    
    def _normalize_text(self, text):
        """Normalize text for hashing (same as lint_cards)"""
        import re
        normalized = re.sub(r'\s+', ' ', text.lower().strip())
        normalized = re.sub(r'[.!?]+$', '', normalized)
        return normalized