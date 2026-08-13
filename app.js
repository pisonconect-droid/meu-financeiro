const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session=null,current=null,authMode="login";
let state={mov:[],contas:[],orc:[],orcItens:[],orcCustos:[],fixas:[],profile:null};
let calDate=new Date(),selectedDate=null,calFilter="TODOS";
let navState=JSON.parse(sessionStorage.getItem("mf_nav")||'{"view":"home","account":null}');
let calendarReturnAccount=null;
let privacyHidden=localStorage.getItem("mf_privacy_hidden")==="1";

const $=id=>document.getElementById(id);
const brl=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const hoje=()=>new Date().toISOString().slice(0,10);
const dataBR=s=>{if(!s)return"";const[y,m,d]=s.split("-");return`${d}/${m}/${y}`};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const uid=()=>session?.user?.id;
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const accountName=a=>a==="PF"?"Pessoa Física":"CNPJ";
const moneySpan=v=>`<span class="money-inline">${brl(v)}</span>`;

function applyPrivacy(){
  document.body.classList.toggle("values-hidden",privacyHidden);
  $("privacyBtn").textContent=privacyHidden?"🙈 Exibir":"👁 Valores";
  $("privacyBtn").title=privacyHidden?"Exibir valores":"Ocultar valores";
}
$("privacyBtn").onclick=()=>{privacyHidden=!privacyHidden;localStorage.setItem("mf_privacy_hidden",privacyHidden?"1":"0");applyPrivacy()};

function setAuth(m){
  authMode=m;
  $("tabLogin").classList.toggle("active",m==="login");
  $("tabSignup").classList.toggle("active",m==="signup");
  $("nomeWrap").classList.toggle("hidden",m!=="signup");
  $("authSubmit").textContent=m==="login"?"Entrar":"Criar conta";
  $("authMsg").textContent="";
}
$("tabLogin").onclick=()=>setAuth("login");
$("tabSignup").onclick=()=>setAuth("signup");

$("authForm").onsubmit=async e=>{
  e.preventDefault();
  $("authMsg").textContent="";
  try{
    const email=$("email").value.trim(),password=$("senha").value;
    if(authMode==="signup"){
      const nome=$("nome").value.trim();
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{nome},emailRedirectTo:"https://pisonconect-droid.github.io/meu-financeiro/"}});
      if(error)throw error;
      if(data.session)await ensureProfile(data.user,nome);
      $("authMsg").style.color="#047857";
      $("authMsg").textContent=data.session?"Conta criada.":"Conta criada. Confirme seu e-mail e depois entre.";
    }else{
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error)throw error;
    }
  }catch(err){
    $("authMsg").style.color="#b91c1c";
    $("authMsg").textContent=err.message||"Erro ao autenticar.";
  }
};

async function ensureProfile(user,nome=""){
  if(!user)return;
  await sb.from("profiles").upsert({id:user.id,nome:nome||user.user_metadata?.nome||""},{onConflict:"id"});
}
$("logout").onclick=()=>sb.auth.signOut();

sb.auth.onAuthStateChange(async(event,s)=>{
  session=s;
  if(s?.user){
    await ensureProfile(s.user);
    showApp(false);
    await loadAll();
    if(event==="SIGNED_IN"||event==="INITIAL_SESSION")restoreNavigation();
  }else showAuth();
});

async function start(){
  applyPrivacy();
  const {data}=await sb.auth.getSession();
  session=data.session;
  if(session?.user){await ensureProfile(session.user);showApp(false);await loadAll();restoreNavigation()}
  else showAuth();
}
function showAuth(){$("auth").classList.remove("hidden");$("app").classList.add("hidden")}
function showApp(reset=false){
  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("userEmail").textContent=session.user.email||"";
  if(reset)goHome();
}
function saveNav(view,account=null){
  navState={view,account};
  sessionStorage.setItem("mf_nav",JSON.stringify(navState));
}
function restoreNavigation(){
  const n=navState||{view:"home",account:null};
  if(n.view==="area"&&n.account)return openArea(n.account,false);
  if(n.view==="budget")return openBudgetView(false);
  if(n.view==="calendar"&&n.account)return openAccountCalendar(n.account,false);
  goHome(false);
}

