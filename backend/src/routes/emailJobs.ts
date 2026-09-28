import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { getEmailJobs } from '../utils/email.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), (_req: AuthRequest, res: Response) => {
  res.json(getEmailJobs());
});

export default router;
