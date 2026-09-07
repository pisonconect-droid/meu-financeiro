const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session=null,current=null,authMode="login";
let state={mov:[],contas:[],orc:[],orcItens:[],orcCustos:[],orcFotos:[],orcRecebimentos:[],orcNfse:[],fixas:[],categorias:[],clientes:[],profile:null,contaLiquidacoes:[],compensacoes:[],cartoes:[],faturasCartao:[],bankReconciliations:[],bankReconciliationEntries:[],balanceBaselines:[]};
let selectedClientId=null;
let editingOrcId=null;
let movCategoryFilter="TODOS";
let reportYear=new Date().getFullYear();
let pendingPhotos=[];
let calDate=new Date(),selectedDate=null,calFilter="TODOS";
let navState=JSON.parse(sessionStorage.getItem("mf_nav")||'{"view":"home","account":null}');
let calendarReturnAccount=null;
let privacyHidden=localStorage.getItem("mf_privacy_hidden")==="1";
const busyActions=new Set();
async function runOnce(key,fn){
  if(busyActions.has(key))return;
  busyActions.add(key);
  try{return await fn()}finally{busyActions.delete(key)}
}
const newOperationKey=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const pendingOperationStorageKey=(kind,id)=>`mf_pending_${kind}_${id}`;
const pendingOperationPayloadKey=(kind,id)=>`${pendingOperationStorageKey(kind,id)}_payload`;
function persistentOperationKey(kind,id){
  const storageKey=pendingOperationStorageKey(kind,id);
  let key=localStorage.getItem(storageKey);
  if(!key){key=newOperationKey(kind);localStorage.setItem(storageKey,key)}
  return key;
}
function pendingOperationPayload(kind,id){
  try{return JSON.parse(localStorage.getItem(pendingOperationPayloadKey(kind,id))||"null")}catch{return null}
}
function persistOperationPayload(kind,id,payload){localStorage.setItem(pendingOperationPayloadKey(kind,id),JSON.stringify(payload))}
function confirmOperation(kind,id){
  localStorage.removeItem(pendingOperationStorageKey(kind,id));
  localStorage.removeItem(pendingOperationPayloadKey(kind,id));
}

const $=id=>document.getElementById(id);
const brl=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};

let selectedPeriod=null;
function currentYearMonth(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function normalizePeriod(v){return /^\d{4}-\d{2}$/.test(String(v||""))?String(v):currentYearMonth()}
function periodLabel(v){
  const [y,m]=normalizePeriod(v).split("-").map(Number);
  return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase());
}
function shiftPeriod(v,delta){
  const [y,m]=normalizePeriod(v).split("-").map(Number),d=new Date(y,m-1+delta,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function ensureSelectedPeriod(){if(!selectedPeriod)selectedPeriod=currentYearMonth()}
function updatePeriodSelectorUI(){
  ensureSelectedPeriod();
  const historical=selectedPeriod!==currentYearMonth();
  if($("periodCurrentLabel"))$("periodCurrentLabel").textContent=periodLabel(selectedPeriod);
  if($("periodMonthPicker"))$("periodMonthPicker").value=selectedPeriod;
  $("periodHistoricalBadge")?.classList.toggle("hidden",!historical);
  $("periodToday")?.classList.toggle("hidden",!historical);
}
function setSelectedPeriod(v){
  selectedPeriod=normalizePeriod(v);
  updatePeriodSelectorUI();
  render();
}
function initPeriodSelector(){
  ensureSelectedPeriod();updatePeriodSelectorUI();
  if($("periodPrev"))$("periodPrev").onclick=()=>setSelectedPeriod(shiftPeriod(selectedPeriod,-1));
  if($("periodNext"))$("periodNext").onclick=()=>setSelectedPeriod(shiftPeriod(selectedPeriod,1));
  if($("periodToday"))$("periodToday").onclick=()=>setSelectedPeriod(currentYearMonth());
  if($("periodCurrentLabel"))$("periodCurrentLabel").onclick=()=>{
    const p=$("periodMonthPicker");
    if(p?.showPicker)p.showPicker();else p?.click();
  };
  if($("periodMonthPicker"))$("periodMonthPicker").onchange=e=>e.target.value&&setSelectedPeriod(e.target.value);
}
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
    await loadModulePrefs();
    if(event==="SIGNED_IN"||event==="INITIAL_SESSION")restoreNavigation();
  }else showAuth();
});

async function start(){
  applyPrivacy();
  const {data}=await sb.auth.getSession();
  session=data.session;
  if(session?.user){await ensureProfile(session.user);showApp(false);await loadAll();await loadModulePrefs();restoreNavigation()}
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
  const [m,c,o,oi,oc,of,orx,clq,cmp,onf,f,cat,cli,cc,inv,br,bre,bb,p]=await Promise.all([
    sb.from("movimentacoes").select("*").order("data",{ascending:false}).order("created_at",{ascending:false}),
    sb.from("contas").select("*").order("vencimento"),
    sb.from("orcamentos").select("*").order("created_at",{ascending:false}),
    sb.from("orcamento_itens").select("*"),
    sb.from("orcamento_custos").select("*"),
    sb.from("orcamento_fotos").select("*").order("created_at",{ascending:true}),
    sb.from("orcamento_recebimentos").select("*").order("data_recebimento",{ascending:true}),
    sb.from("conta_liquidacoes").select("*").order("data_liquidacao",{ascending:true}),
    sb.from("compensacoes").select("*").order("data",{ascending:false}),
    sb.from("orcamento_nfse").select("*").order("data_emissao",{ascending:false}),
    sb.from("contas_fixas").select("*").order("descricao"),
    sb.from("categorias").select("*").eq("ativa",true).order("nome"),
    sb.from("clientes").select("*").order("nome"),
    sb.from("cartoes_credito").select("*").order("nome"),
    sb.from("cartao_faturas").select("*").order("vencimento",{ascending:true}),
    sb.from("bank_reconciliations").select("*").order("periodo_fim",{ascending:false}),
    sb.from("bank_reconciliation_entries").select("*").order("data",{ascending:true}),
    sb.from("account_balance_baselines").select("*").eq("ativo",true).order("data_referencia",{ascending:false}),
    sb.from("profiles").select("*").eq("id",uid()).maybeSingle()
  ]);
  const baselineUnavailable=bb.error&&["42P01","PGRST205"].includes(bb.error.code);
  const er=m.error||c.error||o.error||oi.error||oc.error||of.error||orx.error||clq.error||cmp.error||onf.error||f.error||cat.error||cli.error||cc.error||inv.error||br.error||bre.error||(baselineUnavailable?null:bb.error)||p.error;
  if(er){alert(er.message);return}
  state={mov:m.data||[],contas:c.data||[],orc:o.data||[],orcItens:oi.data||[],orcCustos:oc.data||[],orcFotos:of.data||[],orcRecebimentos:orx.data||[],contaLiquidacoes:clq.data||[],compensacoes:cmp.data||[],orcNfse:onf.data||[],fixas:f.data||[],categorias:cat.data||[],clientes:cli.data||[],cartoes:cc.data||[],faturasCartao:inv.data||[],bankReconciliations:br.data||[],bankReconciliationEntries:bre.data||[],balanceBaselines:baselineUnavailable?[]:(bb.data||[]),profile:p.data||null};
  await ensureDefaultCategories();initPeriodSelector();renderCategoryUI();render();renderCalendar();renderFixas();renderFinancialReport();renderBudgetSummary();
}

document.querySelectorAll("[data-account]").forEach(b=>b.onclick=()=>openArea(b.dataset.account));
$("homeBtn").onclick=()=>{if(navState.view==="calendar"&&calendarReturnAccount)openArea(calendarReturnAccount);else goHome()};


$("btnCalendar").onclick=()=>openAccountCalendar(current);

function setView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id))}
function goHome(save=true){
  current=null;calendarReturnAccount=null;setView("home");
  $("homeBtn").classList.add("hidden");$("subtitle").textContent="Escolha uma área";
  if(save)saveNav("home",null);render();renderBudgetSummary();
}
function openArea(a,save=true){
  current=a;movCategoryFilter="TODOS";
  if(a==="ORC"&&$("orcFormWrap"))$("orcFormWrap").classList.add("hidden");calendarReturnAccount=null;setView("area");
  $("homeBtn").classList.remove("hidden");
  $("accountName").textContent=accountName(a);
  $("subtitle").textContent=accountName(a);
  $("orcSummaryWrap").classList.toggle("hidden",a!=="CNPJ");
  if(save)saveNav("area",a);
  renderCategoryUI();render();renderFixas();renderFinancialReport();renderBudgetSummary();
}
function openBudgetView(save=true){
  current="CNPJ";calendarReturnAccount=null;setView("budgetView");
  $("homeBtn").classList.remove("hidden");$("subtitle").textContent="Orçamentos · CNPJ";
  if(save)saveNav("budget","CNPJ");
  renderOrc();renderBudgetSummary();
}
window.openBudgetViewApp=()=>openBudgetView(true);
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
$("btnExportHistory").onclick=()=>current&&downloadHistoryCsv(current);
$("pfReconFile").onchange=e=>{const f=e.target.files?.[0];if(f)importPfReconciliationFile(f);e.target.value="";};
$("btnConta").onclick=()=>openConta();


const liquidationLabels={
  pix:"Pix",debito:"Débito",credito:"Crédito",dinheiro:"Dinheiro",
  transferencia:"Transferência",compensacao:"Compensação / Permuta",outro:"Outro"
};
const immediateLiquidations=new Set(["pix","debito","dinheiro","transferencia","outro"]);
function liquidationLabel(v){return liquidationLabels[v]||v||"Não informado"}
function isCompensation(v){return v==="compensacao"}
function impactsCash(v){return immediateLiquidations.has(v)}

function accountLiquidationInfo(account){
  const rows=(state.contaLiquidacoes||[]).filter(r=>r.conta_id===account.id);
  const liquidado=rows.reduce((s,r)=>s+Number(r.valor||0),0);
  const total=Number(account.valor||0),saldo=Math.max(0,total-liquidado);
  return {rows,liquidado,total,saldo,partial:liquidado>0&&saldo>0};
}
function compensationBalanceRows(account){
  const rows=(state.compensacoes||[]).filter(x=>x.conta===account);
  const by={};
  rows.forEach(x=>{
    const p=x.contraparte||"Sem contraparte";
    by[p]=by[p]||{credito:0,debito:0,rows:[]};
    if(x.direcao==="credito_usuario")by[p].credito+=Number(x.valor||0);
    else by[p].debito+=Number(x.valor||0);
    by[p].rows.push(x);
  });
  return Object.entries(by).map(([contraparte,v])=>({contraparte,...v,saldo:v.credito-v.debito})).sort((a,b)=>Math.abs(b.saldo)-Math.abs(a.saldo));
}
function renderCompensationSummary(){
  const box=$("compensationSummary");if(!box||!current)return;
  const groups=compensationBalanceRows(current);
  box.innerHTML=groups.length?groups.map(g=>`<details class="comp-party"><summary><span><b>${esc(g.contraparte)}</b><small>Créditos ${brl(g.credito)} · Débitos ${brl(g.debito)}</small></span><b class="${g.saldo>=0?"positive":"negative"}">${g.saldo===0?"Compensado":g.saldo>0?`${brl(g.saldo)} a seu favor`:`${brl(Math.abs(g.saldo))} a favor da contraparte`}</b></summary><div>${g.rows.map(r=>`<div class="comp-row"><span>${dataBR(r.data)} · ${esc(r.descricao)}<small>${r.direcao==="credito_usuario"?"A seu favor":"A favor da contraparte"}</small></span><b>${brl(r.valor)}</b></div>`).join("")}</div></details>`).join(""):`<p class="meta">Nenhuma compensação registrada para ${accountName(current)}.</p>`;
}
async function insertCompensation({conta,contraparte,descricao,valor,direcao,data,referencia_tipo=null,referencia_id=null,observacao=null,chave_idempotencia=null}){
  if(!contraparte)return;
  const {error}=await sb.from("compensacoes").insert({user_id:uid(),conta,contraparte,descricao,valor,direcao,data,referencia_tipo,referencia_id,observacao,chave_idempotencia});
  if(error)throw error;
}

function safeCalendarDate(year,month1,day){
  const last=new Date(year,month1,0).getDate();
  return `${year}-${String(month1).padStart(2,"0")}-${String(Math.min(Math.max(1,Number(day)||1),last)).padStart(2,"0")}`;
}
function nextMonthYM(year,month1){return month1===12?[year+1,1]:[year,month1+1]}
function invoiceCycleForPurchase(card,dateStr){
  const [y,m,d]=String(dateStr||hoje()).split("-").map(Number),closeDay=Number(card.dia_fechamento),dueDay=Number(card.dia_vencimento);
  let cy=y,cm=m;
  const closingThis=safeCalendarDate(y,m,closeDay);
  if(dateStr>closingThis)[cy,cm]=nextMonthYM(y,m);
  const fechamento=safeCalendarDate(cy,cm,closeDay);
  let dy=cy,dm=cm,due=safeCalendarDate(dy,dm,dueDay);
  if(due<=fechamento){[dy,dm]=nextMonthYM(cy,cm);due=safeCalendarDate(dy,dm,dueDay)}
  return {fechamento,vencimento:due,chave:`${card.id}|${due}`};
}
function activeCards(account=current){return (state.cartoes||[]).filter(c=>c.conta===account&&c.ativo!==false)}
function cardById(id){return state.cartoes.find(c=>c.id===id)||null}
function invoiceById(id){return state.faturasCartao.find(f=>f.id===id)||null}
function invoicePurchases(invoiceId){return state.mov.filter(m=>m.fatura_cartao_id===invoiceId&&m.forma_liquidacao==="credito"&&m.origem!=="pagamento_fatura_cartao")}
function invoiceTotal(invoice){return invoicePurchases(invoice.id).reduce((s,x)=>s+Number(x.valor||0),0)}
function invoiceStatusLabel(inv){return inv.status==="quitada_antecipadamente"?"Quitada antecipadamente":inv.status==="paga"?"Paga":"Aberta"}
function fillCreditCardSelect(selected=""){
  const sel=$("creditCardSelect");if(!sel)return;
  const cards=activeCards(current);
  sel.innerHTML=`<option value="">Selecione</option>`+cards.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join("");
  if(selected&&cards.some(c=>c.id===selected))sel.value=selected;
}
function updateCreditInvoicePreview(){
  const wrap=$("creditCardWrap"),method=$("liquidationMethod")?.value,expense=$("data")?.dataset.tipo==="saida";
  const show=method==="credito"&&expense&&$("mode")?.value==="mov";
  wrap?.classList.toggle("hidden",!show);
  if(!show)return;
  fillCreditCardSelect($("creditCardSelect")?.value||"");
  const card=cardById($("creditCardSelect")?.value),box=$("creditInvoicePreview");
  if(!card){box.textContent="Selecione um cartão para calcular a fatura.";return}
  const cycle=invoiceCycleForPurchase(card,$("data").value);
  box.innerHTML=`<b>${esc(card.nome)}</b> · fechamento ${dataBR(cycle.fechamento)} · <b>fatura ${dataBR(cycle.vencimento)}</b>`;
}
function syncLiquidationFields(){
  updateCreditInvoicePreview();
}
if($("liquidationMethod"))$("liquidationMethod").onchange=syncLiquidationFields;
if($("creditCardSelect"))$("creditCardSelect").onchange=updateCreditInvoicePreview;
if($("data"))$("data").addEventListener("change",updateCreditInvoicePreview);

function openCreditCardModal(card=null,returnToExpense=false){
  $("creditCardId").value=card?.id||"";
  $("creditCardModalTitle").textContent=card?"Editar cartão":"Novo cartão";
  $("creditCardName").value=card?.nome||"";
  $("creditCardAccount").value=card?.conta||current||"PF";
  $("creditCardClosingDay").value=card?.dia_fechamento||"";
  $("creditCardDueDay").value=card?.dia_vencimento||"";
  $("creditCardActive").value=String(card?.ativo??true);
  $("creditCardModal").dataset.returnExpense=returnToExpense?"1":"0";
  $("creditCardModal").classList.remove("hidden");
}
$("closeCreditCardModal").onclick=()=>$("creditCardModal").classList.add("hidden");
$("addCreditCardBtn").onclick=()=>openCreditCardModal(null,false);
$("addCardInlineBtn").onclick=()=>openCreditCardModal(null,true);
$("creditCardForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("creditCardId").value,p={user_id:uid(),nome:$("creditCardName").value.trim(),conta:$("creditCardAccount").value,
    dia_fechamento:+$("creditCardClosingDay").value,dia_vencimento:+$("creditCardDueDay").value,ativo:$("creditCardActive").value==="true"};
  if(!p.nome||p.dia_fechamento<1||p.dia_fechamento>31||p.dia_vencimento<1||p.dia_vencimento>31)return alert("Confira nome, fechamento e vencimento do cartão.");
  const q=id?sb.from("cartoes_credito").update(p).eq("id",id).eq("user_id",uid()):sb.from("cartoes_credito").insert(p).select().single();
  const {data,error}=await q;if(error)return alert("Cartão: "+error.message);
  const returnExpense=$("creditCardModal").dataset.returnExpense==="1";
  $("creditCardModal").classList.add("hidden");
  await loadAll();
  if(returnExpense){fillCreditCardSelect(data?.id||id);if(data?.id)$("creditCardSelect").value=data.id;updateCreditInvoicePreview();$("modal").classList.remove("hidden")}
};
function editCreditCard(id){const c=cardById(id);if(c)openCreditCardModal(c,false)}

