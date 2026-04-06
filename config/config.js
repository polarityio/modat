'use strict';

module.exports = {
  name: 'Modat Magnify',
  acronym: 'MOD',
  description:
    'Polarity integration for Modat Magnify — surfaces Host DNA profiles (device fingerprinting, open services, CVEs, geo/ASN context) for IPv4, IPv6, and domain entities.',
  entityTypes: ['IPv4', 'IPv6', 'domain'],
  defaultColor: 'light-blue',
  styles: ['./styles/styles.less'],
  block: {
    component: {
      file: './components/block.js'
    },
    template: {
      file: './templates/block.hbs'
    }
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: '',
    rejectUnauthorized: true
  },
  logging: {
    level: 'info'
  },
  onDemandOnly: false,
  options: [
    {
      key: 'apiKey',
      name: 'Modat API Key',
      description:
        'Your Modat Magnify API key. Obtain from https://magnify.modat.io. This key is passed in the Authorization header as "Bearer <apiKey>".',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
