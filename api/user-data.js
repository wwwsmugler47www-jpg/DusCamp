import { db } from "hatchable";
export const access = "user";
export const methods = ["GET","POST","DELETE"];
export default async function(req,res){
 const userId=req.user.id;
 const userEmail=req.user.email||"";
 const userName=req.user.name||"";
 await db.query("INSERT INTO user_registry(user_id,email,name) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,last_seen_at=NOW()",[userId,userEmail,userName]);
 await db.query("INSERT INTO user_login_events(user_id) VALUES($1)",[userId]);
 if(req.method==="GET"){
  const [h,f]=await Promise.all([
   db.query("SELECT id,question_id,lesson,topic,is_correct,answered_at FROM user_question_history WHERE user_id=$1 ORDER BY answered_at DESC LIMIT 20000",[userId]),
   db.query("SELECT question_id,created_at FROM user_favorites WHERE user_id=$1 ORDER BY created_at DESC",[userId])
  ]);
  const wrong=await db.query("SELECT q.id,q.lesson,q.topic,q.question_group,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.option_e,q.correct,h.answered_at FROM questions q JOIN (SELECT DISTINCT ON(question_id) question_id,lesson,topic,answered_at,is_correct FROM user_question_history WHERE user_id=$1 ORDER BY question_id,answered_at DESC) h ON h.question_id=q.id WHERE h.is_correct=false ORDER BY h.answered_at DESC LIMIT 200",[userId]);const fav=await db.query("SELECT q.id,q.lesson,q.topic,q.question_group,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.option_e,q.correct,f.created_at FROM questions q JOIN user_favorites f ON f.question_id=q.id WHERE f.user_id=$1 ORDER BY f.created_at DESC",[userId]);return res.json({history:h.rows,favorites:f.rows,wrongQuestions:wrong.rows,favoriteQuestions:fav.rows,user:req.user});
 }
 const b=req.body||{};
 if(req.method==="POST"&&b.action==="history"){
  if(!b.question_id)return res.status(400).json({error:"question_id gerekli"});
  await db.query("INSERT INTO user_question_history(user_id,question_id,lesson,topic,is_correct) VALUES($1,$2,$3,$4,$5)",[userId,b.question_id,b.lesson||"",b.topic||"",!!b.is_correct]);
  return res.json({ok:true});
 }
 if(req.method==="POST"&&b.action==="favorite"){
  if(!b.question_id)return res.status(400).json({error:"question_id gerekli"});
  await db.query("INSERT INTO user_favorites(user_id,question_id) VALUES($1,$2) ON CONFLICT(user_id,question_id) DO NOTHING",[userId,b.question_id]);
  return res.json({ok:true});
 }
 if(req.method==="DELETE"){
  if(!b.question_id)return res.status(400).json({error:"question_id gerekli"});
  await db.query("DELETE FROM user_favorites WHERE user_id=$1 AND question_id=$2",[userId,b.question_id]);
  return res.json({ok:true});
 }
 return res.status(400).json({error:"Geçersiz işlem"});
}