async function getOrCreateInvoice(card,cycle){
  let inv=state.faturasCartao.find(f=>f.cartao_id===card.id&&f.vencimento===cycle.vencimento);
  if(inv)return inv;
  const {data,error}=await sb.from("cartao_faturas").insert({user_id:uid(),cartao_id:card.id,conta:card.conta,fechamento:cycle.fechamento,vencimento:cycle.vencimento,status:"aberta"}).select().single();
  if(error){
    const existing=await sb.from("cartao_faturas").select("*").eq("cartao_id",card.id).eq("vencimento",cycle.vencimento).maybeSingle();
    if(existing.error||!existing.data)throw error;
    return existing.data;
  }
  state.faturasCartao.push(data);return data;
}
function openInvoiceDetails(id){
  const inv=invoiceById(id),card=inv&&cardById(inv.cartao_id);if(!inv||!card)return;
  const purchases=invoicePurchases(id),total=invoiceTotal(inv);
  const box=$("creditInvoicesList");
  let detail=document.getElementById("invoiceInlineDetail");if(detail)detail.remove();
  detail=document.createElement("div");detail.id="invoiceInlineDetail";detail.className="invoice-inline-detail";
  detail.innerHTML=`<div class="drilldown-head"><div><h4>${esc(card.nome)} · Fatura ${dataBR(inv.vencimento)}</h4><small>${purchases.length} compra(s) · ${brl(total)}</small></div><button type="button" onclick="this.closest('#invoiceInlineDetail').remove()">×</button></div>${purchases.length?`<div class="invoice-purchase-list">${purchases.map(x=>`<div><span><b>${esc(x.descricao)}</b><small>${dataBR(x.data)} · ${esc(inferCategory(x))}${x.observacao?` · ${esc(x.observacao)}`:""}</small></span><b>${brl(x.valor)}</b></div>`).join("")}</div>`:`<p class="meta">Nenhuma compra vinculada.</p>`}<div class="invoice-detail-total">Total <b>${brl(total)}</b></div>`;
  box.prepend(detail);detail.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function openInvoicePayment(id){
  const inv=invoiceById(id),card=inv&&cardById(inv.cartao_id);if(!inv||!card||inv.status!=="aberta")return;
  const total=invoiceTotal(inv);if(!(total>0))return alert("Esta fatura não possui compras para pagamento.");
  $("invoicePaymentId").value=id;$("invoicePaymentTitle").textContent=`${card.nome} · ${dataBR(inv.vencimento)}`;
  $("invoicePaymentSummary").innerHTML=`<b>Total ${brl(total)}</b><span>Vencimento ${dataBR(inv.vencimento)}</span>`;
  $("invoicePaymentDate").value=hoje();$("invoicePaymentMethod").value="pix";$("invoicePaymentModal").classList.remove("hidden");
}
$("closeInvoicePaymentModal").onclick=()=>$("invoicePaymentModal").classList.add("hidden");
$("invoicePaymentForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("invoicePaymentId").value,inv=invoiceById(id),card=inv&&cardById(inv.cartao_id);if(!inv||!card)return;
  if(inv.status!=="aberta")return alert("Esta fatura já foi quitada.");
  const total=invoiceTotal(inv),data=$("invoicePaymentDate").value,method=$("invoicePaymentMethod").value;
  if(!(total>0))return alert("Fatura sem valor para pagamento.");
  let r=await sb.from("movimentacoes").insert({user_id:uid(),conta:card.conta,tipo:"saida",descricao:`Pagamento fatura ${card.nome} · ${dataBR(inv.vencimento)}`,valor:total,data,
    origem:"pagamento_fatura_cartao",categoria:"Outros",forma_liquidacao:method,impacta_saldo:true,situacao:"quitada",cartao_id:card.id,fatura_cartao_id:inv.id}).select().single();
  if(r.error)return alert("Pagamento da fatura: "+r.error.message);
  const status=data<inv.vencimento?"quitada_antecipadamente":"paga";
  r=await sb.from("cartao_faturas").update({status,data_pagamento:data,forma_pagamento:method,valor_pago:total,movimentacao_pagamento_id:r.data.id}).eq("id",id).eq("user_id",uid());
  if(r.error)return alert("Saída registrada, mas a fatura precisa ser conferida: "+r.error.message);
  $("invoicePaymentModal").classList.add("hidden");await loadAll();
};
function renderCreditCards(){
  const overview=$("creditCardsOverview"),list=$("creditInvoicesList");if(!overview||!list||!current)return;
  const cards=(state.cartoes||[]).filter(c=>c.conta===current),ids=new Set(cards.map(c=>c.id));
  overview.innerHTML=cards.length?`<div class="credit-card-chips">${cards.map(c=>`<button type="button" class="credit-card-chip ${c.ativo===false?"inactive":""}" onclick="editCreditCard('${c.id}')"><b>${esc(c.nome)}</b><small>Fecha ${c.dia_fechamento} · vence ${c.dia_vencimento}${c.ativo===false?" · inativo":""}</small></button>`).join("")}</div>`:`<p class="meta">Nenhum cartão cadastrado em ${accountName(current)}.</p>`;
  const invoices=(state.faturasCartao||[]).filter(f=>ids.has(f.cartao_id)).sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
  list.innerHTML=invoices.length?invoices.map(inv=>{const card=cardById(inv.cartao_id),purchases=invoicePurchases(inv.id),total=invoiceTotal(inv),open=inv.status==="aberta";return `<div class="credit-invoice ${open?"open":"paid"}"><div><b>${esc(card?.nome||"Cartão")} · Fatura ${dataBR(inv.vencimento)}</b><div class="meta">${purchases.length} compra(s) · ${invoiceStatusLabel(inv)}${inv.data_pagamento?` · paga em ${dataBR(inv.data_pagamento)}`:""}</div></div><div class="credit-invoice-actions"><b>${brl(total)}</b><button type="button" onclick="openInvoiceDetails('${inv.id}')">Ver compras</button>${open?`<button class="primary small" type="button" onclick="openInvoicePayment('${inv.id}')">Pagar fatura</button>`:""}</div></div>`}).join(""):`<p class="meta">Nenhuma fatura vinculada aos cartões desta conta.</p>`;
}
function openMov(tipo,x=null,forcedDate=null,forcedAccount=null){
  if(forcedAccount)current=forcedAccount;
  $("mode").value="mov";$("editId").value=x?.id||"";
  $("modalTitle").textContent=x?"Editar lançamento":tipo==="entrada"?"Nova entrada":"Novo gasto";
  $("descricao").value=x?.descricao||"";formatBRMoneyInput($("valor"),x?.valor||0);
  $("data").value=x?.data||forcedDate||hoje();$("data").dataset.tipo=tipo;
  $("categoryWrap").classList.toggle("hidden",tipo==="entrada");
  $("priorityWrap").classList.add("hidden");
  fillCategorySelect($("categoria"),current,x?.categoria||(tipo==="entrada"?"Receita":""));
  $("liquidationMethod").value=x?.forma_liquidacao||"pix";
  $("liquidationCounterparty").value=x?.contraparte||"";
  $("liquidationNote").value=x?.observacao||"";
  fillCreditCardSelect(x?.cartao_id||"");
  syncLiquidationFields();
  $("dateLabel").childNodes[0].nodeValue="Data ";
  $("modal").classList.remove("hidden");
}
function openConta(x=null,forcedDate=null,forcedAccount=null){
  if(forcedAccount)current=forcedAccount;
  $("mode").value="conta";$("editId").value=x?.id||"";
  $("modalTitle").textContent=x?"Editar conta a pagar":"Adicionar conta a pagar";
  $("categoryWrap").classList.add("hidden");
  $("priorityWrap").classList.remove("hidden");
  $("prioridade").value=x?.prioridade||"prioritaria";
  $("descricao").value=x?.descricao||"";formatBRMoneyInput($("valor"),x?.valor||0);
  $("data").value=x?.vencimento||forcedDate||hoje();
  $("liquidationMethod").value=x?.forma_prevista||"pix";
  $("liquidationCounterparty").value=x?.contraparte||"";
  $("liquidationNote").value=x?.observacao||"";
  fillCreditCardSelect("");
  syncLiquidationFields();
  $("dateLabel").childNodes[0].nodeValue="Vencimento ";
  $("modal").classList.remove("hidden");
}
$("closeModal").onclick=()=>$("modal").classList.add("hidden");

$("modalForm").onsubmit=async e=>{
  e.preventDefault();
  const editing=$("editId").value,method=$("liquidationMethod").value;
  const contraparte=$("liquidationCounterparty").value.trim()||null,observacao=$("liquidationNote").value.trim()||null;
  const valor=parseBRMoney($("valor").value),data=$("data").value;
  if(!(valor>0))return alert("Informe um valor maior que zero.");

  if($("mode").value==="mov"){
    const tipoMov=$("data").dataset.tipo;
    if(tipoMov==="entrada"&&method==="credito")return alert("Crédito como obrigação futura é válido para despesas, não para entradas.");
    const impacta_saldo=impactsCash(method);
    const situacao=method==="credito"?"pendente":method==="compensacao"?"compensada":"quitada";
    const p={user_id:uid(),conta:current,tipo:tipoMov,descricao:$("descricao").value.trim(),valor,data,origem:"manual",
      categoria:tipoMov==="entrada"?"Receita":$("categoria").value,forma_liquidacao:method,impacta_saldo,contraparte,observacao,situacao};

    if(editing){
      const {error}=await sb.from("movimentacoes").update(p).eq("id",editing).eq("user_id",uid());
      if(error)return alert(error.message);
    }else{
      const {data:mov,error}=await sb.from("movimentacoes").insert(p).select().single();
      if(error)return alert(error.message);

      if(method==="credito"&&tipoMov==="saida"){
        const card=cardById($("creditCardSelect").value);
        if(!card)return alert("Selecione um cartão de crédito.");
        if(card.conta!==current)return alert("O cartão selecionado pertence a outra conta.");
        try{
          const cycle=invoiceCycleForPurchase(card,data),inv=await getOrCreateInvoice(card,cycle);
          const {error:ue}=await sb.from("movimentacoes").update({cartao_id:card.id,fatura_cartao_id:inv.id}).eq("id",mov.id).eq("user_id",uid());
          if(ue)throw ue;
        }catch(err){return alert("Compra registrada, mas a fatura precisa ser conferida: "+err.message)}
      }
      if(method==="compensacao"){
        try{
          await insertCompensation({conta:current,contraparte,descricao:p.descricao,valor,
            direcao:tipoMov==="entrada"?"credito_usuario":"debito_usuario",data,referencia_tipo:"movimentacao",referencia_id:mov.id,observacao});
        }catch(err){return alert("Movimentação registrada, mas a compensação precisa ser conferida: "+err.message)}
      }
    }
  }else{
    const p={user_id:uid(),conta:current,descricao:$("descricao").value.trim(),valor,vencimento:data,prioridade:$("prioridade").value,
      categoria:"Outros",contraparte,observacao,forma_prevista:method};
    if(!editing)p.status="pendente";
    const q=editing?sb.from("contas").update(p).eq("id",editing).eq("user_id",uid()):sb.from("contas").insert(p);
    const {error}=await q;if(error)return alert(error.message);
  }
  $("modal").classList.add("hidden");
  await loadAll();
};

async function delMov(id){
  alert("Lançamentos confirmados fazem parte do histórico e não podem ser excluídos. Use Editar para corrigir informações.");
}
async function delConta(id){
  if(confirm("Excluir conta?")){
    const {error}=await sb.from("contas").delete().eq("id",id);
    if(error)alert(error.message);else loadAll();
  }
}
function editMov(id){const x=state.mov.find(x=>x.id===id);if(x)openMov(x.tipo,x)}
function editConta(id){const x=state.contas.find(x=>x.id===id);if(x)openConta(x)}
function pagarConta(id){
  const x=state.contas.find(x=>x.id===id);if(!x)return;
  if(x.valor==null||Number(x.valor)<=0){alert("Informe primeiro o valor real desta conta.");openConta(x);return}
  const li=accountLiquidationInfo(x);
  $("accountSettlementId").value=id;
  $("accountSettlementTitle").textContent=x.descricao;
  $("accountSettlementBalance").innerHTML=`<b>Total ${brl(li.total)}</b><span>Liquidado ${brl(li.liquidado)}</span><span>A liquidar ${brl(li.saldo)}</span>`;
  formatBRMoneyInput($("accountSettlementAmount"),li.saldo);
  $("accountSettlementDate").value=hoje();
  $("accountSettlementMethod").value=x.forma_prevista||"pix";
  $("accountSettlementCounterparty").value=x.contraparte||"";
  $("accountSettlementNote").value="";
  $("accountSettlementForm").dataset.operationKey=persistentOperationKey("pagar-conta",id);
  $("accountCreditDueDate").value="";
  const pending=pendingOperationPayload("pagar-conta",id);
  if(pending){
    formatBRMoneyInput($("accountSettlementAmount"),pending.p_valor);
    $("accountSettlementDate").value=pending.p_data;
    $("accountSettlementMethod").value=pending.p_forma_liquidacao;
    $("accountSettlementCounterparty").value=pending.p_contraparte||"";
    $("accountSettlementNote").value=pending.p_observacao||"";
    $("accountCreditDueDate").value=pending.p_vencimento_credito||"";
  }
  syncAccountSettlementMethod();
  $("accountSettlementModal").classList.remove("hidden");
}
function syncAccountSettlementMethod(){
  const credit=$("accountSettlementMethod").value==="credito";
  $("accountCreditDueWrap").classList.toggle("hidden",!credit);
  $("accountCreditDueDate").required=credit;
}
$("accountSettlementMethod").onchange=syncAccountSettlementMethod;
$("closeAccountSettlement").onclick=()=>$("accountSettlementModal").classList.add("hidden");
prepareMoneyInput($("accountSettlementAmount"));
$("accountSettlementForm").onsubmit=async e=>{
  e.preventDefault();
  const lockId=$("accountSettlementId").value;
  await runOnce(`pagar:${lockId}`,async()=>{
  const id=$("accountSettlementId").value,x=state.contas.find(c=>c.id===id);if(!x)return;
  const li=accountLiquidationInfo(x),valor=parseBRMoney($("accountSettlementAmount").value),method=$("accountSettlementMethod").value;
  const data=$("accountSettlementDate").value,contraparte=$("accountSettlementCounterparty").value.trim()||x.contraparte||null;
  const observacao=$("accountSettlementNote").value.trim()||null;
  const operationKey=$("accountSettlementForm").dataset.operationKey||persistentOperationKey("pagar-conta",id);
  if(!(valor>0)||valor>li.saldo+0.009)return alert(`Informe um valor entre R$ 0,01 e ${brl(li.saldo)}.`);
  const due=method==="credito"?$("accountCreditDueDate").value:null;
  if(method==="credito"&&!due)return alert("Informe o vencimento da nova obrigação do crédito.");
  const rpcPayload={
    p_conta_id:id,p_valor:valor,p_data:data,p_forma_liquidacao:method,
    p_contraparte:contraparte,p_observacao:observacao,p_vencimento_credito:due,
    p_chave_idempotencia:operationKey
  };
  persistOperationPayload("pagar-conta",id,rpcPayload);
  const {data:result,error}=await sb.rpc("liquidar_conta_v810",rpcPayload);
  if(error)return alert("Liquidação: "+error.message);
  confirmOperation("pagar-conta",id);
  $("accountSettlementModal").classList.add("hidden");
  delete $("accountSettlementForm").dataset.operationKey;
  await loadAll();
  if(result?.idempotente)alert("Pagamento já confirmado anteriormente. Os dados foram atualizados sem duplicidade.");
  });
};

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

function latestBankReconciliation(account){
  return (state.bankReconciliations||[]).filter(r=>r.conta===account&&r.status==="conciliado").sort((a,b)=>String(b.periodo_fim).localeCompare(String(a.periodo_fim)))[0]||null;
}
function activeBalanceBaseline(account){
  return (state.balanceBaselines||[]).filter(b=>b.conta===account&&b.ativo!==false)
    .sort((a,b)=>String(b.ativado_em||b.created_at||"").localeCompare(String(a.ativado_em||a.created_at||"")))[0]||null;
}
function isAfterBalanceBaseline(x,baseline){
  if(!baseline)return true;
  const movementDate=String(x.data||"").slice(0,10),referenceDate=String(baseline.data_referencia||"").slice(0,10);
  if(movementDate>referenceDate)return true;
  if(movementDate<referenceDate)return false;
  return String(x.created_at||"")>String(baseline.ativado_em||baseline.created_at||"");
}
function saldoMovimentosApos(account,date){
  return state.mov.filter(x=>isBankMovement(x)&&x.conta===account&&String(x.data||"")>String(date||""))
    .reduce((s,x)=>s+(x.tipo==="entrada"?+x.valor:x.tipo==="saida"?-x.valor:0),0);
}
function isBankMovement(x){return x?.impacta_saldo!==false&&x?.ativa_economica!==false&&x?.historico_pre_marco!==true}
function currentBalanceMovements(account){
  const baseline=account==="CNPJ"?activeBalanceBaseline(account):null;
  return (state.mov||[]).filter(x=>x.conta===account&&isBankMovement(x)&&isAfterBalanceBaseline(x,baseline));
}
function saldo(a){
  const baseline=a==="CNPJ"?activeBalanceBaseline(a):null;
  if(baseline)return Number(baseline.saldo_inicial||0)+currentBalanceMovements(a)
    .reduce((s,x)=>s+(x.tipo==="entrada"?+x.valor:x.tipo==="saida"?-x.valor:0),0);
  const recon=latestBankReconciliation(a);
  if(recon)return Number(recon.saldo_final||0)+saldoMovimentosApos(a,recon.periodo_fim);
  return state.mov.filter(x=>x.conta===a&&isBankMovement(x)).reduce((s,x)=>s+(x.tipo==="entrada"?+x.valor:x.tipo==="saida"?-x.valor:0),0);
}
function eligibleBudgets(){return (state.orc||[]).filter(o=>["aprovado","pago"].includes(o.status))}
function businessReceivables(){
  return eligibleBudgets().reduce((acc,o)=>{
    const info=recebimentoInfo(o);
    acc.total+=info.total;acc.liquidado+=info.liquidado;acc.saldo+=info.saldo;
    return acc;
  },{total:0,liquidado:0,saldo:0});
}
function businessGeneralPayables(){
  const contas=(state.contas||[]).filter(c=>c.conta==="CNPJ"&&c.status==="pendente"&&c.ativa!==false);
  const obrigacoes=contas.reduce((s,c)=>s+accountLiquidationInfo(c).saldo,0);
  const faturas=(state.faturasCartao||[]).filter(f=>f.conta==="CNPJ"&&f.status==="aberta").reduce((s,f)=>s+invoiceTotal(f),0);
  return {obrigacoes,faturas,total:obrigacoes+faturas};
}
function businessEconomicResult(){return eligibleBudgets().reduce((s,o)=>s+Number(o.total||0)-serviceCost(o),0)}
function budgetFinancialPosition(){
  const receivables=businessReceivables();
  const budgetAccounts=(state.contas||[]).filter(c=>c.conta==="CNPJ"&&c.ativa!==false&&c.orcamento_id);
  const aPagar=budgetAccounts.reduce((s,c)=>s+accountLiquidationInfo(c).saldo,0);
  return {aReceber:receivables.saldo,aPagar,saldoPendente:receivables.saldo-aPagar,resultadoEconomico:businessEconomicResult()};
}
function ambiguousLegacyBudgetCosts(){
  return (state.mov||[]).filter(x=>x.conta==="CNPJ"&&x.impacta_saldo===true&&["orcamento_custo_item","orcamento_custo_servico"].includes(x.origem));
}
const sum=a=>a.reduce((s,x)=>s+Number(x.valor),0);



const defaultCategories={
  PF:["Receita","Moradia","Alimentação","Mercado","Transporte","Saúde","Lazer","Empréstimos","Transferência","Outros"],
  CNPJ:["Receita","Peças / materiais","Combustível","Alimentação em serviço","Pedágio / viagem","Ferramentas","Terceirização","Impostos","Despesas administrativas","Custos do serviço","Transferência","Outros"]
};
const protectedCategories=new Set(["Receita","Transferência","Peças / materiais","Custos do serviço"]);

async function ensureDefaultCategories(){
  if(!uid())return;
  const missing=[];
  for(const conta of ["PF","CNPJ"]){
    const existing=new Set(state.categorias.filter(c=>c.conta===conta).map(c=>c.nome));
    for(const nome of defaultCategories[conta]){
      if(!existing.has(nome))missing.push({user_id:uid(),conta,nome,protegida:protectedCategories.has(nome),ativa:true});
    }
  }
  if(missing.length){
    const {error}=await sb.from("categorias").upsert(missing,{onConflict:"user_id,conta,nome"});
    if(error){console.warn("Categorias padrão:",error.message);return}
    const {data}=await sb.from("categorias").select("*").eq("ativa",true).order("nome");
    state.categorias=data||state.categorias;
  }
}

function categoryNames(conta=current){
  const list=state.categorias.filter(c=>c.conta===conta&&c.ativa).map(c=>c.nome);
  return [...new Set(list)].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
function fillCategorySelect(select,conta,value=""){
  if(!select)return;
  const names=categoryNames(conta);
  select.innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  if(value&&names.includes(value))select.value=value;
  else if(names.length)select.value=names[0];
}
function renderCategoryUI(){
  if(!current)return;
  const names=categoryNames(current);
  $("categoryFilters").innerHTML=names.map(n=>`<button type="button" data-mov-cat="${esc(n)}" class="${movCategoryFilter===n?"active":""}">${esc(n)}</button>`).join("");
  $("categoryFilters").querySelectorAll("[data-mov-cat]").forEach(b=>b.onclick=()=>{
    movCategoryFilter=b.dataset.movCat;
    $("allMovBtn").classList.remove("active");
    renderCategoryUI();render();
  });
  $("allMovBtn").classList.toggle("active",movCategoryFilter==="TODOS");
  fillCategorySelect($("categoria"),current,$("categoria")?.value);
  fillCategorySelect($("budgetCostCategory"),"CNPJ",$("budgetCostCategory")?.value);
}
$("allMovBtn").onclick=()=>{
  movCategoryFilter="TODOS";
  renderCategoryUI();render();
};
$("toggleCategoryFiltersBtn").onclick=()=>{
  $("categoryFilterDrawer").classList.toggle("hidden");
};
$("openCategoriesManageBtn").onclick=()=>openCategories();
$("openSummaryBtn").onclick=()=>openFinancialSummary();

function inferCategory(x){
  if(x.categoria)return x.categoria;
  if(x.origem==="transferencia")return"Transferência";
  if(x.origem==="orcamento_pago"||x.tipo==="entrada")return"Receita";
  if(x.origem==="orcamento_custo_item")return"Peças / materiais";
  if(x.origem==="orcamento_custo_servico")return"Custos do serviço";
  return x.conta==="PF"?"Outros":"Despesas administrativas";
}

$("closeCategories").onclick=()=>$("categoriesModal").classList.add("hidden");
function openCategories(){
  $("categoriesTitle").textContent=`Categorias · ${accountName(current)}`;
  $("categoryId").value="";$("categoryName").value="";
  renderCategoriesList();$("categoriesModal").classList.remove("hidden");
}
function renderCategoriesList(){
  const list=state.categorias.filter(c=>c.conta===current&&c.ativa);
  $("categoriesList").innerHTML=list.length?list.map(c=>`<div class="item category-item"><div><b>${esc(c.nome)}</b>${c.protegida?'<div class="meta">Categoria do sistema</div>':""}</div><div class="actions">${c.protegida?"":`<button onclick="editCategory('${c.id}')">Editar</button><button class="danger" onclick="deleteCategory('${c.id}')">Excluir</button>`}</div></div>`).join(""):`<p class="meta">Nenhuma categoria.</p>`;
}
$("categoryForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("categoryId").value,nome=$("categoryName").value.trim();
  if(!nome)return;
  const payload={user_id:uid(),conta:current,nome,protegida:false,ativa:true};
  const q=id?sb.from("categorias").update({nome}).eq("id",id):sb.from("categorias").insert(payload);
  const {error}=await q;
  if(error)return alert("Categoria: "+error.message);
  $("categoryId").value="";$("categoryName").value="";
  await loadAll();openCategories();
};
function editCategory(id){
  const c=state.categorias.find(x=>x.id===id);if(!c||c.protegida)return;
  $("categoryId").value=id;$("categoryName").value=c.nome;$("categoryName").focus();
}
async function deleteCategory(id){
  const c=state.categorias.find(x=>x.id===id);if(!c||c.protegida)return;
  if(!confirm(`Excluir a categoria "${c.nome}"? Lançamentos antigos manterão o nome já salvo.`))return;
  const {error}=await sb.from("categorias").update({ativa:false}).eq("id",id);
  if(error)return alert(error.message);
  await loadAll();openCategories();
}


function isTransfer(x){return x.origem==="transferencia"||inferCategory(x)==="Transferência"}
function bankMovementsForReport(conta,year,month=null){
  const baseline=conta==="CNPJ"?activeBalanceBaseline(conta):null;
  if(!baseline)return (state.mov||[]).filter(x=>x.conta===conta&&isBankMovement(x));
  const periodEnd=month===null?`${year}-12-31`:`${year}-${String(month).padStart(2,"0")}-31`;
  return periodEnd<String(baseline.data_referencia||"").slice(0,10)
    ?(state.mov||[]).filter(x=>x.conta===conta&&isBankMovement(x))
    :currentBalanceMovements(conta);
}
function reportIncomeRows(conta,year,month=null){
  return bankMovementsForReport(conta,year,month).filter(x=>{
    const d=String(x.data||"");
    return x.conta===conta&&isBankMovement(x)&&x.tipo==="entrada"&&!isTransfer(x)&&d.startsWith(String(year))&&(month===null||d.slice(5,7)===String(month).padStart(2,"0"));
  });
}
function reportExpenseRows(conta,year,month=null){
  return bankMovementsForReport(conta,year,month).filter(x=>{
    const d=String(x.data||"");
    return x.conta===conta&&isBankMovement(x)&&x.tipo==="saida"&&!isTransfer(x)&&d.startsWith(String(year))&&(month===null||d.slice(5,7)===String(month).padStart(2,"0"));
  });
}
function reportTransferRows(conta,year){
  return bankMovementsForReport(conta,year).filter(x=>isTransfer(x)&&String(x.data||"").startsWith(String(year)));
}
function availableReportYears(conta){
  const yrs=new Set([new Date().getFullYear()]);
  state.mov.filter(x=>x.conta===conta).forEach(x=>{
    const y=Number(String(x.data||"").slice(0,4));
    if(y)yrs.add(y);
  });
  return [...yrs].sort((a,b)=>b-a);
}
function setupReportYear(){
  if(!current||!$("reportYear"))return;
  const yrs=availableReportYears(current);
  if(!yrs.includes(reportYear))reportYear=yrs[0]||new Date().getFullYear();
  $("reportYear").innerHTML=yrs.map(y=>`<option value="${y}" ${y===reportYear?"selected":""}>${y}</option>`).join("");
}
$("reportYear").onchange=()=>{
  reportYear=Number($("reportYear").value)||new Date().getFullYear();
  renderFinancialReport();
};
function renderFinancialReport(){
  if(!current||!$("annualMonthlyRows"))return;
  setupReportYear();
  const y=reportYear;
  const income=reportIncomeRows(current,y);
  const expenses=reportExpenseRows(current,y);
  const transfers=reportTransferRows(current,y);
  const incomeTotal=income.reduce((s,x)=>s+Number(x.valor||0),0);
  const expenseTotal=expenses.reduce((s,x)=>s+Number(x.valor||0),0);
  const transferTotal=transfers.reduce((s,x)=>s+Number(x.valor||0),0);
  const result=incomeTotal-expenseTotal;

  $("reportTitle").textContent=`Resumo ${y} · ${accountName(current)}`;
  $("reportSubtitle").textContent=current==="CNPJ"
    ?"Fluxo bancário realizado. Transferências próprias e eventos econômicos ficam separados."
    :"Entradas e gastos pessoais. Transferências ficam separadas.";
  $("annualIncomeLabel").textContent=current==="CNPJ"?"Entradas bancárias":"Entradas";
  $("monthlyIncomeHead").textContent=current==="CNPJ"?"Entradas bancárias":"Entradas";
  $("annualExpenseLabel").textContent=current==="CNPJ"?"Saídas bancárias":"Gastos";
  $("annualResultLabel").textContent=current==="CNPJ"?"Fluxo bancário líquido":"Resultado";
  $("monthlyResultHead").textContent=current==="CNPJ"?"Fluxo líquido":"Resultado";
  $("annualIncome").textContent=brl(incomeTotal);
  $("annualExpense").textContent=brl(expenseTotal);
  $("annualResult").textContent=brl(result);
  $("annualResult").className="money-value "+(result>0?"positive":result<0?"negative":"");
  $("annualTransfers").textContent=brl(transferTotal);

  const meses=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  $("annualMonthlyRows").innerHTML=meses.map((nome,i)=>{
    const inc=reportIncomeRows(current,y,i+1).reduce((s,x)=>s+Number(x.valor||0),0);
    const exp=reportExpenseRows(current,y,i+1).reduce((s,x)=>s+Number(x.valor||0),0);
    const res=inc-exp;
    return `<tr><td>${nome}</td><td class="money-inline">${brl(inc)}</td><td class="money-inline">${brl(exp)}</td><td class="money-inline ${res>0?"positive":res<0?"negative":""}">${brl(res)}</td></tr>`;
  }).join("");

  const byCat={};
  expenses.forEach(x=>{
    const cat=inferCategory(x);
    byCat[cat]=(byCat[cat]||0)+Number(x.valor||0);
  });
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  $("annualCategoryRows").innerHTML=cats.length
    ? cats.map(([cat,val])=>`<div class="category-report-row"><span>${esc(cat)}</span><strong class="money-inline">${brl(val)}</strong></div>`).join("")
    : `<p class="meta">Nenhum gasto registrado neste ano.</p>`;
}

function csvEscape(v){const s=String(v??"");return `"${s.replaceAll('"','""')}"`;}
function exportHistoryRows(account){
  const rows=[],add=r=>rows.push(r);
  (state.mov||[]).filter(x=>x.conta===account).forEach(x=>add({
    data:x.data||"",conta:account,tipo:x.tipo==="entrada"?"Entrada":"Saída",descricao:x.descricao||"",
    categoria:inferCategory(x)||"",valor:Number(x.valor||0),forma:liquidationLabel(x.forma_liquidacao||""),
    impacta:x.impacta_saldo===false?"Não":"Sim",contraparte:x.contraparte||"",origem:x.origem||"",
    situacao:x.situacao||"",referencia:x.referencia_id||"",observacao:x.observacao||"",fonte:"movimentacoes"
  }));
  if(account==="CNPJ"){
    (state.orcRecebimentos||[]).filter(r=>!r.movimentacao_id).forEach(r=>{
      const o=(state.orc||[]).find(x=>x.id===r.orcamento_id);
      add({data:r.data_recebimento||"",conta:"CNPJ",tipo:"Recebimento orçamento",
        descricao:o?`Orçamento ${o.numero} · ${o.cliente||""}`:"Recebimento de orçamento",categoria:"Receita",
        valor:Number(r.valor||0),forma:liquidationLabel(r.forma_liquidacao||r.forma_pagamento||""),
        impacta:r.historico_pre_marco===true?"Não (pré-Marco)":r.impacta_caixa===false?"Não":"Sim",contraparte:r.contraparte||o?.cliente||"",
        origem:r.origem_registro||"orcamento_recebimentos",situacao:o?.status||"",referencia:r.orcamento_id||"",
        observacao:r.observacao||"",fonte:"orcamento_recebimentos"});
    });
  }
  (state.contaLiquidacoes||[]).filter(r=>!r.movimentacao_id).forEach(r=>{
    const c=(state.contas||[]).find(x=>x.id===r.conta_id);
    if(c?.conta!==account)return;
    add({data:r.data_liquidacao||"",conta:account,tipo:"Liquidação de obrigação",descricao:c?.descricao||"",
      categoria:c?.categoria||"",valor:Number(r.valor||0),forma:liquidationLabel(r.forma_liquidacao||""),
      impacta:r.historico_pre_marco===true?"Não (pré-Marco)":r.impacta_saldo===false?"Não":"Sim",contraparte:r.contraparte||c?.contraparte||"",
      origem:r.origem_registro||"conta_liquidacoes",situacao:c?.status||"",referencia:r.conta_id||"",
      observacao:r.observacao||"",fonte:"conta_liquidacoes"});
  });
  (state.compensacoes||[]).filter(r=>r.conta===account).forEach(r=>add({
    data:r.data||"",conta:account,tipo:r.direcao==="credito_usuario"?"Compensação a favor":"Compensação a pagar",
    descricao:r.descricao||"",categoria:"Compensação / Permuta",valor:Number(r.valor||0),
    forma:"Compensação / Permuta",impacta:"Não",contraparte:r.contraparte||"",
    origem:r.referencia_tipo||"compensacoes",situacao:"Compensada",referencia:r.referencia_id||"",
    observacao:r.observacao||"",fonte:"compensacoes"
  }));
  return rows.sort((a,b)=>String(a.data).localeCompare(String(b.data)));
}
function downloadHistoryCsv(account){
  const rows=exportHistoryRows(account);
  let entradas=0,saidas=0;
  currentBalanceMovements(account).forEach(x=>{
    if(x.tipo==="entrada")entradas+=Number(x.valor||0);
    else if(x.tipo==="saida")saidas+=Number(x.valor||0);
  });
  const headers=["Data","Conta","Tipo","Descrição","Categoria","Valor","Forma de pagamento/liquidação","Impacta saldo?","Contraparte","Origem","Situação","Referência","Observação","Fonte técnica"];
  const lines=[headers.map(csvEscape).join(";")];
  rows.forEach(r=>lines.push([r.data,r.conta,r.tipo,r.descricao,r.categoria,r.valor.toFixed(2).replace(".",","),r.forma,r.impacta,r.contraparte,r.origem,r.situacao,r.referencia,r.observacao,r.fonte].map(csvEscape).join(";")));
  lines.push("");
  [["RESUMO",""],["Entradas com impacto em caixa",entradas],["Saídas com impacto em caixa",saidas],["Saldo calculado pelo histórico exportado",entradas-saidas],["Saldo exibido no app",saldo(account)]].forEach(([label,val])=>{
    const row=[label,"","","","",typeof val==="number"?val.toFixed(2).replace(".",","):"","","","","","","","",""];
    lines.push(row.map(csvEscape).join(";"));
  });
  const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`historico_${account}_${hoje()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function pfReconEntries(){
  const r=latestBankReconciliation("PF");
  return r?(state.bankReconciliationEntries||[]).filter(x=>x.reconciliation_id===r.id):[];
}
function reconSumBy(classification){
  return pfReconEntries().filter(x=>x.classificacao===classification).reduce((s,x)=>s+Number(x.valor||0),0);
}
function renderPfBankReconciliation(){
  const wrap=$("pfBankReconciliationWrap"); if(!wrap)return;
  wrap.classList.toggle("hidden",current!=="PF"); if(current!=="PF")return;
  const r=latestBankReconciliation("PF");
  if(!r){
    $("pfReconPeriod").textContent="Nenhuma conciliação importada";
    $("pfReconEquation").textContent="Importe o arquivo de conciliação PF Nubank.";
    ["pfReconBalance","pfReconRevenue","pfReconExpenses","pfReconOwnTransfers","pfReconThirdTransfers","pfReconCardPayments","pfReconUnclassified"].forEach(id=>$(id).textContent=brl(0));
    return;
  }
  $("pfReconPeriod").textContent=`Nubank · ${dataBR(r.periodo_inicio)} a ${dataBR(r.periodo_fim)}`;
  $("pfReconEquation").textContent=`${brl(r.saldo_inicial)} + ${brl(r.total_entradas)} - ${brl(r.total_saidas)} = ${brl(r.saldo_final)}`;
  $("pfReconBalance").textContent=brl(saldo("PF"));
  $("pfReconRevenue").textContent=brl(reconSumBy("receita"));
  $("pfReconExpenses").textContent=brl(reconSumBy("despesa"));
  $("pfReconOwnTransfers").textContent=brl(reconSumBy("transferencia_propria"));
  $("pfReconThirdTransfers").textContent=brl(reconSumBy("transferencia_terceiro"));
  $("pfReconCardPayments").textContent=brl(reconSumBy("pagamento_fatura"));
  $("pfReconUnclassified").textContent=brl(reconSumBy("a_classificar"));
}
function parseMoneyCsv(v){return Number(String(v||"0").trim().replace(/\./g,"").replace(",","."));}
function parseSemicolonCsvLine(line){
  const out=[]; let cur="",quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++}
      else quoted=!quoted;
    }else if(ch===";"&&!quoted){out.push(cur);cur=""}
    else cur+=ch;
  }
  out.push(cur);
  return out.map(x=>x.trim());
}
function parsePfReconciliationCsv(text){
  const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean),meta={},entries=[]; let header=false;
  for(const line of lines){
    const c=parseSemicolonCsvLine(line);
    if(c[0]==="META"){meta[c[1]]=c[2];continue}
    if(c[0]==="data"){header=true;continue}
    if(!header)continue;
    entries.push({data:c[0],direcao:c[1],valor:parseMoneyCsv(c[2]),contraparte:c[3]||"",descricao:c[4]||"",
      classificacao:c[5]||"a_classificar",categoria_sugerida:c[6]||"",classificacao_confirmada:c[7]==="sim",
      observacao:c[8]||"",source_key:c[9]||""});
  }
  return{meta,entries};
}
async function importPfReconciliationFile(file){
  const {meta:m,entries:e}=parsePfReconciliationCsv(await file.text());
  const keys=e.map(x=>x.source_key).filter(Boolean);
  if(keys.length!==e.length)return alert("Conciliação recusada: existe linha sem identificador técnico.");
  if(new Set(keys).size!==keys.length)return alert("Conciliação recusada: existem identificadores técnicos duplicados no arquivo.");
  const entradas=e.filter(x=>x.direcao==="entrada").reduce((s,x)=>s+x.valor,0);
  const saidas=e.filter(x=>x.direcao==="saida").reduce((s,x)=>s+x.valor,0);
  const saldoInicial=parseMoneyCsv(m.saldo_inicial),saldoFinal=saldoInicial+entradas-saidas;
  const cents=x=>Math.round(Number(x||0)*100);
  if(cents(entradas)!==cents(parseMoneyCsv(m.total_entradas))||cents(saidas)!==cents(parseMoneyCsv(m.total_saidas))||cents(saldoFinal)!==cents(parseMoneyCsv(m.saldo_final)))
    return alert(`Conciliação recusada: ${brl(saldoInicial)} + ${brl(entradas)} - ${brl(saidas)} = ${brl(saldoFinal)}.`);
  if(m.conta!=="PF"||m.banco!=="Nubank")return alert("Arquivo não corresponde à PF Nubank.");
  const payload={user_id:uid(),conta:"PF",banco:"Nubank",periodo_inicio:m.periodo_inicio,periodo_fim:m.periodo_fim,saldo_inicial:saldoInicial,
    total_entradas:entradas,total_saidas:saidas,saldo_final:saldoFinal,status:"conciliado",fonte:"extrato_bancario"};
  const {data:r,error}=await sb.from("bank_reconciliations").upsert(payload,{onConflict:"user_id,conta,banco,periodo_inicio,periodo_fim"}).select("*").single();
  if(error)return alert("Conciliação: "+error.message);
  const del=await sb.from("bank_reconciliation_entries").delete().eq("reconciliation_id",r.id); if(del.error)return alert("Conciliação: "+del.error.message);
  const rows=e.map(x=>({...x,user_id:uid(),reconciliation_id:r.id,conta:"PF",banco:"Nubank",impacta_saldo:true}));
  const ins=await sb.from("bank_reconciliation_entries").insert(rows); if(ins.error)return alert("Conciliação: "+ins.error.message);
  await loadAll(); alert(`Conciliação PF concluída. Saldo bancário em ${dataBR(m.periodo_fim)}: ${brl(saldoFinal)}.`);
}
function render(){
  ensureSelectedPeriod();
  updatePeriodSelectorUI();
  $("saldoPF").textContent=brl(saldo("PF"));
  $("saldoCNPJ").textContent=brl(saldo("CNPJ"));
  const [ano,mes]=selectedPeriod.split("-").map(Number);
  if(current){
    const entradas=reportIncomeRows(current,ano,mes).reduce((s,x)=>s+Number(x.valor||0),0),gastos=reportExpenseRows(current,ano,mes).reduce((s,x)=>s+Number(x.valor||0),0);
    const cnpj=current==="CNPJ",position=cnpj?budgetFinancialPosition():null;
    $("summaryLabel1").textContent=cnpj?"A receber":"Entradas do mês";
    $("summaryLabel2").textContent=cnpj?"A pagar dos orçamentos":"Gastos do mês";
    $("summaryLabel3").textContent=cnpj?"Resultado dos orçamentos":"Resultado do mês";
    $("summaryValue1").textContent=brl(cnpj?position.aReceber:entradas);
    $("summaryValue2").textContent=brl(cnpj?position.aPagar:gastos);
    const monthResult=cnpj?position.resultadoEconomico:entradas-gastos;
    $("summaryValue3").textContent=brl(monthResult);
    const resultCard=$("summaryValue3")?.closest(".summary-card");
    if(resultCard){
      resultCard.classList.toggle("result-positive",monthResult>0);
      resultCard.classList.toggle("result-negative",monthResult<0);
      resultCard.classList.toggle("result-neutral",monthResult===0);
    }
  }
  if(!current)return;
  const s=saldo(current);
  const position=current==="CNPJ"?budgetFinancialPosition():null,budgetBalanceCard=$("budgetBalanceCard");
  if(budgetBalanceCard)budgetBalanceCard.classList.toggle("hidden",current!=="CNPJ");
  if(position&&$("budgetBalanceValue")){
    $("budgetBalanceValue").textContent=brl(position.saldoPendente);
    $("budgetBalanceValue").className="money-value "+(position.saldoPendente>0?"positive":position.saldoPendente<0?"negative":"");
    $("budgetBalanceComposition").textContent=`A receber ${brl(position.aReceber)} − A pagar ${brl(position.aPagar)}`;
  }
  $("saldoAtual").textContent=brl(s);
  $("saldoAtual").className="money-value "+(s>0?"positive":s<0?"negative":"");
  $("statusSaldo").textContent=s>0?"POSITIVO":s<0?"NEGATIVO":"ZERADO";
  $("saldoAtual")?.previousElementSibling && ($("saldoAtual").previousElementSibling.textContent=current==="CNPJ"?"Saldo Real":latestBankReconciliation("PF")?"Saldo bancário":"Saldo atual");
  const legacy=ambiguousLegacyBudgetCosts(),legacyTotal=legacy.reduce((n,x)=>n+Number(x.valor||0),0),legacyNote=$("bankBalanceLegacyNote");
  if(legacyNote){
    legacyNote.classList.toggle("hidden",current!=="CNPJ"||!legacy.length);
    const baseline=activeBalanceBaseline("CNPJ");
    legacyNote.textContent=legacy.length?(baseline?`${legacy.length} custo(s) legado(s), ${brl(legacyTotal)}, preservados no histórico anterior ao Marco Zero.`:`${legacy.length} custo(s) legado(s), ${brl(legacyTotal)}, aguardam classificação humana e permanecem conforme registrados.`):"";
  }
  renderPfBankReconciliation();
  const movimentosConta=state.mov.filter(x=>x.conta===current&&x.ativa_economica!==false&&String(x.data||"").slice(0,7)===selectedPeriod);
  const movimentosFiltrados=movCategoryFilter==="TODOS"
    ? movimentosConta
    : movimentosConta.filter(x=>inferCategory(x)===movCategoryFilter);
  $("movList").innerHTML=listMov(movimentosFiltrados);
  const cs=state.contas.filter(x=>x.conta===current&&x.status==="pendente"&&x.ativa!==false);
  const openInvoices=(state.faturasCartao||[]).filter(f=>f.conta===current&&f.status==="aberta");
  const invoiceOpenTotal=openInvoices.reduce((s,f)=>s+invoiceTotal(f),0);
  const totalOpen=cs.reduce((s,x)=>s+accountLiquidationInfo(x).saldo,0)+invoiceOpenTotal;
  const next30Accounts=cs.filter(x=>{const [y,m,d]=String(x.vencimento||"").slice(0,10).split("-").map(Number);const [ty,tm,td]=hoje().split("-").map(Number);if(!y||!ty)return false;const diff=Math.round((Date.UTC(y,m-1,d)-Date.UTC(ty,tm-1,td))/86400000);return diff>=0&&diff<=30}).reduce((s,x)=>s+accountLiquidationInfo(x).saldo,0);
  const next30Invoices=openInvoices.filter(f=>{const [y,m,d]=String(f.vencimento||"").split("-").map(Number);const [ty,tm,td]=hoje().split("-").map(Number);const diff=Math.round((Date.UTC(y,m-1,d)-Date.UTC(ty,tm-1,td))/86400000);return diff>=0&&diff<=30}).reduce((s,f)=>s+invoiceTotal(f),0);
  if($("payableTotal"))$("payableTotal").textContent=brl(totalOpen);
  if($("payable30"))$("payable30").textContent=brl(next30Accounts+next30Invoices);
  if($("payableCount"))$("payableCount").textContent=String(cs.length+openInvoices.length);
  const urgent=cs.filter(x=>(x.prioridade||"prioritaria")==="urgente");
  const priority=cs.filter(x=>(x.prioridade||"prioritaria")==="prioritaria");
  const wait=cs.filter(x=>x.prioridade==="pode_esperar");
  const remaining=a=>a.reduce((n,x)=>n+accountLiquidationInfo(x).saldo,0);
  $("tAtrasadas").textContent=brl(remaining(urgent));
  $("tPagar").textContent=brl(remaining(priority));
  $("tPagas").textContent=brl(remaining(wait));
  $("atrasadas").innerHTML=listConta(urgent,true);
  $("pagar").innerHTML=listConta(priority,true);
  $("pagas").innerHTML=listConta(wait,true);
  renderCompensationSummary();
  renderCreditCards();
  if(current==="CNPJ")renderOrc();
}
function actionMenu(items){
  const valid=items.filter(Boolean);
  if(!valid.length)return"";
  return `<details class="row-action-menu"><summary title="Ações">⋮</summary><div class="row-action-popover">${valid.join("")}</div></details>`;
}
function listMov(a){
  return a.length?a.slice(0,60).map(x=>{
    const canEdit=x.origem!=="transferencia"&&x.origem!=="orcamento_pago"&&!String(x.origem||"").startsWith("orcamento_custo");
    const bank=isBankMovement(x),kind=bank?(x.tipo==="entrada"?"Entrada bancária":"Saída bancária"):"Evento econômico";
    return `<div class="item movement-item ${bank?"bank-movement":"economic-movement"}"><div><b>${esc(x.descricao)}</b><div class="meta">${dataBR(x.data)} · ${kind} · ${esc(inferCategory(x))}${x.forma_liquidacao?` · ${esc(liquidationLabel(x.forma_liquidacao))}`:""}${x.cartao_id?` · ${esc(cardById(x.cartao_id)?.nome||"Cartão")}`:""}${x.fatura_cartao_id?` · Fatura ${dataBR(invoiceById(x.fatura_cartao_id)?.vencimento)}`:""}${!bank?" · sem movimento bancário":""}${x.contraparte?` · ${esc(x.contraparte)}`:""}</div></div><div class="item-value-actions"><b class="money-inline ${bank?(x.tipo==="entrada"?"positive":"negative"):"economic-value"}">${bank?(x.tipo==="entrada"?"+":"-"):""} ${brl(x.valor)}</b>${actionMenu([canEdit?`<button onclick="editMov('${x.id}')">Editar</button>`:""])}</div></div>`;
  }).join(""):`<p class="meta">Nenhum lançamento.</p>`;
}
function dueText(x){
  const today=new Date(hoje()+"T12:00:00"),due=new Date(x.vencimento+"T12:00:00");
  const days=Math.round((due-today)/86400000);
  if(days<0)return `<span class="due overdue-text">Vencida há ${Math.abs(days)} dia${Math.abs(days)===1?"":"s"}</span>`;
  if(days===0)return `<span class="due urgent-text">Vence hoje</span>`;
  if(days===1)return `<span class="due urgent-text">Vence amanhã</span>`;
  return `<span class="due">Vence em ${days} dias</span>`;
}
function listConta(a,open){
  return a.length?a.map(x=>{
    const li=accountLiquidationInfo(x),display=li.saldo;
    const status=x.revisao_manual?`Revisar · liquidado ${brl(li.liquidado)}`:li.partial?`Parcial · liquidado ${brl(li.liquidado)}`:li.liquidado>0&&li.saldo<=0?"Quitada":priorityLabel(x);
    return `<div class="item bill-item"><div><b>${esc(x.descricao)}</b><div class="meta">${dueText(x)} · ${status}${x.forma_prevista?` · ${esc(liquidationLabel(x.forma_prevista))}`:""}${x.contraparte?` · ${esc(x.contraparte)}`:""}</div></div><div class="item-value-actions"><b class="money-inline">${x.valor==null?"Valor pendente":brl(display)}</b>${actionMenu([
      open&&li.saldo>0?`<button onclick="pagarConta('${x.id}')">Liquidar</button>`:"",
      open?`<button onclick="editConta('${x.id}')">Editar</button>`:"",
      open&&!li.liquidado?`<button onclick="delConta('${x.id}')">Remover conta</button>`:""
    ])}</div></div>`;
  }).join(""):`<p class="meta">Nenhuma conta.</p>`;
}


prepareMoneyInput($("valor"));
prepareMoneyInput($("fixedValue"));

// CONTAS FIXAS

$("fixedActionsBtn").onclick=()=>$("fixedActionsMenu").classList.toggle("hidden");
$("addFixedBtn").onclick=()=>{$("fixedActionsMenu").classList.add("hidden");openFixed()};
$("closeFixed").onclick=()=>$("fixedModal").classList.add("hidden");
function syncFixedValueType(){
  const variable=$("fixedValueType").value==="variavel";
  $("fixedValueWrap").classList.toggle("disabled-field",variable);
  $("fixedValue").disabled=variable;
  $("fixedVariableHelp").classList.toggle("hidden",!variable);
  if(variable)$("fixedValue").value="";
}
$("fixedValueType").onchange=syncFixedValueType;

function openFixed(x=null){
  $("fixedId").value=x?.id||"";
  $("fixedTitle").textContent=x?"Editar conta fixa":"Nova conta fixa";
  $("fixedAccount").value=x?.conta||current||"PF";
  $("fixedDesc").value=x?.descricao||"";
  $("fixedValueType").value=x?.tipo_valor||"fixo";
  $("fixedPriority").value=x?.prioridade||"prioritaria";
  formatBRMoneyInput($("fixedValue"),x?.valor||0);
  $("fixedDay").value=x?.dia_vencimento||"";
  syncFixedValueType();
  $("fixedModal").classList.remove("hidden");
}
$("fixedForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("fixedId").value;
  const tipoValor=$("fixedValueType").value;
  const valor=tipoValor==="fixo"?parseBRMoney($("fixedValue").value):null;
  if(tipoValor==="fixo"&&!(valor>0))return alert("Informe o valor padrão da conta fixa.");
  const p={
    user_id:uid(),
    conta:$("fixedAccount").value,
    descricao:$("fixedDesc").value.trim(),
    valor,
    tipo_valor:tipoValor,
    prioridade:$("fixedPriority").value,
    dia_vencimento:+$("fixedDay").value,
    ativa:true
  };
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
  $("fixedActionsMenu").classList.add("hidden");
  const competencia=new Date();competencia.setDate(1);
  const {data,error}=await sb.rpc("gerar_contas_fixas_mes",{p_competencia:iso(competencia)});
  if(error)return alert("Contas fixas: "+error.message);
  alert(`${data||0} conta(s) criada(s) para este mês.`);
  await loadAll();
};
function renderFixas(){
  if(!$("fixedList"))return;
  const a=current?state.fixas.filter(x=>x.conta===current):state.fixas;
  $("fixedList").innerHTML=a.length?a.map(x=>{
    const variable=(x.tipo_valor||"fixo")==="variavel";
    return `<div class="fixed-item"><div><b>${esc(x.descricao)}</b><div class="meta">${accountName(x.conta)} · vence dia ${x.dia_vencimento} · ${variable?"Valor variável":"Valor fixo"} · ${priorityLabel(x)}</div></div><div class="item-value-actions"><b class="money-inline">${variable?"Valor do mês":brl(x.valor)}</b>${actionMenu([
      `<button onclick="editFixed('${x.id}')">Editar</button>`,
      `<button onclick="delFixed('${x.id}')">Remover conta fixa</button>`
    ])}</div></div>`;
  }).join(""):`<p class="meta">Nenhuma conta fixa cadastrada.</p>`;
}


$("orcCondicaoPagamento").onchange=()=>{
  $("orcCondicaoDetalheWrap").classList.toggle("hidden",$("orcCondicaoPagamento").value!=="Personalizado");
};

// CLIENTES
function normClient(v){return String(v||"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function renderClientSuggestions(){
  const box=$("clientSuggestions"),q=normClient($("orcCliente").value.trim());
  if(!q){box.classList.add("hidden");box.innerHTML="";return}
  const digits=q.replace(/\D/g,"");
  const found=state.clientes.filter(c=>normClient(c.nome).includes(q)||(digits&&String(c.documento||"").replace(/\D/g,"").includes(digits))).slice(0,6);
  if(!found.length){box.innerHTML=`<button type="button" class="client-new-suggestion" onclick="openClientModalFromBudget()">＋ Cadastrar “${esc($("orcCliente").value.trim())}”</button>`;box.classList.remove("hidden");return}
  box.innerHTML=found.map(c=>`<button type="button" class="client-suggestion" onclick="selectClient('${c.id}')"><b>${esc(c.nome)}</b><small>${esc(c.documento||c.whatsapp||"")}</small></button>`).join("");
  box.classList.remove("hidden");
}
function selectClient(id){
  const c=state.clientes.find(x=>x.id===id);if(!c)return;
  selectedClientId=c.id;$("orcCliente").value=c.nome||"";$("orcWhatsapp").value=c.whatsapp||"";
  $("clientSuggestions").classList.add("hidden");
}
$("orcCliente").oninput=()=>{selectedClientId=null;renderClientSuggestions()};
$("orcCliente").onfocus=renderClientSuggestions;
$("orcCliente").onblur=()=>setTimeout(()=>$("clientSuggestions").classList.add("hidden"),180);
function openClientModalFromBudget(){
  $("clientId").value="";$("clientName").value=$("orcCliente").value.trim();$("clientDocument").value="";$("clientWhatsapp").value=$("orcWhatsapp").value.trim();$("clientEmail").value="";$("clientAddress").value="";
  $("clientModalTitle").textContent="Novo cliente";$("clientModal").classList.remove("hidden");setTimeout(()=>$("clientName").focus(),50);
}
$("newClientBtn").onclick=openClientModalFromBudget;
function closeClientModal(){$("clientModal").classList.add("hidden")}
$("closeClientModal").onclick=closeClientModal;$("cancelClientModal").onclick=closeClientModal;
$("clientForm").onsubmit=async e=>{
  e.preventDefault();
  const payload={user_id:uid(),nome:$("clientName").value.trim(),documento:$("clientDocument").value.trim()||null,whatsapp:$("clientWhatsapp").value.trim()||null,email:$("clientEmail").value.trim()||null,endereco:$("clientAddress").value.trim()||null};
  const {data,error}=await sb.from("clientes").insert(payload).select().single();
  if(error)return alert("Cliente: "+error.message);
  state.clientes.push(data);state.clientes.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR"));
  selectClient(data.id);closeClientModal();
};
// ORÇAMENTOS
$("btnOrc").onclick=()=>{
  $("orcList").classList.add("hidden");
  $("mobileBudgetBack")?.classList.remove("hidden");
  $("orcEditModeBanner").classList.remove("hidden");
  $("orcEditModeTitle").textContent="Novo orçamento";
  resetOrc(false);
  $("orcFormWrap").classList.remove("hidden");
  $("saveOrcBtn").textContent="Salvar orçamento";
  $("existingPhotos").innerHTML="";
  $("orcData").value=hoje();
  $("orcFormaPagamento").value="PIX";
  $("orcCondicaoPagamento").value="À vista";
  $("orcCondicaoDetalhe").value="";
  $("orcCondicaoDetalheWrap").classList.add("hidden");
  $("orcPrestador").value=state.profile?.prestador_nome||state.profile?.nome||"";
  addOrcItem();
  $("orcFormWrap").scrollIntoView({behavior:"smooth",block:"start"});
};
$("cancelOrc").onclick=()=>resetOrc();
$("mobileBudgetBack").onclick=()=>{
  if(confirm("Voltar para a lista de orçamentos? Alterações não salvas serão descartadas."))resetOrc();
};
$("addItem").onclick=()=>addOrcItem();
$("addCostBtn").onclick=()=>addCost();


function showBudgetFeedback(msg,type="ok"){
  const el=$("orcSaveMsg");
  if(!el)return;
  el.textContent=msg;
  el.className=`save-feedback ${type}`;
  clearTimeout(showBudgetFeedback._t);
  showBudgetFeedback._t=setTimeout(()=>el.classList.add("hidden"),2600);
}
function resetOrc(hide=true){
  editingOrcId=null;
  selectedClientId=null;
  if($("saveOrcBtn"))$("saveOrcBtn").textContent="Salvar orçamento";
  pendingPhotos=[];
  $("orcForm").reset();
  $("orcItens").innerHTML="";
  $("orcCustos").innerHTML="";
  if(hide){$("orcFormWrap").classList.add("hidden");$("orcList").classList.remove("hidden");$("orcEditModeBanner").classList.add("hidden");$("mobileBudgetBack")?.classList.add("hidden");}
  calcOrc();
}
function addOrcItem(data=null){
  const f=$("budgetItemTemplate").content.cloneNode(true),r=f.querySelector(".budget-item-row");
  r.dataset.recordId=data?.id||"";
  const tipo=r.querySelector(".iTipo"),desc=r.querySelector(".iDesc"),qtd=r.querySelector(".iQtd"),fornec=r.querySelector(".iFornec"),val=r.querySelector(".iVal"),custo=r.querySelector(".iCusto");
  if(data){
    tipo.value=data.tipo||"peca";
    desc.value=data.descricao||"";
    qtd.value=data.quantidade??1;
    fornec.value=data.fornecimento||"prestador";
    val.value=data.valor_unitario??0;
    custo.value=data.custo_unitario??0;
  }
  const syncItem=()=>{
    const mao=tipo.value==="mao_obra";
    if(mao){
      fornec.value="prestador";
      fornec.disabled=true;
      custo.disabled=true;
      custo.value="0";
      val.disabled=false;
      val.required=true;
      val.placeholder="Valor da M.O.";
    }else{
      fornec.disabled=false;
      const cliente=fornec.value==="cliente";
      val.disabled=cliente;
      custo.disabled=cliente;
      val.required=!cliente;
      if(cliente){val.value="0";custo.value="0"}
      val.placeholder=cliente?"Fornecido pelo cliente":"Valor cobrado";
      custo.placeholder=cliente?"Sem custo do prestador":"Custo real";
      r.classList.toggle("supplied-by-client",cliente);
    }
    if(mao)r.classList.remove("supplied-by-client");
    calcOrc();
  };
  r.querySelectorAll("input,select").forEach(i=>i.oninput=calcOrc);
  tipo.onchange=syncItem;
  fornec.onchange=syncItem;
  r.querySelector(".remove-budget-item").onclick=()=>{r.remove();calcOrc()};
  $("orcItens").appendChild(f);
  syncItem();
}
function addCost(data=null){
  const f=$("costTemplate").content.cloneNode(true),r=f.querySelector(".cost-row");
  r.dataset.recordId=data?.id||"";
  fillCategorySelect(r.querySelector(".cCat"),"CNPJ",data?.categoria||"Custos do serviço");
  if(data){
    r.querySelector(".cDesc").value=data.descricao||"";
    r.querySelector(".cVal").value=data.valor??0;
  }
  r.querySelectorAll("input,select").forEach(i=>i.oninput=calcOrc);
  r.querySelector(".remove-cost").onclick=()=>{r.remove();calcOrc()};
  $("orcCustos").appendChild(f);
  calcOrc();
}
function editOrc(id){
  const o=state.orc.find(x=>x.id===id);
  if(!o)return;
  $("orcList").classList.add("hidden");
  $("mobileBudgetBack")?.classList.remove("hidden");
  $("orcEditModeBanner").classList.remove("hidden");
  $("orcEditModeTitle").textContent=`Orçamento ${o.numero} · ${o.cliente||""}`;
  if(!["rascunho","orcamento","enviado","aprovado"].includes(o.status)){
    alert("Este orçamento não pode mais ser editado.");
    return;
  }
  editingOrcId=id;
  selectedClientId=o.cliente_id||null;
  $("saveOrcBtn").textContent="Salvar alterações";
  $("orcForm").reset();
  $("orcItens").innerHTML="";
  $("orcCustos").innerHTML="";
  $("orcPrestador").value=o.prestador||state.profile?.prestador_nome||state.profile?.nome||"";
  $("orcCliente").value=o.cliente||"";
  $("orcWhatsapp").value=o.whatsapp||"";
  $("orcEquipamento").value=o.equipamento_modelo||"";
  $("orcData").value=o.data||hoje();
  $("orcFormaPagamento").value=o.forma_pagamento||"PIX";
  $("orcCondicaoPagamento").value=o.condicao_pagamento||"À vista";
  $("orcCondicaoDetalhe").value=o.condicao_pagamento_detalhe||"";
  $("orcCondicaoDetalheWrap").classList.toggle("hidden",$("orcCondicaoPagamento").value!=="Personalizado");
  $("orcDesc").value=o.descricao||"";
  const its=state.orcItens.filter(x=>x.orcamento_id===id);
  const custos=state.orcCustos.filter(x=>x.orcamento_id===id);
  if(its.length)its.forEach(addOrcItem); else addOrcItem();
  custos.forEach(addCost);
  renderExistingPhotos(id);
  $("orcFormWrap").classList.remove("hidden");
  calcOrc();
  $("orcFormWrap").scrollIntoView({behavior:"smooth",block:"start"});
}
function orcItems(){
  return[...document.querySelectorAll(".budget-item-row")].map(r=>{
    const tipo=r.querySelector(".iTipo").value;
    const fornecimento=tipo==="mao_obra"?"prestador":r.querySelector(".iFornec").value;
    const cliente=tipo==="peca"&&fornecimento==="cliente";
    return{
      id:r.dataset.recordId||null,
      tipo,
      fornecimento,
      descricao:r.querySelector(".iDesc").value.trim(),
      quantidade:+r.querySelector(".iQtd").value||0,
      valor_unitario:cliente?0:(+r.querySelector(".iVal").value||0),
      custo_unitario:cliente?0:(+r.querySelector(".iCusto").value||0)
    };
  });
}
function orcCosts(){
  return[...document.querySelectorAll(".cost-row")].map(r=>({
    id:r.dataset.recordId||null,
    descricao:r.querySelector(".cDesc").value.trim(),
    categoria:r.querySelector(".cCat").value,
    valor:+r.querySelector(".cVal").value||0
  }));
}


async function compressPhotoFile(file){
  if(!file||!String(file.type||"").startsWith("image/"))return file;
  try{
    const bmp=await createImageBitmap(file);
    const maxSide=1600;
    const ratio=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
    const w=Math.max(1,Math.round(bmp.width*ratio)),h=Math.max(1,Math.round(bmp.height*ratio));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    canvas.getContext("2d").drawImage(bmp,0,0,w,h);
    bmp.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.82));
    if(!blob)return file;
    const base=(file.name||"foto").replace(/\.[^.]+$/,"");
    return new File([blob],`${base}.jpg`,{type:"image/jpeg",lastModified:Date.now()});
  }catch(e){console.warn("Compressão de foto:",e);return file}
}
async function photoFileHash(file){
  try{
    const buf=await file.arrayBuffer();
    const digest=await crypto.subtle.digest("SHA-256",buf);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }catch(e){
    return `${file.name}:${file.size}:${file.lastModified}`;
  }
}
function photoHashExists(hash){
  if(!hash)return false;
  return pendingPhotos.some(p=>p.arquivo_hash===hash)||state.orcFotos.some(f=>f.orcamento_id===editingOrcId&&f.arquivo_hash===hash);
}
async function addPendingPhotos(files,tipo){
  let duplicadas=0;
  for(const file of [...files]){
    const compressed=await compressPhotoFile(file);
    const arquivo_hash=await photoFileHash(compressed);
    if(photoHashExists(arquivo_hash)){duplicadas++;continue}
    pendingPhotos.push({file:compressed,tipo,legenda:"",arquivo_hash});
  }
  renderPendingPhotos();
  if(duplicadas)alert(`${duplicadas} foto(s) duplicada(s) não foram adicionadas.`);
}
const bindPhotoInput=(id,tipo)=>{
  const el=$(id);if(!el)return;
  el.onchange=async e=>{await addPendingPhotos(e.target.files,tipo);e.target.value=""};
};
bindPhotoInput("orcCameraAntes","antes");
bindPhotoInput("orcFotosAntes","antes");
bindPhotoInput("orcCameraDurante","durante");
bindPhotoInput("orcFotosDurante","durante");
bindPhotoInput("orcCameraDepois","depois");
bindPhotoInput("orcFotosDepois","depois");

function photoStageLabel(tipo){return tipo==="depois"?"DEPOIS":tipo==="durante"?"DURANTE":"ANTES"}
function renderPendingPhotos(){
  $("photoPreview").innerHTML=pendingPhotos.map((p,i)=>`<div class="photo-thumb pending photo-pending-card">
    <div><span class="photo-tag ${p.tipo}">${photoStageLabel(p.tipo)}</span><span>${esc(p.file.name)}</span></div>
    <input class="photo-caption-input" value="${esc(p.legenda||"")}" placeholder="Legenda opcional" oninput="pendingPhotos[${i}].legenda=this.value">
    <button type="button" onclick="removePendingPhoto(${i})" title="Remover foto">🗑</button>
  </div>`).join("");
}
function removePendingPhoto(i){pendingPhotos.splice(i,1);renderPendingPhotos()}

async function renderExistingPhotos(orcamentoId){
  if(!orcamentoId){$("existingPhotos").innerHTML="";return}
  const fotos=state.orcFotos.filter(f=>f.orcamento_id===orcamentoId);
  if(!fotos.length){$("existingPhotos").innerHTML='<div class="meta">Nenhuma foto salva ainda.</div>';return}
  $("existingPhotos").innerHTML=`<div class="meta photo-existing-title">Fotos já salvas (${fotos.length})</div><div class="existing-photo-grid"><div class="preview-loading">Carregando fotos...</div></div>`;
  const rows=(await Promise.all(fotos.map(async f=>({f,url:await signedPhotoUrl(f.storage_path)}))));
  const grid=$("existingPhotos").querySelector(".existing-photo-grid");
  grid.innerHTML=rows.map(({f,url})=>`<div class="existing-photo-card">
    <div class="existing-photo-image">${url?`<img src="${url}" alt="${(f.tipo||"antes")==="depois"?"Depois":"Antes"}">`:'<div class="photo-unavailable">Foto indisponível</div>'}</div>
    <div class="existing-photo-info"><span class="photo-tag ${f.tipo||"antes"}">${photoStageLabel(f.tipo||"antes")}</span><small title="${esc(f.nome_arquivo||"foto")}">${esc(f.nome_arquivo||"foto")}</small>
    <input class="photo-caption-input" value="${esc(f.legenda||"")}" placeholder="Legenda opcional" onchange="savePhotoCaption('${f.id}',this.value)"></div>
    <button type="button" class="photo-delete-btn" onclick="deleteSavedPhoto('${f.id}')" title="Remover esta foto" aria-label="Remover esta foto">🗑</button>
  </div>`).join("");
}
async function savePhotoCaption(id,legenda){
  const r=await sb.from("orcamento_fotos").update({legenda:String(legenda||"").trim()||null}).eq("id",id).eq("user_id",uid());
  if(r.error)return alert("Não foi possível salvar a legenda: "+r.error.message);
  const f=state.orcFotos.find(x=>x.id===id);if(f)f.legenda=String(legenda||"").trim()||null;
}
async function deleteSavedPhoto(id){
  const f=state.orcFotos.find(x=>x.id===id);if(!f)return;
  if(!confirm(`Remover esta foto do orçamento?\\n${f.nome_arquivo||"Foto"}`))return;
  // primeiro remove o registro; depois tenta limpar o arquivo do Storage
  let r=await sb.from("orcamento_fotos").delete().eq("id",id).eq("user_id",uid());
  if(r.error)return alert("Não foi possível remover a foto: "+r.error.message);
  if(f.storage_path){
    const s=await sb.storage.from("orcamento-fotos").remove([f.storage_path]);
    if(s.error)console.warn("Arquivo de foto permaneceu no Storage:",s.error.message);
  }
  state.orcFotos=state.orcFotos.filter(x=>x.id!==id);
  await renderExistingPhotos(f.orcamento_id);
  renderOrc();
  alert("Foto removida.");
}

async function uploadBudgetPhotos(orcamentoId){
  for(const p of pendingPhotos){
    const file=p.file;
    const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-zA-Z0-9]/g,"");
    const path=`${uid()}/${orcamentoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const up=await sb.storage.from("orcamento-fotos").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
    if(up.error)throw up.error;
    const ins=await sb.from("orcamento_fotos").insert({
      user_id:uid(),orcamento_id:orcamentoId,storage_path:path,nome_arquivo:file.name,tipo:p.tipo,legenda:p.legenda||null,arquivo_hash:p.arquivo_hash||null
    });
    if(ins.error)throw ins.error;
  }
  pendingPhotos=[];
  renderPendingPhotos();
}
async function signedPhotoUrl(path){
  const {data,error}=await sb.storage.from("orcamento-fotos").createSignedUrl(path,3600);
  return error?null:data.signedUrl;
}
async function openBudgetPhotos(id){
  const fotos=state.orcFotos.filter(f=>f.orcamento_id===id);
  if(!fotos.length)return alert("Este orçamento ainda não possui fotos.");
  const urls=(await Promise.all(fotos.map(async f=>({f,url:await signedPhotoUrl(f.storage_path)})))).filter(x=>x.url);
  const w=window.open("","_blank");
  if(!w)return alert("Permita pop-ups para visualizar as fotos.");
  w.document.write(`<title>Fotos do orçamento</title><style>body{font-family:Arial;padding:20px;background:#f4f4f5}img{max-width:100%;max-height:75vh;display:block;margin:12px auto;border-radius:10px}.box{background:white;padding:12px;margin:12px 0;border-radius:12px}.tag{font-weight:700;font-size:12px;padding:5px 8px;border-radius:999px;background:#e5e7eb}</style><h2>Fotos do orçamento</h2>${urls.map(x=>`<div class="box"><span class="tag">${(x.f.tipo||"antes")==="depois"?"DEPOIS":"ANTES"}</span><b> ${esc(x.f.nome_arquivo||"Foto")}</b><img src="${x.url}"></div>`).join("")}`);
  w.document.close();
}

function calcOrc(){
  document.querySelectorAll(".budget-item-row").forEach(r=>{
    const tipo=r.querySelector(".iTipo")?.value;
    const fornecimento=tipo==="mao_obra"?"prestador":r.querySelector(".iFornec")?.value;
    const cliente=tipo==="peca"&&fornecimento==="cliente";
    const q=Number(r.querySelector(".iQtd")?.value||0),v=Number(r.querySelector(".iVal")?.value||0);
    const t=r.querySelector(".iTotal");
    if(t){
      t.textContent=cliente?"Fornecido pelo cliente":brl(q*v);
      t.classList.toggle("client-supplied-total",cliente);
    }
  });
  const its=orcItems(),custos=orcCosts();
  const pecas=its.filter(x=>x.tipo==="peca"&&x.fornecimento!=="cliente").reduce((s,x)=>s+x.quantidade*x.valor_unitario,0);
  const mo=its.filter(x=>x.tipo==="mao_obra").reduce((s,x)=>s+x.quantidade*x.valor_unitario,0);
  const custoItens=its.filter(x=>x.tipo==="peca"&&x.fornecimento!=="cliente").reduce((s,x)=>s+x.quantidade*x.custo_unitario,0);
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
  $("saveOrcBtn").disabled=true;
  $("saveOrcBtn").textContent="Salvando...";
  showBudgetFeedback("Salvando orçamento...","info");
  const its=orcItems(),custos=orcCosts(),t=calcOrc();
  let statusOriginal=null;
  if(!its.length)return alert("Adicione pelo menos um item.");
  const prestador=$("orcPrestador").value.trim();
  if(prestador)await sb.from("profiles").update({prestador_nome:prestador}).eq("id",uid());

  const payload={
    prestador,
    cliente_id:selectedClientId,
    cliente:$("orcCliente").value.trim(),
    whatsapp:$("orcWhatsapp").value,
    equipamento_modelo:$("orcEquipamento").value.trim(),
    data:$("orcData").value,
    descricao:$("orcDesc").value,
    forma_pagamento:$("orcFormaPagamento").value,
    condicao_pagamento:$("orcCondicaoPagamento").value,
    condicao_pagamento_detalhe:$("orcCondicaoDetalhe").value.trim(),
    total:t.total,
    subtotal_pecas:t.pecas,
    subtotal_mao_obra:t.mo,
    custo_itens:t.custoItens,
    custo_servico:t.custoServico,
    resultado:t.resultado
  };

  let orcamentoId=editingOrcId;
  if(editingOrcId){
    const atual=state.orc.find(x=>x.id===editingOrcId);
    const statusAntes=atual?.status;
    statusOriginal=statusAntes;
    if(!atual||!["rascunho","orcamento","enviado","aprovado"].includes(atual.status)){
      return alert("Este orçamento não pode mais ser editado.");
    }
    const {error}=await sb.from("orcamentos").update(payload).eq("id",editingOrcId).eq("user_id",uid());
    if(error)return alert(error.message);

  }else{
    const {data:o,error}=await sb.from("orcamentos").insert({
      user_id:uid(),...payload,status:"rascunho"
    }).select().single();
    if(error)return alert(error.message);
    orcamentoId=o.id;
  }

  if(editingOrcId){
    const itemIds=new Set(its.map(x=>x.id).filter(Boolean));
    const costIds=new Set(custos.map(x=>x.id).filter(Boolean));
    const removedItems=state.orcItens.filter(x=>x.orcamento_id===orcamentoId&&!itemIds.has(x.id));
    const removedCosts=state.orcCustos.filter(x=>x.orcamento_id===orcamentoId&&!costIds.has(x.id));
    for(const x of its){
      const {id,...values}=x;
      const q=id
        ?sb.from("orcamento_itens").update(values).eq("id",id).eq("user_id",uid())
        :sb.from("orcamento_itens").insert({user_id:uid(),orcamento_id:orcamentoId,...values});
      const {error}=await q;if(error)return alert(error.message);
    }
    for(const x of custos){
      const {id,...values}=x;
      const q=id
        ?sb.from("orcamento_custos").update(values).eq("id",id).eq("user_id",uid())
        :sb.from("orcamento_custos").insert({user_id:uid(),orcamento_id:orcamentoId,...values});
      const {error}=await q;if(error)return alert(error.message);
    }
    for(const x of removedItems){
      const {error}=await sb.from("orcamento_itens").delete().eq("id",x.id).eq("user_id",uid());
      if(error)return alert("Item removido: "+error.message);
    }
    for(const x of removedCosts){
      const {error}=await sb.from("orcamento_custos").delete().eq("id",x.id).eq("user_id",uid());
      if(error)return alert("Custo removido: "+error.message);
    }
  }else{
    const itemRows=its.map(({id,...x})=>({user_id:uid(),orcamento_id:orcamentoId,...x}));
    const costRows=custos.map(({id,...x})=>({user_id:uid(),orcamento_id:orcamentoId,...x}));
    const r=await sb.from("orcamento_itens").insert(itemRows);
    if(r.error)return alert(r.error.message);
    if(costRows.length){
      const rc=await sb.from("orcamento_custos").insert(costRows);
      if(rc.error)return alert(rc.error.message);
    }
  }
  try{if(pendingPhotos.length)await uploadBudgetPhotos(orcamentoId)}catch(err){return alert("Fotos: "+(err.message||err))}

  if(statusOriginal==="aprovado"){
    const sync=await sb.rpc("aprovar_orcamento",{p_orcamento_id:orcamentoId,p_data:hoje()});
    if(sync.error)return alert("Sincronização dos custos: "+sync.error.message);
  }

  const wasEditing=Boolean(editingOrcId);
  $("saveOrcBtn").disabled=false;
  $("saveOrcBtn").textContent=wasEditing?"Salvar alterações":"Salvar orçamento";
  showBudgetFeedback(wasEditing?"Orçamento atualizado com sucesso.":"Orçamento salvo com sucesso.","ok");
  resetOrc(false);
  await loadAll();
  $("orcFormWrap").classList.add("hidden");
  $("orcList").classList.remove("hidden");
  $("orcEditModeBanner").classList.add("hidden");
  $("mobileBudgetBack")?.classList.add("hidden");
};
async function enviarOrc(id){
  if(!confirm("Marcar este orçamento como enviado ao cliente?"))return;
  const {error}=await sb.from("orcamentos").update({status:"enviado"}).eq("id",id).eq("status","rascunho");
  if(error)alert(error.message);else loadAll();
}
async function aprovarOrc(id){
  if(!confirm("Confirmar aprovação? Os custos serão registrados como despesas econômicas e obrigações a pagar, sem reduzir o saldo bancário."))return;
  await runOnce(`aprovar:${id}`,async()=>{
    const {error}=await sb.rpc("aprovar_orcamento",{p_orcamento_id:id,p_data:hoje()});
    if(error)alert("Aprovação: "+error.message);else await loadAll();
  });
}

function openApprovedCost(id){
  $("budgetCostOrcId").value=id;
  $("budgetCostForm").dataset.operationKey=persistentOperationKey("custo-orcamento",id);
  $("budgetCostDesc").value="";
  fillCategorySelect($("budgetCostCategory"),"CNPJ","Custos do serviço");
  $("budgetCostValue").value="";
  $("budgetCostDate").value=hoje();
  const pending=pendingOperationPayload("custo-orcamento",id);
  if(pending){
    $("budgetCostDesc").value=pending.p_descricao;
    $("budgetCostCategory").value=pending.p_categoria;
    $("budgetCostValue").value=pending.p_valor;
    $("budgetCostDate").value=pending.p_data;
  }
  $("budgetCostModal").classList.remove("hidden");
}
$("closeBudgetCost").onclick=()=>$("budgetCostModal").classList.add("hidden");
$("budgetCostForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("budgetCostOrcId").value;
  await runOnce(`custo:${id}`,async()=>{
    const operationKey=$("budgetCostForm").dataset.operationKey||persistentOperationKey("custo-orcamento",id);
    const rpcPayload={
      p_orcamento_id:id,
      p_descricao:$("budgetCostDesc").value.trim(),
      p_categoria:$("budgetCostCategory").value,
      p_valor:+$("budgetCostValue").value,
      p_data:$("budgetCostDate").value,
      p_chave_idempotencia:operationKey
    };
    persistOperationPayload("custo-orcamento",id,rpcPayload);
    const {error}=await sb.rpc("registrar_custo_orcamento_v810",rpcPayload);
    if(error)return alert("Custo: "+error.message);
    confirmOperation("custo-orcamento",id);
    delete $("budgetCostForm").dataset.operationKey;
    $("budgetCostModal").classList.add("hidden");
    await loadAll();
  });
};

function addMonthsISO(dateStr,months){
  const [y,m,d]=String(dateStr).split("-").map(Number);
  const base=new Date(y,m-1,d);
  const targetMonth=base.getMonth()+Number(months||3);
  base.setMonth(targetMonth);
  if(base.getMonth()!==((targetMonth%12)+12)%12)base.setDate(0);
  return iso(base);
}
function garantiaInfo(o){
  const inicio=o.concluido_em||o.pago_em||null;
  const ate=o.garantia_ate||(inicio?addMonthsISO(String(inicio).slice(0,10),Number(o.garantia_meses||3)):null);
  if(!ate)return null;
  const ativa=ate>=hoje();
  return {inicio:String(inicio).slice(0,10),ate,ativa,meses:Number(o.garantia_meses||3)};
}
function recebimentoInfo(o){
  const rs=state.orcRecebimentos.filter(r=>r.orcamento_id===o.id);
  const liquidado=rs.reduce((s,r)=>s+Number(r.valor||0),0);
  const recebido=rs.filter(r=>r.impacta_caixa!==false).reduce((s,r)=>s+Number(r.valor||0),0);
  const compensado=rs.filter(r=>r.impacta_caixa===false||r.forma_liquidacao==="compensacao").reduce((s,r)=>s+Number(r.valor||0),0);
  const total=Number(o.total||0), saldo=Math.max(0,total-liquidado);
  const vencido=saldo>0 && o.proximo_vencimento && String(o.proximo_vencimento)<hoje();
  const cor=saldo<=0?"verde":(liquidado>0&&!vencido?"laranja":"vermelho");
  return {rs,recebido,compensado,liquidado,total,saldo,vencido,cor};
}
function pagarOrc(id){
  const o=state.orc.find(x=>x.id===id);if(!o)return;
  const ri=recebimentoInfo(o);
  $("paymentOrcId").value=id;
  $("paymentDate").value=hoje();
  $("paymentConclusionDate").value="";
  $("paymentNextDue").value=o.proximo_vencimento||"";
  $("paymentInstallment").value="";
  $("paymentMethod").value="pix";$("paymentCounterparty").value=o.cliente||"";$("paymentNote").value="";
  $("paymentAmount").value="";
  $("paymentForm").dataset.operationKey=persistentOperationKey("receber-orcamento",id);
  const pending=pendingOperationPayload("receber-orcamento",id);
  if(pending){
    formatBRMoneyInput($("paymentAmount"),pending.p_valor);
    $("paymentDate").value=pending.p_data;
    $("paymentMethod").value=pending.p_forma_liquidacao;
    $("paymentCounterparty").value=pending.p_contraparte||"";
    $("paymentNote").value=pending.p_observacao||"";
    $("paymentInstallment").value=pending.p_parcela||"";
    $("paymentNextDue").value=pending.p_proximo_vencimento||"";
    $("paymentConclusionDate").value=pending.p_concluido_em||"";
  }
  $("paymentBalanceInfo").innerHTML=`<b>Total ${brl(ri.total)}</b><span>Recebido ${brl(ri.recebido)}</span><span>A receber ${brl(ri.saldo)}</span>`;
  $("paymentModal").classList.remove("hidden");
}
prepareMoneyInput($("paymentAmount"));
$("closePaymentModal").onclick=()=>$("paymentModal").classList.add("hidden");
$("paymentForm").onsubmit=async e=>{
  e.preventDefault();
  const lockId=$("paymentOrcId").value;
  await runOnce(`receber:${lockId}`,async()=>{
  const id=$("paymentOrcId").value,o=state.orc.find(x=>x.id===id);if(!o)return;
  const ri=recebimentoInfo(o),valor=parseBRMoney($("paymentAmount").value),method=$("paymentMethod").value;
  const contraparte=$("paymentCounterparty").value.trim()||o.cliente||null,observacao=$("paymentNote").value.trim()||null;
  const operationKey=$("paymentForm").dataset.operationKey||persistentOperationKey("receber-orcamento",id);
  if(!(valor>0))return alert("Informe o valor liquidado.");
  if(valor>ri.saldo+0.009)return alert(`O valor não pode ser maior que o saldo de ${brl(ri.saldo)}.`);
  const rpcPayload={
    p_orcamento_id:id,p_valor:valor,p_data:$("paymentDate").value,
    p_forma_liquidacao:method,p_contraparte:contraparte,p_observacao:observacao,
    p_parcela:$("paymentInstallment").value.trim()||null,
    p_proximo_vencimento:$("paymentNextDue").value||null,
    p_concluido_em:$("paymentConclusionDate").value||null,
    p_chave_idempotencia:operationKey
  };
  persistOperationPayload("receber-orcamento",id,rpcPayload);
  const {data:result,error}=await sb.rpc("registrar_recebimento_orcamento_v810",rpcPayload);
  if(error)return alert("Recebimento/liquidação: "+error.message);
  confirmOperation("receber-orcamento",id);
  $("paymentModal").classList.add("hidden");
  delete $("paymentForm").dataset.operationKey;
  alert(result?.idempotente?"Recebimento já confirmado anteriormente. Nenhum valor foi duplicado.":result?.status==="pago"?"Serviço totalmente liquidado.":`Liquidação parcial registrada. Saldo: ${brl(result?.saldo||0)}`);
  await loadAll();
  });
};

async function delOrc(id){
  const o=state.orc.find(x=>x.id===id);
  if(!o)return;
  if(!["rascunho","orcamento"].includes(o.status))return alert("Somente orçamentos em rascunho podem ser excluídos.");
  if(confirm("Excluir este rascunho?")){
    const {error}=await sb.from("orcamentos").delete().eq("id",id).eq("user_id",uid());
    if(error)alert(error.message);else loadAll();
  }
}

async function imageUrlToData(url){
  const r=await fetch(url);if(!r.ok)throw new Error("Falha ao carregar foto");
  const blob=await r.blob();
  return await new Promise((resolve,reject)=>{
    const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob);
  });
}
function pdfSafe(v){return String(v??"").replace(/[^\x20-\x7EÀ-ÿ]/g," ")}
let previewBudgetId=null;
let previewGeneratedPack=null;
async function buildBudgetClientPreview(o){
  const its=state.orcItens.filter(x=>x.orcamento_id===o.id);
  const fotos=state.orcFotos.filter(x=>x.orcamento_id===o.id);
  const gi=garantiaInfo(o);
  const itemRows=its.map(i=>{
    const cliente=i.tipo==="peca"&&i.fornecimento==="cliente";
    return `<tr><td>${i.tipo==="mao_obra"?"M.O.":"Material"}</td><td>${esc(i.descricao)}</td><td>${i.quantidade}</td><td>${cliente?"Cliente":"Prestador"}</td><td>${cliente?"—":brl(i.valor_unitario)}</td><td>${cliente?'<b class="client-supplied-label">Fornecido pelo cliente</b>':brl(Number(i.quantidade)*Number(i.valor_unitario))}</td></tr>`;
  }).join("");
  const photos=(await Promise.all(fotos.map(async f=>({f,url:await signedPhotoUrl(f.storage_path)})))).filter(x=>x.url);
  const photoHtml=(tipo,label)=>{
    const group=photos.filter(x=>(x.f.tipo||"antes")===tipo);
    if(!group.length)return"";
    return `<section class="preview-photo-group"><h4>${label}</h4><div class="preview-photo-grid">${group.map(x=>`<figure><img src="${x.url}" alt="${label}"><figcaption>${x.f.legenda?esc(x.f.legenda):esc(x.f.nome_arquivo||"Foto")}</figcaption></figure>`).join("")}</div></section>`;
  };
  return `<article class="client-document-preview">
    <header><h1>ORÇAMENTO / RELATÓRIO DE SERVIÇO</h1></header>
    <section class="preview-client-data">
      <p><b>Prestador:</b> ${esc(o.prestador||state.profile?.prestador_nome||state.profile?.nome||"-")}</p>
      <p><b>Orçamento Nº:</b> ${esc(o.numero)} <b>Data:</b> ${dataBR(o.data)}</p>
      <p><b>Cliente:</b> ${esc(o.cliente||"-")}</p>
      ${o.whatsapp?`<p><b>WhatsApp:</b> ${esc(o.whatsapp)}</p>`:""}
      ${o.equipamento_modelo?`<p><b>Equipamento / Modelo:</b> ${esc(o.equipamento_modelo)}</p>`:""}
      ${o.descricao?`<h3>Descrição do serviço</h3><p>${esc(o.descricao)}</p>`:""}
    </section>
    <h3>ITENS COMERCIAIS</h3>
    <div class="preview-table-wrap"><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd.</th><th>Fornecimento</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>${itemRows||`<tr><td colspan="6">Nenhum item.</td></tr>`}</tbody></table></div>
    <div class="preview-grand-total">TOTAL: ${brl(o.total)}</div>
    <section><p><b>Forma de pagamento:</b> ${esc(o.forma_pagamento||"Não informada")}</p><p><b>Condição de pagamento:</b> ${esc(o.condicao_pagamento||"Não informada")}${o.condicao_pagamento_detalhe?` — ${esc(o.condicao_pagamento_detalhe)}`:""}</p></section>
    ${photos.length?`<section class="preview-photo-summary"><h3>REGISTRO FOTOGRÁFICO</h3>${photoHtml("antes","ANTES")}${photoHtml("durante","DURANTE")}${photoHtml("depois","DEPOIS")}</section>`:""}
    <section class="preview-warranty"><b>Garantia do serviço:</b> ${gi?`${gi.meses} meses — válida até ${dataBR(gi.ate)}.`:"3 meses a partir da data de conclusão/entrega."}</section>
    <footer>Documento referente ao orçamento e ao registro dos serviços descritos acima.</footer>
  </article>`;
}
async function previewPdfCliente(id){
  const o=state.orc.find(x=>x.id===id);if(!o)return;
  previewBudgetId=id;
  previewGeneratedPack=null;
  $("previewShareBtn").disabled=true;
  $("previewShareBtn").title="Gere o PDF antes de compartilhar";
  $("pdfPreviewTitle").textContent=`Orçamento ${o.numero} · ${o.cliente||""}`;
  $("pdfPreviewBody").innerHTML='<div class="preview-loading">Carregando pré-visualização e fotos...</div>';
  $("pdfPreviewModal").classList.remove("hidden");
  $("pdfPreviewBody").innerHTML=await buildBudgetClientPreview(o);
}
$("closePdfPreview").onclick=()=>{$("pdfPreviewModal").classList.add("hidden");previewBudgetId=null;previewGeneratedPack=null};
$("previewEditBtn").onclick=()=>{const id=previewBudgetId;$("pdfPreviewModal").classList.add("hidden");if(id)editOrc(id)};
$("previewGenerateBtn").onclick=async()=>{
  if(!previewBudgetId)return;
  const btn=$("previewGenerateBtn"),original=btn.innerHTML;
  btn.disabled=true;btn.innerHTML="⏳ <span>Gerando...</span>";
  try{
    const pack=await gerarPdfCliente(previewBudgetId,null,"blob");
    if(!pack)throw new Error("Não foi possível gerar o PDF.");
    previewGeneratedPack=pack;
    downloadGeneratedPdf(pack);
    $("previewShareBtn").disabled=false;
    $("previewShareBtn").title="Compartilhar PDF";
    btn.innerHTML="✓ <span>PDF gerado</span>";
    setTimeout(()=>{btn.disabled=false;btn.innerHTML=original},1600);
  }catch(err){
    previewGeneratedPack=null;
    $("previewShareBtn").disabled=true;
    btn.disabled=false;btn.innerHTML=original;
    alert("Erro ao gerar PDF: "+(err.message||err));
  }
};
$("previewShareBtn").onclick=async()=>{
  if(!previewGeneratedPack)return alert("Gere o PDF antes de compartilhar.");
  await compartilharPackPdf(previewGeneratedPack,$("previewShareBtn"));
};
async function gerarPdfCliente(id,btn=null,modo="salvar"){
  const o=state.orc.find(x=>x.id===id);if(!o)return;
  const its=state.orcItens.filter(x=>x.orcamento_id===id);
  const fotos=state.orcFotos.filter(x=>x.orcamento_id===id);
  const {jsPDF}=window.jspdf||{};
  if(!jsPDF)return alert("Gerador de PDF não carregou. Atualize a página e tente novamente.");

  const originalText=btn?.textContent||"Gerar PDF";
  if(btn){btn.disabled=true;btn.textContent="Gerando PDF...";}

  try{
    const doc=new jsPDF({unit:"mm",format:"a4"});
    const pageW=210,pageH=297,margin=16,contentW=pageW-margin*2;
    let y=18;

    const addPageNumber=()=>{
      const n=doc.getNumberOfPages();
      for(let i=1;i<=n;i++){
        doc.setPage(i);
        doc.setFont("helvetica","normal");
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Página ${i} de ${n}`,pageW-margin,pageH-8,{align:"right"});
        doc.setTextColor(0);
      }
    };
    const ensure=(needed=20)=>{if(y+needed>275){doc.addPage();y=18}};
    const line=(txt,size=10,bold=false)=>{
      doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);
      const lines=doc.splitTextToSize(pdfSafe(txt),contentW);
      doc.text(lines,margin,y);y+=lines.length*(size*0.42)+2;
    };

    doc.setFont("helvetica","bold");doc.setFontSize(18);
    doc.text("ORÇAMENTO / RELATÓRIO DE SERVIÇO",margin,y);y+=9;
    doc.setDrawColor(180);doc.line(margin,y,pageW-margin,y);y+=7;

    line(`Prestador: ${o.prestador||state.profile?.prestador_nome||state.profile?.nome||"-"}`,10,true);
    line(`Orçamento Nº ${o.numero}   Data: ${dataBR(o.data)}`);
    line(`Cliente: ${o.cliente||"-"}`,11,true);
    if(o.whatsapp)line(`WhatsApp: ${o.whatsapp}`);
    if(o.equipamento_modelo)line(`Equipamento / Modelo: ${o.equipamento_modelo}`);
    if(o.descricao){y+=2;line("Descrição do serviço",11,true);line(o.descricao);}

    ensure(25);y+=3;line("ITENS COMERCIAIS",12,true);
    its.forEach(i=>{
      ensure(10);
      const tipo=i.tipo==="mao_obra"?"M.O.":"Material";
      const cliente=i.tipo==="peca"&&i.fornecimento==="cliente";
      if(cliente){
        line(`${tipo}: ${i.descricao} — Qtd. ${i.quantidade} — Fornecido pelo cliente`,9);
      }else{
        line(`${tipo}: ${i.descricao} — ${i.quantidade} x ${brl(i.valor_unitario)} = ${brl(Number(i.quantidade)*Number(i.valor_unitario))}`,9);
      }
    });

    ensure(18);y+=4;
    doc.setFillColor(245,245,245);doc.roundedRect(margin,y-5,contentW,14,2,2,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(13);
    doc.text(`TOTAL: ${brl(o.total)}`,pageW-margin,y+4,{align:"right"});y+=16;

    ensure(22);
    line(`Forma de pagamento: ${o.forma_pagamento||"Não informada"}`,9,true);
    const condicao=o.condicao_pagamento||"Não informada";
    const detalhe=o.condicao_pagamento_detalhe?` — ${o.condicao_pagamento_detalhe}`:"";
    line(`Condição de pagamento: ${condicao}${detalhe}`,9);
    if(o.status==="pago"&&o.forma_pagamento_efetiva){
      line(`Forma de pagamento realizada: ${o.forma_pagamento_efetiva}`,9);
    }

    const drawPhotoGrid=async(grupo,label)=>{
      const gf=fotos.filter(f=>(f.tipo||"antes")===grupo);
      if(!gf.length)return;

      ensure(15);
      line(label,11,true);

      const gap=5;
      const cellW=(contentW-gap)/2;
      const imageH=46;const captionH=8;const cellH=imageH+captionH;
      let col=0;

      for(const f of gf){
        if(col===0)ensure(cellH+8);

        const url=await signedPhotoUrl(f.storage_path);if(!url)continue;
        try{
          const data=await imageUrlToData(url);
          const props=doc.getImageProperties(data);
          const scale=Math.min(cellW/props.width,imageH/props.height);
          const w=props.width*scale,h=props.height*scale;
          const x=margin+col*(cellW+gap)+(cellW-w)/2;
          const yy=y+(imageH-h)/2;

          doc.setDrawColor(220);
          doc.roundedRect(margin+col*(cellW+gap),y,cellW,cellH,1.5,1.5);
          doc.addImage(data,props.fileType||"JPEG",x,yy,w,h);
          if(f.legenda){
            doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(90);
            const cap=doc.splitTextToSize(pdfSafe(f.legenda),cellW-4).slice(0,2);
            doc.text(cap,margin+col*(cellW+gap)+2,y+imageH+4);
            doc.setTextColor(0);
          }

          col++;
          if(col===2){
            col=0;
            y+=cellH+6;
          }
        }catch(e){console.warn("Foto PDF",e)}
      }
      if(col!==0)y+=cellH+6;
      y+=2;
    };

    if(fotos.length){
      ensure(20);
      line("REGISTRO FOTOGRÁFICO",12,true);
      await drawPhotoGrid("antes","ANTES");
      await drawPhotoGrid("durante","DURANTE");
      await drawPhotoGrid("depois","DEPOIS");
    }

    const gi=garantiaInfo(o);
    if(gi){
      ensure(18);y+=3;
      line(`Garantia do serviço: ${gi.meses} meses — válida até ${dataBR(gi.ate)}.`,9,true);
    }else{
      ensure(18);y+=3;
      line("Garantia do serviço: 3 meses a partir da data de conclusão/entrega.",9,true);
    }
    ensure(20);y+=4;
    doc.setDrawColor(190);doc.line(margin,y,pageW-margin,y);y+=6;
    line("Documento referente ao orçamento e ao registro dos serviços descritos acima.",8);

    addPageNumber();

    const filename=`orcamento-${o.numero}-${(o.cliente||"cliente").replace(/[^a-zA-Z0-9À-ÿ]+/g,"-")}.pdf`;
    if(modo==="blob"){
      if(btn){btn.disabled=false;btn.textContent=originalText;}
      return {blob:doc.output("blob"),filename};
    }
    doc.save(filename);
    if(btn){
      btn.textContent="PDF gerado";
      setTimeout(()=>{btn.disabled=false;btn.textContent=originalText},1800);
    }
  }catch(err){
    console.error(err);
    alert("Erro ao gerar PDF: "+(err.message||err));
    if(btn){btn.disabled=false;btn.textContent=originalText;}
  }
}
function downloadGeneratedPdf(pack){
  const url=URL.createObjectURL(pack.blob),a=document.createElement("a");
  a.href=url;a.download=pack.filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1800);
}
async function compartilharPackPdf(pack,btn=null){
  const original=btn?.innerHTML||"Compartilhar";
  if(btn){btn.disabled=true;btn.innerHTML="⏳";}
  try{
    const file=new File([pack.blob],pack.filename,{type:"application/pdf"});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({title:"Orçamento / Relatório de Serviço",text:"Segue o orçamento / relatório de serviço.",files:[file]});
      return;
    }
    downloadGeneratedPdf(pack);
    alert("Este navegador não permite compartilhar o PDF diretamente. O arquivo foi baixado para você enviar pelo WhatsApp, e-mail ou outro aplicativo.");
  }catch(err){
    if(err?.name!=="AbortError"){
      downloadGeneratedPdf(pack);
      alert("Não foi possível abrir o compartilhamento nativo. O PDF foi baixado como alternativa.");
    }
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML=original;}
  }
}
async function compartilharPdfCliente(id,btn=null){
  const original=btn?.textContent||"Compartilhar";
  if(btn){btn.disabled=true;btn.textContent="Preparando...";}
  try{
    const pack=await gerarPdfCliente(id,null,"blob");
    if(!pack)throw new Error("Não foi possível preparar o PDF.");
    const file=new File([pack.blob],pack.filename,{type:"application/pdf"});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({title:"Orçamento / Relatório de Serviço",text:"Segue o orçamento / relatório de serviço.",files:[file]});
      if(btn){btn.textContent="Compartilhado";setTimeout(()=>{btn.disabled=false;btn.textContent=original},1500);}
      return;
    }
    const url=URL.createObjectURL(pack.blob),a=document.createElement("a");
    a.href=url;a.download=pack.filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    alert("O compartilhamento direto não está disponível neste navegador. O PDF foi baixado para você compartilhar.");
  }catch(err){
    if(err?.name!=="AbortError")alert("Não foi possível compartilhar: "+(err.message||err));
  }finally{
    if(btn&&btn.textContent!=="Compartilhado"){btn.disabled=false;btn.textContent=original;}
  }
}


function nfseForOrc(id){return state.orcNfse.find(n=>n.orcamento_id===id)||null}
function nfseFinancialInfo(o,n){
  const ri=recebimentoInfo(o);
  const valor=Number(n?.valor||0);
  return {recebido:ri.recebido,liquidado:ri.liquidado,aReceber:Math.max(0,valor-ri.liquidado),pago:o.status==="pago"||ri.saldo<=0};
}
function renderNfseSection(o){
  const n=nfseForOrc(o.id);
  const operacional=(o.concluido_em||o.status==="pago")?"Serviço concluído":"Serviço em andamento";
  if(!n){
    return `<details class="nfse-section"><summary><span>Nota Fiscal</span><span class="nfse-pill not-issued">Não emitida</span></summary>
      <div class="nfse-body">
        <div class="nfse-state-grid"><span><small>Operacional</small><b>${operacional}</b></span><span><small>Fiscal</small><b>NFS-e não emitida</b></span><span><small>Financeiro</small><b>${o.status==="pago"?"Pago":"Aguardando recebimento"}</b></span></div>
        <button type="button" class="small" onclick="openNfseModal('${o.id}')">＋ Registrar NFS-e</button>
      </div></details>`;
  }
  const fi=nfseFinancialInfo(o,n);
  const diff=Math.abs(Number(n.valor||0)-Number(o.total||0))>0.009;
  return `<details class="nfse-section"><summary><span>Nota Fiscal</span><span class="nfse-pill issued">Emitida</span></summary>
    <div class="nfse-body">
      <div class="nfse-state-grid">
        <span><small>Operacional</small><b>${operacional}</b></span>
        <span><small>Fiscal</small><b>NFS-e emitida</b></span>
        <span><small>Financeiro</small><b>${fi.pago?"Pago":"Aguardando pagamento"}</b></span>
      </div>
      <div class="nfse-data-grid">
        <span><small>Número</small><b>${esc(n.numero)}</b></span>
        <span><small>Emissão</small><b>${dataBR(n.data_emissao)}</b></span>
        <span><small>Valor</small><b class="money-inline">${brl(n.valor)}</b></span>
        ${n.data_prevista_pagamento?`<span><small>Previsão pagamento</small><b>${dataBR(n.data_prevista_pagamento)}</b></span>`:""}
      </div>
      ${!fi.pago?`<div class="nfse-receivable"><b>NFS-e emitida — Aguardando pagamento</b><span>A receber considerando os recebimentos registrados: ${brl(fi.aReceber)}</span></div>`:""}
      ${diff?`<div class="nfse-warning">Valor da NFS-e diferente do valor total do orçamento.</div>`:""}
      <div class="nfse-actions">
        <button type="button" class="orc-icon-action preview" onclick="viewNfsePdf('${o.id}')" title="Visualizar DANFSe" aria-label="Visualizar DANFSe">👁</button>
        <button type="button" class="orc-icon-action pdf" onclick="downloadNfsePdf('${o.id}')" title="Baixar DANFSe" aria-label="Baixar DANFSe">📄</button>
        <button type="button" class="orc-icon-action share" onclick="shareNfsePdf('${o.id}')" title="Compartilhar DANFSe" aria-label="Compartilhar DANFSe">↗</button>
        <button type="button" class="orc-icon-action edit" onclick="openNfseModal('${o.id}',true)" title="Editar dados / substituir PDF" aria-label="Editar NFS-e">✎</button>
      </div>
    </div></details>`;
}
function openNfseModal(orcId,editing=false){
  const o=state.orc.find(x=>x.id===orcId);if(!o)return;
  const n=nfseForOrc(orcId);
  $("nfseOrcId").value=orcId;
  $("nfseModalTitle").textContent=n?"Editar NFS-e":"Registrar NFS-e";
  $("nfseNumero").value=n?.numero||"";
  $("nfseDataEmissao").value=n?.data_emissao||hoje();
  formatBRMoneyInput($("nfseValor"),n?.valor??o.total??0);
  $("nfseDataPrevista").value=n?.data_prevista_pagamento||"";
  $("nfsePdf").value="";
  $("nfsePdf").required=!n;
  $("nfseCurrentFile").classList.toggle("hidden",!n?.pdf_nome);
  $("nfseCurrentFile").innerHTML=n?.pdf_nome?`<b>PDF atual:</b> ${esc(n.pdf_nome)}<br><small>Para substituir, selecione outro PDF. A substituição será confirmada antes de salvar.</small>`:"";
  updateNfseValueWarning();
  $("nfseModal").classList.remove("hidden");
}
function closeNfseModal(){$("nfseModal").classList.add("hidden");$("nfsePdf").value=""}
$("closeNfseModal").onclick=closeNfseModal;
prepareMoneyInput($("nfseValor"));
function updateNfseValueWarning(){
  const o=state.orc.find(x=>x.id===$("nfseOrcId").value);
  if(!o)return;
  const v=parseBRMoney($("nfseValor").value);
  $("nfseValueWarning").classList.toggle("hidden",Math.abs(v-Number(o.total||0))<=0.009);
}
$("nfseValor").addEventListener("input",updateNfseValueWarning);
async function nfseSignedUrl(path){
  const {data,error}=await sb.storage.from("orcamento-documentos").createSignedUrl(path,3600);
  if(error)throw error;return data.signedUrl;
}
async function getNfsePdfPack(orcId){
  const n=nfseForOrc(orcId);if(!n?.pdf_path)throw new Error("DANFSe não encontrado.");
  const url=await nfseSignedUrl(n.pdf_path);
  const r=await fetch(url);if(!r.ok)throw new Error("Não foi possível carregar o DANFSe.");
  return {blob:await r.blob(),filename:n.pdf_nome||`danfse-${n.numero||"nfse"}.pdf`,url};
}
async function viewNfsePdf(orcId){
  try{
    const n=nfseForOrc(orcId);if(!n?.pdf_path)return alert("DANFSe não anexado.");
    const url=await nfseSignedUrl(n.pdf_path);
    const w=window.open(url,"_blank");
    if(!w)location.href=url;
  }catch(e){alert("DANFSe: "+(e.message||e))}
}
async function downloadNfsePdf(orcId){
  try{
    const p=await getNfsePdfPack(orcId),url=URL.createObjectURL(p.blob),a=document.createElement("a");
    a.href=url;a.download=p.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);
  }catch(e){alert("DANFSe: "+(e.message||e))}
}
async function shareNfsePdf(orcId){
  try{
    const p=await getNfsePdfPack(orcId);
    const file=new File([p.blob],p.filename,{type:"application/pdf"});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({title:"DANFSe",text:"Segue o DANFSe do serviço.",files:[file]});return;
    }
    const url=URL.createObjectURL(p.blob),a=document.createElement("a");a.href=url;a.download=p.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);
    alert("O compartilhamento direto não está disponível neste navegador. O DANFSe foi baixado para você compartilhar.");
  }catch(e){if(e?.name!=="AbortError")alert("DANFSe: "+(e.message||e))}
}
$("nfseForm").onsubmit=async e=>{
  e.preventDefault();
  const orcId=$("nfseOrcId").value,o=state.orc.find(x=>x.id===orcId);if(!o)return;
  const atual=nfseForOrc(orcId);
  const file=$("nfsePdf").files?.[0]||null;
  if(file&&file.type&&file.type!=="application/pdf")return alert("Anexe somente o DANFSe em PDF.");
  if(file&&atual?.pdf_path&&!confirm("Substituir o PDF/DANFSe atual?"))return;
  const valor=parseBRMoney($("nfseValor").value);
  if(!(valor>0))return alert("Informe o valor da NFS-e.");
  $("saveNfseBtn").disabled=true;$("saveNfseBtn").textContent="Salvando...";
  try{
    let pdf_path=atual?.pdf_path||null,pdf_nome=atual?.pdf_nome||null;
    if(file){
      pdf_path=`${uid()}/${orcId}/danfse.pdf`;
      const up=await sb.storage.from("orcamento-documentos").upload(pdf_path,file,{upsert:true,contentType:"application/pdf",cacheControl:"3600"});
      if(up.error)throw up.error;
      pdf_nome=file.name||`danfse-${$("nfseNumero").value.trim()}.pdf`;
    }
    if(!pdf_path)throw new Error("Anexe o PDF/DANFSe.");
    const payload={
      user_id:uid(),orcamento_id:orcId,numero:$("nfseNumero").value.trim(),
      data_emissao:$("nfseDataEmissao").value,valor,
      data_prevista_pagamento:$("nfseDataPrevista").value||null,
      pdf_path,pdf_nome,updated_at:new Date().toISOString()
    };
    const q=await sb.from("orcamento_nfse").upsert(payload,{onConflict:"orcamento_id"}).select().single();
    if(q.error)throw q.error;
    const ix=state.orcNfse.findIndex(n=>n.orcamento_id===orcId);
    if(ix>=0)state.orcNfse[ix]=q.data;else state.orcNfse.push(q.data);
    closeNfseModal();renderOrc();
    const diff=Math.abs(valor-Number(o.total||0))>0.009;
    alert(diff?"NFS-e registrada. Atenção: valor diferente do total do orçamento.":"NFS-e registrada com sucesso.");
  }catch(err){alert("NFS-e: "+(err.message||err))}
  finally{$("saveNfseBtn").disabled=false;$("saveNfseBtn").textContent="Salvar NFS-e"}
};

function budgetCard(o){
  const its=state.orcItens.filter(x=>x.orcamento_id===o.id);
  const custos=state.orcCustos.filter(x=>x.orcamento_id===o.id);
  const fotos=state.orcFotos.filter(x=>x.orcamento_id===o.id);
  const antes=fotos.filter(f=>(f.tipo||"antes")==="antes").length;
  const durante=fotos.filter(f=>f.tipo==="durante").length;
  const depois=fotos.filter(f=>f.tipo==="depois").length;
  const custoItens=its.filter(x=>x.tipo==="peca"&&x.fornecimento!=="cliente").reduce((s,x)=>s+Number(x.quantidade)*Number(x.custo_unitario||0),0);
  const custoServico=custos.reduce((s,x)=>s+Number(x.valor),0);
  const resultado=Number(o.total)-custoItens-custoServico;
  const gi=garantiaInfo(o);
  const isDraft=["rascunho","orcamento"].includes(o.status);
  const ri=recebimentoInfo(o);
  return `<details class="item budget-record"><summary><div><b>Orçamento ${o.numero} · ${esc(o.cliente)}</b><div class="meta">${dataBR(o.data)}${o.equipamento_modelo?` · ${esc(o.equipamento_modelo)}`:""}</div><span class="status-pill ${o.status}">${({orcamento:"Rascunho",rascunho:"Rascunho",enviado:"Enviado",aprovado:"Aprovado",pago:"Pago"}[o.status]||o.status)}</span>${gi?`<span class="warranty-pill ${gi.ativa?"active":"ended"}">${gi.ativa?"Garantia ativa":"Garantia encerrada"} · ${dataBR(gi.ate)}</span>`:""}</div><b class="money-inline">${brl(o.total)}</b></summary><div class="budget-detail">
    <div class="meta"><b>Prestador:</b> ${esc(o.prestador||"-")}</div>
    <div class="meta"><b>Pagamento:</b> ${esc(o.forma_pagamento||"Não informado")} · ${esc(o.condicao_pagamento||"Não informada")}${o.condicao_pagamento_detalhe?` · ${esc(o.condicao_pagamento_detalhe)}`:""}${o.forma_pagamento_efetiva?` · recebido via ${esc(o.forma_pagamento_efetiva)}`:""}</div>
    ${["aprovado","pago"].includes(o.status)?`<div class="receivable-status ${ri.cor}"><b>${ri.cor==="verde"?"Pagamento concluído":ri.vencido?"Pagamento pendente / parcela vencida":ri.recebido>0?"Pagamento parcial":"Aguardando pagamento"}</b><span>Recebido em dinheiro ${moneySpan(ri.recebido)}</span>${ri.compensado>0?`<span>Compensado ${moneySpan(ri.compensado)}</span>`:""}<span>A receber ${moneySpan(ri.saldo)}</span>${o.proximo_vencimento&&ri.saldo>0?`<span>Próximo vencimento ${dataBR(o.proximo_vencimento)}</span>`:""}</div>`:""}
    <div class="budget-split"><span>Total cobrado <b class="money-inline">${brl(o.total)}</b></span><span>Gastos <b class="money-inline">${brl(custoItens+custoServico)}</b></span><span>Resultado ${o.status==="pago"?"real":"previsto"} <b class="money-inline">${brl(o.status==="pago"?o.resultado:resultado)}</b></span></div>
    <div class="photo-counts"><span>Antes (${antes})</span><span>Durante (${durante})</span><span>Depois (${depois})</span></div>
    ${its.map(i=>{
      const cliente=i.tipo==="peca"&&i.fornecimento==="cliente";
      return `<div class="meta">${i.tipo==="peca"?"Material":"M.O."}: ${esc(i.descricao)} · ${i.quantidade}${cliente?' · <b class="client-supplied-label">Fornecido pelo cliente</b>':` × ${moneySpan(i.valor_unitario)}${Number(i.custo_unitario||0)>0?` · custo ${moneySpan(Number(i.custo_unitario)*Number(i.quantidade))}`:""}`}</div>`;
    }).join("")}
    ${custos.length?`<div class="internal-box"><b>Custos internos</b>${custos.map(c=>`<div class="meta">${esc(c.descricao)} · ${esc(c.categoria||"Custos do serviço")} · ${moneySpan(c.valor)}</div>`).join("")}</div>`:""}
    ${fotos.length?`<button type="button" class="small" onclick="openBudgetPhotos('${o.id}')">Fotos (${fotos.length})</button>`:""}
    ${renderNfseSection(o)}
    <div class="actions"><button class="orc-icon-action preview" onclick="previewPdfCliente('${o.id}')" title="Pré-visualizar documento" aria-label="Pré-visualizar documento">👁</button><button class="orc-icon-action share" onclick="previewPdfCliente('${o.id}')" title="Pré-visualizar antes de compartilhar" aria-label="Pré-visualizar antes de compartilhar">↗</button>${o.status!=="pago"?`<button class="orc-icon-action edit" onclick="editOrc('${o.id}')" title="Editar orçamento" aria-label="Editar orçamento">✎</button>`:""}${isDraft?`<button onclick="enviarOrc('${o.id}')">Marcar enviado</button><button class="warning" onclick="aprovarOrc('${o.id}')">Aprovar</button><button class="danger" onclick="delOrc('${o.id}')">Excluir</button>`:""}${o.status==="enviado"?`<button class="warning" onclick="aprovarOrc('${o.id}')">Aprovar</button>`:""}${o.status==="aprovado"?`<button class="orc-icon-action cost" onclick="openApprovedCost('${o.id}')" title="Registrar custo" aria-label="Registrar custo">＋</button><button class="orc-icon-action done" onclick="pagarOrc('${o.id}')" title="Registrar recebimento" aria-label="Registrar recebimento">✓</button>`:""}</div>
  </div></details>`;
}
function renderOrc(){
  if(!editingOrcId&&$("orcList"))$("orcList").classList.remove("hidden");
  const groups=[
    {key:"draft",title:"Rascunhos",open:false,items:state.orc.filter(o=>["rascunho","orcamento","enviado"].includes(o.status))},
    {key:"approved",title:"Aprovados / Em andamento",open:true,items:state.orc.filter(o=>o.status==="aprovado")},
    {key:"paid",title:"Pagos",open:false,items:state.orc.filter(o=>o.status==="pago")}
  ];
  $("orcList").innerHTML=`<div class="budget-accordions">${groups.map(g=>`
    <details class="budget-group" ${g.open?"open":""}>
      <summary class="budget-group-summary">
        <span>${g.title}</span>
        <span class="budget-group-count">${g.items.length}</span>
      </summary>
      <div class="budget-group-body">
        ${g.items.length?g.items.map(budgetCard).join(""):`<p class="meta empty-column">Nenhum orçamento.</p>`}
      </div>
    </details>`).join("")}</div>`;
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


// V8 — MÓDULOS, HISTÓRICO, RESUMO E GRÁFICOS
let modulePrefs={pf:true,cnpj:true,orc:true};
let monthlyChartInstance=null,categoryChartInstance=null;

async function loadModulePrefs(){
  try{
    const {data,error}=await sb.from("user_module_preferences").select("*").eq("user_id",uid()).maybeSingle();
    if(!error&&data){
      modulePrefs={pf:data.pf_enabled!==false,cnpj:data.cnpj_enabled===true,orc:data.orcamentos_enabled===true};
    }
  }catch(e){console.warn("Módulos",e)}
  applyModulePrefs();
}
function applyModulePrefs(){
  const pf=document.querySelector('[data-account="PF"]');
  const cnpj=document.querySelector('[data-account="CNPJ"]');
  const orc=$("openBudgets");
  if(pf)pf.classList.toggle("module-hidden",!modulePrefs.pf);
  if(cnpj)cnpj.classList.toggle("module-hidden",!modulePrefs.cnpj);
  if(orc)orc.classList.toggle("module-hidden",!(modulePrefs.orc&&modulePrefs.cnpj));
}
function openModuleSettings(){
  $("modPF").checked=modulePrefs.pf;
  $("modCNPJ").checked=modulePrefs.cnpj;
  $("modORC").checked=modulePrefs.orc;
  $("moduleSettingsModal").classList.remove("hidden");
}
if($("moduleSettingsBtn"))$("moduleSettingsBtn").onclick=openModuleSettings;
if($("closeModuleSettings"))$("closeModuleSettings").onclick=()=>$("moduleSettingsModal").classList.add("hidden");
if($("modCNPJ"))$("modCNPJ").onchange=()=>{if(!$("modCNPJ").checked)$("modORC").checked=false};
if($("modORC"))$("modORC").onchange=()=>{if($("modORC").checked)$("modCNPJ").checked=true};
if($("moduleSettingsForm"))$("moduleSettingsForm").onsubmit=async e=>{
  e.preventDefault();
  const payload={user_id:uid(),pf_enabled:$("modPF").checked,cnpj_enabled:$("modCNPJ").checked,orcamentos_enabled:$("modORC").checked};
  const {error}=await sb.from("user_module_preferences").upsert(payload,{onConflict:"user_id"});
  if(error)return alert("Módulos: "+error.message);
  modulePrefs={pf:payload.pf_enabled,cnpj:payload.cnpj_enabled,orc:payload.orcamentos_enabled};
  applyModulePrefs();$("moduleSettingsModal").classList.add("hidden");
};

// V8.10.2 TEMPORARIO: configuração isolada; remover todo o bloco após a regularização.
const V8102_OPERATIONS={
  marco:{title:"1. Configurar Marco Zero",rpc:"configurar_marco_zero_v8102",button:"Configurar Marco Zero",fixed:{conta:"CNPJ",data_referencia:"2026-09-01",saldo_inicial:"1000.00",observacao:"Marco Zero conferido pelo usuário",chave:"marco-zero-cnpj-2026-09-01"},summary:"CNPJ · 01/09/2026 · R$ 1.000,00 · Marco Zero conferido pelo usuário",fields:[]},
  orc5:{title:"2. Regularizar Orçamento 5",rpc:"registrar_baixa_historica_orcamento_v8102",button:"Regularizar Orçamento 5",fixed:{orcamento_id:"14e08369-f858-4731-8afc-2ff32efc6fed",valor:"3500.00",chave:"regularizacao-historica-orc5-3500-v8102",observacao:"Regularização histórica do Orçamento 5"},summary:"14e08369-f858-4731-8afc-2ff32efc6fed · R$ 3.500,00",fields:["data_original","forma_original"]},
  orc6:{title:"3. Regularizar Orçamento 6",rpc:"registrar_baixa_historica_orcamento_v8102",button:"Regularizar Orçamento 6",fixed:{orcamento_id:"2c7e537e-c829-4b13-a416-56c6c9ff17a5",valor:"4000.00",chave:"regularizacao-historica-orc6-4000-v8102",observacao:"Regularização histórica do Orçamento 6"},summary:"2c7e537e-c829-4b13-a416-56c6c9ff17a5 · R$ 4.000,00",fields:["data_original","forma_original"]},
  pistao:{title:"4. Regularizar Pistão",rpc:"regularizar_obrigacao_historica_orcamento_v8102",button:"Regularizar Pistão",fixed:{orcamento_id:"2c7e537e-c829-4b13-a416-56c6c9ff17a5",item_id:"f8b797ab-c3d9-4a39-96f5-431f073d6c8d",descricao:"recuperação pistão da caçamba",valor_total:"5000.00",valor_liquidado:"2500.00",chave:"regularizacao-historica-pistao-orc6-v8102",observacao:"Regularização histórica do custo do pistão"},summary:"Orçamento 6 · Item f8b797ab-c3d9-4a39-96f5-431f073d6c8d<br>recuperação pistão da caçamba · R$ 5.000,00 · liquidado R$ 2.500,00",fields:["data_obrigacao","data_liquidacao","forma_original","contraparte"]}
};
const v8102FieldHtml=name=>{
  if(name==="forma_original")return `<label>Forma original (confirmar)<select name="${name}" required><option value="">Selecione</option><option value="pix">Pix</option><option value="debito">Débito</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label>`;
  const labels={data_original:"Data original",data_obrigacao:"Data da obrigação",data_liquidacao:"Data da liquidação",contraparte:"Contraparte"};
  return `<label>${labels[name]} (confirmar)<input name="${name}" ${name.startsWith("data_")?'type="date" max="2026-09-06"':""} required></label>`;
};
function renderV8102Operations(){
  const host=$("v8102Operations");if(!host)return;
  host.innerHTML=Object.entries(V8102_OPERATIONS).map(([kind,cfg])=>`<form class="v8102-operation" data-v8102-operation="${kind}"><h3>${cfg.title}</h3><p>${cfg.summary}</p>${cfg.fields.length?`<div class="v8102-fields">${cfg.fields.map(v8102FieldHtml).join("")}<label class="full-field">Observação<input name="observacao" value="${esc(cfg.fixed.observacao)}"></label></div>`:""}<pre class="v8102-payload"></pre><button class="primary v8102-run" type="submit" disabled>${cfg.button}</button><pre class="v8102-result" aria-live="polite"></pre></form>`).join("");
}
let v8102OperationRunning=false;
function v8102Raw(form){
  const cfg=V8102_OPERATIONS[form.dataset.v8102Operation];
  return{...cfg.fixed,...Object.fromEntries(new FormData(form).entries())};
}
function v8102Payload(kind,raw){
  if(kind==="marco")return{p_conta:raw.conta,p_data_referencia:raw.data_referencia,p_saldo_inicial:Number(raw.saldo_inicial),p_observacao:raw.observacao,p_chave_idempotencia:raw.chave};
  if(kind==="orc5"||kind==="orc6")return{p_orcamento_id:raw.orcamento_id,p_valor:Number(raw.valor),p_data_original:raw.data_original,p_forma_original:raw.forma_original,p_observacao:raw.observacao||null,p_chave_idempotencia:raw.chave};
  return{p_orcamento_id:raw.orcamento_id,p_item_id:raw.item_id,p_descricao:raw.descricao,p_valor_total:Number(raw.valor_total),p_valor_liquidado:Number(raw.valor_liquidado),p_data_obrigacao:raw.data_obrigacao,p_data_liquidacao:raw.data_liquidacao,p_forma_original:raw.forma_original,p_contraparte:raw.contraparte,p_observacao:raw.observacao||null,p_chave_idempotencia:raw.chave};
}
function v8102SetBusy(busy){
  v8102OperationRunning=busy;
  document.querySelectorAll(".v8102-run").forEach(button=>button.disabled=busy||button.closest("form").dataset.v8102Ready!=="true");
}
function v8102RefreshForm(form){
  const kind=form.dataset.v8102Operation,cfg=V8102_OPERATIONS[kind],raw=v8102Raw(form);
  const ready=cfg.fields.every(name=>String(raw[name]||"").trim());
  form.dataset.v8102Ready=String(ready);
  form.querySelector(".v8102-payload").textContent=JSON.stringify(v8102Payload(kind,raw),null,2);
  form.querySelector(".v8102-run").disabled=v8102OperationRunning||!ready;
}
async function executeV8102Operation(form){
  const {data:authData,error:authError}=await sb.auth.getSession();
  if(authError||!authData.session?.user)throw new Error("Sessão autenticada não encontrada. Entre novamente no aplicativo.");
  const kind=form.dataset.v8102Operation,cfg=V8102_OPERATIONS[kind],payload=v8102Payload(kind,v8102Raw(form));
  if(!confirm(`Confirma a execução exclusiva de ${cfg.rpc}?\\n\\n${JSON.stringify(payload,null,2)}`))return;
  const {data,error}=await sb.rpc(cfg.rpc,payload);
  if(error)throw error;
  form.querySelector(".v8102-result").textContent=JSON.stringify(data,null,2);
  await loadAll();
}
function ensureV8102Access(){
  const settingsForm=$("moduleSettingsForm");
  if(settingsForm&&!$("openV8102Regularization")){
    settingsForm.insertAdjacentHTML("afterend",'<!-- V8.10.2 TEMPORARIO --><button id="openV8102Regularization" class="v8102-admin-entry" type="button">Regularização V8.10.2</button>');
  }
  if(!$("v8102RegularizationModal")){
    document.body.insertAdjacentHTML("beforeend",'<div id="v8102RegularizationModal" class="modal hidden"><div class="card modal-card wide-modal v8102-admin-modal"><div class="head"><div><h2>Regularização V8.10.2</h2><small>Operações autenticadas, históricas e individuais</small></div><button id="closeV8102Regularization" type="button">×</button></div><p class="v8102-admin-warning">Revise o JSON exibido. Cada botão chama somente sua RPC após confirmação explícita.</p><div id="v8102Operations" class="v8102-operations"></div></div></div>');
  }
}
function initV8102Regularization(){
  ensureV8102Access();
  const modal=$("v8102RegularizationModal");if(!modal||!$("openV8102Regularization"))return;
  renderV8102Operations();
  $("openV8102Regularization").onclick=()=>{$("moduleSettingsModal").classList.add("hidden");modal.classList.remove("hidden");document.querySelectorAll(".v8102-operation").forEach(v8102RefreshForm)};
  $("closeV8102Regularization").onclick=()=>{if(!v8102OperationRunning)modal.classList.add("hidden")};
  document.querySelectorAll(".v8102-operation").forEach(form=>{
    form.addEventListener("input",()=>v8102RefreshForm(form));
    form.addEventListener("change",()=>v8102RefreshForm(form));
    v8102RefreshForm(form);
    form.onsubmit=async event=>{
      event.preventDefault();
      if(v8102OperationRunning||form.dataset.v8102Ready!=="true")return;
      const result=form.querySelector(".v8102-result");result.textContent="";v8102SetBusy(true);
      try{await executeV8102Operation(form)}catch(error){result.textContent=`ERRO: ${error.message||String(error)}`}finally{v8102SetBusy(false)}
    };
  });
}
initV8102Regularization();

function monthKey(v){return String(v||"").slice(0,7)}
function financialRows(){
  const area=current==="CNPJ"?"CNPJ":"PF";
  return currentBalanceMovements(area).filter(m=>!isTransfer(m));
}
function openFinancialSummary(){
  $("financialSummaryModal").classList.remove("hidden");
  renderFinancialCharts();
}
if($("closeFinancialSummary"))$("closeFinancialSummary").onclick=()=>$("financialSummaryModal").classList.add("hidden");

if($("financePeriodPreset"))$("financePeriodPreset").onchange=renderFinancialCharts;
if($("financeStart"))$("financeStart").onchange=renderFinancialCharts;
if($("financeEnd"))$("financeEnd").onchange=renderFinancialCharts;
if($("clientMetricSelect"))$("clientMetricSelect").onchange=renderBusinessIntelligence;



function financeDateInRange(v,start,end){
  const d=String(v||"").slice(0,10);
  return d&&d>=start&&d<=end;
}
function financePeriodBounds(){
  const preset=$("financePeriodPreset")?.value||"year",today=hoje(),year=today.slice(0,4);
  let start=`${year}-01-01`,end=`${year}-12-31`;
  const dt=new Date();
  if(preset==="month")start=today.slice(0,7)+"-01",end=today;
  if(preset==="3m"){dt.setMonth(dt.getMonth()-2);start=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-01`;end=today}
  if(preset==="6m"){dt.setMonth(dt.getMonth()-5);start=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-01`;end=today}
  if(preset==="custom"){start=$("financeStart")?.value||start;end=$("financeEnd")?.value||today}
  return{start,end};
}
function budgetFiscalStatus(o){
  if(state.orcNfse?.some(n=>n.orcamento_id===o.id))return"nfse_emitida";
  return o.situacao_fiscal||"pendente";
}
function serviceCost(o){
  const item=state.orcItens.filter(x=>x.orcamento_id===o.id&&x.tipo==="peca"&&x.fornecimento!=="cliente").reduce((s,x)=>s+Number(x.quantidade||0)*Number(x.custo_unitario||0),0);
  const extra=state.orcCustos.filter(x=>x.orcamento_id===o.id).reduce((s,x)=>s+Number(x.valor||0),0);
  return item+extra;
}
function trackedRevenue(start,end){
  const t={nfse:0,dispensed:0,pending:0,total:0};
  state.orcRecebimentos.filter(r=>r.impacta_caixa!==false&&financeDateInRange(r.data_recebimento,start,end)).forEach(r=>{
    const o=state.orc.find(x=>x.id===r.orcamento_id);if(!o)return;
    const v=Number(r.valor||0),f=budgetFiscalStatus(o);t.total+=v;
    if(f==="nfse_emitida")t.nfse+=v;else if(f==="dispensada_pf")t.dispensed+=v;else t.pending+=v;
  });
  return t;
}
function renderCategoryDrilldown(category,rows){
  const list=rows.filter(x=>x.tipo==="saida"&&(x.categoria||"Sem categoria")===category);
  const box=$("categoryDrilldown");if(!box)return;
  box.classList.remove("hidden");
  box.innerHTML=`<div class="drilldown-head"><div><h4>${esc(category)}</h4><small>${list.length} lançamento(s) · ${brl(list.reduce((s,x)=>s+Number(x.valor||0),0))}</small></div><button type="button" onclick="$('categoryDrilldown').classList.add('hidden')">×</button></div><div class="drilldown-list">${list.map(x=>`<div><span><b>${esc(x.descricao)}</b><small>${dataBR(x.data)}</small></span><b>${brl(x.valor)}</b></div>`).join("")}</div>`;
  setTimeout(()=>box.scrollIntoView({behavior:"smooth",block:"nearest"}),0);
}
function renderBusinessIntelligence(){
  const section=$("cnpjIntelligence");if(!section)return;
  const isCnpj=current==="CNPJ";section.classList.toggle("hidden",!isCnpj);if(!isCnpj)return;
  const {start,end}=financePeriodBounds(),t=trackedRevenue(start,end);
  if($("trackedRevenueCards"))$("trackedRevenueCards").innerHTML=`<div><small>Com NFS-e</small><b>${brl(t.nfse)}</b></div><div><small>Sem NFS-e / PF</small><b>${brl(t.dispensed)}</b></div><div class="tracked-total"><small>Total acompanhado</small><b>${brl(t.total)}</b></div>${t.pending?`<div class="tracked-pending"><small>Situação fiscal pendente</small><b>${brl(t.pending)}</b></div>`:""}`;

  const metric=$("clientMetricSelect")?.value||"received";
  const rows=state.orc.map(o=>{
    const receipts=state.orcRecebimentos.filter(r=>r.orcamento_id===o.id&&financeDateInRange(r.data_recebimento,start,end));
    const received=receipts.reduce((s,r)=>s+Number(r.valor||0),0);
    const contracted=financeDateInRange(o.data,start,end)?Number(o.total||0):0;
    const cost=contracted?serviceCost(o):0;
    return{o,received,contracted,result:contracted-cost,cost};
  });
  const key=metric==="result"?"result":metric==="contracted"?"contracted":"received",label=metric==="result"?"Resultado econômico":metric==="contracted"?"Valor dos serviços":"Liquidado";
  const byClient={};rows.forEach(r=>byClient[r.o.cliente||"Sem cliente"]=(byClient[r.o.cliente||"Sem cliente"]||0)+Number(r[key]||0));
  const clientEntries=Object.entries(byClient).filter(([,v])=>Math.abs(v)>0.009).sort((a,b)=>b[1]-a[1]);
  if(window.clientChartInstance)window.clientChartInstance.destroy();
  if(window.serviceChartInstance)window.serviceChartInstance.destroy();
  const cc=$("clientChart"),sc=$("serviceChart");
  if(cc){
    window.clientChartInstance=new Chart(cc,{type:"bar",data:{labels:clientEntries.map(x=>x[0]),datasets:[{label,data:clientEntries.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y"}});
    cc.onclick=e=>{const els=window.clientChartInstance.getElementsAtEventForMode(e,"nearest",{intersect:true},true);if(!els.length)return;const name=clientEntries[els[0].index][0],list=rows.filter(r=>(r.o.cliente||"Sem cliente")===name),box=$("intelligenceDetail");box.classList.remove("hidden");box.innerHTML=`<h4>${esc(name)}</h4>${list.map(r=>`<div class="intelligence-row"><span>#${r.o.numero} · ${esc(r.o.descricao||r.o.equipamento_modelo||"Serviço")}</span><b>${brl(r[key])}</b></div>`).join("")}`;};
  }
  const services=rows.filter(r=>Math.abs(Number(r[key]||0))>0.009).sort((a,b)=>b[key]-a[key]);
  if(sc){
    window.serviceChartInstance=new Chart(sc,{type:"bar",data:{labels:services.map(r=>`#${r.o.numero} · ${r.o.cliente}`),datasets:[{label,data:services.map(r=>r[key])}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y"}});
    sc.onclick=e=>{const els=window.serviceChartInstance.getElementsAtEventForMode(e,"nearest",{intersect:true},true);if(!els.length)return;const r=services[els[0].index],box=$("intelligenceDetail");box.classList.remove("hidden");box.innerHTML=`<h4>Orçamento ${r.o.numero} · ${esc(r.o.cliente)}</h4><div class="service-kpis"><span>Serviço <b>${brl(r.o.total)}</b></span><span>Recebido <b>${brl(r.received)}</b></span><span>Custos <b>${brl(r.cost)}</b></span><span>Resultado <b>${brl(r.result)}</b></span></div>`;};
  }
}
function renderFinancialCharts(){
  if(!window.Chart)return;
  const rows=financialRows();
  const year=new Date().getFullYear();
  const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,"0")}`);
  const labels=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const entradas=months.map(m=>rows.filter(x=>monthKey(x.data)===m&&x.tipo==="entrada").reduce((s,x)=>s+Number(x.valor||0),0));
  const gastos=months.map(m=>rows.filter(x=>monthKey(x.data)===m&&x.tipo==="saida").reduce((s,x)=>s+Number(x.valor||0),0));
  const cats={};
  rows.filter(x=>x.tipo==="saida"&&String(x.data||"").startsWith(String(year))).forEach(x=>cats[x.categoria||"Sem categoria"]=(cats[x.categoria||"Sem categoria"]||0)+Number(x.valor||0));

  if(monthlyChartInstance)monthlyChartInstance.destroy();
  if(categoryChartInstance)categoryChartInstance.destroy();
  monthlyChartInstance=new Chart($("monthlyChart"),{type:"bar",data:{labels,datasets:[{label:"Entradas",data:entradas},{label:"Gastos",data:gastos}]},options:{responsive:true,maintainAspectRatio:false}});
  const catEntries=Object.entries(cats),catCanvas=$("categoryChart");
  categoryChartInstance=new Chart(catCanvas,{type:"doughnut",data:{labels:catEntries.map(x=>x[0]),datasets:[{data:catEntries.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false}});
  catCanvas.onclick=e=>{const els=categoryChartInstance.getElementsAtEventForMode(e,"nearest",{intersect:true},true);if(!els.length)return;renderCategoryDrilldown(catEntries[els[0].index][0],rows);};
  $("summaryTable").innerHTML=`<div class="budget-split"><span>Entradas no ano <b>${brl(entradas.reduce((a,b)=>a+b,0))}</b></span><span>Gastos no ano <b>${brl(gastos.reduce((a,b)=>a+b,0))}</b></span><span>Resultado <b>${brl(entradas.reduce((a,b)=>a+b,0)-gastos.reduce((a,b)=>a+b,0))}</b></span></div>`;
  renderBusinessIntelligence();
}

// Conta a pagar: prioridade visual calculada sem apagar histórico.
function priorityLabel(c){
  const p=String(c.prioridade||"prioritaria").toLowerCase();
  return p==="urgente"?"Urgente":p==="pode_esperar"?"Pode esperar":"Prioritária";
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
  state.mov.filter(x=>x.data===date&&ok(x.conta)).forEach(x=>events.push({type:"mov",title:x.descricao,meta:`${accountName(x.conta)} · ${isBankMovement(x)?(x.tipo==="entrada"?"Entrada bancária":"Saída bancária"):"Evento econômico sem caixa"} · ${brl(x.valor)}`}));
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
window.editCategory=editCategory;window.deleteCategory=deleteCategory;window.gerarPdfCliente=gerarPdfCliente;window.compartilharPdfCliente=compartilharPdfCliente;window.removePendingPhoto=removePendingPhoto;window.openBudgetPhotos=openBudgetPhotos;window.openApprovedCost=openApprovedCost;window.editFixed=editFixed;window.delFixed=delFixed;window.editOrc=editOrc;window.enviarOrc=enviarOrc;window.aprovarOrc=aprovarOrc;window.pagarOrc=pagarOrc;window.delOrc=delOrc;
start();
window.openFinancialSummary=openFinancialSummary;window.openModuleSettings=openModuleSettings;
function parseBRMoney(v){
  if(typeof v==="number")return v;
  let s=String(v??"").trim().replace(/\s/g,"").replace(/^R\$/i,"");
  if(!s)return 0;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  return Number(s.replace(/[^\d.-]/g,""))||0;
}
function formatBRMoneyInput(el,value=null){
  if(!el)return;
  const n=value===null?parseBRMoney(el.value):Number(value||0);
  el.value=n?brl(n):"";
}
function prepareMoneyInput(el){
  if(!el)return;
  el.addEventListener("focus",()=>{
    const n=parseBRMoney(el.value);
    el.value=n? n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  });
  el.addEventListener("blur",()=>formatBRMoneyInput(el));
}



function syncTouchLandscapeBudget(){
  const touch=(navigator.maxTouchPoints||0)>0 || "ontouchstart" in window;
  const landscape=window.matchMedia?.("(orientation: landscape)")?.matches || window.innerWidth>window.innerHeight;
  document.body.classList.toggle("touch-landscape-budget",Boolean(touch&&landscape));
}
window.addEventListener("resize",syncTouchLandscapeBudget,{passive:true});
window.addEventListener("orientationchange",()=>setTimeout(syncTouchLandscapeBudget,80),{passive:true});
document.addEventListener("DOMContentLoaded",syncTouchLandscapeBudget);
setTimeout(syncTouchLandscapeBudget,0);
