import { db } from "hatchable";

export const access = "user";
export const methods = ["POST"];

export default async function(req,res){
  const userId=req.user.id;
  const email=req.user.email||"";
  const message=String(req.body?.message||"").trim();

  if(!message) return res.status(400).json({error:"Öneri boş olamaz."});
  if(message.length>1000) return res.status(400).json({error:"Öneri en fazla 1000 karakter olabilir."});

  await db.query(
    "INSERT INTO user_feedback(user_id,email,message) VALUES($1,$2,$3)",
    [userId,email,message]
  );

  return res.json({ok:true});
}