async function loadAll(){
  const [m,c,o,oi,oc,f,p]=await Promise.all([
    sb.from("movimentacoes").select("*").order("data",{ascending:false}).order("created_at",{ascending:false}),
    sb.from("contas").select("*").order("vencimento"),
    sb.from("orcamentos").select("*").order("created_at",{ascending:false}),
    sb.from("orcamento_itens").select("*"),
    sb.from("orcamento_custos").select("*"),
    sb.from("contas_fixas").select("*").order("descricao"),
    sb.from("profiles").select("*").eq("id",uid()).maybeSingle()
  ]);
  const er=m.error||c.error||o.error||oi.error||oc.error||f.error||p.error;
  if(er){alert(er.message);return}
  state={mov:m.data||[],contas:c.data||[],orc:o.data||[],orcItens:oi.data||[],orcCustos:oc.data||[],fixas:f.data||[],profile:p.data||null};
  render();renderCalendar();renderFixas();renderBudgetSummary();
}

document.querySelectorAll("[data-account]").forEach(b=>b.onclick=()=>openArea(b.dataset.account));
$("homeBtn").onclick=()=>{if(navState.view==="calendar"&&calendarReturnAccount)openArea(calendarReturnAccount);else goHome()};
$("openBudgets").onclick=()=>openBudgetView();
$("openBudgetsFromCNPJ").onclick=()=>openBudgetView();
$("btnCalendar").onclick=()=>openAccountCalendar(current);

function setView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id))}
function goHome(save=true){
  current=null;calendarReturnAccount=null;setView("home");
  $("homeBtn").classList.add("hidden");$("subtitle").textContent="Escolha uma área";
  if(save)saveNav("home",null);render();renderBudgetSummary();
}
function openArea(a,save=true){
  current=a;calendarReturnAccount=null;setView("area");
  $("homeBtn").classList.remove("hidden");
  $("accountName").textContent=accountName(a);
  $("subtitle").textContent=accountName(a);
  $("orcSummaryWrap").classList.toggle("hidden",a!=="CNPJ");
  if(save)saveNav("area",a);
  render();renderFixas();renderBudgetSummary();
}
function openBudgetView(save=true){
  current="CNPJ";calendarReturnAccount=null;setView("budgetView");
  $("homeBtn").classList.remove("hidden");$("subtitle").textContent="Orçamentos · CNPJ";
  if(save)saveNav("budget","CNPJ");
  renderOrc();renderBudgetSummary();
}
function openAccountCalendar(account,save=true){
  if(!account)return;
  current=account;calendarReturnAccount=account;calFilter=account;
  document.querySelectorAll("[data-cal-filter]").forEach(x=>x.classList.toggle("active",x.dataset.calFilter===account));
  setView("calendarView");$("homeBtn").classList.remove("hidden");
  $("subtitle").textContent=`Calendário · ${accountName(account)}`;
  if(save)saveNav("calendar",account);
  renderCalendar();
}

$("btnEntrada").onclick=()=>openMov("entrada");
$("btnGasto").onclick=()=>openMov("saida");
$("btnConta").onclick=()=>openConta();

function openMov(tipo,x=null,forcedDate=null,forcedAccount=null){
  if(forcedAccount)current=forcedAccount;
  $("mode").value="mov";$("editId").value=x?.id||"";
  $("modalTitle").textContent=x?"Editar lançamento":tipo==="entrada"?"Nova entrada":"Novo gasto";
  $("descricao").value=x?.descricao||"";$("valor").value=x?.valor||"";
  $("data").value=x?.data||forcedDate||hoje();$("data").dataset.tipo=tipo;
  $("dateLabel").childNodes[0].nodeValue="Data ";
  $("modal").classList.remove("hidden");
}
function openConta(x=null,forcedDate=null,forcedAccount=null){
  if(forcedAccount)current=forcedAccount;
  $("mode").value="conta";$("editId").value=x?.id||"";
  $("modalTitle").textContent=x?"Editar conta":"Adicionar conta";
  $("descricao").value=x?.descricao||"";$("valor").value=x?.valor||"";
  $("data").value=x?.vencimento||forcedDate||hoje();
  $("dateLabel").childNodes[0].nodeValue="Vencimento ";
  $("modal").classList.remove("hidden");
}
$("closeModal").onclick=()=>$("modal").classList.add("hidden");

