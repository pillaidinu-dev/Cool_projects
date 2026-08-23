import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

function otherUserId(match, viewerId) {
  return match.user_a_id === viewerId ? match.user_b_id : match.user_a_id;
}

router.get('/', requireAuth, (req, res) => {
  const matches = db
    .prepare('SELECT * FROM matches WHERE user_a_id = ? OR user_b_id = ? ORDER BY created_at DESC')
    .all(req.userId, req.userId);

  const result = matches.map((m) => {
    const otherId = otherUserId(m, req.userId);
    const other = db.prepare('SELECT id, name, bio FROM users WHERE id = ?').get(otherId);
    const plan = db.prepare('SELECT id, title, activity_type, location FROM plans WHERE id = ?').get(m.plan_id);
    const lastMessage = db
      .prepare('SELECT * FROM messages WHERE match_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(m.id);
    return {
      id: m.id,
      createdAt: m.created_at,
      otherUser: other,
      plan: plan
        ? { id: plan.id, title: plan.title, activityType: plan.activity_type, location: plan.location }
        : null,
      lastMessage: lastMessage ? { body: lastMessage.body, createdAt: lastMessage.created_at } : null,
    };
  });
  res.json({ matches: result });
});

function assertMatchAccess(matchId, userId, res) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return null;
  }
  if (match.user_a_id !== userId && match.user_b_id !== userId) {
    res.status(403).json({ error: 'You are not part of this match' });
    return null;
  }
  return match;
}

router.get('/:id/messages', requireAuth, (req, res) => {
  const match = assertMatchAccess(req.params.id, req.userId, res);
  if (!match) return;
  const messages = db
    .prepare('SELECT * FROM messages WHERE match_id = ? ORDER BY created_at ASC')
    .all(match.id);
  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
    })),
  });
});

router.post('/:id/messages', requireAuth, (req, res) => {
  const match = assertMatchAccess(req.params.id, req.userId, res);
  if (!match) return;
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const result = db
    .prepare('INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)')
    .run(match.id, req.userId, body.trim());
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    message: { id: message.id, senderId: message.sender_id, body: message.body, createdAt: message.created_at },
  });
});

export default router;
