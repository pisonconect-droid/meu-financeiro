const KEY = "meu_financeiro_v1";
const state = loadState();
let pendingImages = [];
let paymentFilter = "todos";

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(KEY));
    if(!saved) return {lancamentos:[], pagamentos:[], orcamentos:[]};
    return {
      lancamentos:Array.isArray(saved.lancamentos)?saved.lancamentos:[],
      pagamentos:Array.isArray(saved.pagamentos)?saved.pagamentos:[],
      orcamentos:Array.isArray(saved.orcamentos)?saved.orcamentos:[]
    };
  }catch{
    return {lancamentos:[], pagamentos:[], orcamentos:[]};
  }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); renderAll(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function brl(v){ return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function hoje(){ return new Date().toISOString().slice(0,10); }
function addDays(dateStr,days){
  const d=new Date(dateStr+"T12:00:00");
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function fmtDate(s){ if(!s) return ""; const [y,m,d]=s.split("-"); return `${d}/${m}/${y}`; }
function isLate(p){ return p.status==="pendente" && p.tipo==="pagar" && p.vencimento < hoje(); }
function isToday(p){ return p.status==="pendente" && p.tipo==="pagar" && p.vencimento===hoje(); }
function isFuturePay(p){ return p.status==="pendente" && p.tipo==="pagar" && p.vencimento > hoje(); }
function isPaid(p){ return p.tipo==="pagar" && p.status==="pago"; }
function isToReceive(p){ return p.tipo==="receber" && p.status==="pendente"; }
function isReceived(p){ return p.tipo==="receber" && p.status==="recebido"; }

document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));
document.querySelectorAll("[data-view-link]").forEach(btn=>btn.onclick=()=>showView(btn.dataset.viewLink));

document.querySelectorAll("[data-account]").forEach(btn=>btn.onclick=()=>{
  const conta=btn.dataset.account;
  lConta.value=conta;
  filtroConta.value=conta;
  renderLancamentos();
  showView("lancamentos");
});

document.querySelectorAll(".filter-btn").forEach(btn=>btn.onclick=()=>{
  paymentFilter=btn.dataset.filter;
  document.querySelectorAll(".filter-btn").forEach(x=>x.classList.toggle("active",x===btn));
  renderPagamentos();
});

function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===id));
  window.scrollTo({top:0,behavior:"smooth"});
}

lData.value=hoje();
pVencimento.value=hoje();
oData.value=hoje();

formLancamento.onsubmit=e=>{
  e.preventDefault();
  const contaAtual=lConta.value;
  state.lancamentos.unshift({
    id:uid(), conta:lConta.value, tipo:lTipo.value,
    valor:Number(lValor.value), data:lData.value, descricao:lDescricao.value.trim()
  });
  e.target.reset();
  lConta.value=contaAtual;
  lData.value=hoje();
  filtroConta.value=contaAtual;
  save();
};
filtroConta.onchange=renderLancamentos;

formPagamento.onsubmit=e=>{
  e.preventDefault();
  state.pagamentos.unshift({
    id:uid(),
    conta:pConta.value,
    tipo:pTipo.value,
    valor:Number(pValor.value),
    vencimento:pVencimento.value,
    descricao:pDescricao.value.trim(),
    status:"pendente"
  });
  e.target.reset();
  pVencimento.value=hoje();
  save();
};

function markPayment(id){
  const p=state.pagamentos.find(x=>x.id===id);
  if(!p || p.status!=="pendente") return;
  p.status = p.tipo==="pagar" ? "pago" : "recebido";
  state.lancamentos.unshift({
    id:uid(),
    conta:p.conta,
    tipo:p.tipo==="pagar"?"saida":"entrada",
    valor:p.valor,
    data:hoje(),
    descricao:p.descricao
  });
  save();
}
function removePayment(id){
  if(confirm("Excluir este registro?")){
    state.pagamentos=state.pagamentos.filter(x=>x.id!==id);
    save();
  }
}
function removeLanc(id){
  if(confirm("Excluir este lançamento?")){
    state.lancamentos=state.lancamentos.filter(x=>x.id!==id);
    save();
  }
}

