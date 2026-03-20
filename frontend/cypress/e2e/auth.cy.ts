describe('Auth Flow', () => {
  it('should redirect to login when not authenticated', () => {
    cy.visit('/clock');
    cy.url().should('include', '/login');
  });

  it('should show login page', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').should('exist');
    cy.get('input[type="password"]').should('exist');
    cy.get('button[type="submit"]').should('exist');
  });
});

describe('Clock In/Out Flow', () => {
  beforeEach(() => {
    // Login via API and set token
    cy.request('POST', 'http://localhost:3000/auth/login', {
      email: 'driver1@greenwaste.com',
      password: 'password123',
    }).then((res) => {
      window.localStorage.setItem('tk_token', res.body.data.token);
    });
  });

  it('should show clock button when authenticated', () => {
    cy.visit('/clock');
    cy.get('.clock-button').should('exist');
  });
});

describe('Manager Dashboard', () => {
  beforeEach(() => {
    cy.request('POST', 'http://localhost:3000/auth/login', {
      email: 'manager@greenwaste.com',
      password: 'password123',
    }).then((res) => {
      window.localStorage.setItem('tk_token', res.body.data.token);
    });
  });

  it('should show driver dashboard', () => {
    cy.visit('/manager');
    cy.get('.dashboard').should('exist');
    cy.get('.dashboard-header h1').should('contain', 'Driver Dashboard');
  });
});
