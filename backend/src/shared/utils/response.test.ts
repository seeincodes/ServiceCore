import { Response } from 'express';
import { sendSuccess, sendError } from './response';

describe('response utils', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('sendSuccess', () => {
    it('sends 200 with success payload by default', () => {
      sendSuccess(res as Response, { id: '1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: '1' },
          timestamp: expect.any(String),
        }),
      );
    });

    it('sends given status code when provided', () => {
      sendSuccess(res as Response, { created: true }, 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('sendError', () => {
    it('sends 500 with error message by default', () => {
      sendError(res as Response, 'Something broke');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: 'Something broke',
          timestamp: expect.any(String),
        }),
      );
    });

    it('sends given status code when provided', () => {
      sendError(res as Response, 'Unauthorized', 401);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
