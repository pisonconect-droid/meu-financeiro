const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session=null,current=null,authMode="login";
let state={mov:[],contas:[],orc:[]};

const $=id=>document.getElementById(id);
const brl=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const hoje=()=>new Date().toISOString().slice(0,10);
const dataBR=s=>{if(!s)return"";const[y,m,d]=s.split("-");return`${d}/${m}/${y}`};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const uid=()=>session?.user?.id;

function setAuth(m){authMode=m;$("tabLogin").classList.toggle("active",m==="login");$("tabSignup").classList.toggle("active",m==="signup");$("nomeWrap").classList.toggle("hidden",m!=="signup");$("authSubmit").textContent=m==="login"?"Entrar":"Criar conta";$("authMsg").textContent=""}
$("tabLogin").onclick=()=>setAuth("login");$("tabSignup").onclick=()=>setAuth("signup");
$("authForm").onsubmit=async e=>{e.preventDefault();$("authMsg").textContent="";try{
 const email=$("email").value.trim(),password=$("senha").value;
 if(authMode==="signup"){
  const nome=$("nome").value.trim();
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{nome},emailRedirectTo:"https://pisonconect-droid.github.io/meu-financeiro/"}});
  if(error)throw error;
  if(data.session)await ensureProfile(data.user,nome);
  $("authMsg").style.color="#047857";$("authMsg").textContent=data.session?"Conta criada.":"Conta criada. Confirme seu e-mail e depois entre.";
 }else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error}
}catch(err){$("authMsg").style.color="#b91c1c";$("authMsg").textContent=err.message||"Erro ao autenticar."}};
async function ensureProfile(user,nome=""){if(!user)return;await sb.from("profiles").upsert({id:user.id,nome:nome||user.user_metadata?.nome||""},{onConflict:"id"})}
$("logout").onclick=()=>sb.auth.signOut();

sb.auth.onAuthStateChange(async(_e,s)=>{session=s;if(s?.user){await ensureProfile(s.user);showApp();await loadAll()}else showAuth()});
async function start(){const {data}=await sb.auth.getSession();session=data.session;if(session?.user){await ensureProfile(session.user);showApp();await loadAll()}else showAuth()}
function showAuth(){$("auth").classList.remove("hidden");$("app").classList.add("hidden")}
function showApp(){$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("userEmail").textContent=session.user.email||"";goHome()}

async function loadAll(){
 const [m,c,o]=await Promise.all([
  sb.from("movimentacoes").select("*").order("data",{ascending:false}).order("created_at",{ascending:false}),
  sb.from("contas").select("*").order("vencimento"),
  sb.from("orcamentos").select("*").order("created_at",{ascending:false})
 ]);
 if(m.error||c.error||o.error){alert((m.error||c.error||o.error).message);return}
 state={mov:m.data||[],contas:c.data||[],orc:o.data||[]};render();
}

document.querySelectorAll("[data-account]").forEach(b=>b.onclick=()=>openArea(b.dataset.account));
$("homeBtn").onclick=goHome;
function goHome(){current=null;$("home").classList.add("active");$("area").classList.remove("active");$("homeBtn").classList.add("hidden");$("subtitle").textContent="Escolha uma área";render()}
function openArea(a){current=a;$("home").classList.remove("active");$("area").classList.add("active");$("homeBtn").classList.remove("hidden");$("accountName").textContent=a==="PF"?"Pessoa Física":"CNPJ";$("subtitle").textContent=$("accountName").textContent;$("orcWrap").classList.toggle("hidden",a!=="CNPJ");render()}

