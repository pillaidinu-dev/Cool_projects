import { Router } from 'express';
import { getQuote, normalizeSymbol, isValidSymbol } from '../prices.js';

const router = Router();

// Used by the add-position form to show the ticker's name and live price
// before saving.
router.get('/:symbol', async (req, res, next) => {
  const symbol = normalizeSymbol(req.params.symbol);
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid ticker symbol.' });
  try {
    res.json(await getQuote(symbol));
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: `Couldn't find ticker ${symbol}.` });
    next(err);
  }
});

export default router;
