#!/usr/bin/env python3
"""
Tutor Me CLI - A wrapper for managing study sessions and flashcard generation
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from commands.capture_session import CaptureSessionCommand
from commands.list_sessions import ListSessionsCommand
from commands.extract_cards import ExtractCardsCommand
from commands.lint_cards import LintCardsCommand
from commands.export_anki import ExportAnkiCommand
from commands.status import StatusCommand


def load_config():
    """Load configuration from config.json"""
    config_path = Path(__file__).parent / "config.json"
    if config_path.exists():
        with open(config_path) as f:
            return json.load(f)
    return {
        "default_deck": "Masters::Math",
        "tag_separator": "space",
        "max_cards_per_extract": 15,
        "session_dir": "data/sessions",
        "cards_dir": "data/cards",
        "exports_dir": "data/exports"
    }


def main():
    parser = argparse.ArgumentParser(
        description="Tutor Me CLI - Manage study sessions and flashcard generation"
    )
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    config = load_config()
    
    # capture-session command
    capture_parser = subparsers.add_parser('capture-session', help='Capture a study session')
    capture_parser.add_argument('--topic', required=True, help='Topic of the session')
    capture_parser.add_argument('--source', default='TutorMe', help='Source of the session')
    capture_parser.add_argument('--notes', help='Additional notes')
    capture_parser.add_argument('--tags', help='Comma-separated tags')
    capture_parser.add_argument('--input-file', help='Input file path (if not provided, reads from STDIN)')
    
    # list-sessions command
    list_parser = subparsers.add_parser('list-sessions', help='List recent session files')
    list_parser.add_argument('--limit', type=int, default=10, help='Number of sessions to show')
    
    # extract-cards command
    extract_parser = subparsers.add_parser('extract-cards', help='Extract flashcards from session')
    extract_parser.add_argument('--from-date', required=True, help='Date to extract from (YYYY-MM-DD)')
    extract_parser.add_argument('--max', type=int, default=config['max_cards_per_extract'], 
                               help='Maximum cards to extract')
    extract_parser.add_argument('--out', required=True, help='Output file path')
    
    # lint-cards command
    lint_parser = subparsers.add_parser('lint-cards', help='Lint and deduplicate cards')
    lint_parser.add_argument('--in', dest='input_file', required=True, help='Input cards file')
    lint_parser.add_argument('--out', required=True, help='Output approved cards file')
    lint_parser.add_argument('--force', action='store_true', help='Overwrite existing files')
    
    # export-anki command
    anki_parser = subparsers.add_parser('export-anki', help='Export cards to Anki CSV')
    anki_parser.add_argument('--deck', default=config['default_deck'], help='Target deck')
    anki_parser.add_argument('--since', help='Export cards since date (YYYY-MM-DD)')
    anki_parser.add_argument('--out', required=True, help='Output CSV file')
    anki_parser.add_argument('--reexport', action='store_true', help='Re-export already exported cards')
    
    # status command
    subparsers.add_parser('status', help='Show quick statistics')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        if args.command == 'capture-session':
            cmd = CaptureSessionCommand(config)
            cmd.execute(args)
        elif args.command == 'list-sessions':
            cmd = ListSessionsCommand(config)
            cmd.execute(args)
        elif args.command == 'extract-cards':
            cmd = ExtractCardsCommand(config)
            cmd.execute(args)
        elif args.command == 'lint-cards':
            cmd = LintCardsCommand(config)
            cmd.execute(args)
        elif args.command == 'export-anki':
            cmd = ExportAnkiCommand(config)
            cmd.execute(args)
        elif args.command == 'status':
            cmd = StatusCommand(config)
            cmd.execute(args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()