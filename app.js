const KEY="meu_financeiro_v1";
let state=load();
let currentAccount=null;
let pendingImages=[];

function load(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY))||{};
    return {lancamentos:Array.isArray(s.lancamentos)?s.lancamentos:[],pagamentos:Array.isArray(s.pagamentos)?s.pagamentos:[],orcamentos:Array.isArray(s.orcamentos)?s.orcamentos:[]};
  }catch{return {lancamentos:[],pagamentos:[],orcamentos:[]}}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function today(){return new Date().toISOString().slice(0,10)}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function dateBR(v){if(!v)return"";const[y,m,d]=v.split("-");return`${d}/${m}/${y}`}
function esc(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function accountLabel(a){return a==="PF"?"Pessoa Física":"CNPJ"}

document.querySelectorAll("[data-open-account]").forEach(b=>b.onclick=()=>openAccount(b.dataset.openAccount));
homeBtn.onclick=showHome;
function showHome(){currentAccount=null;homeView.classList.add("active");accountView.classList.remove("active");homeBtn.classList.add("hidden");subtitle.textContent="Escolha uma área para começar";renderHome();window.scrollTo(0,0)}
function openAccount(a){currentAccount=a;homeView.classList.remove("active");accountView.classList.add("active");homeBtn.classList.remove("hidden");accountName.textContent=accountLabel(a);subtitle.textContent=accountLabel(a);budgetSection.classList.toggle("hidden",a!=="CNPJ");renderAll();window.scrollTo(0,0)}

addEntrada.onclick=()=>openMovement("entrada");
addGasto.onclick=()=>openMovement("saida");
addConta.onclick=()=>openBill();

function openMovement(tipo,item=null){
  formMode.value="movimento";editId.value=item?.id||"";modalTitle.textContent=item?"Editar lançamento":tipo==="entrada"?"Nova entrada":"Novo gasto";
  mDescricao.value=item?.descricao||"";mValor.value=item?.valor||"";mData.value=item?.data||today();mData.dataset.tipo=tipo;dateLabel.firstChild.textContent="Data";modal.classList.remove("hidden")
}
function openBill(item=null){
  formMode.value="conta";editId.value=item?.id||"";modalTitle.textContent=item?"Editar conta":"Adicionar conta";
  mDescricao.value=item?.descricao||"";mValor.value=item?.valor||"";mData.value=item?.vencimento||today();dateLabel.firstChild.textContent="Vencimento";modal.classList.remove("hidden")
}
function closeM(){modal.classList.add("hidden");modalForm.reset();editId.value=""}
closeModal.onclick=closeM;cancelModal.onclick=closeM;modal.onclick=e=>{if(e.target===modal)closeM()}

modalForm.onsubmit=e=>{
  e.preventDefault();const mode=formMode.value,editing=editId.value;
  if(mode==="movimento"){
    if(editing){const x=state.lancamentos.find(x=>x.id===editing);if(x){x.descricao=mDescricao.value.trim();x.valor=+mValor.value;x.data=mData.value}}
    else state.lancamentos.unshift({id:id(),conta:currentAccount,tipo:mData.dataset.tipo,descricao:mDescricao.value.trim(),valor:+mValor.value,data:mData.value});
  }else{
    if(editing){const x=state.pagamentos.find(x=>x.id===editing);if(x){x.descricao=mDescricao.value.trim();x.valor=+mValor.value;x.vencimento=mData.value}}
    else state.pagamentos.unshift({id:id(),conta:currentAccount,tipo:"pagar",descricao:mDescricao.value.trim(),valor:+mValor.value,vencimento:mData.value,status:"pendente"});
  }
  closeM();save()
}

function delMovement(i){if(confirm("Excluir este lançamento?")){state.lancamentos=state.lancamentos.filter(x=>x.id!==i);save()}}
function delBill(i){if(confirm("Excluir esta conta?")){state.pagamentos=state.pagamentos.filter(x=>x.id!==i);save()}}
function payBill(i){
  const p=state.pagamentos.find(x=>x.id===i);if(!p||p.status!=="pendente")return;
  p.status="pago";p.pagoEm=today();
  state.lancamentos.unshift({id:id(),conta:p.conta,tipo:"saida",descricao:p.descricao,valor:p.valor,data:today(),origemConta:p.id});
  save()
}
function editBill(i){const p=state.pagamentos.find(x=>x.id===i);if(p)openBill(p)}
function editMovement(i){const x=state.lancamentos.find(x=>x.id===i);if(x)openMovement(x.tipo,x)}

function balance(a){return state.lancamentos.filter(x=>x.conta===a).reduce((s,x)=>s+(x.tipo==="entrada"?x.valor:-x.valor),0)}
function renderHome(){homeSaldoPF.textContent=money(balance("PF"));homeSaldoCNPJ.textContent=money(balance("CNPJ"))}
function renderAccount(){
  if(!currentAccount)return;const b=balance(currentAccount);accountBalance.textContent=money(b);accountBalance.className=b>0?"positive":b<0?"negative":"neutral";balanceStatus.textContent=b>0?"POSITIVO":b<0?"NEGATIVO":"ZERADO";balanceStatus.className=b>0?"positive":b<0?"negative":"neutral";
  const moves=state.lancamentos.filter(x=>x.conta===currentAccount).slice(0,30);
  dailyList.innerHTML=moves.length?moves.map(x=>`<div class="list-item"><div><strong>${esc(x.descricao)}</strong><div class="meta">${dateBR(x.data)} · ${x.tipo==="entrada"?"Entrada":"Gasto"}</div></div><div style="text-align:right"><strong class="${x.tipo==="entrada"?"positive":"negative"}">${x.tipo==="entrada"?"+":"-"} ${money(x.valor)}</strong><div class="actions"><button class="small" onclick="editMovement('${x.id}')">Editar</button><button class="danger" onclick="delMovement('${x.id}')">Excluir</button></div></div></div>`).join(""):`<div class="empty">Nenhum lançamento ainda.</div>`;
  renderBills();renderBudgets()
}
function renderBills(){
  const bills=state.pagamentos.filter(x=>x.conta===currentAccount&&x.tipo==="pagar"),h=today();
  const late=bills.filter(x=>x.status==="pendente"&&x.vencimento<h),pending=bills.filter(x=>x.status==="pendente"&&x.vencimento>=h),paid=bills.filter(x=>x.status==="pago");
  totalAtrasadas.textContent=money(late.reduce((s,x)=>s+x.valor,0));totalAPagar.textContent=money(pending.reduce((s,x)=>s+x.valor,0));totalPagas.textContent=money(paid.reduce((s,x)=>s+x.valor,0));
  listAtrasadas.innerHTML=billHTML(late,true);listAPagar.innerHTML=billHTML(pending,true);listPagas.innerHTML=billHTML(paid,false)
}
function billHTML(arr,open){
  if(!arr.length)return`<div class="empty">Nenhuma conta.</div>`;
  return arr.map(x=>`<div class="list-item"><div><strong>${esc(x.descricao)}</strong><div class="meta">${open?"Vence":"Venceu"} ${dateBR(x.vencimento)}</div></div><div style="text-align:right"><strong>${money(x.valor)}</strong><div class="actions">${open?`<button class="small" onclick="payBill('${x.id}')">Marcar paga</button><button class="small" onclick="editBill('${x.id}')">Editar</button>`:""}<button class="danger" onclick="delBill('${x.id}')">Excluir</button></div></div></div>`).join("")
}

newBudgetBtn.onclick=()=>{budgetFormWrap.classList.remove("hidden");oData.value=today();if(!budgetItems.children.length)addBudgetItem();window.scrollTo({top:budgetFormWrap.offsetTop-20,behavior:"smooth"})}
cancelBudget.onclick=()=>{budgetFormWrap.classList.add("hidden");budgetForm.reset();budgetItems.innerHTML="";pendingImages=[];imagePreview.innerHTML=""}
addItemBtn.onclick=()=>addBudgetItem();
function addBudgetItem(){
  const f=itemTemplate.content.cloneNode(true),r=f.querySelector(".budget-item");r.querySelectorAll("input").forEach(x=>x.oninput=calcBudget);r.querySelector(".remove-item").onclick=()=>{r.remove();calcBudget()};budgetItems.appendChild(f);calcBudget()
}
function items(){return[...document.querySelectorAll(".budget-item")].map(r=>({descricao:r.querySelector(".iDesc").value.trim(),qtd:+r.querySelector(".iQtd").value||0,valor:+r.querySelector(".iValor").value||0}))}
function calcBudget(){const t=items().reduce((s,x)=>s+x.qtd*x.valor,0);oTotal.textContent=money(t);return t}
oImagens.onchange=async e=>{pendingImages=[];for(const f of [...e.target.files].slice(0,6))pendingImages.push(await compress(f));imagePreview.innerHTML=pendingImages.map(x=>`<img src="${x}">`).join("")}
function compress(file){return new Promise((res,rej)=>{const im=new Image(),rd=new FileReader();rd.onload=()=>im.src=rd.result;rd.onerror=rej;im.onload=()=>{let w=im.width,h=im.height,s=Math.min(1,1100/Math.max(w,h));w*=s;h*=s;const c=document.createElement("canvas");c.width=Math.round(w);c.height=Math.round(h);c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",.75))};rd.readAsDataURL(file)})}
budgetForm.onsubmit=e=>{
  e.preventDefault();const its=items();if(!its.length||its.some(x=>!x.descricao||x.qtd<=0)){alert("Revise os itens.");return}
  state.orcamentos.unshift({id:id(),numero:String(state.orcamentos.length+1).padStart(3,"0"),cliente:oCliente.value.trim(),whatsapp:oWhatsApp.value.replace(/\D/g,""),data:oData.value,descricao:oDescricao.value.trim(),itens:its,imagens:[...pendingImages],observacoes:oObs.value.trim(),total:calcBudget()});
  save();budgetFormWrap.classList.add("hidden");budgetForm.reset();budgetItems.innerHTML="";pendingImages=[];imagePreview.innerHTML=""
}
function renderBudgets(){
  if(currentAccount!=="CNPJ")return;
  budgetList.innerHTML=state.orcamentos.length?state.orcamentos.map(o=>`<div class="list-item"><div><strong>Orçamento ${o.numero} · ${esc(o.cliente)}</strong><div class="meta">${dateBR(o.data)}</div></div><div style="text-align:right"><strong>${money(o.total)}</strong><div class="actions"><button class="small" onclick="printBudget('${o.id}')">PDF</button><button class="small" onclick="whats('${o.id}')">WhatsApp</button><button class="danger" onclick="delBudget('${o.id}')">Excluir</button></div></div></div>`).join(""):`<div class="empty">Nenhum orçamento salvo.</div>`
}
function delBudget(i){if(confirm("Excluir orçamento?")){state.orcamentos=state.orcamentos.filter(x=>x.id!==i);save()}}
function whats(i){const o=state.orcamentos.find(x=>x.id===i);if(!o)return;const text=`Olá, ${o.cliente}. Segue o orçamento nº ${o.numero}, no valor total de ${money(o.total)}.`;window.open(o.whatsapp?`https://wa.me/${o.whatsapp}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank")}
function printBudget(i){const o=state.orcamentos.find(x=>x.id===i);if(!o)return;printArea.innerHTML=`<div class="print-doc"><h1>ORÇAMENTO Nº ${o.numero}</h1><p>Data: ${dateBR(o.data)}</p><h2>${esc(o.cliente)}</h2>${o.descricao?`<p>${esc(o.descricao)}</p>`:""}<table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor</th><th>Total</th></tr></thead><tbody>${o.itens.map(x=>`<tr><td>${esc(x.descricao)}</td><td>${x.qtd}</td><td>${money(x.valor)}</td><td>${money(x.qtd*x.valor)}</td></tr>`).join("")}</tbody></table><div class="grand-total">Total: ${money(o.total)}</div>${o.imagens?.length?`<div class="print-images">${o.imagens.map(x=>`<img src="${x}">`).join("")}</div>`:""}${o.observacoes?`<h3>Observações</h3><p>${esc(o.observacoes)}</p>`:""}</div>`;window.print()}

function renderAll(){renderHome();renderAccount()}
renderAll();