'use strict';

/**
 * Build the Polarity summary tags array for a single host record.
 *
 * Order:
 * 1. Up to 5 threat tags (overflow: "+N more")
 * 2. CVE count ("N CVEs" or "N CVEs (K KEV)")
 * 3. Open ports — up to 5, sorted ascending (overflow: "+N more")
 * 4. ASN org string
 *
 * @param {Object} primaryHost  Transformed host record from transformHostRecord()
 * @param {string} entityType   'ip' | 'domain'
 * @param {number} totalRecords Total records from search (domain only)
 * @returns {string[]}
 */
function createSummaryTags(primaryHost, entityType, totalRecords) {
  const tags = [];

  if (!primaryHost) {
    return tags;
  }

  // Domain: lead with total hosts found
  if (entityType === 'domain' && totalRecords > 1) {
    tags.push(`${totalRecords} Hosts Found`);
  }

  // Threat tags (up to 5)
  const threatTags = primaryHost.tags || [];
  if (threatTags.length > 0) {
    const visible = threatTags.slice(0, 5).map((t) => t.name);
    visible.forEach((t) => tags.push(t));
    if (threatTags.length > 5) {
      tags.push(`+${threatTags.length - 5} more tags`);
    }
  }

  // CVE count with optional KEV callout
  const cves = primaryHost.cves || [];
  if (cves.length > 0) {
    const kevCount = primaryHost.kevCount || 0;
    if (kevCount > 0) {
      tags.push(`${cves.length} CVEs (${kevCount} KEV)`);
    } else {
      tags.push(`${cves.length} CVEs`);
    }
  }

  // Open ports (up to 5)
  const services = primaryHost.services || [];
  if (services.length > 0) {
    const ports = services.map((s) => s.port).sort((a, b) => a - b);
    const visible = ports.slice(0, 5);
    const overflow = ports.length - 5;
    const portStr = visible.join(', ') + (overflow > 0 ? `, +${overflow} more` : '');
    tags.push(`Ports: ${portStr}`);
  }

  // ASN
  if (primaryHost.asnString && primaryHost.asnString !== 'Unknown') {
    tags.push(primaryHost.asnString);
  }

  return tags;
}

module.exports = { createSummaryTags };
