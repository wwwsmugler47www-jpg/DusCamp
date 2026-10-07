import { ai } from "hatchable";

export const access = "public";
export const methods = ["POST"];

export default async function(req,res){
  const b=req.body||{};
  const lesson=String(b.lesson||"").trim();
  const topic=String(b.topic||"").trim();
  const count=Math.min(Math.max(Number(b.count)||10,1),30);
  const difficulty=String(b.difficulty||"Orta");

  if(!lesson||!topic){
    return res.status(400).json({error:"Ders ve konu gerekli."});
  }

  const prompt="Diş hekimliği ve DUS hazırlığı için Türkçe "+count+
    " adet çoktan seçmeli soru üret. Ders: "+lesson+
    ". Konu: "+topic+". Zorluk: "+difficulty+
    ". Her soru 5 şıklı A-E olsun. SADECE JSON döndür: "+
    "{questions:[{question,options,correct,explanation}]}. "+
    "options tam 5 elemanlı, correct A/B/C/D/E olsun.";

  try{
    // Google Gemini kullanıyoruz; Anthropic/Claude anahtarı gerektirmez.
    const out=await ai.generateText({
      model:"gemini",
      prompt,
      maxSteps:1,
      purpose:"DUS practice question generation"
    });

    const raw=typeof out==="string"?out:(out.text||out.output||"");
    const clean=raw
      .replace(/^\s*\`\`\`json\s*/,"")
      .replace(/\s*\`\`\`\s*$/,"")
      .trim();

    const data=JSON.parse(clean);

    if(!Array.isArray(data.questions)){
      throw new Error("Geçersiz AI çıktısı");
    }

    return res.json({
      lesson,
      topic,
      difficulty,
      questions:data.questions.slice(0,count)
    });
  }catch(e){
    return res.status(500).json({
      error:"AI soru üretimi başarısız oldu.",
      detail:String(e.message||e)
    });
  }
}