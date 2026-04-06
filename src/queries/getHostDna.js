'use strict';

const MODAT_BASE_URL = 'https://api.magnify.modat.io';

/**
 * Build the Modat query string based on entity type.
 * - IPv4 / IPv6  → ip:"<value>"
 * - domain       → fqdn:"<value>"
 */
function buildQuery(entity) {
  if (entity.isIP) {
    return `ip:"${entity.value}"`;
  }
  return `fqdn:"${entity.value}"`;
}

/**
 * Query POST /host/search/v1
 * Returns a HostSearchResponse: { page_nr, total_pages, total_records, page[] }
 */
async function getHostDna(query, page, options, requestWithDefaults, Logger) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: 'POST',
      uri: `${MODAT_BASE_URL}/host/search/v1`,
      headers: {
        Authorization: `Bearer ${options.apiKey}`
      },
      json: true,
      body: {
        query,
        page: page || 1,
        page_size: 10
      }
    };

    Logger.trace({ requestOptions: { ...requestOptions, headers: { Authorization: '[REDACTED]' } } }, 'getHostDna request');

    requestWithDefaults(requestOptions, (err, res, body) => {
      if (err) {
        Logger.error({ err }, 'getHostDna network error');
        return reject(new Error(`Network error: ${err.message}`));
      }

      Logger.trace({ statusCode: res.statusCode }, 'getHostDna response');

      if (res.statusCode === 200) {
        return resolve(body);
      }

      if (res.statusCode === 404) {
        return resolve({ page_nr: 1, total_pages: 0, total_records: 0, page: [] });
      }

      if (res.statusCode === 401) {
        return reject(new Error('Invalid API Key. Please verify your Modat API key in the integration settings.'));
      }

      if (res.statusCode === 422) {
        const errors =
          body && Array.isArray(body.errors) ? body.errors.join(', ') : 'Invalid query string';
        return reject(new Error(`Modat query error: ${errors}`));
      }

      if (res.statusCode === 429) {
        return reject(new Error('Modat rate limit exceeded. Please wait before retrying.'));
      }

      const detail = (body && body.detail) || `Unexpected HTTP status: ${res.statusCode}`;
      return reject(new Error(detail));
    });
  });
}

module.exports = { getHostDna, buildQuery };
