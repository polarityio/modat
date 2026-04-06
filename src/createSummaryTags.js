'use strict';

// Severity priority for sorting threat tags in summary (lower = higher priority)
const COLOR_PRIORITY = { red: 1, orange: 2, yellow: 3, grey: 4 };

/**
 * Build the Polarity summary tags array for a single host record.
 *
 * Order:
 * 1. Domain: host count
 * 2. Threat classification — show top 2 by severity, collapse rest: "C2 · Malicious +1"
 * 3. CVE count with KEV callout: "3 CVEs · 1 KEV" (KEV-first when present)
 * 4. Open ports — up to 4, sorted ascending
 *
 * @param {Object} primaryHost  Transformed host record from transformHostRecord()
 * @param {string} entityType   'ip' | 'domain'
 * @param {number} totalRecords Total records from search (domain only)
 * @returns {string[]}
 */
function createSummaryTags(primaryHost, entityType, totalRecords) {
  const tags = [];

  if (!primaryHost) return tags;

  // 1. Domain: lead with total hosts found
  if (entityType === 'domain' && totalRecords > 1) {
    tags.push(`${totalRecords} Hosts Found`);
  }

  // 2. Threat classification — sorted by severity, max 2 visible, rest collapsed
  const threatTags = (primaryHost.tags || []).slice().sort(
    (a, b) => (COLOR_PRIORITY[a.colorClass] || 9) - (COLOR_PRIORITY[b.colorClass] || 9)
  );
  if (threatTags.length > 0) {
    const visible = threatTags.slice(0, 2).map((t) => t.name);
    const overflow = threatTags.length - 2;
    const label = visible.join(' · ') + (overflow > 0 ? ` +${overflow}` : '');
    tags.push(label);
  }

  // 3. CVE count — lead with KEV when present
  const cves = primaryHost.cves || [];
  if (cves.length > 0) {
    const kevCount = primaryHost.kevCount || 0;
    if (kevCount > 0) {
      tags.push(`${kevCount} KEV · ${cves.length} CVEs`);
    } else {
      tags.push(`${cves.length} CVEs`);
    }
  }

  // 4. Open ports (up to 4)
  const services = primaryHost.services || [];
  if (services.length > 0) {
    const ports = services.map((s) => s.port).sort((a, b) => a - b);
    const visible = ports.slice(0, 4);
    const overflow = ports.length - 4;
    const portStr = visible.join(', ') + (overflow > 0 ? ` +${overflow}` : '');
    tags.push(`Ports: ${portStr}`);
  }

  return tags;
}

module.exports = { createSummaryTags };