$("modalForm").onsubmit=async e=>{
  e.preventDefault();
  const editing=$("editId").value;
  if($("mode").value==="mov"){
    const p={user_id:uid(),conta:current,tipo:$("data").dataset.tipo,descricao:$("descricao").value.trim(),valor:+$("valor").value,data:$("data").value,origem:"manual"};
    const q=editing?sb.from("movimentacoes").update(p).eq("id",editing):sb.from("movimentacoes").insert(p);
    const {error}=await q;if(error)return alert(error.message);
  }else{
    const p={user_id:uid(),conta:current,descricao:$("descricao").value.trim(),valor:+$("valor").value,vencimento:$("data").value};
    if(!editing)p.status="pendente";
    const q=editing?sb.from("contas").update(p).eq("id",editing):sb.from("contas").insert(p);
    const {error}=await q;if(error)return alert(error.message);
  }
  $("modal").classList.add("hidden");
  await loadAll();
};

async function delMov(id){
  const x=state.mov.find(v=>v.id===id);if(!x)return;
  if(x.origem==="transferencia"&&x.transferencia_id){
    if(!confirm("Excluir esta transferência inteira? Os dois saldos serão revertidos."))return;
    const {error}=await sb.rpc("excluir_transferencia",{p_transferencia_id:x.transferencia_id});
    if(error)return alert("Exclusão da transferência: "+error.message);
    return loadAll();
  }
  if(confirm("Excluir lançamento?")){
    const {error}=await sb.from("movimentacoes").delete().eq("id",id);
    if(error)alert(error.message);else loadAll();
  }
}
async function delConta(id){
  if(confirm("Excluir conta?")){
    const {error}=await sb.from("contas").delete().eq("id",id);
    if(error)alert(error.message);else loadAll();
  }
}
function editMov(id){const x=state.mov.find(x=>x.id===id);if(x)openMov(x.tipo,x)}
function editConta(id){const x=state.contas.find(x=>x.id===id);if(x)openConta(x)}
async function pagarConta(id){
  const x=state.contas.find(x=>x.id===id);if(!x)return;
  let {error}=await sb.from("contas").update({status:"pago",pago_em:hoje()}).eq("id",id);
  if(error)return alert(error.message);
  ({error}=await sb.from("movimentacoes").insert({user_id:uid(),conta:x.conta,tipo:"saida",descricao:x.descricao,valor:x.valor,data:hoje(),origem:"conta_paga"}));
  if(error)return alert(error.message);
  await loadAll();
}

$("btnTransfer").onclick=()=>{
  $("transferDirection").textContent=`${accountName(current)} → ${accountName(current==="PF"?"CNPJ":"PF")}`;
  $("transferDate").value=hoje();$("transferValue").value="";
  $("transferModal").classList.remove("hidden");
};
$("closeTransfer").onclick=()=>$("transferModal").classList.add("hidden");
$("transferForm").onsubmit=async e=>{
  e.preventDefault();
  const destino=current==="PF"?"CNPJ":"PF";
  const {error}=await sb.rpc("transferir_valor",{p_origem:current,p_destino:destino,p_valor:+$("transferValue").value,p_descricao:$("transferDesc").value.trim()||"Transferência",p_data:$("transferDate").value});
  if(error)return alert("Transferência: "+error.message);
  $("transferModal").classList.add("hidden");
  await loadAll();
};

function saldo(a){return state.mov.filter(x=>x.conta===a).reduce((s,x)=>s+(x.tipo==="entrada"?+x.valor:x.tipo==="saida"?-x.valor:0),0)}
const sum=a=>a.reduce((s,x)=>s+Number(x.valor),0);

