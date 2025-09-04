#!/usr/bin/env python3
"""
Tutor Me Dashboard - Web interface for the CLI tool
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from anki_connector import AnkiConnector, import_cards_to_anki
import pyperclip

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

def load_config():
    """Load configuration from config.json"""
    config_path = Path("config.json")
    if config_path.exists():
        with open(config_path) as f:
            return json.load(f)
    return {}

def run_cli_command(command):
    """Run a CLI command and return the result"""
    try:
        result = subprocess.run(
            ["python3", "cli.py"] + command.split(),
            capture_output=True,
            text=True,
            cwd="."
        )
        return {
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr
        }
    except Exception as e:
        return {
            "success": False,
            "output": "",
            "error": str(e)
        }

def get_status():
    """Get current system status"""
    config = load_config()
    session_dir = Path(config.get('session_dir', 'data/sessions'))
    cards_dir = Path(config.get('cards_dir', 'data/cards'))
    
    # Count files
    session_files = list(session_dir.glob('*.jsonl')) if session_dir.exists() else []
    candidate_files = list((cards_dir / 'candidates').glob('*.cards.json')) if (cards_dir / 'candidates').exists() else []
    approved_files = list((cards_dir / 'approved').glob('*.cards.json')) if (cards_dir / 'approved').exists() else []
    
    # Load index for exported count
    index_file = cards_dir / 'index.json'
    exported_count = 0
    if index_file.exists():
        with open(index_file) as f:
            index = json.load(f)
            exported_count = sum(1 for entry in index.values() if entry.get('exported_at'))
    
    return {
        "sessions": len(session_files),
        "last_session": max(session_files, key=lambda f: f.stem).stem if session_files else "None",
        "candidate_cards": sum(_count_cards_in_file(f) for f in candidate_files),
        "approved_cards": sum(_count_cards_in_file(f) for f in approved_files),
        "exported_cards": exported_count
    }

def _count_cards_in_file(card_file):
    """Count cards in a JSON file"""
    try:
        with open(card_file) as f:
            cards = json.load(f)
            return len(cards) if isinstance(cards, list) else 0
    except:
        return 0

@app.route('/')
def index():
    """Main dashboard"""
    status = get_status()
    config = load_config()
    
    # Check if API key is configured
    api_key_configured = bool(os.getenv(config.get('gemini_api_key_env', 'GEMINI_API_KEY')))
    
    return render_template('index.html', 
                         status=status, 
                         config=config,
                         api_key_configured=api_key_configured)

@app.route('/capture', methods=['GET', 'POST'])
def capture_session():
    """Capture a study session"""
    if request.method == 'POST':
        topic = request.form['topic']
        source = request.form.get('source', 'TutorMe')
        notes = request.form.get('notes', '')
        tags = request.form.get('tags', '')
        transcript = request.form['transcript']
        
        # Save transcript to temp file
        temp_file = Path("temp_transcript.txt")
        with open(temp_file, 'w') as f:
            f.write(transcript)
        
        # Run capture command
        command = f"capture-session --topic '{topic}' --source '{source}' --input-file temp_transcript.txt"
        if notes:
            command += f" --notes '{notes}'"
        if tags:
            command += f" --tags '{tags}'"
        
        result = run_cli_command(command)
        
        # Clean up temp file
        temp_file.unlink(missing_ok=True)
        
        if result['success']:
            flash('Session captured successfully!', 'success')
            return redirect(url_for('index'))
        else:
            flash(f'Error: {result["error"]}', 'error')
    
    return render_template('capture.html')

@app.route('/extract', methods=['GET', 'POST'])
def extract_cards():
    """Extract flashcards from session"""
    if request.method == 'POST':
        from_date = request.form['from_date']
        max_cards = request.form.get('max_cards', '15')
        
        # Generate output filename
        output_file = f"data/cards/candidates/{from_date}.cards.json"
        
        command = f"extract-cards --from-date {from_date} --max {max_cards} --out {output_file}"
        result = run_cli_command(command)
        
        if result['success']:
            flash('Cards extracted successfully!', 'success')
            return redirect(url_for('review_cards', filename=f"{from_date}.cards.json"))
        else:
            flash(f'Error: {result["error"]}', 'error')
    
    # Get available session dates
    session_dir = Path('data/sessions')
    session_dates = []
    if session_dir.exists():
        session_dates = [f.stem for f in session_dir.glob('*.jsonl')]
        session_dates.sort(reverse=True)
    
    return render_template('extract.html', session_dates=session_dates)

@app.route('/review/<filename>')
def review_cards(filename):
    """Review extracted cards"""
    cards_file = Path(f"data/cards/candidates/{filename}")
    
    if not cards_file.exists():
        flash('Cards file not found!', 'error')
        return redirect(url_for('index'))
    
    with open(cards_file) as f:
        cards = json.load(f)
    
    return render_template('review.html', cards=cards, filename=filename)

@app.route('/lint', methods=['POST'])
def lint_cards():
    """Lint and approve cards"""
    filename = request.json['filename']
    
    input_file = f"data/cards/candidates/{filename}"
    output_file = f"data/cards/approved/{filename}"
    
    command = f"lint-cards --in {input_file} --out {output_file} --force"
    result = run_cli_command(command)
    
    return jsonify({
        "success": result['success'],
        "message": result['output'] if result['success'] else result['error']
    })

@app.route('/export', methods=['GET', 'POST'])
def export_cards():
    """Export cards to Anki"""
    if request.method == 'POST':
        deck = request.form.get('deck', 'Masters::Math')
        since_date = request.form.get('since_date', '')
        
        # Generate output filename
        today = datetime.now().strftime('%Y-%m-%d')
        output_file = f"data/exports/anki_export_{today}.csv"
        
        command = f"export-anki --deck '{deck}' --out {output_file}"
        if since_date:
            command += f" --since {since_date}"
        
        result = run_cli_command(command)
        
        if result['success']:
            flash(f'Cards exported to {output_file}!', 'success')
            return redirect(url_for('index'))
        else:
            flash(f'Error: {result["error"]}', 'error')
    
    return render_template('export.html')

@app.route('/api/status')
def api_status():
    """API endpoint for status"""
    return jsonify(get_status())

@app.route('/import-to-anki', methods=['POST'])
def import_to_anki():
    """Import approved cards directly to Anki"""
    filename = request.json.get('filename')
    deck_name = request.json.get('deck', 'Masters::Math')
    
    if not filename:
        return jsonify({'success': False, 'error': 'No filename provided'})
    
    cards_file = f"data/cards/approved/{filename}"
    result = import_cards_to_anki(cards_file, deck_name)
    
    return jsonify(result)

@app.route('/check-anki')
def check_anki():
    """Check if Anki is running with AnkiConnect"""
    connector = AnkiConnector()
    is_running = connector.is_anki_running()
    
    decks = []
    if is_running:
        decks = connector.get_deck_names()
    
    return jsonify({
        'anki_running': is_running,
        'available_decks': decks
    })

@app.route('/quick-capture', methods=['POST'])
def quick_capture():
    """Quick capture from clipboard"""
    try:
        clipboard_content = pyperclip.paste()
        
        if not clipboard_content.strip():
            return jsonify({'success': False, 'error': 'Clipboard is empty'})
        
        # Use auto-capture logic
        from auto_capture import AutoCapture
        auto_capture = AutoCapture()
        
        if auto_capture.is_tutorme_conversation(clipboard_content):
            turns_count, session_file = auto_capture.auto_capture_session(clipboard_content)
            topic = auto_capture.extract_topic_from_text(clipboard_content)
            
            return jsonify({
                'success': True, 
                'message': f'Captured {turns_count} turns to {session_file.name}',
                'topic': topic,
                'turns': turns_count
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'Clipboard doesn\'t appear to contain a TutorMe conversation'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/manage-sessions')
def manage_sessions():
    """Session management page"""
    session_dir = Path('data/sessions')
    sessions_data = []
    
    if session_dir.exists():
        for session_file in sorted(session_dir.glob('*.jsonl'), reverse=True):
            sessions = []
            with open(session_file) as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            session = json.loads(line)
                            session['line_number'] = line_num
                            session['file_name'] = session_file.name
                            sessions.append(session)
                        except:
                            continue
            
            if sessions:
                sessions_data.append({
                    'file_name': session_file.name,
                    'date': session_file.stem,
                    'sessions': sessions,
                    'count': len(sessions)
                })
    
    return render_template('manage_sessions.html', sessions_data=sessions_data)

@app.route('/delete-session', methods=['POST'])
def delete_session():
    """Delete a specific session"""
    data = request.json
    file_name = data.get('file_name')
    session_id = data.get('session_id')
    
    if not file_name or not session_id:
        return jsonify({'success': False, 'error': 'Missing file_name or session_id'})
    
    session_file = Path(f'data/sessions/{file_name}')
    if not session_file.exists():
        return jsonify({'success': False, 'error': 'Session file not found'})
    
    # Read all sessions
    sessions = []
    with open(session_file) as f:
        for line in f:
            if line.strip():
                try:
                    session = json.loads(line)
                    if session.get('id') != session_id:
                        sessions.append(session)
                except:
                    continue
    
    # Write back without the deleted session
    with open(session_file, 'w') as f:
        for session in sessions:
            f.write(json.dumps(session) + '\n')
    
    return jsonify({'success': True, 'message': f'Session {session_id} deleted'})

@app.route('/update-session', methods=['POST'])
def update_session():
    """Update session topic, notes, or tags"""
    data = request.json
    file_name = data.get('file_name')
    session_id = data.get('session_id')
    updates = data.get('updates', {})
    
    if not file_name or not session_id:
        return jsonify({'success': False, 'error': 'Missing file_name or session_id'})
    
    session_file = Path(f'data/sessions/{file_name}')
    if not session_file.exists():
        return jsonify({'success': False, 'error': 'Session file not found'})
    
    # Read, update, and write back
    sessions = []
    updated = False
    
    with open(session_file) as f:
        for line in f:
            if line.strip():
                try:
                    session = json.loads(line)
                    if session.get('id') == session_id:
                        # Apply updates
                        for key, value in updates.items():
                            if key in ['topic', 'notes', 'tags']:
                                session[key] = value
                        updated = True
                    sessions.append(session)
                except:
                    continue
    
    if not updated:
        return jsonify({'success': False, 'error': 'Session not found'})
    
    # Write back
    with open(session_file, 'w') as f:
        for session in sessions:
            f.write(json.dumps(session) + '\n')
    
    return jsonify({'success': True, 'message': 'Session updated successfully'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)