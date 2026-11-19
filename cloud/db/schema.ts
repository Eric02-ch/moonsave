import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const financialSnapshots = sqliteTable('financial_snapshots', {
  userId: text('user_id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull()
});
export const aiFeedbackCache=sqliteTable('ai_feedback_cache',{
  userId:text('user_id').notNull(),cacheKey:text('cache_key').notNull(),
  result:text('result').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.cacheKey]})]);
export const aiFeedbackUsage=sqliteTable('ai_feedback_usage',{
  userId:text('user_id').notNull(),day:text('day').notNull(),attempts:integer('attempts').notNull(),lastStartedAt:integer('last_started_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.day]})]);