function editPayment(id){
  const p=state.pagamentos.find(x=>x.id===id);
  if(!p) return;
  editId.value=p.id;
  editConta.value=p.conta;
  editTipo.value=p.tipo;
  editValor.value=p.valor;
  editVencimento.value=p.vencimento;
  editDescricao.value=p.descricao;
  editModal.classList.remove("hidden");
}
cancelarEdicao.onclick=()=>editModal.classList.add("hidden");
editModal.onclick=e=>{ if(e.target===editModal) editModal.classList.add("hidden"); };
formEditarPagamento.onsubmit=e=>{
  e.preventDefault();
  const p=state.pagamentos.find(x=>x.id===editId.value);
  if(!p) return;
  p.conta=editConta.value;
  p.tipo=editTipo.value;
  p.valor=Number(editValor.value);
  p.vencimento=editVencimento.value;
  p.descricao=editDescricao.value.trim();
  editModal.classList.add("hidden");
  save();
};

function addItem(data={descricao:"",qtd:1,valor:""}){
  const frag=itemTemplate.content.cloneNode(true);
  const row=frag.querySelector(".budget-item");
  row.querySelector(".iDescricao").value=data.descricao||"";
  row.querySelector(".iQtd").value=data.qtd||1;
  row.querySelector(".iValor").value=data.valor??"";
  row.querySelectorAll("input").forEach(i=>i.addEventListener("input",calcBudget));
  row.querySelector(".removeItem").onclick=()=>{ row.remove(); calcBudget(); };
  itensOrcamento.appendChild(frag);
  calcBudget();
}
addItem.onclick=()=>addItem();
addItem();

function getItems(){
  return [...document.querySelectorAll(".budget-item")].map(r=>({
    descricao:r.querySelector(".iDescricao").value.trim(),
    qtd:Number(r.querySelector(".iQtd").value||0),
    valor:Number(r.querySelector(".iValor").value||0)
  }));
}
function calcBudget(){
  const total=getItems().reduce((s,i)=>s+i.qtd*i.valor,0);
  oTotal.textContent=brl(total);
  return total;
}

oImagens.onchange=async e=>{
  pendingImages=[];
  for(const file of [...e.target.files].slice(0,6)){
    pendingImages.push(await compressImage(file,1100,.75));
  }
  renderImagePreview();
};
function compressImage(file,maxDim=1100,quality=.75){
  return new Promise((resolve,reject)=>{
    const img=new Image(), reader=new FileReader();
    reader.onload=()=>img.src=reader.result;
    reader.onerror=reject;
    img.onload=()=>{
      let {width,height}=img;
      const scale=Math.min(1,maxDim/Math.max(width,height));
      width=Math.round(width*scale); height=Math.round(height*scale);
      const c=document.createElement("canvas"); c.width=width; c.height=height;
      c.getContext("2d").drawImage(img,0,0,width,height);
      resolve(c.toDataURL("image/jpeg",quality));
    };
    reader.readAsDataURL(file);
  });
}
function renderImagePreview(){
  previewImagens.innerHTML=pendingImages.map(src=>`<img src="${src}" alt="Imagem do orçamento">`).join("");
}

formOrcamento.onsubmit=e=>{
  e.preventDefault();
  const items=getItems();
  if(!items.length || items.some(i=>!i.descricao || i.qtd<=0)){
    alert("Revise os itens do orçamento.");
    return;
  }
  const total=calcBudget();
  const orc={
    id:uid(),
    numero:(state.orcamentos.length+1).toString().padStart(3,"0"),
    cliente:oCliente.value.trim(),
    whatsapp:oWhatsApp.value.replace(/\D/g,""),
    data:oData.value,
    descricao:oDescricao.value.trim(),
    itens:items,
    imagens:[...pendingImages],
    observacoes:oObservacoes.value.trim(),
    total
  };
  try{
    state.orcamentos.unshift(orc);
    save();
  }catch(err){
    alert("Não foi possível salvar. Tente usar menos imagens ou imagens menores.");
    state.orcamentos=state.orcamentos.filter(x=>x.id!==orc.id);
    return;
  }
  e.target.reset();
  oData.value=hoje();
  pendingImages=[];
  renderImagePreview();
  itensOrcamento.innerHTML="";
  addItem();
};

