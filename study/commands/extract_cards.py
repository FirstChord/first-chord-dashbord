import json
import os
from datetime import datetime
from pathlib import Path
import openai
from openai import OpenAI
import google.generativeai as genai


class ExtractCardsCommand:
    def __init__(self, config):
        self.config = config
        self.session_dir = Path(config['session_dir'])
        self.cards_dir = Path(config['cards_dir'])
        self.prompt_file = Path('prompts/extract_cards.md')
        self.llm_provider = config.get('llm_provider', 'gemini')
        
        # Initialize LLM client based on provider
        if self.llm_provider == 'openai':
            api_key = os.getenv(config.get('openai_api_key_env', 'OPENAI_API_KEY'))
            if not api_key:
                raise ValueError("OpenAI API key not found in environment variables")
            self.client = OpenAI(api_key=api_key)
        elif self.llm_provider == 'gemini':
            api_key = os.getenv(config.get('gemini_api_key_env', 'GEMINI_API_KEY'))
            if not api_key:
                raise ValueError("Gemini API key not found in environment variables")
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(config.get('gemini_model', 'gemini-1.5-flash'))
        else:
            raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")
    
    def execute(self, args):
        """Extract flashcards from a session file"""
        session_file = self.session_dir / f"{args.from_date}.jsonl"
        
        if not session_file.exists():
            raise FileNotFoundError(f"Session file not found: {session_file}")
        
        # Check if prompt file exists
        if not self.prompt_file.exists():
            raise FileNotFoundError(f"Prompt file not found: {self.prompt_file}")
        
        # Load session data
        transcript = self._load_session_transcript(session_file)
        
        if not transcript.strip():
            raise ValueError("Empty transcript")
        
        # Load and prepare prompt
        with open(self.prompt_file) as f:
            prompt_template = f.read()
        
        prompt = prompt_template.replace('{{MAX_CARDS}}', str(args.max))
        
        # Call OpenAI API
        cards = self._extract_cards_with_llm(prompt, transcript)
        
        # Validate and clean cards
        validated_cards = self._validate_cards(cards, args.max)
        
        # Ensure output directory exists
        output_path = Path(args.out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save cards
        with open(output_path, 'w') as f:
            json.dump(validated_cards, f, indent=2)
        
        print(f"Extracted {len(validated_cards)} cards to {output_path}")
    
    def _load_session_transcript(self, session_file):
        """Load and combine session transcript"""
        transcript_parts = []
        
        with open(session_file) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                    if 'prompt' in obj and obj['prompt']:
                        transcript_parts.append(f"User: {obj['prompt']}")
                    if 'assistant_reply' in obj and obj['assistant_reply']:
                        transcript_parts.append(f"Assistant: {obj['assistant_reply']}")
                except json.JSONDecodeError:
                    continue
        
        return '\n\n'.join(transcript_parts)
    
    def _extract_cards_with_llm(self, prompt, transcript):
        """Use configured LLM to extract cards from transcript"""
        full_prompt = f"{prompt}\n\nTranscript:\n\n{transcript}"
        
        try:
            if self.llm_provider == 'openai':
                messages = [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Transcript:\n\n{transcript}"}
                ]
                
                response = self.client.chat.completions.create(
                    model=self.config.get('llm_model', 'gpt-4'),
                    messages=messages,
                    temperature=0.1,
                    max_tokens=4000
                )
                content = response.choices[0].message.content
                
            elif self.llm_provider == 'gemini':
                response = self.client.generate_content(
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=4000,
                    )
                )
                content = response.text
            
            # Try to extract JSON from the response
            if '```json' in content:
                json_start = content.find('```json') + 7
                json_end = content.find('```', json_start)
                json_content = content[json_start:json_end].strip()
            else:
                # Look for array structure
                start = content.find('[')
                end = content.rfind(']') + 1
                if start != -1 and end != 0:
                    json_content = content[start:end]
                else:
                    json_content = content
            
            return json.loads(json_content)
            
        except Exception as e:
            raise ValueError(f"Failed to extract cards with {self.llm_provider}: {e}")
    
    def _validate_cards(self, cards, max_cards):
        """Validate and clean extracted cards"""
        if not isinstance(cards, list):
            raise ValueError("Cards must be a JSON array")
        
        validated = []
        
        for i, card in enumerate(cards[:max_cards]):
            try:
                # Ensure required fields
                if 'type' not in card or card['type'] not in ['basic', 'reverse', 'cloze']:
                    continue
                
                # Generate ID if missing
                if 'id' not in card:
                    card['id'] = f"card_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{i}"
                
                # Set defaults
                card.setdefault('tags', [])
                card.setdefault('deck', self.config['default_deck'])
                card.setdefault('source', 'TutorMe')
                card.setdefault('created_at', datetime.now().isoformat())
                card.setdefault('difficulty', 'med')
                card.setdefault('extra', '')
                
                # Type-specific validation
                if card['type'] in ['basic', 'reverse']:
                    if 'front' not in card or 'back' not in card:
                        continue
                elif card['type'] == 'cloze':
                    if 'cloze_text' not in card:
                        continue
                    if '{{c1::' not in card['cloze_text']:
                        continue
                
                validated.append(card)
                
            except Exception as e:
                print(f"Warning: Skipping invalid card {i}: {e}")
                continue
        
        return validated