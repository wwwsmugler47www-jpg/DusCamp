import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function(req,res){
  const {rows}=await db.query(
    "SELECT id,email,message,created_at FROM user_feedback ORDER BY created_at DESC LIMIT 200"
  );
  return res.json({feedback:rows});
}