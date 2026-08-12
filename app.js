const KEY = "meu_financeiro_v1";
const state = loadState();
let pendingImages = [];

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(KEY)) || {lancamentos:[], pagamentos:[], orcamentos:[]};
  }catch{
    return {lancamentos:[], pagamentos:[], orcamentos:[]};
  }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); renderAll(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function brl(v){ return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function hoje(){ return new Date().toISOString().slice(0,10); }
function fmtDate(s){ if(!s) return ""; const [y,m,d]=s.split("-"); return `${d}/${m}/${y}`; }
function isLate(p){ return p.status==="pendente" && p.tipo==="pagar" && p.vencimento < hoje(); }

document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));
document.querySelectorAll("[data-go]").forEach(btn=>btn.onclick=()=>{
  showView(btn.dataset.go);
  if(btn.dataset.action) document.getElementById("lTipo").value=btn.dataset.action;
});
document.querySelectorAll("[data-account]").forEach(btn=>btn.onclick=()=>{
  const conta=btn.dataset.account;
  document.getElementById("lConta").value=conta;
  document.getElementById("filtroConta").value=conta;
  renderLancamentos();
  showView("lancamentos");
});

function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===id));
  window.scrollTo({top:0,behavior:"smooth"});
}

document.getElementById("lData").value=hoje();
document.getElementById("pVencimento").value=hoje();
document.getElementById("oData").value=hoje();

document.getElementById("formLancamento").onsubmit=e=>{
  e.preventDefault();
  state.lancamentos.unshift({
    id:uid(), conta:lConta.value, tipo:lTipo.value,
    valor:Number(lValor.value), data:lData.value, descricao:lDescricao.value.trim()
  });
  const contaAtual=lConta.value;
  e.target.reset(); lConta.value=contaAtual; lData.value=hoje(); save();
};
document.getElementById("filtroConta").onchange=renderLancamentos;

document.getElementById("formPagamento").onsubmit=e=>{
  e.preventDefault();
  state.pagamentos.unshift({
    id:uid(), conta:pConta.value, tipo:pTipo.value, valor:Number(pValor.value),
    vencimento:pVencimento.value, descricao:pDescricao.value.trim(), status:"pendente"
  });
  e.target.reset(); pVencimento.value=hoje(); save();
};

function markPayment(id){
  const p=state.pagamentos.find(x=>x.id===id);
  if(!p) return;
  if(p.status==="pendente"){
    p.status = p.tipo==="pagar" ? "pago" : "recebido";
    state.lancamentos.unshift({
      id:uid(), conta:p.conta, tipo:p.tipo==="pagar"?"saida":"entrada",
      valor:p.valor, data:hoje(), descricao:p.descricao
    });
  }
  save();
}
function removePayment(id){ if(confirm("Excluir este registro?")){ state.pagamentos=state.pagamentos.filter(x=>x.id!==id); save(); } }
function removeLanc(id){ if(confirm("Excluir este lançamento?")){ state.lancamentos=state.lancamentos.filter(x=>x.id!==id); save(); } }

function addItem(data={descricao:"",qtd:1,valor:""}){
  const frag=document.getElementById("itemTemplate").content.cloneNode(true);
  const row=frag.querySelector(".budget-item");
  row.querySelector(".iDescricao").value=data.descricao||"";
  row.querySelector(".iQtd").value=data.qtd||1;
  row.querySelector(".iValor").value=data.valor??"";
  row.querySelectorAll("input").forEach(i=>i.addEventListener("input",calcBudget));
  row.querySelector(".removeItem").onclick=()=>{ row.remove(); calcBudget(); };
  document.getElementById("itensOrcamento").appendChild(frag);
  calcBudget();
}
document.getElementById("addItem").onclick=()=>addItem();
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
  document.getElementById("oTotal").textContent=brl(total);
  return total;
}

