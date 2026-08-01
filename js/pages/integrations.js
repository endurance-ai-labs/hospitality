/* Integrations & Data Health */
renderPage('Integrations & Data Health', 'Every feed, its tier, and what it cannot give us',
  ['Toast', 'Square', 'R365', 'Docs'], function () {
  var TIERS = {
    1: ['Live API + webhooks', 'Near real-time. Push events plus a reconciliation pull.', 'good'],
    2: ['Scheduled API pull', 'Hourly or nightly. Complete, but never current.', 'info'],
    3: ['File / EDI / SFTP', 'Nightly drops with a file-arrival monitor. Missing files are the failure mode.', 'warn'],
    4: ['Document ingest', 'PDFs and portals, OCR-extracted then human-reviewed before posting.', 'bad']
  };

  var health = RG.SYSTEMS.map(function (s) { return RG.connectorHealth(s.id); }).filter(Boolean);
  var byTier = { 1: [], 2: [], 3: [], 4: [] };
  health.forEach(function (h) { byTier[h.tier].push(h); });
  var degraded = health.filter(function (h) { return h.status !== 'healthy'; });
  var assumed = health.filter(function (h) { return h.assumed; });

  var rows = health.sort(function (a, b) { return a.tier - b.tier || b.rows - a.rows; })
    .map(function (h) {
      var t = TIERS[h.tier];
      return '<tr><td><b>' + esc(h.name) + '</b>' +
        '<div style="font-size:10px;color:var(--color-slate-hint)">' + esc(h.domain) + '</div></td>' +
        '<td>' + pill('Tier ' + h.tier, t[2]) + '</td>' +
        '<td style="font-size:11.5px;color:var(--color-text-muted)">' + esc(t[0]) + '</td>' +
        '<td class="num">' + fmtNum(h.units) + '</td>' +
        '<td class="num">' + traced(h.latencyMin < 60 ? h.latencyMin + ' min' :
            h.latencyMin < 1440 ? Math.round(h.latencyMin / 60) + ' hrs' :
            Math.round(h.latencyMin / 1440) + ' days', {
          value: 'Last sync ' + (h.latencyMin < 60 ? h.latencyMin + ' minutes' :
            Math.round(h.latencyMin / 60) + ' hours') + ' ago',
          formula: 'time since the last successful sync completed',
          inputs: [['Tier', 'Tier ' + h.tier + ' — ' + t[0]], ['Rows in last sync', fmtNum(h.rows)],
                   ['Failed records', fmtNum(h.errors)],
                   ['Units covered', fmtNum(h.units) + ' of ' + RG.UNITS.length]],
          source: [h.name.indexOf('Toast') >= 0 ? 'Toast' : 'Model'], period: 'live',
          note: t[1] }) + '</td>' +
        '<td class="num">' + fmtNum(h.rows) + '</td>' +
        '<td class="num">' + (h.errors ? '<span class="chip chip-bad">' + fmtNum(h.errors) + '</span>' : '—') + '</td>' +
        '<td>' + pill(h.status, h.status === 'healthy' ? 'good' : h.status === 'stale' ? 'warn' : 'bad') + '</td>' +
        '<td>' + (h.assumed ? pill('assumed', 'warn') : pill('confirmed', 'good')) + '</td></tr>';
    }).join('');

  var tierCards = [1, 2, 3, 4].map(function (t) {
    var m = TIERS[t];
    return '<div class="stat" style="padding:16px 18px">' +
      '<span>Tier ' + t + ' · ' + esc(m[0]) + '</span>' +
      '<b>' + fmtNum(byTier[t].length) + ' feeds</b>' +
      '<i style="display:block;margin-top:6px;line-height:1.5">' + esc(m[1]) + '</i>' +
      '<div style="margin-top:8px;font-size:11px;color:var(--color-slate-hint)">' +
      byTier[t].map(function (h) { return esc(h.name); }).join(' · ') + '</div></div>';
  }).join('');

  /* what each vendor genuinely cannot give us */
  var LIMITS = [
    ['Toast', 'Partner API access requires an approved integration agreement. Historical backfill is ' +
      'capped, so the first sync sets the horizon.'],
    ['Square', 'Labor endpoints expose punches but not the scheduling intent, so scheduled-versus-actual ' +
      'needs the scheduling system alongside it.'],
    ['NCR Aloha', 'No usable public API. If any unit runs Aloha it becomes a nightly export file — ' +
      'plan for Tier 3, not Tier 1.'],
    ['DoorDash / Uber Eats', 'Marketplace APIs are partner-gated and rate-limited. A middleware layer ' +
      '(Deliverect, Otter, ItsaCheckmate) is usually one integration instead of four.'],
    ['QuickBooks Desktop', 'No cloud API. Requires the Web Connector or a scheduled export — this is ' +
      'the single most common bottleneck in a group this size.'],
    ['Sysco / US Foods', 'EDI 810 and 850 give invoice and order data, but contract pricing and rebate ' +
      'terms usually live outside the feed entirely.'],
    ['Local vendors', 'No feed of any kind. PDFs by email, OCR-extracted, human-reviewed. Without this ' +
      'pipeline those vendors are invisible to price watch.'],
    ['Health inspections', 'County portals, not APIs. Scraped or manually entered depending on the county.']
  ];

  return '<div class="stat-row">' +
    [['Connected feeds', fmtNum(health.length), 'across ' + RG.UNITS.length + ' restaurants'],
     ['Tier 1 live', fmtNum(byTier[1].length), 'near real-time'],
     ['Document ingest', fmtNum(byTier[4].length), 'OCR + review queue'],
     ['Degraded', fmtNum(degraded.length), degraded.length ? 'need attention' : 'all healthy'],
     ['Assumed', fmtNum(assumed.length), 'confirm in discovery'],
     ['Records last sync', fmtNum(health.reduce(function (a, h) { return a + h.rows; }, 0)), '']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'The four tiers',
      sub: 'Not every system gives data the same way. Pretending they do is how integration projects slip.',
      body: '<div class="stat-row" style="margin-bottom:0">' + tierCards + '</div>' }) +

    card({ title: 'Connector board', sub: 'Live status, freshness and failed records',
      tools: gridTools('conn', 'Connectors'), sources: ['Toast', 'Square', 'R365'],
      body: table({ id: 'conn', cols: [{ label: 'System' }, { label: 'Tier' }, { label: 'Method' },
        { label: 'Units', num: true }, { label: 'Last sync', num: true }, { label: 'Records', num: true },
        { label: 'Errors', num: true }, { label: 'Status' }, { label: 'Confirmed?' }],
        rows: [rows] }) +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
        'Feeds marked <b>assumed</b> are our best guess at the stack from public signals and the ' +
        'discovery call. Every one of them needs confirming before a build — the tier a system sits ' +
        'in changes the integration effort by an order of magnitude.</div>' }) +

    card({ title: 'What these systems cannot give us',
      sub: 'The honest column. Every integration deck omits this one, and it is the only part that ' +
        'predicts how the project actually goes.',
      body: '<div style="padding:2px 0">' + LIMITS.map(function (l) {
        return '<div style="display:grid;grid-template-columns:180px 1fr;gap:16px;padding:11px 0;' +
          'border-bottom:1px solid var(--glass-border);font-size:12.5px;line-height:1.55">' +
          '<b>' + esc(l[0]) + '</b><span style="color:var(--color-text-muted)">' + esc(l[1]) + '</span></div>';
      }).join('') + '</div>' });
});
