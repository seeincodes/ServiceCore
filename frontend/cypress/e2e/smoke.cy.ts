describe('ServiceCore smoke', () => {
  it('loads the app shell', () => {
    cy.visit('/');
    cy.get('app-root', { timeout: 15000 }).should('exist');
    cy.contains('Hello, frontend').should('be.visible');
  });
});
