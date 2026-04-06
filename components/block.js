polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  primaryHost: Ember.computed.alias('block.data.details.primaryHost'),

  // ─── Computed: collapsible section visibility defaults ─────────────────
  // Sections open by default when they contain data.

  hasTags: Ember.computed('primaryHost.hasTags', function () {
    return !!this.get('primaryHost.hasTags');
  }),

  hasCves: Ember.computed('primaryHost.hasCves', function () {
    return !!this.get('primaryHost.hasCves');
  }),

  hasServices: Ember.computed('primaryHost.hasServices', function () {
    return !!this.get('primaryHost.hasServices');
  }),

  isDomain: Ember.computed('details.entityType', function () {
    return this.get('details.entityType') === 'domain';
  }),

  hasMultipleHosts: Ember.computed('details.totalRecords', 'isDomain', function () {
    return this.get('isDomain') && this.get('details.totalRecords') > 1;
  }),

  // ─── Computed: all hosts (initial + loaded via LOAD_MORE) ─────────────
  displayedHosts: Ember.computed(
    'details.allHosts',
    'block._state.additionalHosts.[]',
    function () {
      const initial = this.get('details.allHosts') || [];
      const additional = this.get('block._state.additionalHosts') || [];
      return [...initial, ...additional];
    }
  ),

  hasMoreHosts: Ember.computed(
    'block._state.displayedPage',
    'details.totalPages',
    function () {
      const displayed = this.get('block._state.displayedPage') || 1;
      const total = this.get('details.totalPages') || 1;
      return displayed < total;
    }
  ),

  showingCount: Ember.computed('displayedHosts.length', function () {
    return this.get('displayedHosts.length') || 0;
  }),

  // ─── Computed: deep link to Modat Magnify ─────────────────────────────
  modatSearchUrl: Ember.computed('block.entity.value', 'details.entityType', function () {
    const value = this.get('block.entity.value');
    const entityType = this.get('details.entityType');
    if (!value) return 'https://magnify.modat.io';
    const query = entityType === 'ip' ? `ip:"${value}"` : `fqdn:"${value}"`;
    return `https://magnify.modat.io/search?query=${encodeURIComponent(query)}`;
  }),

  // ─── init ──────────────────────────────────────────────────────────────
  init() {
    this._super(...arguments);
    if (!this.get('block._state')) {
      this.set('block._state', {
        showTags: !!this.get('primaryHost.hasTags'),
        showCves: !!this.get('primaryHost.hasCves'),
        showServices: true,
        showAllHosts: false,
        additionalHosts: [],
        displayedPage: 1,
        isLoadingMoreHosts: false,
        loadMoreError: null
      });
    }
  },

  actions: {
    // ─── Toggle collapsible sections ──────────────────────────────────
    toggleSection(section) {
      const key = `block._state.show${section}`;
      this.set(key, !this.get(key));
    },

    // ─── Toggle service history for a specific port row ───────────────
    // The `service` argument is a plain object from details.primaryHost.services[].
    // Ember.set() is used so Polarity re-renders when we mutate state.
    toggleServiceHistory(service) {
      // If already loaded, just toggle visibility
      if (service.historyLoaded) {
        Ember.set(service, 'historyVisible', !service.historyVisible);
        this.get('block').notifyPropertyChange('data');
        return;
      }

      const ip = this.get('primaryHost.ip');
      Ember.set(service, 'isLoadingHistory', true);
      this.get('block').notifyPropertyChange('data');

      this.sendIntegrationMessage({
        data: {
          action: 'GET_SERVICE_HISTORY',
          ip,
          port: service.port,
          transport: service.transport
        }
      })
        .then((response) => {
          Ember.set(service, 'history', response.history || []);
          Ember.set(service, 'historyLoaded', true);
          Ember.set(service, 'historyVisible', true);
          Ember.set(service, 'isLoadingHistory', false);
          Ember.set(service, 'historyError', null);
        })
        .catch((err) => {
          const msg =
            (err.meta && err.meta.detail) ||
            err.message ||
            'Failed to load service history';
          Ember.set(service, 'historyError', msg);
          Ember.set(service, 'historyLoaded', true);
          Ember.set(service, 'historyVisible', true);
          Ember.set(service, 'isLoadingHistory', false);
        })
        .finally(() => {
          this.get('block').notifyPropertyChange('data');
        });
    },

    // ─── Load next page of hosts (domain only) ─────────────────────────
    loadMoreHosts() {
      const nextPage = (this.get('block._state.displayedPage') || 1) + 1;
      const query = this.get('details.searchQuery');

      this.set('block._state.isLoadingMoreHosts', true);
      this.set('block._state.loadMoreError', null);
      this.get('block').notifyPropertyChange('data');

      this.sendIntegrationMessage({
        data: {
          action: 'LOAD_MORE_HOSTS',
          query,
          page: nextPage
        }
      })
        .then((response) => {
          const existing = this.get('block._state.additionalHosts') || [];
          this.set('block._state.additionalHosts', [...existing, ...(response.hosts || [])]);
          this.set('block._state.displayedPage', nextPage);
        })
        .catch((err) => {
          const msg =
            (err.meta && err.meta.detail) || err.message || 'Failed to load more hosts';
          this.set('block._state.loadMoreError', msg);
        })
        .finally(() => {
          this.set('block._state.isLoadingMoreHosts', false);
          this.get('block').notifyPropertyChange('data');
        });
    }
  }
});
