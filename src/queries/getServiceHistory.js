'use strict';

const MODAT_BASE_URL = 'https://api.magnify.modat.io';
const HISTORY_LOOKBACK_DAYS = 90;

/**
 * Query POST /service/history/v1
 * Returns a ServiceHistoryResponse: { history[] }
 * Max 100 records. Lookback window is fixed at 90 days.
 *
 * @param {string} ip
 * @param {number} port
 * @param {string} transport  - "tcp" | "udp"
 */
async function getServiceHistory(ip, port, transport, options, requestWithDefaults, Logger) {
  const since = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: 'POST',
      uri: `${MODAT_BASE_URL}/service/history/v1`,
      headers: {
        Authorization: `Bearer ${options.apiKey}`
      },
      json: true,
      body: {
        since,
        ip,
        port: Number(port),
        transport
      }
    };

    Logger.trace(
      { requestOptions: { ...requestOptions, headers: { Authorization: '[REDACTED]' } } },
      'getServiceHistory request'
    );

    requestWithDefaults(requestOptions, (err, res, body) => {
      if (err) {
        Logger.error({ err }, 'getServiceHistory network error');
        return reject(new Error(`Network error: ${err.message}`));
      }

      Logger.trace({ statusCode: res.statusCode }, 'getServiceHistory response');

      if (res.statusCode === 200) {
        return resolve(body);
      }

      if (res.statusCode === 401) {
        // Subscription limit returns 401 with { detail: { error_code, message } }
        const detail = body && body.detail;
        if (detail && typeof detail === 'object' && detail.message) {
          return reject(new Error(`Service history unavailable: ${detail.message}`));
        }
        return reject(new Error('Invalid API Key for service history request.'));
      }

      if (res.statusCode === 422) {
        const errors =
          body && Array.isArray(body.detail)
            ? body.detail.map((d) => d.msg || d).join(', ')
            : 'Validation error in history request';
        return reject(new Error(`Service history error: ${errors}`));
      }

      if (res.statusCode === 429) {
        return reject(new Error('Rate limit exceeded for service history.'));
      }

      const detail = (body && body.detail) || `Unexpected HTTP status: ${res.statusCode}`;
      return reject(new Error(detail));
    });
  });
}

module.exports = { getServiceHistory };