function render(){
  $("saldoPF").textContent=brl(saldo("PF"));
  $("saldoCNPJ").textContent=brl(saldo("CNPJ"));
  const mes=hoje().slice(0,7);
  if(current){
    const mm=state.mov.filter(x=>x.conta===current&&String(x.data||"").startsWith(mes));
    const entradas=mm.filter(x=>x.tipo==="entrada").reduce((s,x)=>s+Number(x.valor),0);
    const gastos=mm.filter(x=>x.tipo==="saida").reduce((s,x)=>s+Number(x.valor),0);
    $("summaryLabel1").textContent=current==="CNPJ"?"Receitas do mês":"Entradas do mês";
    $("summaryLabel2").textContent=current==="CNPJ"?"Despesas do mês":"Gastos do mês";
    $("summaryLabel3").textContent="Resultado do mês";
    $("summaryValue1").textContent=brl(entradas);
    $("summaryValue2").textContent=brl(gastos);
    $("summaryValue3").textContent=brl(entradas-gastos);
  }
  if(!current)return;
  const s=saldo(current);
  $("saldoAtual").textContent=brl(s);
  $("saldoAtual").className="money-value "+(s>0?"positive":s<0?"negative":"");
  $("statusSaldo").textContent=s>0?"POSITIVO":s<0?"NEGATIVO":"ZERADO";
  $("movList").innerHTML=listMov(state.mov.filter(x=>x.conta===current));
  const h=hoje(),cs=state.contas.filter(x=>x.conta===current);
  const late=cs.filter(x=>x.status==="pendente"&&x.vencimento<h);
  const pay=cs.filter(x=>x.status==="pendente"&&x.vencimento>=h);
  const paid=cs.filter(x=>x.status==="pago");
  $("tAtrasadas").textContent=brl(sum(late));
  $("tPagar").textContent=brl(sum(pay));
  $("tPagas").textContent=brl(sum(paid));
  $("atrasadas").innerHTML=listConta(late,true);
  $("pagar").innerHTML=listConta(pay,true);
  $("pagas").innerHTML=listConta(paid,false);
  if(current==="CNPJ")renderOrc();
}
function listMov(a){
  return a.length?a.slice(0,60).map(x=>`<div class="item"><div><b>${esc(x.descricao)}</b><div class="meta">${dataBR(x.data)} · ${x.tipo==="entrada"?"Entrada":"Gasto"}${x.origem==="transferencia"?" · Transferência":""}</div></div><div><b class="money-inline ${x.tipo==="entrada"?"positive":"negative"}">${x.tipo==="entrada"?"+":"-"} ${brl(x.valor)}</b><div class="actions">${x.origem!=="transferencia"&&x.origem!=="orcamento_pago"&&!String(x.origem||"").startsWith("orcamento_custo")?`<button onclick="editMov('${x.id}')">Editar</button>`:""}${x.origem==="orcamento_pago"||String(x.origem||"").startsWith("orcamento_custo")?"":`<button class="danger" onclick="delMov('${x.id}')">Excluir</button>`}</div></div></div>`).join(""):`<p class="meta">Nenhum lançamento.</p>`;
}
function listConta(a,open){
  return a.length?a.map(x=>`<div class="item"><div><b>${esc(x.descricao)}</b><div class="meta">Vence ${dataBR(x.vencimento)}</div></div><div><b class="money-inline">${brl(x.valor)}</b><div class="actions">${open?`<button onclick="pagarConta('${x.id}')">Marcar paga</button><button onclick="editConta('${x.id}')">Editar</button>`:""}<button class="danger" onclick="delConta('${x.id}')">Excluir</button></div></div></div>`).join(""):`<p class="meta">Nenhuma conta.</p>`;
}

