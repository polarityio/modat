# Modat Magnify — Polarity Integration

Surfaces **Host DNA** profiles from [Modat Magnify](https://magnify.modat.io) directly in the Polarity overlay. For any IPv4, IPv6, or domain entity, the integration returns device fingerprinting tags, open services, CVE exposures (with CISA KEV flag), and geolocation/ASN context.

## Entity Types Supported

| Entity | Query |
|--------|-------|
| IPv4 Address | `ip:"<value>"` → `/host/search/v1` |
| IPv6 Address | `ip:"<value>"` → `/host/search/v1` |
| Domain / FQDN | `fqdn:"<value>"` → `/host/search/v1` |

## Features

- **Host DNA Header** — IP, location, ASN org, anycast flag, hostnames
- **Threat Classification** — Color-coded tag pills (red: C2/Malicious/Honeypot, orange: IoT/SCADA/ICS, yellow: VPN/Proxy)
- **Vulnerabilities** — CVE table with CVSS severity coloring, KEV badges, and NVD deep links
- **Open Services** — Sorted port list with on-demand **90-day scan history** per port
- **All Hosts** (domain entities) — Paginated host list with "Load More" expansion
- **Polarity Assistant** — AI reducer pipeline included for LLM summarization

## Installation

1. Clone this repository into your Polarity integrations folder.
2. Run `npm install` from the integration directory.
3. Navigate to **Settings → Integrations → Modat Magnify** in the Polarity UI.
4. Enter your **Modat API Key** (see below).

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| Modat API Key | Password | Your Modat Magnify API key. Obtain from [https://magnify.modat.io](https://magnify.modat.io). |

## Getting an API Key

1. Sign up or log in at [https://magnify.modat.io](https://magnify.modat.io)
2. Navigate to **Account → API Keys**
3. Create a new key and paste it into the Polarity integration settings

## Rate Limiting

The Modat API uses a sliding 3-second window per subscription tier. This integration uses [Bottleneck](https://github.com/SGrondin/bottleneck) to enforce a maximum of ~2 requests/second per API key, safely within the limit.

## Architecture

```
integration.js                  ← Entry point: startup, doLookup, onMessage, validateOptions
src/
  queries/
    getHostDna.js               ← POST /host/search/v1
    getServiceHistory.js        ← POST /service/history/v1
  dataTransformations.js        ← Tag colors, CVSS severity, date formatting
  createSummaryTags.js          ← Summary tag builder
  validateOptions.js            ← Option validation
config/
  config.js                     ← Runtime config manifest
  config.json                   ← Installation manifest (polarityIntegrationUuid: c183e2af-ab5c-4e0e-8f88-cea038ebe20c)
components/block.js             ← Ember component: state, service history, load-more actions
templates/block.hbs             ← Handlebars UI template
styles/styles.less              ← Scoped LESS styles
reducers/details.json           ← Polarity Assistant AI reducer pipeline
```

## Prior Art

This integration's architecture (Bottleneck rate limiter, `postman-request` HTTP client, port/tag/CVE summary tags) is modeled after [polarityio/shodan](https://github.com/polarityio/shodan).

## Changelog

### 1.0.0
- Initial release
- Host DNA lookup for IPv4, IPv6, and domain entities
- On-demand service history per port (90-day lookback)
- Domain multi-host paginated expansion
