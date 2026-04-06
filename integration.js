'use strict';

const request = require('postman-request');
const fs = require('fs');
const Bottleneck = require('bottleneck');
const cache = require('memory-cache');

const { getHostDna, buildQuery } = require('./src/queries/getHostDna');
const { getServiceHistory } = require('./src/queries/getServiceHistory');
const { transformHostRecord, transformHistoryRecords, parseErrorToReadableJSON } = require('./src/dataTransformations');
const { createSummaryTags } = require('./src/createSummaryTags');
const { validateStringOptions } = require('./src/validateOptions');
const config = require('./config/config');

const IGNORED_IPS = new Set(['127.0.0.1', '255.255.255.255', '0.0.0.0']);

let Logger;
let requestWithDefaults;
let bottleneckApiKeyCache = new cache.Cache();

// ─── Bottleneck limiter ────────────────────────────────────────────────────
// Modat uses a 3-second sliding window rate limit. We use one Bottleneck
// instance per API key, processing one request at a time with 500ms spacing
// (≈ 2 req/sec, safely within the window).
function getLimiter(apiKey) {
  let limiter = bottleneckApiKeyCache.get(apiKey);
  if (!limiter) {
    limiter = new Bottleneck({
      id: apiKey,
      maxConcurrent: 1,
      highWater: 15,
      strategy: Bottleneck.strategy.OVERFLOW,
      minTime: 500
    });
    bottleneckApiKeyCache.put(apiKey, limiter);
  }
  return limiter;
}

// ─── startup ──────────────────────────────────────────────────────────────
function startup(logger) {
  Logger = logger;
  const defaults = {};

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0)
    defaults.cert = fs.readFileSync(config.request.cert);
  if (typeof config.request.key === 'string' && config.request.key.length > 0)
    defaults.key = fs.readFileSync(config.request.key);
  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0)
    defaults.passphrase = config.request.passphrase;
  if (typeof config.request.ca === 'string' && config.request.ca.length > 0)
    defaults.ca = fs.readFileSync(config.request.ca);
  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0)
    defaults.proxy = config.request.proxy;
  if (typeof config.request.rejectUnauthorized === 'boolean')
    defaults.rejectUnauthorized = config.request.rejectUnauthorized;

  requestWithDefaults = request.defaults(defaults);
  Logger.info('Modat Magnify integration started');
}

// ─── doLookup ─────────────────────────────────────────────────────────────
async function doLookup(entities, options, cb) {
  Logger.trace({ entities }, 'doLookup');

  const ignoredResults = [];
  const validEntities = entities.filter((entity) => {
    if (entity.isPrivateIP || IGNORED_IPS.has(entity.value)) {
      ignoredResults.push({ entity, data: null });
      return false;
    }
    return true;
  });

  if (validEntities.length === 0) {
    return cb(null, ignoredResults);
  }

  const limiter = getLimiter(options.apiKey);

  try {
    const lookupResults = await Promise.all(
      validEntities.map((entity) =>
        limiter.schedule(() => lookupEntity(entity, options))
      )
    );

    Logger.trace({ lookupResults }, 'doLookup results');
    cb(null, [...lookupResults, ...ignoredResults]);
  } catch (error) {
    const formattedError = parseErrorToReadableJSON(error);
    Logger.error({ error, formattedError }, 'doLookup failed');
    cb({ detail: error.message || 'Lookup failed', err: formattedError });
  }
}

/**
 * Perform a single entity lookup against Modat's /host/search/v1 endpoint.
 */
async function lookupEntity(entity, options) {
  const query = buildQuery(entity);
  let response;

  try {
    response = await getHostDna(query, 1, options, requestWithDefaults, Logger);
  } catch (error) {
    throw error;
  }

  const { total_records, total_pages, page } = response;

  if (!total_records || total_records === 0 || !page || page.length === 0) {
    return { entity, data: null };
  }

  const primaryHost = transformHostRecord(page[0]);
  const allHosts = page.map(transformHostRecord);
  const entityType = entity.isIP ? 'ip' : 'domain';

  return {
    entity,
    data: {
      summary: createSummaryTags(primaryHost, entityType, total_records),
      details: {
        entityType,
        primaryHost,
        allHosts,
        totalRecords: total_records,
        totalPages: total_pages,
        currentPage: 1,
        searchQuery: query
      }
    }
  };
}

// ─── onMessage ────────────────────────────────────────────────────────────
async function onMessage({ data }, options, cb) {
  const { action } = data;
  Logger.debug({ action }, 'onMessage received');

  if (action === 'GET_SERVICE_HISTORY') {
    const { ip, port, transport } = data;
    try {
      const response = await getServiceHistory(
        ip,
        port,
        transport,
        options,
        requestWithDefaults,
        Logger
      );
      const history = transformHistoryRecords(response.history || []);
      return cb(null, { history });
    } catch (error) {
      const formattedError = parseErrorToReadableJSON(error);
      Logger.error({ error, formattedError }, 'GET_SERVICE_HISTORY failed');
      return cb({ detail: error.message || 'Failed to load service history', err: formattedError });
    }
  }

  if (action === 'LOAD_MORE_HOSTS') {
    const { query, page } = data;
    try {
      const response = await getHostDna(query, page, options, requestWithDefaults, Logger);
      const hosts = (response.page || []).map(transformHostRecord);
      return cb(null, {
        hosts,
        currentPage: response.page_nr,
        totalPages: response.total_pages,
        totalRecords: response.total_records
      });
    } catch (error) {
      const formattedError = parseErrorToReadableJSON(error);
      Logger.error({ error, formattedError }, 'LOAD_MORE_HOSTS failed');
      return cb({ detail: error.message || 'Failed to load more hosts', err: formattedError });
    }
  }

  return cb({ detail: `Unknown action: ${action}` });
}

// ─── validateOptions ──────────────────────────────────────────────────────
function validateOptions(options, cb) {
  const errors = validateStringOptions(
    {
      apiKey: 'You must provide a valid Modat API Key.'
    },
    options
  );
  cb(null, errors);
}

module.exports = {
  startup,
  doLookup,
  onMessage,
  validateOptions
};
