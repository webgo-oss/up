// Turns tasks into calendar events. Each task can produce several: uploaded, due, picked,
// submitted (one per attempt) and a review result (approved / redo / rejected) per attempt.
const MAX_DAYS = 70;

function parseRange(q) {
  const from = new Date(q.from);
  const to = new Date(q.to);
  if (isNaN(from) || isNaN(to) || to < from || to - from > MAX_DAYS * 86400000) return null;
  return { from, to };
}

// Mongo filter: any date on the task falls inside the range
function rangeFilter({ from, to }) {
  const r = { $gte: from, $lte: to };
  return {
    $or: [
      { createdAt: r },
      { dueDate: r },
      { claimedAt: r },
      { 'submissions.submittedAt': r },
      { 'submissions.review.reviewedAt': r },
    ],
  };
}

function buildEvents(tasks, { from, to, showWho }) {
  const out = [];
  const add = (t, type, at, allDay) => {
    if (!at || at < from || at > to) return;
    const person = showWho && t.assignee && t.assignee.name && type !== 'uploaded' && type !== 'due';
    out.push({
      id: `${t._id}:${type}:${+at}`,
      taskId: String(t._id),
      title: t.title,
      type,
      at: at.toISOString(),
      allDay: !!allDay, // due dates are whole days, not moments
      status: t.status,
      who: person ? t.assignee.name : undefined,
    });
  };
  tasks.forEach((t) => {
    add(t, 'uploaded', t.createdAt);
    if (t.dueDate) add(t, 'due', t.dueDate, true);
    add(t, 'picked', t.claimedAt);
    (t.submissions || []).forEach((s) => {
      add(t, 'submitted', s.submittedAt);
      if (s.review && s.review.decision) add(t, s.review.decision, s.review.reviewedAt);
    });
  });
  return out;
}

module.exports = { parseRange, rangeFilter, buildEvents };
