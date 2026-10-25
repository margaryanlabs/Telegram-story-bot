"""Read-only, dependency-free inventory of the existing VETOGRAM frontend.

Run from repository root. Does not load credentials, call APIs or execute app code.
This is source evidence, not a browser or integration test.
"""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Inventory(HTMLParser):
    def __init__(self):
        super().__init__()
        self.screens, self.styles, self.scripts, self.dialogs, self.ids = [], [], [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if 'data-screen' in a:
            self.screens.append({'route': a['data-screen'], 'id': a.get('id')})
        if tag == 'link' and a.get('rel') == 'stylesheet':
            self.styles.append(a['href'].split('?')[0])
        if tag == 'script' and a.get('src'):
            self.scripts.append(a['src'].split('?')[0])
        if tag == 'dialog' or a.get('aria-modal') == 'true':
            self.dialogs.append({'tag': tag, 'id': a.get('id')})


def inventory():
    html = (ROOT / 'public/studio.html').read_text()
    parsed = Inventory()
    parsed.feed(html)
    app = (ROOT / 'public/app.js').read_text()
    sheets = re.findall(r'function\s+(\w*Sheet)\s*\(', app)
    return {
        'evidence': 'static source inventory; not runtime QA',
        'studio_lines': len(html.splitlines()),
        'screens': parsed.screens,
        'stylesheets_in_cascade_order': parsed.styles,
        'script_entries': parsed.scripts,
        'static_dialogs': parsed.dialogs,
        'app_sheet_functions': sheets,
        'duplicate_ids': sorted({i for i in parsed.ids if parsed.ids.count(i) > 1}),
        'css': [{'path': p, 'bytes': (ROOT / 'public' / p.lstrip('/')).stat().st_size,
                 'important_count': (ROOT / 'public' / p.lstrip('/')).read_text().count('!important')}
                for p in parsed.styles],
        'limits': ['Does not enumerate dynamically generated DOM outside app.js sheet functions.',
                   'No authenticated Telegram state, device or accessibility certification.'],
    }


if __name__ == '__main__':
    print(json.dumps(inventory(), ensure_ascii=False, indent=2))
