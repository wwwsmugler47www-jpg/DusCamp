import { db } from "hatchable";
export const access="admin";
export const methods=["GET"];
export default async function(req,res){
 const id=String(req.query?.user_id||"").trim();
 if(!id)return res.status(400).json({error:"user_id gerekli"});
 const user=await db.query("SELECT user_id,email,name,first_seen_at,last_seen_at FROM user_registry WHERE user_id=$1",[id]);
 if(!user.rows.length)return res.status(404).json({error:"Kullanıcı bulunamadı"});
 const stats=await db.query(`SELECT lesson,topic,COUNT(*)::int AS answers,COUNT(DISTINCT question_id)::int AS unique_questions,COUNT(*) FILTER(WHERE is_correct)::int AS correct,COUNT(*) FILTER(WHERE is_correct=false)::int AS wrong FROM user_question_history WHERE user_id=$1 GROUP BY lesson,topic ORDER BY lesson,topic`,[id]);
 return res.json({user:user.rows[0],stats:stats.rows});
}