// CONTAS FIXAS
$("addFixedBtn").onclick=()=>openFixed();
$("closeFixed").onclick=()=>$("fixedModal").classList.add("hidden");
function openFixed(x=null){
  $("fixedId").value=x?.id||"";
  $("fixedTitle").textContent=x?"Editar conta fixa":"Nova conta fixa";
  $("fixedAccount").value=x?.conta||current||"PF";
  $("fixedDesc").value=x?.descricao||"";
  $("fixedValue").value=x?.valor||"";
  $("fixedDay").value=x?.dia_vencimento||"";
  $("fixedModal").classList.remove("hidden");
}
$("fixedForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("fixedId").value;
  const p={user_id:uid(),conta:$("fixedAccount").value,descricao:$("fixedDesc").value.trim(),valor:+$("fixedValue").value,dia_vencimento:+$("fixedDay").value,ativa:true};
  const q=id?sb.from("contas_fixas").update(p).eq("id",id):sb.from("contas_fixas").insert(p);
  const {error}=await q;
  if(error)return alert(error.message);
  $("fixedModal").classList.add("hidden");
  await loadAll();
};
async function delFixed(id){
  if(!confirm("Excluir esta conta fixa? As contas mensais já geradas não serão apagadas."))return;
  const {error}=await sb.from("contas_fixas").delete().eq("id",id);
  if(error)alert(error.message);else loadAll();
}
function editFixed(id){const x=state.fixas.find(x=>x.id===id);if(x)openFixed(x)}
$("generateFixedBtn").onclick=async()=>{
  const competencia=new Date();competencia.setDate(1);
  const {data,error}=await sb.rpc("gerar_contas_fixas_mes",{p_competencia:iso(competencia)});
  if(error)return alert("Contas fixas: "+error.message);
  alert(`${data||0} conta(s) criada(s) para este mês.`);
  await loadAll();
};
function renderFixas(){
  if(!$("fixedList"))return;
  const a=current?state.fixas.filter(x=>x.conta===current):state.fixas;
  $("fixedList").innerHTML=a.length?a.map(x=>`<div class="fixed-item"><div><b>${esc(x.descricao)}</b><div class="meta">${accountName(x.conta)} · vence dia ${x.dia_vencimento}</div></div><div><b class="money-inline">${brl(x.valor)}</b><div class="actions"><button onclick="editFixed('${x.id}')">Editar</button><button class="danger" onclick="delFixed('${x.id}')">Excluir</button></div></div></div>`).join(""):`<p class="meta">Nenhuma conta fixa cadastrada.</p>`;
}

// ORÇAMENTOS
$("btnOrc").onclick=()=>{
  $("orcFormWrap").classList.remove("hidden");
  $("orcData").value=hoje();
  $("orcPrestador").value=state.profile?.prestador_nome||state.profile?.nome||"";
  if(!$("orcItens").children.length)addOrcItem();
};
$("cancelOrc").onclick=()=>resetOrc();
$("addItem").onclick=addOrcItem;
$("addCostBtn").onclick=addCost;

