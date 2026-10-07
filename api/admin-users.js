import { db } from "hatchable";
export const access="admin";
export const methods=["GET"];
export default async function(req,res){
 const users=await db.query(`
  SELECT r.user_id,r.email,r.name,r.first_seen_at,r.last_seen_at,
         COUNT(h.id)::int AS total_answers,
         COUNT(DISTINCT h.question_id)::int AS unique_questions,
         COUNT(DISTINCT NULLIF(h.lesson,''))::int AS lessons_solved,
         COUNT(DISTINCT NULLIF(h.lesson||' / '||h.topic,''))::int AS topics_solved,
         COUNT(*) FILTER (WHERE h.is_correct)::int AS correct_answers,
         COUNT(*) FILTER (WHERE h.is_correct=false)::int AS wrong_answers
  FROM user_registry r
  LEFT JOIN user_question_history h ON h.user_id=r.user_id
  GROUP BY r.user_id,r.email,r.name,r.first_seen_at,r.last_seen_at
  ORDER BY r.last_seen_at DESC
 `);
 const activity=await db.query(`
  SELECT TO_CHAR(DATE_TRUNC('day',occurred_at),'YYYY-MM-DD') AS day, COUNT(DISTINCT user_id)::int AS unique_users
  FROM user_login_events
  WHERE occurred_at >= NOW() - INTERVAL '12 months'
  GROUP BY 1 ORDER BY 1
 `);
 const monthly=await db.query(`
  SELECT TO_CHAR(DATE_TRUNC('month',occurred_at),'YYYY-MM') AS month, COUNT(DISTINCT user_id)::int AS unique_users
  FROM user_login_events
  WHERE occurred_at >= NOW() - INTERVAL '24 months'
  GROUP BY 1 ORDER BY 1
 `);
 const weekly=await db.query(`
  SELECT TO_CHAR(DATE_TRUNC('week',occurred_at),'YYYY-MM-DD') AS week, COUNT(DISTINCT user_id)::int AS unique_users
  FROM user_login_events
  WHERE occurred_at >= NOW() - INTERVAL '12 weeks'
  GROUP BY 1 ORDER BY 1
 `);
 const totals=await db.query(`
  SELECT COUNT(*)::int AS registered,
         COUNT(DISTINCT h.user_id)::int AS active_solvers,
         COUNT(h.id)::int AS total_answers,
         COUNT(DISTINCT h.question_id)::int AS unique_questions
  FROM user_registry r
  LEFT JOIN user_question_history h ON h.user_id=r.user_id
 `);
 return res.json({users:users.rows,totals:totals.rows[0],activity:activity.rows,weekly:weekly.rows,monthly:monthly.rows});
}