document.getElementById("oImagens").onchange=async e=>{
  pendingImages=[];
  for(const file of [...e.target.files].slice(0,6)){ pendingImages.push(await compressImage(file,1100,.75)); }
  renderImagePreview();
};
function compressImage(file,maxDim=1100,quality=.75){
  return new Promise((resolve,reject)=>{
    const img=new Image(), reader=new FileReader();
    reader.onload=()=>img.src=reader.result; reader.onerror=reject;
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
function renderImagePreview(){ previewImagens.innerHTML=pendingImages.map(src=>`<img src="${src}" alt="Imagem do orçamento">`).join(""); }

document.getElementById("formOrcamento").onsubmit=e=>{
  e.preventDefault();
  const items=getItems();
  if(!items.length || items.some(i=>!i.descricao || i.qtd<=0)){ alert("Revise os itens do orçamento."); return; }
  const total=calcBudget();
  const orc={
    id:uid(), numero:(state.orcamentos.length+1).toString().padStart(3,"0"),
    cliente:oCliente.value.trim(), whatsapp:oWhatsApp.value.replace(/\D/g,""),
    data:oData.value, descricao:oDescricao.value.trim(), itens:items,
    imagens:[...pendingImages], observacoes:oObservacoes.value.trim(), total
  };
  try{ state.orcamentos.unshift(orc); save(); }
  catch(err){ alert("Não foi possível salvar. Tente usar menos imagens ou imagens menores."); state.orcamentos=state.orcamentos.filter(x=>x.id!==orc.id); return; }
  e.target.reset(); oData.value=hoje(); pendingImages=[]; renderImagePreview(); itensOrcamento.innerHTML=""; addItem();
};

function removeBudget(id){ if(confirm("Excluir este orçamento?")){ state.orcamentos=state.orcamentos.filter(x=>x.id!==id); save(); } }
function printBudget(id){ const o=state.orcamentos.find(x=>x.id===id); if(!o)return; printArea.innerHTML=budgetHTML(o); window.print(); }
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
  const o=state.orcamentos.find(x=>x.id===id); if(!o)return;
  const text=`Olá, ${o.cliente}. Segue o orçamento nº ${o.numero}, no valor total de ${brl(o.total)}.`;
  const url=o.whatsapp ? `https://wa.me/${o.whatsapp}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url,"_blank");
}
function nativeShare(id){
  const o=state.orcamentos.find(x=>x.id===id); if(!o)return;
  const text=`Orçamento nº ${o.numero} - ${o.cliente} - Total ${brl(o.total)}.`;
  if(navigator.share){ navigator.share({title:`Orçamento ${o.numero}`,text}).catch(()=>{}); }
  else{ shareWhatsApp(id); }
}
function escapeHtml(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

function renderSummary(){
  const sum=(conta,tipo)=>state.lancamentos.filter(x=>x.conta===conta&&x.tipo===tipo).reduce((a,b)=>a+b.valor,0);
  saldoPF.textContent=brl(sum("PF","entrada")-sum("PF","saida"));
  saldoCNPJ.textContent=brl(sum("CNPJ","entrada")-sum("CNPJ","saida"));
}
function renderLancamentos(){
  const f=filtroConta.value;
  const data=state.lancamentos.filter(x=>f==="TODOS"||x.conta===f);
  listaLancamentos.innerHTML=data.length?data.map(x=>`
    <div class="list-item">
      <div><strong>${escapeHtml(x.descricao)}</strong><div class="meta">${x.conta==="PF"?"Pessoa Física":"CNPJ"} · ${fmtDate(x.data)}</div></div>
      <div style="text-align:right">
        <strong class="${x.tipo==="entrada"?"positive":"negative"}">${x.tipo==="entrada"?"+":"-"} ${brl(x.valor)}</strong>
        <div class="actions-row"><button class="danger" onclick="removeLanc('${x.id}')">Excluir</button></div>
      </div>
    </div>`).join(""):`<div class="empty">Nenhum lançamento.</div>`;
}
function renderPagamentos(){
  listaPagamentos.innerHTML=state.pagamentos.length?state.pagamentos.map(p=>{
    const atrasado=isLate(p);
    return `<div class="list-item">
      <div>
        <strong>${escapeHtml(p.descricao)}</strong>
        <div class="meta">${p.conta==="PF"?"Pessoa Física":"CNPJ"} · ${p.tipo==="pagar"?"A pagar":"A receber"} · vence ${fmtDate(p.vencimento)}</div>
        <span class="status ${atrasado?"atrasado":p.status!=="pendente"?"ok":""}">${atrasado?"Atrasado":p.status}</span>
      </div>
      <div style="text-align:right">
        <strong>${brl(p.valor)}</strong>
        <div class="actions-row">
          ${p.status==="pendente"?`<button class="small" onclick="markPayment('${p.id}')">${p.tipo==="pagar"?"Marcar pago":"Marcar recebido"}</button>`:""}
          <button class="danger" onclick="removePayment('${p.id}')">Excluir</button>
        </div>
      </div>
    </div>`;
  }).join(""):`<div class="empty">Nenhum pagamento cadastrado.</div>`;
}
function renderBudgets(){
  listaOrcamentos.innerHTML=state.orcamentos.length?state.orcamentos.map(o=>`
    <div class="list-item">
      <div><strong>Orçamento ${o.numero} · ${escapeHtml(o.cliente)}</strong><div class="meta">${fmtDate(o.data)} · ${o.itens.length} item(ns)</div></div>
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
function renderAll(){ renderSummary(); renderLancamentos(); renderPagamentos(); renderBudgets(); }
renderAll();
