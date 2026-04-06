'use strict';

// ─── Tag color classification ──────────────────────────────────────────────
const RED_TAGS = new Set([
  'Malicious', 'C2', 'Honeypot', 'Compromised'
]);

const ORANGE_TAGS = new Set([
  'IoT', 'OT', 'SCADA', 'ICS', 'HMI', 'Power Plant', 'Fuel System',
  'Water Management', 'Building Automation', 'Traffic Controller',
  'Solar Panel', 'Smart Energy', 'Healthcare', 'SCADA'
]);

const YELLOW_TAGS = new Set([
  'VPN', 'Proxy Server', 'Remote Access', 'Open Directory', 'Open Bucket'
]);

function getTagColorClass(tagName) {
  if (RED_TAGS.has(tagName)) return 'red';
  if (ORANGE_TAGS.has(tagName)) return 'orange';
  if (YELLOW_TAGS.has(tagName)) return 'yellow';
  return 'grey';
}

// ─── CVSS severity classification ─────────────────────────────────────────
function getCvssColorClass(score) {
  if (score === null || score === undefined) return 'none';
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

// ─── Date formatting ───────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

// ─── FQDN display ──────────────────────────────────────────────────────────
function formatFqdns(fqdns) {
  if (!fqdns || fqdns.length === 0) return 'None';
  if (fqdns.length <= 3) return fqdns.join(', ');
  return `${fqdns.slice(0, 3).join(', ')} +${fqdns.length - 3} more`;
}

// ─── Host record transformer ───────────────────────────────────────────────
/**
 * Transform a raw HostQueryModel from the Modat API into a display-ready object.
 * Pre-processes tag colors, CVSS severity classes, date strings, and
 * initializes history state fields for each service (mutated later by Ember.set).
 *
 * @param {Object} host  Raw HostQueryModel from API
 * @returns {Object}     Display-ready host object
 */
function transformHostRecord(host) {
  if (!host) return null;

  const geo = host.geo || {};
  const asn = host.asn || {};

  const tags = (host.tags || []).map((tagName) => ({
    name: tagName,
    colorClass: getTagColorClass(tagName)
  }));

  const cves = (host.cves || []).map((cve) => ({
    id: cve.id,
    cvss: cve.cvss !== null && cve.cvss !== undefined ? parseFloat(cve.cvss).toFixed(1) : null,
    cvssRaw: cve.cvss,
    is_kev: !!cve.is_kev,
    cvssColorClass: `modat-cvss-${getCvssColorClass(cve.cvss)}`,
    nvdUrl: `https://nvd.nist.gov/vuln/detail/${cve.id}`
  }));

  // Services sorted ascending by port; include history state fields
  // that will be mutated by Ember.set() inside the component.
  const services = (host.services || [])
    .map((svc) => ({
      transport: svc.transport || 'tcp',
      port: svc.last_scanned_port || svc.port || 0,
      protocol: svc.protocol || 'unknown',
      scanned_at: formatDate(svc.scanned_at),
      portKey: `${svc.transport || 'tcp'}-${svc.last_scanned_port || svc.port || 0}`,
      // History state — initialized here, mutated later by Ember.set in block.js
      historyLoaded: false,
      historyVisible: false,
      isLoadingHistory: false,
      historyError: null,
      history: []
    }))
    .sort((a, b) => a.port - b.port);

  const kevCount = cves.filter((c) => c.is_kev).length;

  return {
    ip: host.ip,
    geo,
    asn,
    fqdns: host.fqdns || [],
    is_anycast: !!host.is_anycast,
    tags,
    cves,
    services,
    // Precomputed display helpers
    hasTags: tags.length > 0,
    hasCves: cves.length > 0,
    hasServices: services.length > 0,
    kevCount,
    locationString:
      [geo.city_name, geo.country_name].filter(Boolean).join(', ') || 'Unknown',
    countryIso: geo.country_iso_code || '',
    asnString: asn.number
      ? `AS${asn.number}${asn.org ? ` · ${asn.org}` : ''}`
      : 'Unknown',
    asnOrg: asn.org || '',
    fqdnsDisplay: formatFqdns(host.fqdns || [])
  };
}

// ─── Service history transformer ───────────────────────────────────────────
/**
 * Transform raw ServiceHistoryModel records into display-ready objects.
 * Banner is truncated to 200 characters.
 *
 * @param {Array} historyItems  Raw ServiceHistoryModel[] from API
 * @returns {Array}
 */
function transformHistoryRecords(historyItems) {
  if (!historyItems || historyItems.length === 0) return [];
  return historyItems.map((record) => {
    const svc = record.service || {};
    const banner = svc.banner
      ? svc.banner.substring(0, 200) + (svc.banner.length > 200 ? '…' : '')
      : null;

    // Protocol-specific enrichment from confirmed live schema
    const http = svc.http || null;
    const ssh = svc.ssh || null;
    const tls = svc.tls || null;

    return {
      scanned_at: formatDate(svc.scanned_at),
      protocol: svc.protocol || 'unknown',
      transport: svc.transport || 'tcp',
      port: svc.port || 0,
      banner,
      hasBanner: !!banner,
      // HTTP details (confirmed: title, status_code)
      httpTitle: http ? http.title || null : null,
      httpStatus: http ? http.status_code || null : null,
      hasHttp: !!(http && (http.title || http.status_code)),
      // SSH details (confirmed: server_id, hassh)
      sshServerId: ssh ? ssh.server_id || null : null,
      sshHashsh: ssh ? ssh.hassh || null : null,
      hasSsh: !!(ssh && (ssh.server_id || ssh.hassh)),
      // TLS info
      hasTls: !!tls
    };
  });
}

// ─── Error serializer ──────────────────────────────────────────────────────
function parseErrorToReadableJSON(error) {
  return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
}

module.exports = {
  transformHostRecord,
  transformHistoryRecords,
  parseErrorToReadableJSON,
  formatDate
};
