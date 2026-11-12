/**
 * @fileoverview Shared HTML escaping and responsive shell renderer for Sonaraim Admin views.
 */

/**
 * Escapes untrusted dynamic strings before embedding them in HTML templates.
 *
 * @param {unknown} value - Raw value to escape.
 * @returns {string} HTML-escaped string safe for text and attribute contexts.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Wraps page content in an accessible, responsive HTML5 document shell.
 *
 * @param {object} params - Shell rendering options.
 * @param {string} params.title - Document and header title.
 * @param {string} params.activeTab - Active navigation route slug.
 * @param {string} params.contentHtml - Pre-escaped inner HTML for the `<main>` landmark.
 * @returns {string} Complete HTML5 document.
 */
export function renderAdminShell({ title, activeTab, contentHtml }) {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="data:," />
  <title>${safeTitle}</title>
  <style>
    :root { --bg:#0b1020; --card:#131b33; --text:#eef2ff; --muted:#9fb0d6; --accent:#38bdf8; }
    * { box-sizing:border-box; }
    html, body { margin:0; padding:0; max-width:100%; overflow-x:hidden; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:1rem 1.5rem; border-bottom:1px solid #243055; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; }
    nav a { color:var(--muted); text-decoration:none; margin-right:1rem; font-weight:600; }
    nav a[aria-current="page"] { color:var(--accent); }
    main { max-width:1200px; width:100%; margin:0 auto; padding:1.5rem; display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr)); }
    section { background:var(--card); border:1px solid #243055; border-radius:12px; padding:1rem; min-width:0; }
    code { overflow-wrap:anywhere; word-break:break-all; }
    form { display:flex; flex-direction:column; gap:0.75rem; }
    label { display:flex; flex-direction:column; gap:0.25rem; font-size:0.9rem; color:var(--muted); }
    input, button { width:100%; max-width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid #243055; background:#0b1020; color:var(--text); font-size:0.95rem; }
    button { background:#0284c7; color:#ffffff; font-weight:600; cursor:pointer; border-color:#38bdf8; }
    @media (max-width:768px) { main { padding:1rem; } }
    @media (max-width:375px) { header { padding:0.75rem; } main { padding:0.75rem; } }
  </style>
</head>
<body>
  <header>
    <h1>${safeTitle}</h1>
    <nav aria-label="Admin Console Navigation">
      <a href="/operator" aria-current="${activeTab === 'operator' ? 'page' : 'false'}">Operator Console</a>
      <a href="/studio" aria-current="${activeTab === 'studio' ? 'page' : 'false'}">Card Studio</a>
    </nav>
  </header>
  <main>${contentHtml}</main>
</body>
</html>`;
}
