import React,{useEffect,useState} from "react";
import{createRoot}from"react-dom/client";
import"./style.css";
const API=import.meta.env.VITE_API_URL||"http://localhost:5000";
const getToken=()=>localStorage.getItem("sc_token");
async function api(path,opts={}){const r=await fetch(API+path,{...opts,headers:{"Content-Type":"application/json",...(getToken()?{Authorization:`Bearer ${getToken()}`}:{ }),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
const today=new Date().toISOString().slice(0,10);
function App(){
 const [user,setUser]=useState(null),[view,setView]=useState("discover"),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[register,setRegister]=useState(false),[reg,setReg]=useState({name:"",email:"",password:"",branch:"E&CE",year:"Final Year"});
 const [mustChange,setMustChange]=useState(false),[currentPassword,setCurrentPassword]=useState(""),[newPassword,setNewPassword]=useState(""),[csvText,setCsvText]=useState("PRN,Name,Surname,Branch,Semester\\n"),[importResult,setImportResult]=useState("");
 const [rides,setRides]=useState([]),[mine,setMine]=useState([]),[requests,setRequests]=useState([]),[query,setQuery]=useState({destination:"",date:"",type:"all"}),[matches,setMatches]=useState([]);
 const [form,setForm]=useState({type:"driver",source:"BVP Dhankawadi",destination:"Satara",date:today,time:"09:00",seats:3,notes:"",genderPreference:"any"});
 const [adminData,setAdminData]=useState(null),[chatRide,setChatRide]=useState(null),[messages,setMessages]=useState([]),[message,setMessage]=useState(""),[chatError,setChatError]=useState("");
 const [external,setExternal]=useState(null);
 const flash=(s)=>{setNotice(s);setTimeout(()=>setNotice(""),3500)};
 async function refresh(){try{const [a,b,c]=await Promise.all([api("/api/rides"),api("/api/rides/mine"),api("/api/requests")]);setRides(a.rides);setMine(b.rides);setRequests(c.requests)}catch(e){setError(e.message)}}
 useEffect(()=>{if(getToken())api("/api/auth/me").then(x=>setUser(x.user)).catch(()=>localStorage.removeItem("sc_token"))},[]);
 useEffect(()=>{if(user?.verified){refresh()}},[user]);useEffect(()=>{if(!chatRide?.id)return;let active=true;const load=async()=>{try{const d=await api(`/api/chat/${chatRide.id}`);if(active)setMessages(old=>{const byId=new Map(old.map(m=>[m.id,m]));for(const m of d.messages)byId.set(m.id,m);return [...byId.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt))})}catch(e){if(active)setChatError(e.message)}};load();const timer=setInterval(load,2500);return()=>{active=false;clearInterval(timer)}},[chatRide?.id]);
 async function login(e){e.preventDefault();setError("");try{const d=await api("/api/auth/login",{method:"POST",body:JSON.stringify({prn:email,password})});localStorage.setItem("sc_token",d.token);setUser(d.user);setMustChange(Boolean(d.mustChangePassword));flash("Signed in successfully")}catch(e){setError(e.message)}}
 async function signup(e){e.preventDefault();setError("");try{const d=await api("/api/auth/register",{method:"POST",body:JSON.stringify(reg)});setRegister(false);setEmail(reg.email);setPassword(reg.password);flash(d.message)}catch(e){setError(e.message)}}
 async function submitRide(e){e.preventDefault();setError("");try{await api("/api/rides",{method:"POST",body:JSON.stringify(form)});flash("Trip posted");refresh();setView("myrides")}catch(e){setError(e.message)}}
 async function search(e){e?.preventDefault();try{const d=await api(`/api/rides?${new URLSearchParams(query)}`);setRides(d.rides);const m=await api(`/api/rides/matches?${new URLSearchParams({destination:query.destination,date:query.date,time:"12:00",windowHours:4})}`);setMatches(m.matches)}catch(e){setError(e.message)}}
 async function requestRide(id){try{await api(`/api/rides/${id}/request`,{method:"POST",body:"{}"});flash("Ride request sent to driver");refresh()}catch(e){setError(e.message)}}
 async function respond(id,status){try{await api(`/api/requests/${id}`,{method:"PATCH",body:JSON.stringify({status})});flash(`Request ${status}`);refresh()}catch(e){setError(e.message)}}
 async function loadAdmin(){try{setAdminData(await api("/api/admin/overview"))}catch(e){setError(e.message)}}
 async function verify(id,verified){try{await api(`/api/admin/users/${id}/verify`,{method:"PATCH",body:JSON.stringify({verified})});loadAdmin()}catch(e){setError(e.message)}}
 async function openExternal(){try{setExternal(await api(`/api/external/blablacar?${new URLSearchParams({origin:form.source,destination:form.destination,date:form.date})}`))}catch(e){setError(e.message)}}
 async function openChat(ride){setChatError("");try{const d=await api(`/api/chat/${ride.id}`);setMessages(d.messages);setChatRide(ride)}catch(e){setChatRide(null);setMessages([]);setChatError(e.message);setError(e.message)}}
 async function sendMessage(e){e.preventDefault();if(!chatRide)return;const text=message.trim();if(!text)return;setChatError("");try{const d=await api(`/api/chat/${chatRide.id}`,{method:"POST",body:JSON.stringify({text})});setMessage("");setMessages(old=>old.some(m=>m.id===d.message.id)?old:[...old,d.message])}catch(e){setChatError(e.message)}}
 function logout(){localStorage.removeItem("sc_token");setUser(null);setAdminData(null);setChatRide(null);setMessages([]);setMustChange(false);setError("");setNotice("");setView("discover");setEmail("");setPassword("")}
 if(!user)return <main className="auth-shell">
  <section className="brand-panel">
    <div className="brand-top"><img className="brand-logo" src="/safecommute-logo.svg" alt="SafeCommute logo"/><span>SafeCommute <b>BVP</b></span></div>
    <div className="hero-copy">
      <p className="eyebrow">THE BVP STUDENT NETWORK</p>
      <h1>Better journeys.<br/><em>Shared together.</em></h1>
      <p className="hero-description">Find students heading your way, coordinate a common ride, and make everyday travel feel a little more connected.</p>
      <div className="hero-points"><span><i>✓</i> College community</span><span><i>↗</i> Shared destinations</span><span><i>○</i> No in-app payments</span></div>
    </div>
    <div className="hero-route" aria-hidden="true"><div className="route-orbit orbit-one"></div><div className="route-orbit orbit-two"></div><div className="route-orbit orbit-three"></div><div className="route-pin"><img src="/safecommute-logo.svg" alt=""/></div><span className="route-stop stop-one"></span><span className="route-stop stop-two"></span><span className="route-stop stop-three"></span></div>
    <div className="brand-footer">YOUR CAMPUS. YOUR ROUTE. YOUR COMMUNITY.</div>
  </section>
  <section className="auth-side">
    <div className="auth-card">
      <div className="mobile-brand"><img src="/safecommute-logo.svg" alt="SafeCommute logo"/><span>SafeCommute <b>BVP</b></span></div>
      <div className="eyebrow auth-eyebrow">SAFECOMMUTE BVP · STUDENT ACCESS</div>
      <h2>Welcome back<span className="heading-dot">.</span></h2>
      <p className="auth-subtitle">Your next shared journey starts here.</p>
      {error&&<div className="alert">{error}</div>}
      <form onSubmit={login} className="stack">
        <label>Student PRN<input required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your college PRN" autoComplete="username"/></label>
        <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/></label>
        <button className="primary auth-submit">Sign in <span>→</span></button>
        <p className="login-hint"><span className="hint-lock">⌑</span> Use the login details provided by your college project administrator.</p>
      </form>
      <div className="auth-bottom"><span className="secure-dot"></span> Private student access <span className="bottom-separator">·</span> BVP Pune</div>
    </div>
  </section>
</main>;
 return <div className="app"><aside className="sidebar"><div className="side-logo"><img src="/safecommute-logo.svg" alt=""/><span>SafeCommute<small>BVP STUDENT NETWORK</small></span></div><div className="profile"><div className="avatar">{user.name?.slice(0,1)}</div><div><b>{user.name}</b><small>{user.branch} · Sem {user.semester||user.year}</small><span className={user.verified?"verified":"pending"}>{user.verified?"✓ Verified student":"Awaiting verification"}</span></div></div><nav>{[["discover","⌕","Find a ride"],["post","＋","Post a trip"],["myrides","▤","My trips"],["requests","⇄","Ride requests"],["alternatives","↗","Other travel options"],...(user.role==="admin"?[["admin","⚙","Admin panel"]]:[])].map(([v,icon,label])=><button key={v} className={view===v?"active":""} onClick={()=>{setView(v);setError("");if(v==="admin")loadAdmin();if(v==="discover")refresh()}}><span>{icon}</span>{label}</button>)}</nav><div className="side-bottom"><div className="safety-note">A campus network helps build trust. It does not replace your own safety checks.</div><button className="logout" onClick={logout} type="button">↪ Log out</button></div></aside>{mustChange&&<div className="modal-backdrop"><section className="chat-modal password-modal"><div className="chat-head"><div><b>Change your initial password</b><p>For account security, set a password only you know.</p></div></div><form className="stack" onSubmit={async e=>{e.preventDefault();try{const d=await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});setUser(d.user);setMustChange(false);setCurrentPassword("");setNewPassword("");flash(d.message)}catch(err){setError(err.message)}}}><label>Current password<input type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>New password (minimum 8 characters)<input type="password" minLength="8" required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><button className="primary">Update password</button>{error&&<div className="alert">{error}</div>}</form></section></div>}<main className="main"><header><div><div className="eyebrow">BHARATI VIDYAPEETH · PUNE</div><h1>{({discover:"Find your people, share the ride.",post:"Post your next trip.",myrides:"Your travel plans.",requests:"Ride requests.",alternatives:"More ways to get there.",admin:"Community control room."})[view]}</h1><p className="muted">{({discover:"Match with verified students heading in the same direction.",post:"Share your route so other BVP students can join.",myrides:"Manage trips you have posted.",requests:"Accept or decline requests for your ride.",alternatives:"Compare the next best option when a carpool doesn't line up.",admin:"Review accounts and reports."})[view]}</p></div><div className="header-actions"><div className="header-chip"><span className="live-dot"></span> Student network</div><button className="header-logout" onClick={logout} type="button" aria-label="Log out of SafeCommute">↪ <span>Log out</span></button></div></header>
 {error&&<div className="alert inline">{error}<button onClick={()=>setError("")}>×</button></div>}{notice&&<div className="toast">{notice}</div>}
 {!user.verified&&user.role!=="admin"?<section className="panel"><h2>Verification pending</h2><p>Your account is created, but ride matching is disabled until an administrator verifies your student status.</p></section>:null}
 {view==="discover"&&<><form className="searchbar" onSubmit={search}><label>Destination<input placeholder="e.g. Satara, Nashik, Kolhapur" value={query.destination} onChange={e=>setQuery({...query,destination:e.target.value})}/></label><label>Date<input type="date" value={query.date} onChange={e=>setQuery({...query,date:e.target.value})}/></label><label>Trip type<select value={query.type} onChange={e=>setQuery({...query,type:e.target.value})}><option value="all">All matches</option><option value="driver">Drivers with seats</option><option value="rider">Other riders</option></select></label><button className="primary">Find matches</button></form><div className="section-title"><div><h2>Trips from your community</h2><p className="muted">Only other users are shown. Confirm details directly before travelling.</p></div><span className="count">{rides.length} trips</span></div><div className="ride-grid">{rides.map(r=><RideCard key={r.id} ride={r} requestStatus={requests.find(q=>q.rideId===r.id&&q.riderId===user.id)?.status} onRequest={requestRide} onChat={openChat}/>)}{!rides.length&&<Empty title="No matching trips yet" text="Try another destination/date, or post your trip so others can find you."/>}</div>{matches.length>0&&<><div className="section-title"><div><h2>Potential time-window matches</h2><p className="muted">Destination similarity and a ±4-hour departure window.</p></div></div><div className="ride-grid">{matches.map(r=><RideCard key={r.id} ride={r} requestStatus={requests.find(q=>q.rideId===r.id&&q.riderId===user.id)?.status} onRequest={requestRide} onChat={openChat}/>)}</div></>}</>}
 {view==="post"&&<section className="panel form-panel"><div className="panel-head"><div><h2>Tell the campus where you're going</h2><p className="muted">No payment is collected here. Sort out cost-sharing with your group.</p></div><span className="pill">Free to post</span></div><form className="form-grid" onSubmit={submitRide}><label>I am<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="driver">Driving / have seats</option><option value="rider">Looking to hitch a ride</option></select></label><label>Starting point<input required value={form.source} onChange={e=>setForm({...form,source:e.target.value})}/></label><label>Destination<input required value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/></label><label>Travel date<input required type="date" min={today} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Departure time<input required type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label>{form.type==="driver"&&<label>Available seats<select value={form.seats} onChange={e=>setForm({...form,seats:Number(e.target.value)})}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} seat{n>1?"s":""}</option>)}</select></label>}<label>Preference<select value={form.genderPreference} onChange={e=>setForm({...form,genderPreference:e.target.value})}><option value="any">No gender preference</option><option value="women">Women-only preference</option></select></label><label className="full">Notes<textarea placeholder="Pickup point, luggage, flexibility…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button className="primary full">Publish trip <span>→</span></button></form></section>}
 {view==="myrides"&&<div className="ride-grid">{mine.map(r=><RideCard key={r.id} ride={r} mine onChat={openChat} onStatus={async(id,status)=>{try{await api(`/api/rides/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});refresh()}catch(e){setError(e.message)}}}/>)}{!mine.length&&<Empty title="No trips posted" text="Post a driver ride or a rider request to get started."/>}</div>}
 {view==="requests"&&<div className="request-list">{requests.map(r=><article className="request-card" key={r.id}><div className="route-icon">⇄</div><div className="request-info"><b>{r.ride?.source} → {r.ride?.destination}</b><p>{r.driver?.id===user.id?`Request from ${r.rider?.name}`:`Driver: ${r.driver?.name}`} · {r.ride?.date} at {r.ride?.time}</p><span className={`status ${r.status}`}>{r.status}</span></div>{r.driver?.id===user.id&&r.status==="pending"&&<div className="actions"><button className="primary small" onClick={()=>respond(r.id,"accepted")}>Accept</button><button className="secondary small" onClick={()=>respond(r.id,"rejected")}>Decline</button></div>}{r.status==="accepted"&&<button className="secondary small" onClick={()=>openChat(r.ride)}>Open chat</button>}</article>)}{!requests.length&&<Empty title="No requests yet" text="When you request a ride or someone requests yours, it will appear here."/>}</div>}
 {view==="alternatives"&&<><section className="panel alt-intro"><h2>Need a backup plan?</h2><p className="muted">These buttons hand you off to provider search/booking flows. Availability, pricing and booking are controlled by the provider—not SafeCommute.</p><div className="form-grid"><label>From<input value={form.source} onChange={e=>setForm({...form,source:e.target.value})}/></label><label>To<input value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/></label><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><button className="secondary" onClick={openExternal}>Check BlaBlaCar integration status</button></div></section><div className="alt-grid"><AltCard icon="B" title="BlaBlaCar" text="Search for intercity carpool rides. Live inventory inside SafeCommute requires authorized API access." action="Search BlaBlaCar" href={`https://www.blablacar.in/search?${new URLSearchParams({from:form.source,to:form.destination,date:form.date})}`}/><AltCard icon="U" title="Uber" text="Open Uber's ride flow. It may allow pickup/drop-off prefill depending on device and link support." action="Open Uber" href={`https://m.uber.com/looking?pickup=${encodeURIComponent(JSON.stringify({addressLine1:form.source}))}&drop[0]=${encodeURIComponent(JSON.stringify({addressLine1:form.destination}))}`}/><AltCard icon="O" title="Ola" text="Open Ola's booking website. Location fields may need confirmation in the Ola app." action="Open Ola" href={`https://book.olacabs.com/?pickup_name=${encodeURIComponent(form.source)}&drop_name=${encodeURIComponent(form.destination)}`}/><AltCard icon="R" title="Rapido" text="Use Rapido for local/last-mile trips; destination prefill support may vary." action="Open Rapido" href="https://www.rapido.bike/"/></div>{external&&<section className="panel api-status"><b>{external.source} integration</b><p>{external.message||"API response received."}</p>{external.searchUrl&&<a className="primary link-button" href={external.searchUrl} target="_blank" rel="noreferrer">Open external search ↗</a>}{external.live&&<pre>{JSON.stringify(external.data,null,2)}</pre>}</section>}</>}
 {view==="admin"&&adminData&&<><div className="stats"><div className="stat"><small>Accounts</small><b>{adminData.users.length}</b></div><div className="stat"><small>Trips posted</small><b>{adminData.rides.length}</b></div><div className="stat"><small>Open reports</small><b>{adminData.reports.filter(r=>r.status==="open").length}</b></div></div><section className="panel"><h2>Student verification queue</h2><div className="table-wrap"><table><thead><tr><th>Student</th><th>Branch / year</th><th>Status</th><th>Action</th></tr></thead><tbody>{adminData.users.filter(u=>u.role!=="admin").map(u=><tr key={u.id}><td>{u.name}<small>{u.email}</small></td><td>{u.branch}<small>{u.year}</small></td><td><span className={`status ${u.verified?"accepted":"pending"}`}>{u.verified?"Verified":"Pending"}</span></td><td><button className="secondary small" onClick={()=>verify(u.id,!u.verified)}>{u.verified?"Revoke":"Verify"}</button></td></tr>)}</tbody></table></div></section><section className="panel roster-panel"><h2>Import / update student roster</h2><p className="muted">Paste CSV rows with columns PRN, Name, Surname, Branch, Semester. New PRNs get an initial surname-in-uppercase password and must change it on first login. Existing students keep their chosen password.</p><textarea rows="7" value={csvText} onChange={e=>setCsvText(e.target.value)} spellCheck="false"/><button className="primary" onClick={async()=>{try{const d=await api("/api/admin/import-roster",{method:"POST",body:JSON.stringify({csv:csvText})});setImportResult(`Added ${d.added}, updated ${d.updated}, skipped ${d.skipped}. Total students: ${d.total}.`);loadAdmin()}catch(e){setError(e.message)}}}>Import roster CSV</button>{importResult&&<p className="muted">{importResult}</p>}</section><section className="panel"><h2>Reports</h2>{adminData.reports.map(r=><p key={r.id}>{r.reason} — {r.details} <span className="status">{r.status}</span></p>)}{!adminData.reports.length&&<p className="muted">No reports submitted.</p>}</section></>}
 <footer>SafeCommute BVP <span>·</span> Student-led ride matching <span>·</span> Payment is arranged independently</footer></main>
 {chatRide&&<div className="modal-backdrop" onClick={()=>setChatRide(null)}><section className="chat-modal" onClick={e=>e.stopPropagation()}><div className="chat-head"><div><b>Trip chat</b><p>{chatRide.source} → {chatRide.destination}</p></div><button onClick={()=>setChatRide(null)}>×</button></div><div className="chat-messages">{messages.map(m=><div key={m.id} className={`bubble ${m.senderId===user.id?"own":""}`}><small>{m.sender?.name||"Student"} · {new Date(m.createdAt).toLocaleString()}</small><p>{m.text}</p></div>)}{!messages.length&&<p className="muted">Chat is available after the driver accepts your seat request.</p>}</div>{chatError&&<div className="alert chat-alert">{chatError}</div>}<form onSubmit={sendMessage} className="chat-compose"><input placeholder="Write a message…" value={message} onChange={e=>setMessage(e.target.value)} required/><button className="primary" disabled={!message.trim()}>Send</button></form></section></div>}
 </div>
}
function RideCard({ ride: r, mine, requestStatus, onRequest, onChat, onStatus }) {
  const driverRide = String(r.type || "").toLowerCase() === "driver";
  const seatsLeft = Number(r.seatsAvailable ?? r.seats ?? 1);
  const canRequest = driverRide && seatsLeft > 0 && r.status === "open";
  return (
    <article className="ride-card">
      <div className="ride-top">
        <span className={`ride-type ${driverRide ? "driver" : "rider"}`}>
          {driverRide ? "Driver ride · seats offered" : "Rider request · seeking a ride"}
        </span>
        <span className="pill">
          {driverRide ? (seatsLeft > 0 ? `${seatsLeft} seats` : "No seats left") : "Looking for a ride"}
        </span>
      </div>
      <div className="route">
        <div><span className="route-dot"></span><b>{r.source}</b></div>
        <div className="route-line"></div>
        <div><span className="route-dot destination"></span><b>{r.destination}</b></div>
      </div>
      <div className="ride-meta"><span>▦ {r.date}</span><span>◷ {r.time}</span></div>
      <div className="driver-row">
        <div className="avatar small-avatar">{r.owner?.name?.slice(0, 1) || "?"}</div>
        <div><b>{r.owner?.name || "Student"}</b><small>{r.owner?.branch || "BVP student"} · {r.owner?.semester || r.owner?.year || ""}{r.owner?.verified ? " · ✓ Verified" : ""}</small></div>
      </div>
      {r.notes && <p className="ride-notes">{r.notes}</p>}
      <div className="card-actions">
        {mine ? (
          <>
            <span className={`status ${r.status}`}>{r.status}</span>
            {r.status === "open" && <button className="secondary small" onClick={() => onStatus?.(r.id, "cancelled")}>Cancel trip</button>}
            {r.status === "open" && <button className="secondary small" onClick={() => onStatus?.(r.id, "completed")}>Mark complete</button>}
          </>
        ) : driverRide ? (
          requestStatus === "accepted" ? (
            <button className="primary small" onClick={() => onChat?.(r)}>Open chat</button>
          ) : requestStatus === "pending" ? (
            <button className="secondary small" disabled>Seat requested · Awaiting driver</button>
          ) : requestStatus === "rejected" ? (
            <button className="secondary small" disabled>Request declined</button>
          ) : canRequest ? (
            <button className="primary small" onClick={() => onRequest?.(r.id)}>Request seat <span>→</span></button>
          ) : (
            <button className="secondary small" disabled>{seatsLeft < 1 ? "No seats available" : "Trip closed"}</button>
          )
        ) : (
          <span className="muted small">This student is looking for a driver; seat requests apply to driver rides.</span>
        )}
      </div>
      {!mine && driverRide && requestStatus !== "accepted" && <p className="ride-help">Request a seat first. Chat unlocks after the driver accepts.</p>}
    </article>
  );
}
function Empty({title,text}){return <div className="empty"><div>↗</div><h3>{title}</h3><p>{text}</p></div>}
function AltCard({icon,title,text,action,href}){return <article className="alt-card"><div className="provider-icon">{icon}</div><h3>{title}</h3><p>{text}</p><a className="secondary link-button" href={href} target="_blank" rel="noreferrer">{action} ↗</a></article>}
createRoot(document.getElementById("root")).render(<App/>);
