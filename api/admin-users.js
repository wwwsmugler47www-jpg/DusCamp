function normalizeSupabaseUrl(value){const raw=String(value||"").trim().replace(/\/+$/,"");if(!raw)return"";try{return new URL(raw).origin}catch(_){return""}}
const SUPABASE_URL=normalizeSupabaseUrl(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL);
const SERVICE_KEY=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"").trim();
const ADMIN_EMAILS=String(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
async function sb(path){if(!SUPABASE_URL||!SERVICE_KEY)throw new Error("Supabase ortam değişkenleri eksik.");const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY}});const raw=await r.text();let d;try{d=raw?JSON.parse(raw):null}catch(_){d=raw}if(!r.ok)throw new Error(d?.message||d?.details||d?.hint||("Supabase "+r.status));return d}
export default async function(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const email=String(req.headers["x-user-email"]||req.query?.email||"").trim().toLowerCase();
 if(!email||!ADMIN_EMAILS.includes(email))return res.status(403).json({error:"Yönetici yetkisi gerekli."});
 try{
  const registry=await sb("user_registry?select=user_id,email,name,first_seen_at,last_seen_at&order=last_seen_at.desc.nullslast");
  const history=await sb("user_question_history?select=user_id,question_id,lesson,topic,is_correct,answered_at");
  const by={}; for(const u of registry||[])by[u.user_id]={...u,total_answers:0,correct_answers:0,wrong_answers:0,questions:new Set(),topics:new Set(),lessons:new Set()};
  for(const h of history||[]){const u=by[h.user_id]||(by[h.user_id]={user_id:h.user_id,email:"E-posta yok",name:"",first_seen_at:null,last_seen_at:null,total_answers:0,correct_answers:0,wrong_answers:0,questions:new Set(),topics:new Set(),lessons:new Set()});u.total_answers++;u.questions.add(String(h.question_id));if(h.is_correct)u.correct_answers++;else u.wrong_answers++;if(h.topic)u.topics.add(h.topic);if(h.lesson)u.lessons.add(h.lesson);if(h.answered_at&&(!u.last_seen_at||new Date(h.answered_at)>new Date(u.last_seen_at)))u.last_seen_at=h.answered_at}
  const users=Object.values(by).map(u=>({user_id:u.user_id,email:u.email,name:u.name,first_seen_at:u.first_seen_at,last_seen_at:u.last_seen_at,total_answers:u.total_answers,unique_questions:u.questions.size,topics_solved:u.topics.size,lessons_solved:u.lessons.size,correct_answers:u.correct_answers,wrong_answers:u.wrong_answers}));
  return res.json({totals:{registered:users.length,active_solvers:users.filter(u=>u.total_answers>0).length,total_answers:users.reduce((n,u)=>n+u.total_answers,0),unique_questions:new Set((history||[]).map(h=>String(h.question_id))).size},users});
 }catch(e){console.error("admin-users error:",e);return res.status(500).json({error:"Kullanıcı verileri alınamadı: "+(e.message||e)})}
}