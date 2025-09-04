# Tutor Me CLI

A command-line tool for managing study sessions and generating flashcards from tutoring transcripts.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up your LLM API key (Gemini is FREE!):
```bash
cp .env.example .env
# Edit .env and add your Gemini API key
```

Get a **FREE** Gemini API key:
1. Go to [ai.google.dev](https://ai.google.dev)
2. Click "Get API key in Google AI Studio"
3. Create a new project or use existing
4. Generate API key (free tier: 15 requests/minute, 1M tokens/day)
5. Add it to your `.env` file as `GEMINI_API_KEY=your_key_here`

## Usage

All commands run from the repo root (`study/`).

### 1. Capture Session

Append Q/A turns to today's JSONL:

```bash
python cli.py capture-session \
  --topic "algebra.simplifying" \
  --source "TutorMe" \
  --notes "Struggled with signs" \
  --tags "algebra.s3,factoring" \
  --input-file path/to/transcript.txt
```

If `--input-file` is omitted, reads from STDIN.

### 2. List Sessions

List recent session files:

```bash
python cli.py list-sessions --limit 10
```

### 3. Extract Cards

Generate flashcards from a session:

```bash
python cli.py extract-cards \
  --from-date 2025-09-04 \
  --max 20 \
  --out data/cards/candidates/2025-09-04.cards.json
```

### 4. Lint Cards

Validate and deduplicate cards:

```bash
python cli.py lint-cards \
  --in data/cards/candidates/2025-09-04.cards.json \
  --out data/cards/approved/2025-09-04.cards.json
```

### 5. Export to Anki

Export cards to CSV for Anki import:

```bash
python cli.py export-anki \
  --deck "Masters::Math" \
  --since 2025-09-01 \
  --out data/exports/anki_export_2025-09-04.csv
```

### 6. Status

View quick statistics:

```bash
python cli.py status
```

## Configuration

Edit `config.json` to customize defaults:

- `llm_provider`: "gemini" (free) or "openai" (paid)
- `default_deck`: Default Anki deck name
- `max_cards_per_extract`: Maximum cards per extraction
- `tag_separator`: How to format tags ("space" or "comma")
- `gemini_model`: Gemini model to use (default: "gemini-1.5-flash")

## File Structure

```
study/
├── cli.py                    # Main CLI entry point
├── config.json               # Configuration
├── commands/                 # Command implementations
├── data/
│   ├── sessions/            # Session JSONL files
│   ├── cards/
│   │   ├── candidates/      # Raw extracted cards
│   │   ├── approved/        # Linted and approved cards
│   │   └── index.json       # Card deduplication index
│   ├── exports/             # Anki CSV exports
│   └── media/               # Referenced media files
└── prompts/
    └── extract_cards.md     # LLM prompt for card extraction
```

## Card Types

- **Basic**: Question → Answer
- **Reverse**: Creates both Question → Answer and Answer → Question
- **Cloze**: Fill-in-the-blank with `{{c1::answer}}` syntax

## Workflow

1. **Capture** your tutoring session transcript
2. **Extract** flashcards using AI
3. **Lint** cards to validate and remove duplicates
4. **Export** approved cards to Anki
5. **Status** to track your progress

The system automatically handles deduplication and maintains an index of all processed cards.