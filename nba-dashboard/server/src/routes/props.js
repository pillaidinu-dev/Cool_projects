import { Router } from 'express';
import { listSlateDates, readHistory, readLatest, readSlate } from '../store.js';

const router = Router();

router.get('/latest', async (req, res) => res.json(await readLatest()));
router.get('/history', async (req, res) => res.json(await readHistory()));
router.get('/dates', async (req, res) => res.json({ dates: await listSlateDates() }));

router.get('/date/:date', async (req, res) => {
  const slate = await readSlate(req.params.date);
  if (!slate) return res.status(404).json({ error: `No saved slate for ${req.params.date}` });
  res.json(slate);
});

export default router;
