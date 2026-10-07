function aiPage(){
 app.innerHTML="<section class='card'><h2>🤖 ChatGPT ile DUS Sorusu Oluştur</h2><p class='muted'>Soruları ChatGPT'de topluca oluştur, sonra tek seferde DUSCamp'e aktar. Tek tek soru yapıştırmana gerek yok.</p><div class='form'><input id='aiLesson' placeholder='Ders: Endodonti'><input id='aiTopic' placeholder='Konu: İrrigasyon'><select id='aiDifficulty'><option>Orta</option><option>Kolay</option><option>Zor</option></select><select id='aiCount'><option>5</option><option selected>10</option><option>20</option><option>30</option><option>50</option></select><button class='primary' onclick='openChatGPT()'>💬 ChatGPT'de Oluştur</button></div><div id='aiResult'></div><hr><h3>📥 Soruları DUSCamp'e Aktar</h3><p class='muted'>ChatGPT'de oluşturduğun tüm soruları tek seferde kopyala veya JSON dosyasını yükle.</p><div class='form'><button onclick='importFromClipboard()'>📋 Panodan Toplu Aktar</button><input id='questionFile' type='file' accept='.json,.txt' onchange='importFromFile(this.files[0])'><button class='primary' onclick='saveImportedQuestions()' id='saveImportedBtn' disabled>💾 Soruları Soru Bankama Kaydet</button></div><div id='importResult'></div></section>";
}

let importedQuestions=[];

function buildPrompt(){
 const lesson=document.getElementById("aiLesson").value.trim();
 const topic=document.getElementById("aiTopic").value.trim();
 const difficulty=document.getElementById("aiDifficulty").value;
 const count=document.getElementById("aiCount").value;
 return "Diş hekimliği DUS hazırlığı için Türkçe "+count+" adet çoktan seçmeli soru hazırla. Ders: "+lesson+". Konu: "+topic+". Zorluk: "+difficulty+". Her soru 5 seçenekli A-E olsun. Her soru klinik/bilimsel açıdan doğru, DUS tarzında ve birbirinden farklı olsun. ÇIKTI KURALI: SADECE geçerli JSON döndür. Format bir JSON dizisi olsun: [{\"lesson\":\"...\",\"topic\":\"...\",\"question\":\"...\",\"options\":[\"A şıkkı\",\"B şıkkı\",\"C şıkkı\",\"D şıkkı\",\"E şıkkı\"],\"correct\":\"A\",\"difficulty\":\""+difficulty+"\",\"explanation\":\"...\"}].";
}

function openChatGPT(){
 const lesson=document.getElementById("aiLesson").value.trim();
 const topic=document.getElementById("aiTopic").value.trim();
 if(!lesson||!topic){document.getElementById("aiResult").innerHTML="<p class='wrong'>❌ Önce ders ve konu gir.</p>";return;}
 const prompt=buildPrompt();
 navigator.clipboard?.writeText(prompt).catch(()=>{});
 const url="https://chatgpt.com/?q="+encodeURIComponent(prompt);
 window.open(url,"_blank","noopener,noreferrer");
 document.getElementById("aiResult").innerHTML="<p>✅ ChatGPT açıldı. Talep panoya da kopyalandı.</p><p class='muted'>ChatGPT soruları oluşturduktan sonra tüm JSON çıktısını kopyala ve burada <b>📋 Panodan Toplu Aktar</b> butonuna bas.</p>";
}

function parseQuestionData(raw){
 // Daha toleranslı içe aktarma: A-E alanları, option_a-e ve options desteklenir.
 let s=String(raw||"").trim();
 const start=s.indexOf("["); const end=s.lastIndexOf("]");
 if(start>=0&&end>start)s=s.slice(start,end+1);
 let data=JSON.parse(s);
 if(!Array.isArray(data)&&Array.isArray(data.questions))data=data.questions;
 if(!Array.isArray(data))throw new Error("JSON bir soru dizisi olmalı.");
 return data.map((q,i)=>{
   const opts=Array.isArray(q.options)?q.options:[q.option_a,q.option_b,q.option_c,q.option_d,q.option_e];
   const correct=String(q.correct||"").trim().toUpperCase();
   if(!q.question||opts.length!==5||opts.some(x=>!String(x||"").trim())||!["A","B","C","D","E"].includes(correct))throw new Error((i+1)+". sorunun formatı hatalı.");
   return {lesson:String(q.lesson||document.getElementById("aiLesson").value.trim()||"Genel"),topic:String(q.topic||document.getElementById("aiTopic").value.trim()||""),question:String(q.question),options:opts.map(String),correct,difficulty:String(q.difficulty||document.getElementById("aiDifficulty").value||"Orta"),explanation:String(q.explanation||"")};
 });
}

function showImported(data){
 importedQuestions=data;
 document.getElementById("saveImportedBtn").disabled=!data.length;
 document.getElementById("importResult").innerHTML="<p class='result'>✅ <b>"+data.length+" soru</b> hazır. Şimdi <b>Soruları Soru Bankama Kaydet</b> butonuna bas.</p>";
}

async function importFromClipboard(){
 try{const raw=await navigator.clipboard.readText();showImported(parseQuestionData(raw));}
 catch(e){document.getElementById("importResult").innerHTML="<p class='wrong'>❌ Panodaki veri okunamadı: "+escapeHtml(e.message)+"</p><p class='muted'>ChatGPT çıktısının tamamını kopyala veya JSON dosyasını yükle.</p>";}
}

function importFromFile(file){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{try{showImported(parseQuestionData(reader.result));}catch(e){document.getElementById("importResult").innerHTML="<p class='wrong'>❌ Dosya okunamadı: "+escapeHtml(e.message)+"</p>";}};
 reader.readAsText(file);
}

async function saveImportedQuestions(){
 if(!importedQuestions.length)return;
 const btn=document.getElementById("saveImportedBtn");btn.disabled=true;
 let ok=0;
 for(const q of importedQuestions){
   try{
    const r=await fetch(API+"/questions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(q)});
    if(r.ok)ok++;
   }catch(e){}
   document.getElementById("importResult").innerHTML="<p>⏳ "+ok+"/"+importedQuestions.length+" soru kaydediliyor...</p>";
 }
 document.getElementById("importResult").innerHTML="<p class='result'>🎉 <b>"+ok+" soru</b> DUSCamp soru bankasına kaydedildi.</p>";
 importedQuestions=[];
 await load();
}