describe('Offline Clock In/Out', () => {
  beforeEach(() => {
    cy.request('POST', 'http://localhost:3000/auth/login', {
      email: 'driver1@greenwaste.com',
      password: 'password123',
    }).then((res) => {
      window.localStorage.setItem('tk_token', res.body.data.token);
    });
  });

  it('should queue clock-in when offline and show pending indicator', () => {
    cy.visit('/clock');
    cy.get('.clock-btn').should('exist');

    // Go offline before clicking clock-in
    cy.window().then((win) => {
      cy.stub(win.navigator, 'onLine').value(false);
      win.dispatchEvent(new Event('offline'));
    });

    // Intercept the clock-in API to simulate network failure
    cy.intercept('POST', '**/timesheets/clock-in', { forceNetworkError: true }).as('clockIn');

    cy.get('.clock-btn').first().click();

    // Should show offline success toast
    cy.get('.toast.success').should('contain', 'offline');

    // Should show pending entries indicator
    cy.get('.offline-pending').should('contain', '1');

    // UI should reflect clocked-in state
    cy.get('.status-dot.in').should('exist');
  });

  it('should queue clock-out when offline and show pending indicator', () => {
    // First clock in while online
    cy.visit('/clock');
    cy.get('.clock-btn').should('exist');

    // Intercept clock-in to succeed
    cy.intercept('POST', '**/timesheets/clock-in').as('clockIn');
    cy.get('.clock-btn').first().click();
    cy.wait('@clockIn');
    cy.get('.toast.success').should('exist');

    // Now go offline
    cy.window().then((win) => {
      cy.stub(win.navigator, 'onLine').value(false);
      win.dispatchEvent(new Event('offline'));
    });

    // Intercept clock-out API to simulate network failure
    cy.intercept('POST', '**/timesheets/clock-out', { forceNetworkError: true }).as('clockOut');

    // Click break button
    cy.get('.clock-out-break').click();

    // Should show offline success toast
    cy.get('.toast.success').should('contain', 'offline');

    // Should show pending entries indicator
    cy.get('.offline-pending').should('exist');

    // UI should reflect clocked-out state
    cy.get('.status-dot.in').should('not.exist');
  });

  it('should sync queued entries when coming back online', () => {
    cy.visit('/clock');
    cy.get('.clock-btn').should('exist');

    // Go offline
    cy.window().then((win) => {
      cy.stub(win.navigator, 'onLine').value(false);
      win.dispatchEvent(new Event('offline'));
    });

    // Intercept clock-in to fail
    cy.intercept('POST', '**/timesheets/clock-in', { forceNetworkError: true }).as('clockIn');

    cy.get('.clock-btn').first().click();
    cy.get('.toast.success').should('contain', 'offline');
    cy.get('.offline-pending').should('contain', '1');

    // Come back online — restore navigator.onLine and intercept sync
    cy.window().then((win) => {
      // Restore onLine property
      Object.defineProperty(win.navigator, 'onLine', { value: true, writable: true });
    });

    cy.intercept('POST', '**/timesheets/sync', {
      statusCode: 200,
      body: {
        success: true,
        data: { syncedCount: 1, errors: [] },
        timestamp: new Date().toISOString(),
      },
    }).as('sync');

    cy.intercept('GET', '**/timesheets/status', {
      statusCode: 200,
      body: {
        success: true,
        data: { clockedIn: true, todayHours: 0, entryId: 'test-entry' },
      },
    }).as('statusReload');

    // Trigger online event
    cy.window().then((win) => {
      win.dispatchEvent(new Event('online'));
    });

    // Sync should fire
    cy.wait('@sync');

    // Pending indicator should clear after sync
    cy.get('.offline-pending').should('not.exist');
  });

  it('should handle normal clock-in when online (no regression)', () => {
    cy.visit('/clock');
    cy.get('.clock-btn').should('exist');

    cy.intercept('POST', '**/timesheets/clock-in').as('clockIn');

    cy.get('.clock-btn').first().click();
    cy.wait('@clockIn');

    // Should show online success toast (not offline message)
    cy.get('.toast.success').should('exist');
    cy.get('.toast.success').should('not.contain', 'offline');

    // No pending indicator should appear
    cy.get('.offline-pending').should('not.exist');
  });
});
