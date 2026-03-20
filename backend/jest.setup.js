// Run before tests so auth service (and other code) see consistent env
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
