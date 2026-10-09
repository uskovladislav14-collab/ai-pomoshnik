const $=id=>document.getElementById(id);
const listenBtn=$("listenBtn"), transcript=$("transcript"), question=$("question"), answer=$("answer"), status=$("status");
const answerBtn=$("answerBtn"), clearBtn=$("clearBtn"), historyEl=$("history");
let recognition=null, listening=false, finalText="";

function setStatus(t){status.textContent=t}
function looksLikeQuestion(t){
  const s=t.trim().toLowerCase();
  if(!s) return false;
  return /[?？]$/.test(s) || /^(что|кто|как|какой|какая|какие|почему|зачем|где|когда|сколько|назовите|объясните|определите|расскажите|що|хто|як|який|яка|які|чому|навіщо|де|коли|скільки|назвіть|поясніть|визначте|розкажіть)\b/.test(s);
}
function renderHistory(){
  const h=JSON.parse(localStorage.getItem("ai_helper_history")||"[]");
  historyEl.innerHTML=h.length?h.slice(0,10).map(x=>`<div class="history-item"><div class="history-q">${escapeHtml(x.q)}</div><div class="history-a">${escapeHtml(x.a)}</div></div>`).join(""):"Пока пусто.";
}
function saveHistory(q,a){
  const h=JSON.parse(localStorage.getItem("ai_helper_history")||"[]");
  h.unshift({q,a,at:Date.now()}); localStorage.setItem("ai_helper_history",JSON.stringify(h.slice(0,30))); renderHistory();
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function initRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setStatus("Браузер не поддерживает распознавание речи");return null}
  const r=new SR(); r.lang="ru-RU"; r.continuous=true; r.interimResults=true;
  r.onstart=()=>{listening=true;listenBtn.classList.add("listening");listenBtn.textContent="⏹ ОСТАНОВИТЬ";setStatus("Слушаю…")};
  r.onend=()=>{if(listening){try{r.start()}catch(e){}}};
  r.onerror=e=>setStatus("Ошибка микрофона: "+e.error);
  r.onresult=e=>{
    let interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const txt=e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText+=" "+txt; else interim+=" "+txt;
    }
    const full=(finalText+" "+interim).trim();
    transcript.textContent=full||"…";
    if(looksLikeQuestion(full)){question.textContent=full;setStatus("Вопрос обнаружен");}
  };
  return r;
}
recognition=initRecognition();
listenBtn.onclick=()=>{
  if(!recognition)return;
  if(listening){listening=false;try{recognition.stop()}catch(e){}listenBtn.classList.remove("listening");listenBtn.textContent="🎤 НАЧАТЬ СЛУШАТЬ";setStatus("Пауза")}
  else {try{recognition.start()}catch(e){}}
};
answerBtn.onclick=async()=>{
  const q=question.textContent.trim();
  if(!q||q==="Вопрос пока не обнаружен."){setStatus("Сначала нужен вопрос");return}
  answer.textContent="ИИ готовит ответ…";setStatus("Обработка…");
  try{
    const r=await fetch("/api/answer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,language:"ru"})});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const data=await r.json(); answer.textContent=data.answer||"Ответ не получен.";saveHistory(q,answer.textContent);setStatus("Готово");
  }catch(e){answer.textContent="ИИ пока не подключён. Запусти сервер и настрой API-ключ.";setStatus("Нет подключения к ИИ")}
};
clearBtn.onclick=()=>{finalText="";transcript.textContent="Здесь появится речь преподавателя…";question.textContent="Вопрос пока не обнаружен.";answer.textContent="Ответ появится здесь.";setStatus("Готов")};
renderHistory();

if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
