import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Insert showcase banner after <body>
banner = '''\
    <div class="showcase-banner">
        <span class="showcase-badge">Showcase</span>
        <span>Interactive demo &mdash; fake data, all features enabled. <strong>Nothing is saved or uploaded.</strong></span>
        <a href="index.html" class="showcase-exit">Back to real app</a>
    </div>
'''
html = re.sub(r'(<body[^>]*>)', r'\1\n' + banner, html, count=1)

# Update CSP for showcase (allow inline style for banner)
html = re.sub(r"style-src 'self';", "style-src 'self' 'unsafe-inline';", html)

# Remove app.js, add showcase-loader.js at end
html = re.sub(r'<script src="src/js/app.js" defer></script>', '', html)
html = re.sub(r'(</body>)',
    '    <script src="src/js/showcase-loader.js" defer></script>\n\\1',
    html)

# Update <title>
html = re.sub(r'<title>.*?</title>', '<title>Clawtrace Showcase — Interactive Demo</title>', html)

with open("showcase.html", "w", encoding="utf-8") as f:
    f.write(html)

print("[+] showcase.html written ({} bytes)".format(len(html)))