$("btnEntrada").onclick=()=>openMov("entrada");$("btnGasto").onclick=()=>openMov("saida");$("btnConta").onclick=()=>openConta();
function openMov(tipo,x=null){$("mode").value="mov";$("editId").value=x?.id||"";$("modalTitle").textContent=x?"Editar lançamento":tipo==="entrada"?"Nova entrada":"Novo gasto";$("descricao").value=x?.descricao||"";$("valor").value=x?.valor||"";$("data").value=x?.data||hoje();$("data").dataset.tipo=tipo;$("dateLabel").childNodes[0].nodeValue="Data ";$("modal").classList.remove("hidden")}
function openConta(x=null){$("mode").value="conta";$("editId").value=x?.id||"";$("modalTitle").textContent=x?"Editar conta":"Adicionar conta";$("descricao").value=x?.descricao||"";$("valor").value=x?.valor||"";$("data").value=x?.vencimento||hoje();$("dateLabel").childNodes[0].nodeValue="Vencimento ";$("modal").classList.remove("hidden")}
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("modalForm").onsubmit=async e=>{e.preventDefault();const editing=$("editId").value;
 if($("mode").value==="mov"){
  const p={user_id:uid(),conta:current,tipo:$("data").dataset.tipo,descricao:$("descricao").value.trim(),valor:+$("valor").value,data:$("data").value,origem:"manual"};
  const q=editing?sb.from("movimentacoes").update(p).eq("id",editing):sb.from("movimentacoes").insert(p);const {error}=await q;if(error)return alert(error.message)
 }else{
  const p={user_id:uid(),conta:current,descricao:$("descricao").value.trim(),valor:+$("valor").value,vencimento:$("data").value};
  if(!editing)p.status="pendente";const q=editing?sb.from("contas").update(p).eq("id",editing):sb.from("contas").insert(p);const {error}=await q;if(error)return alert(error.message)
 }
 $("modal").classList.add("hidden");await loadAll()
};

async function delMov(id){if(confirm("Excluir lançamento?")){const {error}=await sb.from("movimentacoes").delete().eq("id",id);if(error)alert(error.message);else loadAll()}}
async function delConta(id){if(confirm("Excluir conta?")){const {error}=await sb.from("contas").delete().eq("id",id);if(error)alert(error.message);else loadAll()}}
function editMov(id){const x=state.mov.find(x=>x.id===id);if(x)openMov(x.tipo,x)}
function editConta(id){const x=state.contas.find(x=>x.id===id);if(x)openConta(x)}
async function pagarConta(id){const x=state.contas.find(x=>x.id===id);if(!x)return;
 let {error}=await sb.from("contas").update({status:"pago",pago_em:hoje()}).eq("id",id);if(error)return alert(error.message);
 ({error}=await sb.from("movimentacoes").insert({user_id:uid(),conta:x.conta,tipo:"saida",descricao:x.descricao,valor:x.valor,data:hoje(),origem:"conta_paga"}));if(error)return alert(error.message);await loadAll()
}

