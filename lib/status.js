const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In progress',
  submitted: 'Needs review',
  redo: 'Redo requested',
  approved: 'Approved',
  rejected: 'Rejected',
};
module.exports = { STATUS_LABEL, STATUSES: Object.keys(STATUS_LABEL) };