function resetOrc(){
  $("orcForm").reset();
  $("orcItens").innerHTML="";
  $("orcCustos").innerHTML="";
  $("orcFormWrap").classList.add("hidden");
  calcOrc();
}
function addOrcItem(){
  const f=$("budgetItemTemplate").content.cloneNode(true),r=f.querySelector(".budget-item-row");
  const tipo=r.querySelector(".iTipo"),custo=r.querySelector(".iCusto");
  const syncTipo=()=>{
    const mao=tipo.value==="mao_obra";
    custo.disabled=mao;
    custo.value=mao?"0":custo.value;
    custo.placeholder=mao?"M.O. não é custo":"Custo real";
    calcOrc();
  };
  r.querySelectorAll("input,select").forEach(i=>i.oninput=calcOrc);
  tipo.onchange=syncTipo;
  r.querySelector(".remove-budget-item").onclick=()=>{r.remove();calcOrc()};
  $("orcItens").appendChild(f);
  syncTipo();
}
function addCost(){
  const f=$("costTemplate").content.cloneNode(true),r=f.querySelector(".cost-row");
  r.querySelectorAll("input").forEach(i=>i.oninput=calcOrc);
  r.querySelector(".remove-cost").onclick=()=>{r.remove();calcOrc()};
  $("orcCustos").appendChild(f);
  calcOrc();
}
function orcItems(){
  return[...document.querySelectorAll(".budget-item-row")].map(r=>({
    tipo:r.querySelector(".iTipo").value,
    descricao:r.querySelector(".iDesc").value.trim(),
    quantidade:+r.querySelector(".iQtd").value||0,
    valor_unitario:+r.querySelector(".iVal").value||0,
    custo_unitario:+r.querySelector(".iCusto").value||0
  }));
}
function orcCosts(){
  return[...document.querySelectorAll(".cost-row")].map(r=>({
    descricao:r.querySelector(".cDesc").value.trim(),
    valor:+r.querySelector(".cVal").value||0
  }));
}
function calcOrc(){
  const its=orcItems(),custos=orcCosts();
  const pecas=its.filter(x=>x.tipo==="peca").reduce((s,x)=>s+x.quantidade*x.valor_unitario,0);
  const mo=its.filter(x=>x.tipo==="mao_obra").reduce((s,x)=>s+x.quantidade*x.valor_unitario,0);
  const custoItens=its.filter(x=>x.tipo==="peca").reduce((s,x)=>s+x.quantidade*x.custo_unitario,0);
  const custoServico=custos.reduce((s,x)=>s+x.valor,0);
  const total=pecas+mo,resultado=total-custoItens-custoServico;
  $("totalPecas").textContent=brl(pecas);
  $("totalMO").textContent=brl(mo);
  $("totalCustoItens").textContent=brl(custoItens);
  $("totalCustoServico").textContent=brl(custoServico);
  $("orcTotal").textContent=brl(total);
  $("orcResultado").textContent=brl(resultado);
  return{pecas,mo,custoItens,custoServico,total,resultado};
}
$("orcForm").onsubmit=async e=>{
  e.preventDefault();
  const its=orcItems(),custos=orcCosts(),t=calcOrc();
  if(!its.length)return alert("Adicione pelo menos um item.");
  const prestador=$("orcPrestador").value.trim();
  if(prestador)await sb.from("profiles").update({prestador_nome:prestador}).eq("id",uid());
  const {data:o,error}=await sb.from("orcamentos").insert({
    user_id:uid(),prestador,cliente:$("orcCliente").value.trim(),whatsapp:$("orcWhatsapp").value,
    equipamento_modelo:$("orcEquipamento").value.trim(),data:$("orcData").value,descricao:$("orcDesc").value,
    total:t.total,subtotal_pecas:t.pecas,subtotal_mao_obra:t.mo,custo_itens:t.custoItens,custo_servico:t.custoServico,resultado:t.resultado,status:"rascunho"
  }).select().single();
  if(error)return alert(error.message);
  const r=await sb.from("orcamento_itens").insert(its.map(x=>({user_id:uid(),orcamento_id:o.id,...x})));
  if(r.error)return alert(r.error.message);
  if(custos.length){
    const rc=await sb.from("orcamento_custos").insert(custos.map(x=>({user_id:uid(),orcamento_id:o.id,...x})));
    if(rc.error)return alert(rc.error.message);
  }
  resetOrc();
  await loadAll();
};
async function enviarOrc(id){
  if(!confirm("Marcar este orçamento como enviado ao cliente?"))return;
  const {error}=await sb.from("orcamentos").update({status:"enviado"}).eq("id",id).eq("status","rascunho");
  if(error)alert(error.message);else loadAll();
}
async function aprovarOrc(id){
  if(!confirm("Confirmar que o cliente aprovou este orçamento?"))return;
  const {error}=await sb.from("orcamentos").update({status:"aprovado"}).eq("id",id).in("status",["rascunho","enviado"]);
  if(error)alert(error.message);else loadAll();
}
async function recalcularPago(id){
  if(!confirm("Recalcular este orçamento pago usando a regra correta, sem descontar a M.O.?"))return;
  const {data,error}=await sb.rpc("recalcular_orcamento_pago",{p_orcamento_id:id});
  if(error)return alert("Recalcular: "+error.message);
  alert("Orçamento corrigido. Resultado líquido: "+brl(data));
  await loadAll();
}
async function pagarOrc(id){
  if(!confirm("Confirmar pagamento? O saldo CNPJ ficará com o valor recebido menos os custos reais cadastrados."))return;
  const {error}=await sb.rpc("marcar_orcamento_pago",{p_orcamento_id:id,p_data:hoje()});
  if(error)alert("Pagamento: "+error.message);else loadAll();
}
async function delOrc(id){
  const o=state.orc.find(x=>x.id===id);
  if(o?.status==="pago")return alert("Orçamento pago não pode ser excluído.");
  if(confirm("Excluir orçamento?")){
    const {error}=await sb.from("orcamentos").delete().eq("id",id);
    if(error)alert(error.message);else loadAll();
  }
}
function renderOrc(){
  $("orcList").innerHTML=state.orc.length?state.orc.map(o=>{
    const its=state.orcItens.filter(x=>x.orcamento_id===o.id);
    const custos=state.orcCustos.filter(x=>x.orcamento_id===o.id);
    const custoItens=its.filter(x=>x.tipo==="peca").reduce((s,x)=>s+Number(x.quantidade)*Number(x.custo_unitario||0),0);
    const custoServico=custos.reduce((s,x)=>s+Number(x.valor),0);
    const resultado=Number(o.total)-custoItens-custoServico;
    return `<details class="item budget-record"><summary><div><b>Orçamento ${o.numero} · ${esc(o.cliente)}</b><div class="meta">${dataBR(o.data)}${o.equipamento_modelo?` · ${esc(o.equipamento_modelo)}`:""}</div><span class="status-pill ${o.status}">${({orcamento:"Rascunho",rascunho:"Rascunho",enviado:"Enviado",aprovado:"Aprovado",pago:"Pago"}[o.status]||o.status)}</span></div><b class="money-inline">${brl(o.total)}</b></summary><div class="budget-detail">
      <div class="meta"><b>Prestador:</b> ${esc(o.prestador||"-")}</div>
      <div class="budget-split"><span>Total cobrado <b class="money-inline">${brl(o.total)}</b></span><span>Custo itens <b class="money-inline">${brl(custoItens)}</b></span><span>Custos serviço <b class="money-inline">${brl(custoServico)}</b></span><span>Resultado ${o.status==="pago"?"real":"previsto"} <b class="money-inline">${brl(o.status==="pago"?o.resultado:resultado)}</b></span></div>
      ${its.map(i=>`<div class="meta">${i.tipo==="peca"?"Item":"M.O."}: ${esc(i.descricao)} · ${i.quantidade} × ${moneySpan(i.valor_unitario)}${Number(i.custo_unitario||0)>0?` · custo ${moneySpan(Number(i.custo_unitario)*Number(i.quantidade))}`:""}</div>`).join("")}
      ${custos.length?`<div class="internal-box"><b>Custos internos</b>${custos.map(c=>`<div class="meta">${esc(c.descricao)} · ${moneySpan(c.valor)}</div>`).join("")}</div>`:""}
      <div class="actions">${(o.status==="rascunho"||o.status==="orcamento")?`<button onclick="enviarOrc('${o.id}')">Marcar enviado</button><button class="warning" onclick="aprovarOrc('${o.id}')">Aprovar</button>`:""}${o.status==="enviado"?`<button class="warning" onclick="aprovarOrc('${o.id}')">Aprovar</button>`:""}${o.status==="aprovado"?`<button class="success" onclick="pagarOrc('${o.id}')">Marcar pago</button>`:""}${o.status==="pago"?`<button class="warning" onclick="recalcularPago('${o.id}')">Recalcular</button>`:`<button class="danger" onclick="delOrc('${o.id}')">Excluir</button>`}</div>
    </div></details>`;
  }).join(""):`<p class="meta">Nenhum orçamento.</p>`;
}


