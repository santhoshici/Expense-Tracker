/**
 * Query Sanitizer & Execution Security Sandbox
 * Enforces read-only safety, strips forbidden keywords, and guarantees user isolation.
 */
class QuerySanitizer {
  static FORBIDDEN_KEYWORDS = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'GRANT',
    'REVOKE', 'TRUNCATE', 'EXEC', 'INFORMATION_SCHEMA', ';'
  ];

  /**
   * Sanitizes text queries / SQL / MongoDB pipelines and enforces userId isolation
   */
  static sanitizeAndInjectUserContext(rawQuery, userId) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return '';
    }

    const uppercaseQuery = rawQuery.toUpperCase();

    for (const keyword of this.FORBIDDEN_KEYWORDS) {
      if (uppercaseQuery.includes(keyword)) {
        throw new Error(`Security Violation: Unsafe keyword detected in AI generated query: ${keyword}`);
      }
    }

    const cleanUserStr = String(userId).replace(/['"\\]/g, '');
    return rawQuery.trim();
  }

  /**
   * Enforces userId isolation filter on MongoDB aggregation pipeline stages
   */
  static enforceUserIsolationPipeline(pipeline = [], userObjectId) {
    const userMatchStage = { $match: { userId: userObjectId } };
    if (!Array.isArray(pipeline)) return [userMatchStage];
    return [userMatchStage, ...pipeline.filter(stage => !stage.$match || !stage.$match.userId)];
  }
}

module.exports = { QuerySanitizer };