function removeBudget(id){
  if(confirm("Excluir este orçamento?")){
    state.orcamentos=state.orcamentos.filter(x=>x.id!==id);
    save();
  }
}
function printBudget(id){
  const o=state.orcamentos.find(x=>x.id===id);
  if(!o)return;
  printArea.innerHTML=budgetHTML(o);
  window.print();
}
function budgetHTML(o){
  return `<div class="print-doc">
    <h1>ORÇAMENTO Nº ${o.numero}</h1>
    <div class="muted">Data: ${fmtDate(o.data)}</div>
    <h2>${escapeHtml(o.cliente)}</h2>
    ${o.descricao?`<p>${escapeHtml(o.descricao)}</p>`:""}
    <table>
      <thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr></thead>
      <tbody>${o.itens.map(i=>`<tr><td>${escapeHtml(i.descricao)}</td><td>${i.qtd}</td><td>${brl(i.valor)}</td><td>${brl(i.qtd*i.valor)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="grand-total">Total: ${brl(o.total)}</div>
    ${o.imagens?.length?`<div class="print-images">${o.imagens.map(src=>`<img src="${src}">`).join("")}</div>`:""}
    ${o.observacoes?`<h3>Observações</h3><p>${escapeHtml(o.observacoes)}</p>`:""}
  </div>`;
}
function shareWhatsApp(id){
  const o=state.orcamentos.find(x=>x.id===id);
  if(!o)return;
  const text=`Olá, ${o.cliente}. Segue o orçamento nº ${o.numero}, no valor total de ${brl(o.total)}.`;
  const url=o.whatsapp
    ? `https://wa.me/${o.whatsapp}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url,"_blank");
}
function nativeShare(id){
  const o=state.orcamentos.find(x=>x.id===id);
  if(!o)return;
  const text=`Orçamento nº ${o.numero} - ${o.cliente} - Total ${brl(o.total)}.`;
  if(navigator.share){
    navigator.share({title:`Orçamento ${o.numero}`,text}).catch(()=>{});
  }else{
    shareWhatsApp(id);
  }
}
function escapeHtml(s=""){
  return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function renderSummary(){
  const sum=(conta,tipo)=>state.lancamentos
    .filter(x=>x.conta===conta&&x.tipo===tipo)
    .reduce((a,b)=>a+b.valor,0);

  saldoPF.textContent=brl(sum("PF","entrada")-sum("PF","saida"));
  saldoCNPJ.textContent=brl(sum("CNPJ","entrada")-sum("CNPJ","saida"));

  const limite=addDays(hoje(),7);
  const proximos=state.pagamentos
    .filter(p=>p.tipo==="pagar" && p.status==="pendente" && p.vencimento>=hoje() && p.vencimento<=limite)
    .reduce((a,b)=>a+b.valor,0);
  prox7dias.textContent=brl(proximos);
}

function renderLancamentos(){
  const f=filtroConta.value;
  const data=state.lancamentos.filter(x=>f==="TODOS"||x.conta===f);
  listaLancamentos.innerHTML=data.length?data.map(x=>`
    <div class="list-item">
      <div>
        <strong>${escapeHtml(x.descricao)}</strong>
        <div class="meta">${x.conta==="PF"?"Pessoa Física":"CNPJ"} · ${fmtDate(x.data)}</div>
      </div>
      <div style="text-align:right">
        <strong class="${x.tipo==="entrada"?"positive":"negative"}">${x.tipo==="entrada"?"+":"-"} ${brl(x.valor)}</strong>
        <div class="actions-row">
          <button class="danger" onclick="removeLanc('${x.id}')">Excluir</button>
        </div>
      </div>
    </div>`).join(""):`<div class="empty">Nenhum lançamento.</div>`;
}

function paymentMatchesFilter(p){
  switch(paymentFilter){
    case "a-vencer": return isFuturePay(p);
    case "hoje": return isToday(p);
    case "atrasadas": return isLate(p);
    case "pagas": return isPaid(p);
    case "receber": return isToReceive(p);
    case "recebidos": return isReceived(p);
    default: return true;
  }
}
function paymentStatus(p){
  if(isLate(p)) return {label:"Atrasada", cls:"atrasado"};
  if(isToday(p)) return {label:"Vence hoje", cls:"hoje"};
  if(isFuturePay(p)) return {label:"A vencer", cls:"futuro"};
  if(isPaid(p)) return {label:"Paga", cls:"ok"};
  if(isToReceive(p)) return {label:"A receber", cls:"futuro"};
  if(isReceived(p)) return {label:"Recebido", cls:"ok"};
  return {label:p.status||"Pendente", cls:""};
}

function renderPagamentos(){
  const sum = fn => state.pagamentos.filter(fn).reduce((a,b)=>a+b.valor,0);

  totalAVencer.textContent=brl(sum(isFuturePay));
  totalHoje.textContent=brl(sum(isToday));
  totalAtrasado.textContent=brl(sum(isLate));
  totalPagas.textContent=brl(sum(isPaid));
  totalReceber.textContent=brl(sum(isToReceive));
  totalRecebidos.textContent=brl(sum(isReceived));

  const data=state.pagamentos.filter(paymentMatchesFilter);

  listaPagamentos.innerHTML=data.length?data.map(p=>{
    const st=paymentStatus(p);
    return `<div class="list-item">
      <div>
        <strong>${escapeHtml(p.descricao)}</strong>
        <div class="meta">${p.conta==="PF"?"Pessoa Física":"CNPJ"} · ${p.tipo==="pagar"?"A pagar":"A receber"} · ${fmtDate(p.vencimento)}</div>
        <span class="status ${st.cls}">${st.label}</span>
      </div>
      <div style="text-align:right">
        <strong>${brl(p.valor)}</strong>
        <div class="actions-row">
          ${p.status==="pendente"?`<button class="small" onclick="markPayment('${p.id}')">${p.tipo==="pagar"?"Marcar pago":"Marcar recebido"}</button>`:""}
          ${p.status==="pendente"?`<button class="small" onclick="editPayment('${p.id}')">Editar</button>`:""}
          <button class="danger" onclick="removePayment('${p.id}')">Excluir</button>
        </div>
      </div>
    </div>`;
  }).join(""):`<div class="empty">Nenhum registro nesta visão.</div>`;
}

function renderBudgets(){
  listaOrcamentos.innerHTML=state.orcamentos.length?state.orcamentos.map(o=>`
    <div class="list-item">
      <div>
        <strong>Orçamento ${o.numero} · ${escapeHtml(o.cliente)}</strong>
        <div class="meta">${fmtDate(o.data)} · ${o.itens.length} item(ns)</div>
      </div>
      <div style="text-align:right">
        <strong>${brl(o.total)}</strong>
        <div class="actions-row">
          <button class="small" onclick="printBudget('${o.id}')">PDF / Imprimir</button>
          <button class="small" onclick="nativeShare('${o.id}')">Compartilhar</button>
          <button class="small" onclick="shareWhatsApp('${o.id}')">WhatsApp</button>
          <button class="danger" onclick="removeBudget('${o.id}')">Excluir</button>
        </div>
      </div>
    </div>`).join(""):`<div class="empty">Nenhum orçamento salvo.</div>`;
}

function renderAll(){
  renderSummary();
  renderLancamentos();
  renderPagamentos();
  renderBudgets();
}
renderAll();
