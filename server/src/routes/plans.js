import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

function hostSummary(hostId) {
  const u = db.prepare('SELECT id, name, bio FROM users WHERE id = ?').get(hostId);
  return u ? { id: u.id, name: u.name, bio: u.bio } : null;
}

function serializePlan(plan, viewerId) {
  const acceptedCount = db
    .prepare("SELECT COUNT(*) AS c FROM plan_joins WHERE plan_id = ? AND status = 'accepted'")
    .get(plan.id).c;
  const myJoin = viewerId
    ? db.prepare('SELECT * FROM plan_joins WHERE plan_id = ? AND user_id = ?').get(plan.id, viewerId)
    : null;
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    activityType: plan.activity_type,
    location: plan.location,
    planTime: plan.plan_time,
    capacity: plan.capacity,
    status: plan.status,
    createdAt: plan.created_at,
    host: hostSummary(plan.host_id),
    isHost: viewerId === plan.host_id,
    acceptedCount,
    spotsLeft: Math.max(plan.capacity - acceptedCount, 0),
    myJoinStatus: myJoin ? myJoin.status : null,
  };
}

// Create a plan
router.post('/', requireAuth, (req, res) => {
  const { title, description, activityType, location, planTime, capacity } = req.body || {};
  if (!title || !activityType || !location || !planTime) {
    return res.status(400).json({ error: 'title, activityType, location, and planTime are required' });
  }
  const result = db
    .prepare(
      `INSERT INTO plans (host_id, title, description, activity_type, location, plan_time, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, title, description || '', activityType, location, planTime, capacity || 1);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ plan: serializePlan(plan, req.userId) });
});

// Browse open plans (excludes my own)
router.get('/', requireAuth, (req, res) => {
  const { activityType } = req.query;
  let sql = "SELECT * FROM plans WHERE status = 'open' AND host_id != ?";
  const params = [req.userId];
  if (activityType) {
    sql += ' AND activity_type = ?';
    params.push(activityType);
  }
  sql += ' ORDER BY plan_time ASC';
  const plans = db.prepare(sql).all(...params);
  res.json({ plans: plans.map((p) => serializePlan(p, req.userId)) });
});

// Plans I'm hosting
router.get('/mine', requireAuth, (req, res) => {
  const plans = db
    .prepare('SELECT * FROM plans WHERE host_id = ? ORDER BY plan_time ASC')
    .all(req.userId);
  res.json({ plans: plans.map((p) => serializePlan(p, req.userId)) });
});

// Plans I've been accepted into
router.get('/joined', requireAuth, (req, res) => {
  const plans = db
    .prepare(
      `SELECT plans.* FROM plans
       JOIN plan_joins ON plan_joins.plan_id = plans.id
       WHERE plan_joins.user_id = ? AND plan_joins.status = 'accepted'
       ORDER BY plans.plan_time ASC`
    )
    .all(req.userId);
  res.json({ plans: plans.map((p) => serializePlan(p, req.userId)) });
});

router.get('/:id', requireAuth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan: serializePlan(plan, req.userId) });
});

// Request to join a plan
router.post('/:id/join', requireAuth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (plan.host_id === req.userId) return res.status(400).json({ error: "You can't join your own plan" });

  const existing = db
    .prepare('SELECT * FROM plan_joins WHERE plan_id = ? AND user_id = ?')
    .get(plan.id, req.userId);
  if (existing) return res.status(409).json({ error: `You already have a ${existing.status} request for this plan` });

  db.prepare('INSERT INTO plan_joins (plan_id, user_id) VALUES (?, ?)').run(plan.id, req.userId);
  res.status(201).json({ plan: serializePlan(plan, req.userId) });
});

// Host: list join requests for a plan
router.get('/:id/joins', requireAuth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (plan.host_id !== req.userId) return res.status(403).json({ error: 'Only the host can view join requests' });

  const joins = db
    .prepare(
      `SELECT plan_joins.*, users.name AS user_name, users.bio AS user_bio
       FROM plan_joins JOIN users ON users.id = plan_joins.user_id
       WHERE plan_joins.plan_id = ? ORDER BY plan_joins.created_at ASC`
    )
    .all(plan.id);
  res.json({
    joins: joins.map((j) => ({
      id: j.id,
      status: j.status,
      createdAt: j.created_at,
      user: { id: j.user_id, name: j.user_name, bio: j.user_bio },
    })),
  });
});

// Host: accept or decline a join request
router.post('/:id/joins/:joinId/respond', requireAuth, (req, res) => {
  const { accept } = req.body || {};
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (plan.host_id !== req.userId) return res.status(403).json({ error: 'Only the host can respond to requests' });

  const join = db.prepare('SELECT * FROM plan_joins WHERE id = ? AND plan_id = ?').get(req.params.joinId, plan.id);
  if (!join) return res.status(404).json({ error: 'Join request not found' });

  if (accept) {
    const acceptedCount = db
      .prepare("SELECT COUNT(*) AS c FROM plan_joins WHERE plan_id = ? AND status = 'accepted'")
      .get(plan.id).c;
    if (acceptedCount >= plan.capacity) {
      return res.status(400).json({ error: 'This plan is already at capacity' });
    }
  }
  db.prepare('UPDATE plan_joins SET status = ? WHERE id = ?').run(accept ? 'accepted' : 'declined', join.id);
  res.json({ join: { id: join.id, status: accept ? 'accepted' : 'declined' } });
});

function isPlanParticipant(plan, userId) {
  if (plan.host_id === userId) return true;
  const join = db
    .prepare("SELECT 1 FROM plan_joins WHERE plan_id = ? AND user_id = ? AND status = 'accepted'")
    .get(plan.id, userId);
  return Boolean(join);
}

// Confirm you actually met up with another participant at this plan.
// Once both sides confirm each other, a match is created.
router.post('/:id/confirm-attendance', requireAuth, (req, res) => {
  const { withUserId } = req.body || {};
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (!withUserId || withUserId === req.userId) {
    return res.status(400).json({ error: 'withUserId is required and must be a different user' });
  }
  if (!isPlanParticipant(plan, req.userId) || !isPlanParticipant(plan, withUserId)) {
    return res.status(403).json({ error: 'Both users must be participants (host or accepted) on this plan' });
  }

  db.prepare(
    'INSERT OR IGNORE INTO plan_attendance (plan_id, confirmer_id, confirmed_user_id) VALUES (?, ?, ?)'
  ).run(plan.id, req.userId, withUserId);

  const reciprocal = db
    .prepare(
      'SELECT 1 FROM plan_attendance WHERE plan_id = ? AND confirmer_id = ? AND confirmed_user_id = ?'
    )
    .get(plan.id, withUserId, req.userId);

  let match = null;
  if (reciprocal) {
    const [userAId, userBId] = [req.userId, withUserId].sort((a, b) => a - b);
    db.prepare(
      'INSERT OR IGNORE INTO matches (plan_id, user_a_id, user_b_id) VALUES (?, ?, ?)'
    ).run(plan.id, userAId, userBId);
    match = db
      .prepare('SELECT * FROM matches WHERE plan_id = ? AND user_a_id = ? AND user_b_id = ?')
      .get(plan.id, userAId, userBId);
  }

  res.json({ matched: Boolean(reciprocal), match });
});

export default router;
