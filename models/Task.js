const mongoose = require('mongoose');
const { Schema } = mongoose;

const submissionSchema = new Schema({
  image: { type: String, required: true },
  hashtags: [String],
  keywords: [String],
  note: { type: String, default: '', maxlength: 500 },
  submittedAt: { type: Date, default: Date.now },
  review: {
    decision: { type: String, enum: ['approved', 'redo', 'rejected'] },
    comment: { type: String, default: '', maxlength: 1000 },
    reviewedAt: Date,
    newDueDate: Date, // set when a redo also moved the deadline
  },
});

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    brief: { type: String, default: '', trim: true, maxlength: 1000 },
    image: { type: String, required: true }, // admin's reference image
    dueDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'submitted', 'redo', 'approved', 'rejected'],
      default: 'open',
      index: true,
    },
    claimedAt: Date,
    submissions: [submissionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
