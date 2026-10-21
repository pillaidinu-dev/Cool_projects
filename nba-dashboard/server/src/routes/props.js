import { Router } from 'express';
import { listSlateDates, readHistory, readLatest, readSlate } from '../store.js';

const router = Router();

router.get('/latest', (req, res) => res.json(readLatest()));
router.get('/history', (req, res) => res.json(readHistory()));
router.get('/dates', (req, res) => res.json({ dates: listSlateDates() }));

router.get('/date/:date', (req, res) => {
  const slate = readSlate(req.params.date);
  if (!slate) return res.status(404).json({ error: `No saved slate for ${req.params.date}` });
  res.json(slate);
});

export default router;