function renderBudgetSummary(){
  const mes=hoje().slice(0,7);
  const ativos=state.orc.filter(o=>!["pago"].includes(o.status)).length;
  const pagosMes=state.orc.filter(o=>o.status==="pago"&&String(o.pago_em||o.data||"").startsWith(mes)).length;
  if($("homeBudgetCount"))$("homeBudgetCount").textContent=`${ativos} ativo${ativos===1?"":"s"}`;
  if($("budgetOpenCount"))$("budgetOpenCount").textContent=ativos;
  if($("budgetPaidMonth"))$("budgetPaidMonth").textContent=pagosMes;
  if($("orcSummary")){
    const ultimos=state.orc.slice(0,3);
    $("orcSummary").innerHTML=ultimos.length?ultimos.map(o=>`<div class="item"><div><b>#${o.numero} · ${esc(o.cliente)}</b><div class="meta">${({rascunho:"Rascunho",orcamento:"Rascunho",enviado:"Enviado",aprovado:"Aprovado",pago:"Pago"}[o.status]||o.status)}</div></div><b class="money-inline">${brl(o.total)}</b></div>`).join(""):`<p class="meta">Nenhum orçamento ainda.</p>`;
  }
}

// CALENDÁRIO
$("prevMonth").onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};
$("nextMonth").onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};
document.querySelectorAll("[data-cal-filter]").forEach(b=>b.onclick=()=>{
  calFilter=b.dataset.calFilter;
  document.querySelectorAll("[data-cal-filter]").forEach(x=>x.classList.toggle("active",x===b));
  renderCalendar();
});
function calEvents(date){
  const ok=a=>calFilter==="TODOS"||a===calFilter,events=[];
  state.mov.filter(x=>x.data===date&&ok(x.conta)).forEach(x=>events.push({type:"mov",title:x.descricao,meta:`${accountName(x.conta)} · ${x.tipo==="entrada"?"Entrada":"Gasto"} · ${brl(x.valor)}`}));
  state.contas.filter(x=>x.vencimento===date&&ok(x.conta)).forEach(x=>events.push({type:"bill",title:x.descricao,meta:`${accountName(x.conta)} · ${x.status==="pago"?"Paga":"Vencimento"} · ${brl(x.valor)}`}));
  if(calFilter==="TODOS"||calFilter==="CNPJ")state.orc.filter(x=>x.data===date).forEach(x=>events.push({type:"orc",title:`Orçamento ${x.numero} · ${x.cliente}`,meta:`CNPJ · ${x.status} · ${brl(x.total)}`}));
  return events;
}
function renderCalendar(){
  if(!$("calendarGrid"))return;
  const y=calDate.getFullYear(),m=calDate.getMonth(),first=new Date(y,m,1);
  $("monthTitle").textContent=first.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const start=new Date(y,m,1-first.getDay()),cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const ds=iso(d),ev=calEvents(ds);
    cells.push(`<button class="day ${d.getMonth()!==m?"other":""} ${ds===hoje()?"today":""} ${ds===selectedDate?"selected":""}" data-date="${ds}" type="button"><span class="num">${d.getDate()}</span><span class="dots">${[...new Set(ev.map(e=>e.type))].map(t=>`<i class="dot ${t}"></i>`).join("")}</span></button>`);
  }
  $("calendarGrid").innerHTML=cells.join("");
  document.querySelectorAll(".day").forEach(b=>b.onclick=()=>{
    selectedDate=b.dataset.date;renderCalendar();renderSelectedDate();
  });
  if(selectedDate)renderSelectedDate();
}
function renderSelectedDate(){
  $("selectedDateTitle").textContent=dataBR(selectedDate);
  $("calendarAddBtn").classList.remove("hidden");
  const ev=calEvents(selectedDate);
  $("calendarEvents").innerHTML=ev.length?ev.map(e=>`<div class="event ${e.type}"><b>${esc(e.title)}</b><div class="meta">${esc(e.meta)}</div></div>`).join(""):`<p class="meta">Nenhum lançamento ou vencimento neste dia.</p>`;
}
$("calendarAddBtn").onclick=()=>{if(calendarReturnAccount)$("calendarAccount").value=calendarReturnAccount;
  $("calendarActionDate").textContent=dataBR(selectedDate);
  $("calendarActionModal").classList.remove("hidden");
};
$("closeCalendarAction").onclick=()=>$("calendarActionModal").classList.add("hidden");
document.querySelectorAll("[data-cal-action]").forEach(b=>b.onclick=()=>{
  const action=b.dataset.calAction,acc=$("calendarAccount").value;
  $("calendarActionModal").classList.add("hidden");
  if(action==="conta")openConta(null,selectedDate,acc);
  else openMov(action,null,selectedDate,acc);
});

window.delMov=delMov;window.delConta=delConta;window.editMov=editMov;window.editConta=editConta;window.pagarConta=pagarConta;
window.editFixed=editFixed;window.delFixed=delFixed;window.enviarOrc=enviarOrc;window.aprovarOrc=aprovarOrc;window.pagarOrc=pagarOrc;window.recalcularPago=recalcularPago;window.delOrc=delOrc;
start();