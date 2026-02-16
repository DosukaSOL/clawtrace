# Deployment Guide — Clawtrace

Clawtrace is a static site. Deploy it anywhere that serves HTML files.

## Quick Deploy

### GitHub Pages
1. Push the repo to GitHub
2. Go to Settings → Pages → Source: main branch, root folder
3. Save — your site is live at `https://<user>.github.io/clawtrace/`

### Netlify / Vercel / Cloudflare Pages
1. Connect your GitHub repo
2. Build command: *(leave empty — no build step)*
3. Publish directory: `/` (root)
4. Deploy

### Any Web Server
Copy the entire `clawtrace/` folder to your web root.

## Recommended Security Headers

Add these HTTP headers in your server configuration:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Netlify (`_headers` file)
```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none';
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

### Nginx
```nginx
server {
    listen 80;
    server_name clawtrace.example.com;
    root /var/www/clawtrace;
    index index.html;

    add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none';" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()" always;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### Apache (`.htaccess`)
```apache
Header always set Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none';"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Referrer-Policy "no-referrer"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()"
```

## HTTPS

Always serve Clawtrace over HTTPS in production. Free TLS certificates are available from Let's Encrypt / Cloudflare.

## Share URLs

Share URLs encode trace data in the URL fragment (`#ct1:...`). For these to work, users must be able to access the same deployment URL. The fragment is never sent to your server by the browser.
