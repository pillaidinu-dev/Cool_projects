import { Router } from 'express';
import { readPredictions } from '../predictions.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(readPredictions());
});

export default router;