function saldo(a){return state.mov.filter(x=>x.conta===a).reduce((s,x)=>s+(x.tipo==="entrada"?+x.valor:x.tipo==="saida"?-x.valor:0),0)}
function render(){
 $("saldoPF").textContent=brl(saldo("PF"));$("saldoCNPJ").textContent=brl(saldo("CNPJ"));if(!current)return;
 const s=saldo(current);$("saldoAtual").textContent=brl(s);$("saldoAtual").className=s>0?"positive":s<0?"negative":"";$("statusSaldo").textContent=s>0?"POSITIVO":s<0?"NEGATIVO":"ZERADO";
 $("movList").innerHTML=listMov(state.mov.filter(x=>x.conta===current));
 const h=hoje(),cs=state.contas.filter(x=>x.conta===current),late=cs.filter(x=>x.status==="pendente"&&x.vencimento<h),pay=cs.filter(x=>x.status==="pendente"&&x.vencimento>=h),paid=cs.filter(x=>x.status==="pago");
 $("tAtrasadas").textContent=brl(sum(late));$("tPagar").textContent=brl(sum(pay));$("tPagas").textContent=brl(sum(paid));
 $("atrasadas").innerHTML=listConta(late,true);$("pagar").innerHTML=listConta(pay,true);$("pagas").innerHTML=listConta(paid,false);if(current==="CNPJ")renderOrc()
}
const sum=a=>a.reduce((s,x)=>s+Number(x.valor),0);
function listMov(a){return a.length?a.slice(0,50).map(x=>`<div class="item"><div><b>${esc(x.descricao)}</b><div class="meta">${dataBR(x.data)} · ${x.tipo==="entrada"?"Entrada":"Gasto"}</div></div><div><b class="${x.tipo==="entrada"?"positive":"negative"}">${x.tipo==="entrada"?"+":"-"} ${brl(x.valor)}</b><div class="actions"><button onclick="editMov('${x.id}')">Editar</button><button class="danger" onclick="delMov('${x.id}')">Excluir</button></div></div></div>`).join(""):`<p class="meta">Nenhum lançamento.</p>`}
function listConta(a,open){return a.length?a.map(x=>`<div class="item"><div><b>${esc(x.descricao)}</b><div class="meta">Vence ${dataBR(x.vencimento)}</div></div><div><b>${brl(x.valor)}</b><div class="actions">${open?`<button onclick="pagarConta('${x.id}')">Marcar paga</button><button onclick="editConta('${x.id}')">Editar</button>`:""}<button class="danger" onclick="delConta('${x.id}')">Excluir</button></div></div></div>`).join(""):`<p class="meta">Nenhuma conta.</p>`}

$("btnOrc").onclick=()=>{$("orcFormWrap").classList.remove("hidden");$("orcData").value=hoje();if(!$("orcItens").children.length)addOrcItem()};
$("addItem").onclick=addOrcItem;
function addOrcItem(){const d=document.createElement("div");d.className="item";d.innerHTML=`<input class="iDesc" placeholder="Item/serviço" required><input class="iQtd" type="number" value="1" min="1" required><input class="iVal" type="number" step="0.01" min="0" placeholder="Valor" required>`;d.querySelectorAll("input").forEach(i=>i.oninput=calcOrc);$("orcItens").appendChild(d);calcOrc()}
function orcItems(){return[...$("orcItens").children].map(r=>({descricao:r.querySelector(".iDesc").value.trim(),quantidade:+r.querySelector(".iQtd").value||0,valor_unitario:+r.querySelector(".iVal").value||0}))}
function calcOrc(){const t=orcItems().reduce((s,x)=>s+x.quantidade*x.valor_unitario,0);$("orcTotal").textContent=brl(t);return t}
$("orcForm").onsubmit=async e=>{e.preventDefault();const its=orcItems(),total=calcOrc();
 const {data:o,error}=await sb.from("orcamentos").insert({user_id:uid(),cliente:$("orcCliente").value.trim(),whatsapp:$("orcWhatsapp").value,data:$("orcData").value,descricao:$("orcDesc").value,total,subtotal_pecas:total,subtotal_mao_obra:0,status:"orcamento"}).select().single();if(error)return alert(error.message);
 const rows=its.map(x=>({user_id:uid(),orcamento_id:o.id,tipo:"peca",...x}));const r=await sb.from("orcamento_itens").insert(rows);if(r.error)return alert(r.error.message);
 $("orcForm").reset();$("orcItens").innerHTML="";$("orcFormWrap").classList.add("hidden");await loadAll()
}
function renderOrc(){$("orcList").innerHTML=state.orc.length?state.orc.map(o=>`<div class="item"><div><b>Orçamento ${o.numero} · ${esc(o.cliente)}</b><div class="meta">${dataBR(o.data)} · ${esc(o.status)}</div></div><b>${brl(o.total)}</b></div>`).join(""):`<p class="meta">Nenhum orçamento.</p>`}

window.delMov=delMov;window.delConta=delConta;window.editMov=editMov;window.editConta=editConta;window.pagarConta=pagarConta;
start();
