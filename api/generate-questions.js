import { ai } from "hatchable";
export const access="public";
export const methods=["POST"];

const SYSTEM=`Sen DUS (Diş Hekimliğinde Uzmanlık Sınavı) soru yazarı gibi çalışırsın.
Görevin verilen kaynak metne SADIK kalarak gerçek DUS tarzında, klinik ayrım ve bilgi yorumlamayı ölçen, orta-üst zorlukta çoktan seçmeli sorular üretmektir.
Kaynakta olmayan bilgiyi soru için uydurma. Kaynakta çelişki varsa en güvenilir ve standart bilimsel bilgiyi kullan; ancak kaynak dışı ayrıntıyı gereksiz ekleme.
Sorular ezber cümlesi kopyalamak yerine vaka, bulgu, klinik karar, ayırıcı özellik, mekanizma, endikasyon/kontrendikasyon ve uygulama bilgisini ölçsün.
Her soru 5 seçenekli A-E olsun. Çeldiriciler aynı konu alanında, makul ve birbirine yakın olsun; bariz saçma seçenek kullanma.
Doğru cevaplar A,B,C,D,E arasında olabildiğince dengeli ve rastgele dağıtılsın; art arda aynı doğru şıkkı mümkün olduğunca kullanma.
Sorular birbirini tekrar etmesin.
Yalnızca geçerli JSON dizi döndür. Markdown, açıklama veya kod bloğu döndürme.
Her nesne şu alanlara sahip olsun:
lesson, topic, question_group, question, options, correct, difficulty, explanation.
options tam 5 elemanlı dizi; correct yalnızca A/B/C/D/E; difficulty "Orta-Üst".`;

export default async function(req,res){
  try{
    const b=req.body||{};
    const count=Math.max(1,Math.min(100,Number(b.count)||10));
    const source=String(b.source||"").trim();
    if(!source)return res.status(400).json({error:"Kaynak metni gerekli."});
    if(source.length<100)return res.status(400).json({error:"Kaynak çok kısa. Daha kapsamlı bir kaynak ekle."});
    const lesson=String(b.lesson||"Genel").trim();
    const topic=String(b.topic||"Genel").trim();
    const group=String(b.question_group||topic||"Genel").trim();
    const prompt=SYSTEM+"\\n\\nDers: "+lesson+"\\nKonu: "+topic+"\\nKonu grubu: "+group+"\\nİstenen soru sayısı: "+count+"\\n\\nKAYNAK:\\n"+source;
    const out=await ai.generateText({model:"gpt-5",prompt});
    const text=typeof out==="string"?out:(out.text||out.output_text||out.result||"");
    let cleaned=String(text).trim().replace(/^\\s*\`\`\`(?:json)?\\s*/i,"").replace(/\\s*\`\`\`\\s*$/,"");
    const a=cleaned.indexOf("["),z=cleaned.lastIndexOf("]");
    if(a>=0&&z>a)cleaned=cleaned.slice(a,z+1);
    const data=JSON.parse(cleaned);
    if(!Array.isArray(data))throw Error("AI geçerli JSON dizisi üretmedi.");
    const normalized=data.slice(0,count).map(q=>({
      lesson:String(q.lesson||lesson).trim(),
      topic:String(q.topic||topic).trim(),
      question_group:String(q.question_group||group).trim(),
      question:String(q.question||"").trim(),
      options:Array.isArray(q.options)?q.options.map(x=>String(x).trim()):[],
      correct:String(q.correct||"").trim().toUpperCase(),
      difficulty:"Orta-Üst",
      explanation:String(q.explanation||"").trim()
    }));
    if(normalized.some(q=>!q.question||q.options.length!==5||q.options.some(x=>!x)||!["A","B","C","D","E"].includes(q.correct)))throw Error("Üretilen sorulardan en az biri geçersiz.");
    return res.json({questions:normalized,count:normalized.length});
  }catch(e){
    return res.status(500).json({error:e.message||"Soru üretilemedi."});
  }
}