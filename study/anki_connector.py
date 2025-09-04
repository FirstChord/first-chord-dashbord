"""
AnkiConnect integration for direct Anki import
"""

import json
import requests
from pathlib import Path


class AnkiConnector:
    def __init__(self, url='http://localhost:8765'):
        self.url = url
    
    def is_anki_running(self):
        """Check if Anki is running with AnkiConnect"""
        try:
            response = self._request('version')
            return response is not None
        except:
            return False
    
    def create_deck(self, deck_name):
        """Create deck if it doesn't exist"""
        try:
            self._request('createDeck', {'deck': deck_name})
            return True
        except:
            return False
    
    def add_cards(self, cards, deck_name='Default'):
        """Add cards directly to Anki"""
        if not self.is_anki_running():
            raise Exception("Anki is not running or AnkiConnect is not installed")
        
        # Create deck if needed
        self.create_deck(deck_name)
        
        # Prepare notes for AnkiConnect
        notes = []
        for card in cards:
            if card['type'] == 'basic':
                notes.append({
                    'deckName': deck_name,
                    'modelName': 'Basic',
                    'fields': {
                        'Front': card['front'],
                        'Back': card['back']
                    },
                    'tags': card.get('tags', [])
                })
            
            elif card['type'] == 'reverse':
                # Add forward card
                notes.append({
                    'deckName': deck_name,
                    'modelName': 'Basic (and reversed card)',
                    'fields': {
                        'Front': card['front'],
                        'Back': card['back']
                    },
                    'tags': card.get('tags', [])
                })
            
            elif card['type'] == 'cloze':
                notes.append({
                    'deckName': deck_name,
                    'modelName': 'Cloze',
                    'fields': {
                        'Text': card['cloze_text'],
                        'Extra': card.get('extra', '')
                    },
                    'tags': card.get('tags', [])
                })
        
        # Add notes to Anki
        response = self._request('addNotes', {'notes': notes})
        
        if response:
            successful_adds = [note_id for note_id in response if note_id is not None]
            return len(successful_adds)
        
        return 0
    
    def _request(self, action, params=None):
        """Make request to AnkiConnect"""
        payload = {
            'action': action,
            'version': 6,
            'params': params or {}
        }
        
        response = requests.post(self.url, json=payload, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if data.get('error'):
            raise Exception(f"AnkiConnect error: {data['error']}")
        
        return data.get('result')
    
    def get_deck_names(self):
        """Get list of available decks"""
        try:
            return self._request('deckNames')
        except:
            return []


def import_cards_to_anki(cards_file, deck_name='Masters::Math'):
    """Import cards from JSON file directly to Anki"""
    connector = AnkiConnector()
    
    if not connector.is_anki_running():
        return {
            'success': False, 
            'error': 'Anki is not running or AnkiConnect is not installed'
        }
    
    # Load cards
    cards_path = Path(cards_file)
    if not cards_path.exists():
        return {'success': False, 'error': 'Cards file not found'}
    
    with open(cards_path) as f:
        cards = json.load(f)
    
    try:
        added_count = connector.add_cards(cards, deck_name)
        return {
            'success': True, 
            'message': f'Successfully added {added_count} cards to Anki deck "{deck_name}"'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}