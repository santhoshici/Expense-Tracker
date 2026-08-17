const mongoose = require('mongoose');

/**
 * Tracks per-user daily AI query usage.
 * One document per (userId, date) pair.
 * TTL index auto-deletes documents after 2 days.
 */
const UserAIQuotaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // YYYY-MM-DD string — makes daily bucketing simple and timezone-safe
  date: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
  // Used by TTL index — auto-deletes after 2 days
  expiresAt: {
    type: Date,
    default: () => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d;
    },
  },
});

// Compound unique index: one document per user per day
UserAIQuotaSchema.index({ userId: 1, date: 1 }, { unique: true });

// TTL index: MongoDB auto-removes expired documents
UserAIQuotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserAIQuota', UserAIQuotaSchema);
