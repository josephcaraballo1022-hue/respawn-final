'use client'
import { useEffect, useState, useRef } from 'react'
import Script from 'next/script' 
import { supabase } from './supabaseClient'

export default function Home() {
  const [session, setSession] = useState(null)
  const [games, setGames] = useState([])
  const [vista, setVista] = useState('mercado') 
  
  // --- 👮‍♂️ ADMIN ---
  const ADMIN_EMAIL = "josevid1122@gmail.com" 
  const [listaReportes, setListaReportes] = useState([])

  // --- CHAT Y NOTIFICACIONES ---
  const [misChats, setMisChats] = useState([])
  const [chatActivo, setChatActivo] = useState(null) 
  const [mensajesChat, setMensajesChat] = useState([])
  const [nuevoMensajePrivado, setNuevoMensajePrivado] = useState('')
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
  const messagesEndRef = useRef(null) 

  // --- FAVORITOS & PREGUNTAS ---
  const [misFavoritos, setMisFavoritos] = useState([]) 
  const [preguntasRecibidas, setPreguntasRecibidas] = useState([])
  const [comentarios, setComentarios] = useState({})   
  const [chatAbierto, setChatAbierto] = useState(null) 
  const [nuevoComentario, setNuevoComentario] = useState('')

  // --- FILTROS ---
  const [busqueda, setBusqueda] = useState('')
  const [filtroPlataforma, setFiltroPlataforma] = useState('')
  const [filtroCiudad, setFiltroCiudad] = useState('') 
  const [filtroGenero, setFiltroGenero] = useState('')

  // --- DATOS USUARIO / AUTH ---
  const [authMode, setAuthMode] = useState('login') 
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usernameRegister, setUsernameRegister] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // --- PERFIL ---
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [ratingPromedio, setRatingPromedio] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)

  // --- SUBIR JUEGO ---
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaPlataforma, setNuevaPlataforma] = useState('')
  const [nuevaCiudad, setNuevaCiudad] = useState('') 
  const [nuevoGenero, setNuevoGenero] = useState('')
  const [nuevoContacto, setNuevoContacto] = useState('') 
  const [nuevoTipo, setNuevoTipo] = useState('trueque') 
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevaDescripcion, setNuevaDescripcion] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [cargando, setCargando] = useState(false)

  // 💳 TU LLAVE WOMPI ACTUALIZADA
  const WOMPI_PUBLIC_KEY = "pub_test_vVzryG8OHTChcvuwhBEnNFR89Uxuv1ZB"
  
  const CIUDADES_COLOMBIA = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Manizales", "Cúcuta", "Ibagué", "Otra"]
  const GENEROS_JUEGOS = ["Acción", "Aventura", "Deportes", "RPG", "Shooter", "Estrategia", "Carreras", "Peleas", "Terror", "Otro"]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) inicializarDatos(session.user.id)
      else obtenerJuegos()
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('actualizar_pass') 
      }
      if (session) inicializarDatos(session.user.id)
      else obtenerJuegos()
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [mensajesChat])

  useEffect(() => {
    const channel = supabase.channel('global_changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, 
      (payload) => {
        if (session && payload.new.sender_id !== session.user.id) {
            if (chatActivo && chatActivo.id === payload.new.conversation_id) {
                setMensajesChat((prev) => [...prev, payload.new]); marcarLeido(payload.new.id)
            } else { setMensajesNoLeidos(prev => prev + 1); cargarMisChats(session.user.id) }
        }
      })
    .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chatActivo, session])

  async function inicializarDatos(userId) {
    await obtenerJuegos()
    await obtenerPerfil(userId)
    await cargarFavoritos(userId)
    await cargarPreguntasRecibidas(userId)
    await cargarMisChats(userId)
    await contarNoLeidos(userId)
    if (session?.user?.email === ADMIN_EMAIL) cargarReportes()
  }

  async function obtenerJuegos() {
    const { data } = await supabase.from('games').select('*, profiles(username, avatar_url), comments(count)').order('id', { ascending: false })
    if (data) setGames(data)
  }

  // --- AUTH ---
  async function handleLogin(e) { e.preventDefault(); setAuthLoading(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) alert(error.message); setAuthLoading(false); }
  async function handleSignUp(e) { e.preventDefault(); if(!usernameRegister) return alert("Usuario?"); setAuthLoading(true); const { data, error } = await supabase.auth.signUp({ email, password }); if(!error && data.user) { await supabase.from('profiles').insert([{id:data.user.id, username: usernameRegister}]); alert("Creado!") } setAuthLoading(false); }
  async function handleResetPasswordRequest(e) { e.preventDefault(); if (!email) return alert("Escribe tu correo."); setAuthLoading(true); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); if (error) alert(error.message); else alert("¡Correo enviado! Revisa tu bandeja de entrada."); setAuthLoading(false); }
  async function handleUpdatePassword(e) { e.preventDefault(); if (!password) return alert("Escribe nueva contraseña"); setAuthLoading(true); const { error } = await supabase.auth.updateUser({ password: password }); if (error) alert(error.message); else { alert("¡Contraseña actualizada!"); setAuthMode('login'); setVista('mercado'); } setAuthLoading(false); }
  async function handleLogout() { await supabase.auth.signOut(); setGames([]); setMisChats([]); setChatActivo(null); setVista('mercado'); setAuthMode('login'); }

  // --- FUNCIONES CORE ---
  async function toggleReserva(game) { const nuevoEstado = game.condition === 'Reservado' ? 'Disponible' : 'Reservado'; const { error } = await supabase.from('games').update({ condition: nuevoEstado }).eq('id', game.id); if (!error) { alert(`Juego marcado como ${nuevoEstado}`); obtenerJuegos() } }
  async function reportarJuego(gameId) { if (!session) return alert("Inicia sesión"); const motivo = prompt("Motivo:"); if (!motivo) return; const { error } = await supabase.from('reports').insert([{ game_id: gameId, reporter_id: session.user.id, reason: motivo }]); if (error) alert("Error"); else alert("Reportado.") }
  function compartirJuego(game) { const texto = `🎮 ${game.title} - ${game.platform} ($${game.price}) en ReSpawn!`; navigator.clipboard.writeText(texto); alert("Link copiado!") }
  async function cargarReportes() { const { data } = await supabase.from('reports').select('*, games(title), profiles(username)'); if (data) setListaReportes(data) }
  async function adminBorrarJuego(id) { if(!confirm("ADMIN: ¿Borrar?")) return; const { error } = await supabase.from('games').delete().eq('id', id); if(!error) { alert("Eliminado"); obtenerJuegos(); cargarReportes() } }
  async function calificarUsuario(targetUserId) { if(!session) return; const stars = prompt("Estrellas (1-5):"); if(!stars) return; const comment = prompt("Comentario:"); await supabase.from('reviews').insert([{ reviewer_id: session.user.id, user_id: targetUserId, stars: parseInt(stars), comment }]); alert("Gracias!") }

  async function contarNoLeidos(userId) { const { data: convs } = await supabase.from('conversations').select('id').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`); if(!convs?.length) return; const ids = convs.map(c => c.id); const { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).in('conversation_id', ids).neq('sender_id', userId).eq('is_read', false); setMensajesNoLeidos(count || 0) }
  async function iniciarNegociacion(game) { if (!session) return alert("Inicia sesión"); if (game.user_id === session.user.id) return alert("Es tuyo"); const { data: existe } = await supabase.from('conversations').select('*').eq('game_id', game.id).eq('buyer_id', session.user.id).eq('seller_id', game.user_id).single(); if (existe) { setChatActivo(existe); setVista('mensajes'); cargarMensajes(existe.id) } else { const { data: nuevo, error } = await supabase.from('conversations').insert([{ buyer_id: session.user.id, seller_id: game.user_id, game_id: game.id }]).select().single(); if(error) return alert("Error"); await cargarMisChats(session.user.id); setChatActivo(nuevo); setVista('mensajes'); setMensajesChat([]) } }
  async function cargarMisChats(userId) { const { data } = await supabase.from('conversations').select(`*, games (title, image_url), comprador:profiles!fk_conv_buyer (username, avatar_url), vendedor:profiles!fk_conv_seller (username, avatar_url)`).or(`buyer_id.eq.${userId},seller_id.eq.${userId}`); if (data) setMisChats(data) }
  async function cargarMensajes(chatId) { const { data } = await supabase.from('direct_messages').select('*').eq('conversation_id', chatId).order('created_at', { ascending: true }); if (data) { setMensajesChat(data); const noLeidos = data.filter(m => !m.is_read && m.sender_id !== session.user.id); if(noLeidos.length > 0) { noLeidos.forEach(m => marcarLeido(m.id)); setMensajesNoLeidos(prev => Math.max(0, prev - noLeidos.length)) } } }
  async function marcarLeido(msgId) { await supabase.from('direct_messages').update({ is_read: true }).eq('id', msgId) }
  async function enviarMensajePrivado(e) { e.preventDefault(); if (!nuevoMensajePrivado.trim()) return; const { error } = await supabase.from('direct_messages').insert([{ conversation_id: chatActivo.id, sender_id: session.user.id, content: nuevoMensajePrivado }]); if (!error) setNuevoMensajePrivado('') }
  async function abrirChat(gameId) { if (chatAbierto === gameId) { setChatAbierto(null); return } setChatAbierto(gameId); const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url)').eq('game_id', gameId).order('created_at', { ascending: true }); setComentarios(prev => ({ ...prev, [gameId]: data || [] })) }
  async function enviarComentario(gameId, e) { e.preventDefault(); if (!session) return alert("Inicia sesión"); if (!nuevoComentario.trim()) return; const { error } = await supabase.from('comments').insert([{ game_id: gameId, user_id: session.user.id, content: nuevoComentario }]); if (!error) { setNuevoComentario(''); const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url)').eq('game_id', gameId).order('created_at', { ascending: true }); setComentarios(prev => ({ ...prev, [gameId]: data || [] })) } }
  async function cargarFavoritos(userId) { const { data } = await supabase.from('favorites').select('game_id').eq('user_id', userId); if (data) setMisFavoritos(data.map(f => f.game_id)) }
  async function toggleFavorito(gameId) { if (!session) return alert("Login requerido"); if (misFavoritos.includes(gameId)) { await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('game_id', gameId); setMisFavoritos(prev => prev.filter(id => id !== gameId)) } else { await supabase.from('favorites').insert([{ user_id: session.user.id, game_id: gameId }]); setMisFavoritos(prev => [...prev, gameId]) } }
  async function cargarPreguntasRecibidas(userId) { const { data: misJuegos } = await supabase.from('games').select('id').eq('user_id', userId); if (!misJuegos?.length) return; const ids = misJuegos.map(g => g.id); const { data } = await supabase.from('comments').select('*, games(title), profiles(username, avatar_url)').in('game_id', ids).neq('user_id', userId).order('created_at', { ascending: false }); if (data) setPreguntasRecibidas(data) }
  async function obtenerPerfil(userId) { const { data } = await supabase.from('profiles').select('*').eq('id', userId).single(); if (data) { setUsername(data.username); setBio(data.bio); setAvatarUrl(data.avatar_url) } const { data: rev } = await supabase.from('reviews').select('stars').eq('user_id', userId); if (rev?.length) { setRatingPromedio((rev.reduce((a,b)=>a+b.stars,0)/rev.length).toFixed(1)); setTotalReviews(rev.length); } }
  async function actualizarPerfil() { try { setLoadingProfile(true); const user = session.user; let publicUrl = avatarUrl; if (avatar) { const fName = `${user.id}-${Math.random()}.${avatar.name.split('.').pop()}`; const { error } = await supabase.storage.from('imagenes').upload(fName, avatar); if (error) throw error; const { data } = supabase.storage.from('imagenes').getPublicUrl(fName); publicUrl = data.publicUrl } await supabase.from('profiles').upsert({ id: user.id, username, bio, avatar_url: publicUrl, updated_at: new Date() }); setAvatarUrl(publicUrl); alert("Perfil Guardado"); } catch (e) { alert(e.message) } finally { setLoadingProfile(false) } }
  async function subirJuego(e) { e.preventDefault(); if (!nuevoTitulo || !archivo || !nuevaCiudad || !nuevoGenero) return alert("Faltan datos"); setCargando(true); try { const fName = `${Date.now()}-${archivo.name}`; await supabase.storage.from('imagenes').upload(fName, archivo); const { data: { publicUrl } } = supabase.storage.from('imagenes').getPublicUrl(fName); await supabase.from('games').insert([{ title: nuevoTitulo, platform: nuevaPlataforma, contact: session.user.email, city: nuevaCiudad, genre: nuevoGenero, condition: 'Disponible', type: nuevoTipo, price: nuevoTipo==='venta'?nuevoPrecio:0, description: nuevaDescripcion, image_url: publicUrl, user_id: session.user.id }]); setNuevoTitulo(''); setArchivo(null); alert("Publicado!"); obtenerJuegos(); } catch (e) { alert(e.message) } finally { setCargando(false) } }
  
  const handleWompiPayment = (game) => { 
    const checkout = new WidgetCheckout({ 
      currency: 'COP', 
      amountInCents: game.price * 100, 
      reference: `REF-${game.id}-${Date.now()}`, 
      publicKey: WOMPI_PUBLIC_KEY, 
      redirectUrl: window.location.href 
    })
    
    checkout.open(async (r) => { 
      if(r.transaction.status === 'APPROVED'){ 
        await supabase.from('games').update({ condition: 'Vendido' }).eq('id', game.id); 
        alert("¡VENDIDO! Pago exitoso."); 
        obtenerJuegos(); 
      } 
    }) 
  }

  async function eliminarJuego(id) { if(confirm("Borrar?")) await supabase.from('games').delete().eq('id', id); obtenerJuegos(); }

  const juegosFiltrados = games.filter((game) => {
    const coincideTexto = game.title.toLowerCase().includes(busqueda.toLowerCase())
    const coincidePlataforma = filtroPlataforma === '' || game.platform === filtroPlataforma
    const coincideCiudad = filtroCiudad === '' || game.city === filtroCiudad
    const coincideGenero = filtroGenero === '' || game.genre === filtroGenero
    const estaDisponible = game.condition !== 'Vendido' 
    return coincideTexto && coincidePlataforma && coincideCiudad && coincideGenero && estaDisponible
  })

  // --- ESTILOS ---
  const cardStyle = "bg-gray-900/60 backdrop-blur-md border border-white/10 rounded-xl shadow-lg hover:shadow-green-500/20 hover:border-green-500/50 transition-all duration-300"
  const inputStyle = "w-full p-3 bg-gray-900/80 border border-gray-700 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
  const btnPrimary = "w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-green-500/30 transform hover:-translate-y-0.5 transition-all"

  if (!session && authMode !== 'invitado' && authMode !== 'actualizar_pass') return (
    <div className="min-h-screen flex items-center justify-center font-sans relative" style={{ backgroundImage: "url('/fondo.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
      <div className={`relative z-10 p-8 w-full max-w-md ${cardStyle}`}>
        <div className="flex justify-center mb-6"><img src="/logo.png" alt="ReSpawn" className="w-48 h-auto object-contain drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]"/></div>
        {authMode === 'recuperar' ? (
            <div className="animate-fade-in space-y-4"><h3 className="text-white font-bold text-lg">Recuperar Acceso</h3><input type="email" placeholder="Tu correo electrónico" className={inputStyle} value={email} onChange={e=>setEmail(e.target.value)}/><button onClick={handleResetPasswordRequest} disabled={authLoading} className={btnPrimary}>{authLoading ? "Enviando..." : "Enviar Enlace Mágico"}</button><button onClick={()=>setAuthMode('login')} className="w-full text-gray-400 text-sm hover:text-white mt-2">Volver</button></div>
        ) : (
            <form className="flex flex-col gap-4" onSubmit={authMode === 'login' ? handleLogin : handleSignUp}>
                {authMode==='registro' && <input type="text" placeholder="GamerTag" className={inputStyle} value={usernameRegister} onChange={e=>setUsernameRegister(e.target.value)}/>}
                <input type="email" placeholder="Correo" className={inputStyle} value={email} onChange={e=>setEmail(e.target.value)}/>
                <input type="password" placeholder="Contraseña" className={inputStyle} value={password} onChange={e=>setPassword(e.target.value)}/>
                {authMode === 'login' && (<div className="text-right"><button type="button" onClick={()=>setAuthMode('recuperar')} className="text-xs text-green-400 hover:text-green-300 hover:underline">¿Olvidaste tu contraseña?</button></div>)}
                <button disabled={authLoading} className={btnPrimary}>{authLoading?"...":(authMode==='login'?"ENTRAR":"REGISTRO")}</button>
                <div className="flex mt-4 border-t border-gray-700/50 pt-4"><button type="button" className={`flex-1 text-xs font-bold ${authMode==='login'?'text-white':'text-gray-500'}`} onClick={()=>setAuthMode('login')}>LOGIN</button><button type="button" className={`flex-1 text-xs font-bold ${authMode==='registro'?'text-white':'text-gray-500'}`} onClick={()=>setAuthMode('registro')}>CREAR CUENTA</button></div>
            </form>
        )}
        {authMode !== 'recuperar' && (<button onClick={() => setAuthMode('invitado')} className="w-full mt-6 text-gray-500 text-xs hover:text-white transition-colors">Entrar como Invitado</button>)}
      </div>
    </div>
  )

  if (authMode === 'actualizar_pass') return (<div className="min-h-screen flex items-center justify-center font-sans relative" style={{ backgroundImage: "url('/fondo.png')", backgroundSize: 'cover' }}><div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div><div className={`relative z-10 p-8 w-full max-w-md ${cardStyle}`}><h1 className="text-2xl font-bold text-white mb-4 text-center">🔐 Nueva Contraseña</h1><form onSubmit={handleUpdatePassword} className="space-y-4"><input type="password" placeholder="Nueva contraseña segura" className={inputStyle} value={password} onChange={e=>setPassword(e.target.value)}/><button disabled={authLoading} className={btnPrimary}>{authLoading ? "Guardando..." : "Actualizar y Entrar"}</button></form></div></div>)

  return (
    <div className="min-h-screen font-sans text-white relative selection:bg-green-500 selection:text-black" style={{ backgroundImage: "url('/fondo.png')", backgroundAttachment: 'fixed', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-gray-900/85 z-0 fixed h-full w-full"></div> 

      <div className="relative z-10 p-4 sm:p-8">
          <Script src="https://checkout.wompi.co/widget.js" strategy="lazyOnload" />

          {/* HEADER */}
          <div className={`flex flex-col md:flex-row justify-between items-center mb-8 p-4 ${cardStyle} sticky top-4 z-50`}>
            <div className="flex items-center gap-3"><img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain hover:drop-shadow-[0_0_10px_rgba(34,197,94,0.8)] transition-all"/>{session && <span className="hidden md:block text-xs text-gray-400 font-mono border border-gray-600 rounded px-2 py-0.5">ONLINE</span>}</div>
            <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
              <button onClick={() => setVista('mercado')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${vista==='mercado'?'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]':'text-gray-400 hover:bg-white/10'}`}>🏠 Mercado</button>
              <button onClick={() => setVista('perfil')} className={`px-4 py-2 rounded-lg text-sm font-bold relative transition-all ${vista==='perfil'?'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]':'text-gray-400 hover:bg-white/10'}`}>👤 Perfil {preguntasRecibidas.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse">{preguntasRecibidas.length}</span>}</button>
              {session && (<button onClick={() => setVista('mensajes')} className={`px-4 py-2 rounded-lg text-sm font-bold relative transition-all ${vista==='mensajes'?'bg-yellow-600 text-white shadow-[0_0_15px_rgba(202,138,4,0.4)]':'text-gray-400 hover:bg-white/10'}`}>📩 Chat {mensajesNoLeidos > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse">{mensajesNoLeidos}</span>}</button>)}
              {session && session.user.email === ADMIN_EMAIL && (<button onClick={() => setVista('admin')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista==='admin'?'bg-red-600 text-white':'text-red-400 hover:bg-red-900/20'}`}>👮‍♂️ Admin</button>)}
              {session ? <button onClick={handleLogout} className="px-4 py-2 text-red-400 text-sm hover:text-red-300 font-bold border border-red-500/30 rounded-lg hover:bg-red-500/10 ml-2">Salir</button> : <button onClick={() => window.location.reload()} className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/50 rounded-lg text-sm font-bold hover:bg-green-600 hover:text-white transition-all ml-2">Entrar</button>}
            </div>
          </div>

          {/* ADMIN */}
          {vista === 'admin' && session && session.user.email === ADMIN_EMAIL && (
              <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className={`p-6 ${cardStyle}`}><h3 className="font-bold mb-4 text-red-400 text-lg uppercase tracking-wider">🚨 Reportes Activos</h3><div className="max-h-96 overflow-y-auto space-y-2 pr-2 custom-scrollbar">{listaReportes.map(r => (<div key={r.id} className="bg-red-900/20 p-3 rounded border border-red-500/30 hover:border-red-500 transition-colors"><p className="text-red-300 text-xs font-bold uppercase">{r.profiles?.username} reportó:</p><p className="text-white text-sm font-bold mt-1">{r.games?.title}</p><p className="text-gray-300 text-xs mt-1 italic">"{r.reason}"</p><button onClick={() => adminBorrarJuego(r.game_id)} className="mt-3 w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded shadow-lg">⚠️ ELIMINAR CONTENIDO</button></div>))}{listaReportes.length===0 && <p className="text-gray-500 italic text-center py-10">Sin reportes pendientes.</p>}</div></div>
                  <div className={`p-6 ${cardStyle}`}><h3 className="font-bold mb-4 text-blue-400 text-lg uppercase tracking-wider">Base de Datos de Juegos</h3><div className="max-h-96 overflow-y-auto space-y-2 pr-2 custom-scrollbar">{games.map(g => (<div key={g.id} className="flex justify-between items-center bg-gray-800/50 p-2 rounded border border-gray-700 hover:bg-gray-700 transition-colors"><div className="flex gap-3 items-center"><img src={g.image_url} className="w-12 h-12 object-cover rounded-lg border border-gray-600"/><div><p className="font-bold text-sm text-white">{g.title}</p><p className="text-[10px] text-gray-400 uppercase tracking-wide">{g.city} • {g.genre}</p></div></div><button onClick={() => adminBorrarJuego(g.id)} className="text-gray-500 hover:text-red-500 p-2 transition-colors">🗑️</button></div>))}</div></div>
              </div>
          )}

          {/* CHAT */}
          {vista === 'mensajes' && session && (
            <div className={`max-w-5xl mx-auto h-[75vh] flex overflow-hidden ${cardStyle}`}>
              <div className="w-1/3 border-r border-gray-700/50 overflow-y-auto bg-gray-900/30"><div className="p-4 border-b border-gray-700/50 font-bold text-gray-400 uppercase text-xs tracking-widest">Bandeja de Entrada</div>{misChats.map(chat => { const soyComprador = chat.buyer_id === session.user.id; const otroUsuario = soyComprador ? chat.vendedor : chat.comprador; return (<div key={chat.id} onClick={() => { setChatActivo(chat); cargarMensajes(chat.id) }} className={`p-4 border-b border-gray-700/30 cursor-pointer hover:bg-white/5 transition-colors ${chatActivo?.id === chat.id ? 'bg-green-900/20 border-l-4 border-green-500' : ''}`}><div className="flex items-center gap-3"><div className="relative"><img src={otroUsuario?.avatar_url || "https://via.placeholder.com/40"} className="w-10 h-10 rounded-full object-cover border border-gray-600"/><div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div></div><div className="flex-1 min-w-0"><p className="font-bold text-sm truncate text-white">{otroUsuario?.username || "Usuario"}</p><p className="text-xs text-gray-400 truncate">Sobre: <span className="text-green-400">{chat.games?.title}</span></p></div></div></div>) })}</div>
              <div className="w-2/3 flex flex-col bg-gray-900/50">{chatActivo ? (<><div className="p-4 border-b border-gray-700/50 bg-gray-900/50 flex justify-between items-center backdrop-blur-sm"><div className="flex items-center gap-3"><img src={chatActivo.games?.image_url} className="w-12 h-12 rounded-lg object-cover border border-gray-600"/><h3 className="font-bold text-white text-lg">{chatActivo.games?.title}</h3></div><button onClick={() => calificarUsuario(chatActivo.buyer_id === session.user.id ? chatActivo.seller_id : chatActivo.buyer_id)} className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 hover:bg-yellow-500 hover:text-black px-4 py-2 rounded-lg text-xs font-bold transition-all">⭐ CALIFICAR</button></div><div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">{mensajesChat.map(msg => { const esMio = msg.sender_id === session.user.id; return (<div key={msg.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] p-4 rounded-2xl text-sm shadow-md ${esMio ? 'bg-green-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-100 rounded-bl-none'}`}>{msg.content}</div></div>) })}<div ref={messagesEndRef} /></div><form onSubmit={enviarMensajePrivado} className="p-4 bg-gray-800/80 border-t border-gray-700/50 flex gap-3 backdrop-blur-md"><input type="text" className={inputStyle} placeholder="Escribe tu mensaje..." value={nuevoMensajePrivado} onChange={e => setNuevoMensajePrivado(e.target.value)}/><button className="bg-green-600 hover:bg-green-500 text-white px-6 rounded-lg font-bold transition-colors shadow-lg">➤</button></form></>) : (<div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50"><div className="text-6xl mb-4">💬</div><p>Selecciona una conversación para empezar</p></div>)}</div>
            </div>
          )}

          {/* PERFIL */}
          {vista === 'perfil' && session && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                  <div className={`p-6 ${cardStyle}`}><h2 className="text-xl font-bold mb-6 text-blue-400 uppercase tracking-widest text-center">Tu Ficha de Jugador</h2><div className="flex flex-col items-center mb-6"><div className="w-32 h-32 rounded-full overflow-hidden bg-gray-900 border-4 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)] mb-4 group relative"><img src={avatarUrl || "https://via.placeholder.com/150"} className="w-full h-full object-cover transition-transform group-hover:scale-110" /><label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold">CAMBIAR<input type="file" className="hidden" accept="image/*" onChange={(e) => setAvatar(e.target.files[0])} /></label></div><input type="text" placeholder="GamerTag" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-transparent text-center text-2xl font-bold text-white border-b-2 border-gray-700 focus:border-blue-500 outline-none mb-2"/><textarea placeholder="Escribe tu leyenda..." value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 border border-gray-700 focus:border-blue-500 outline-none h-24 mb-4 resize-none"/><button onClick={actualizarPerfil} disabled={loadingProfile} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-transform hover:-translate-y-1">{loadingProfile ? "Guardando..." : "💾 GUARDAR DATOS"}</button></div><div className="border-t border-gray-700 pt-4 text-center"><p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Nivel de Reputación</p><div className="text-3xl text-yellow-400 drop-shadow-md">{ratingPromedio > 0 ? "⭐ " + ratingPromedio : "🆕"}</div><p className="text-xs text-gray-500 mt-1">{totalReviews} Misiones Completadas</p></div></div>
                </div>
                <div className="md:col-span-2 space-y-8">
                  {preguntasRecibidas.length > 0 && <div className={`p-6 ${cardStyle} border-l-4 border-l-red-500`}><h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">🔔 Notificaciones <span className="bg-red-500 text-xs px-2 py-0.5 rounded-full text-white animate-pulse">{preguntasRecibidas.length}</span></h2><div className="max-h-60 overflow-y-auto space-y-3 custom-scrollbar">{preguntasRecibidas.map(p => (<div key={p.id} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex gap-4 items-center"><img src={p.profiles?.avatar_url} className="w-10 h-10 rounded-full border border-gray-500" /><div className="flex-1"><p className="text-xs text-green-400 font-bold uppercase">{p.profiles?.username} <span className="text-gray-400 font-normal normal-case">preguntó en</span> {p.games?.title}:</p><p className="text-sm text-white mt-1 italic">"{p.content}"</p></div><button onClick={() => {setVista('mercado'); setBusqueda(p.games?.title)}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1 rounded text-xs font-bold transition-colors">RESPONDER</button></div>))}</div></div>}
                  <div><h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md">❤️ Wishlist</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{games.filter(g => misFavoritos.includes(g.id)).map(g => (<div key={g.id} className={`p-3 flex gap-3 items-center group cursor-pointer ${cardStyle}`}><img src={g.image_url} className="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition-transform"/><div><h4 className="font-bold text-sm text-white group-hover:text-green-400 transition-colors">{g.title}</h4><p className="text-xs text-gray-400">${g.price}</p></div></div>))} {misFavoritos.length === 0 && <p className="text-gray-500 italic">Tu lista de deseos está vacía.</p>}</div></div>
                  <div><h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md">📦 Tu Inventario</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{games.filter(g => g.user_id === session.user.id).map(game => (<div key={game.id} className={`p-4 flex gap-4 relative group ${cardStyle}`}><img src={game.image_url} className="w-24 h-24 object-cover rounded-lg shadow-md" /><div className="flex-1 min-w-0"><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-lg truncate text-white">{game.title}</h3></div><div className="flex flex-wrap gap-2 mb-3">{game.condition === 'Vendido' && (<span className="bg-red-500/20 text-red-400 border border-red-500/50 text-[10px] px-2 py-0.5 rounded font-bold uppercase">VENDIDO</span>)} {game.condition === 'Reservado' && (<span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 text-[10px] px-2 py-0.5 rounded font-bold uppercase">RESERVADO</span>)} <span className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded border border-gray-600">{game.platform}</span></div>{game.condition !== 'Vendido' && (<div className="flex gap-2"><button onClick={() => toggleReserva(game)} className={`flex-1 text-xs py-1.5 rounded font-bold transition-colors ${game.condition === 'Reservado' ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>{game.condition === 'Reservado' ? '🔓 LIBERAR' : '🔒 PAUSAR'}</button><button onClick={() => eliminarJuego(game.id)} className="px-3 bg-red-900/30 text-red-400 border border-red-500/30 rounded hover:bg-red-500 hover:text-white transition-all text-xs">🗑️</button></div>)}</div></div>))}</div></div>
                </div>
            </div>
          )}

          {/* MERCADO */}
          {vista === 'mercado' && (
            <>
              {/* FILTROS */}
              <div className={`p-4 mb-8 flex flex-col md:flex-row gap-4 items-center sticky top-24 z-40 ${cardStyle}`}>
                 <div className="relative flex-1 w-full group"><span className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-green-400 transition-colors">🔍</span><input type="text" placeholder="Buscar juego..." className="w-full p-3 pl-10 bg-gray-900/50 border border-gray-700 rounded-lg text-white outline-none focus:border-green-500 focus:bg-gray-900 transition-all placeholder-gray-500" value={busqueda} onChange={e=>setBusqueda(e.target.value)} /></div>
                 <select className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white outline-none focus:border-green-500 md:w-36 cursor-pointer hover:bg-gray-800 transition-colors" value={filtroPlataforma} onChange={e=>setFiltroPlataforma(e.target.value)}><option value="">Plataforma</option><option value="PS5">PS5</option><option value="Switch">Switch</option><option value="Xbox">Xbox</option><option value="PC">PC</option></select>
                 <select className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white outline-none focus:border-green-500 md:w-36 cursor-pointer hover:bg-gray-800 transition-colors" value={filtroCiudad} onChange={e=>setFiltroCiudad(e.target.value)}><option value="">Ciudad</option>{CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}</select>
                 <select className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white outline-none focus:border-green-500 md:w-36 cursor-pointer hover:bg-gray-800 transition-colors" value={filtroGenero} onChange={e=>setFiltroGenero(e.target.value)}><option value="">Género</option>{GENEROS_JUEGOS.map(g => <option key={g} value={g}>{g}</option>)}</select>
              </div>

              {/* FORMULARIO */}
              <div className={`max-w-2xl mx-auto p-6 mb-12 relative overflow-hidden group ${cardStyle}`}>
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <h2 className="text-xl font-bold mb-6 text-center text-green-400 uppercase tracking-widest flex items-center justify-center gap-2"><span className="text-2xl">📢</span> Publicar Nueva Misión</h2>
                <form onSubmit={subirJuego} className="flex flex-col gap-4">
                  <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-green-500 hover:bg-green-500/5 transition-all group/file">
                      <label className="cursor-pointer block">
                          <span className="text-4xl block mb-2 group-hover/file:scale-110 transition-transform">📸</span>
                          <p className="text-sm text-gray-400 group-hover/file:text-white">{archivo ? archivo.name : "Arrastra o selecciona la foto del juego"}</p>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setArchivo(e.target.files[0])} />
                      </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4"><input type="text" placeholder="Título del Juego" className={inputStyle} value={nuevoTitulo} onChange={e=>setNuevoTitulo(e.target.value)}/><select className={inputStyle} value={nuevaPlataforma} onChange={e=>setNuevaPlataforma(e.target.value)}><option value="">Plataforma...</option><option value="PS5">PS5</option><option value="Switch">Switch</option><option value="Xbox">Xbox</option><option value="PC">PC</option></select></div>
                  <div className="grid grid-cols-2 gap-4"><select className={inputStyle} value={nuevaCiudad} onChange={e=>setNuevaCiudad(e.target.value)}><option value="">Ciudad...</option>{CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}</select><select className={inputStyle} value={nuevoGenero} onChange={e=>setNuevoGenero(e.target.value)}><option value="">Género...</option>{GENEROS_JUEGOS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                  {nuevoTipo === 'venta' && <input type="number" placeholder="Precio en Pesos ($)" className={`${inputStyle} border-green-500/50 bg-green-900/20`} value={nuevoPrecio} onChange={e=>setNuevoPrecio(e.target.value)}/>}
                  <textarea placeholder="Descripción del estado del juego..." className={`${inputStyle} h-24 resize-none`} value={nuevaDescripcion} onChange={e=>setNuevaDescripcion(e.target.value)} />
                  <div className="flex gap-4 justify-center bg-gray-900/50 p-3 rounded-lg border border-gray-700"><label className="flex items-center gap-2 cursor-pointer hover:text-green-400 transition-colors"><input type="radio" name="tipo" checked={nuevoTipo === 'trueque'} onChange={() => setNuevoTipo('trueque')} className="accent-green-500" /> 🔄 Trueque</label><label className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors"><input type="radio" name="tipo" checked={nuevoTipo === 'venta'} onChange={() => setNuevoTipo('venta')} className="accent-blue-500" /> 💲 Venta</label></div>
                  <button disabled={cargando} className={btnPrimary}>{cargando ? "SUBIENDO..." : "🚀 PUBLICAR ANUNCIO"}</button>
                </form>
              </div>

              {/* GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4 pb-20">
                {juegosFiltrados.map((game) => (
                  <div key={game.id} className={`group relative overflow-hidden flex flex-col ${cardStyle}`}>
                    <button onClick={() => toggleFavorito(game.id)} className="absolute top-3 right-3 z-20 bg-gray-900/80 p-2 rounded-full hover:scale-110 transition-transform backdrop-blur-sm border border-gray-700 hover:border-red-500 group/heart">
                        <span className={misFavoritos.includes(game.id) ? "grayscale-0" : "grayscale opacity-50 group-hover/heart:grayscale-0 group-hover/heart:opacity-100"}>❤️</span>
                    </button>

                    <div className="h-56 bg-gray-900 relative overflow-hidden">
                       {game.image_url ? <img src={game.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className="flex items-center justify-center h-full text-4xl text-gray-700">🎮</div>}
                       <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg ${game.type === 'venta' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>{game.type}</span>
                           <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 border border-white/10">📍 {game.city}</span>
                       </div>
                       {game.condition === 'Reservado' && <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10"><span className="bg-yellow-500 text-black font-extrabold px-6 py-2 rounded-lg rotate-[-12deg] shadow-2xl border-4 border-yellow-300 text-xl">RESERVADO</span></div>}
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                       <h2 className="text-xl font-bold truncate text-white mb-1 group-hover:text-green-400 transition-colors">{game.title}</h2>
                       <p className="text-xs text-blue-400 mb-3 font-mono uppercase tracking-wide">{game.genre} • {game.platform}</p>
                       <div className="flex items-center gap-2 mb-4 bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                          <img src={game.profiles?.avatar_url || "https://via.placeholder.com/30"} className="w-6 h-6 rounded-full object-cover"/>
                          <span className="text-xs text-gray-300 truncate">{game.profiles?.username || "Usuario"}</span>
                       </div>

                       <div className="mt-auto space-y-3">
                         {session ? (
                            game.condition === 'Reservado' ? (
                                <button className="w-full bg-gray-700/50 text-gray-500 py-3 rounded-lg text-sm font-bold cursor-not-allowed border border-gray-600 border-dashed">⛔ EN NEGOCIACIÓN</button>
                            ) : (
                               game.type === 'venta' ? (
                                 <button onClick={() => handleWompiPayment(game)} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 transform active:scale-95 transition-all flex items-center justify-center gap-2">
                                    💳 COMPRAR ${new Intl.NumberFormat('es-CO').format(game.price)}
                                 </button>
                               ) : (
                                 <button onClick={() => iniciarNegociacion(game)} className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-green-900/20 transform active:scale-95 transition-all flex items-center justify-center gap-2">
                                    📩 OFERTAR TRUEQUE
                                 </button>
                               )
                            )
                         ) : (
                           <button onClick={() => alert("¡Inicia sesión para jugar!")} className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg text-sm font-bold text-gray-300 transition-colors">🔒 INICIA SESIÓN</button>
                         )}
                         
                         <div className="flex gap-2">
                             <button onClick={() => abrirChat(game.id)} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1">
                                💬 PREGUNTAS {game.comments?.[0]?.count > 0 && <span className="bg-gray-600 text-white px-1.5 rounded-full text-[10px]">{game.comments[0].count}</span>}
                             </button>
                             <button onClick={() => reportarJuego(game.id)} className="px-3 bg-gray-800 hover:bg-red-900/30 border border-gray-600 hover:border-red-500 text-gray-400 hover:text-red-400 rounded-lg transition-colors" title="Reportar">🚩</button>
                             <button onClick={() => compartirJuego(game)} className="px-3 bg-gray-800 hover:bg-blue-900/30 border border-gray-600 hover:border-blue-500 text-gray-400 hover:text-blue-400 rounded-lg transition-colors" title="Compartir">🔗</button>
                         </div>
                       </div>
                    </div>

                    {chatAbierto === game.id && (
                      <div className="bg-black/80 backdrop-blur-md p-4 border-t border-gray-700 animate-fade-in absolute bottom-0 left-0 w-full h-[80%] z-30 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Preguntas Públicas</h3>
                            <button onClick={() => setChatAbierto(null)} className="text-gray-500 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 mb-3 custom-scrollbar">
                          {comentarios[game.id]?.length > 0 ? (
                            comentarios[game.id].map(c => (
                              <div key={c.id} className="flex gap-2 items-start animate-fade-in">
                                 <img src={c.profiles?.avatar_url} className="w-6 h-6 rounded-full border border-gray-600"/>
                                 <div><p className="font-bold text-[10px] text-green-400">{c.profiles?.username}</p><p className="text-xs text-white bg-gray-800 p-2 rounded-lg rounded-tl-none">{c.content}</p></div>
                              </div>
                            ))
                          ) : (<p className="text-gray-500 italic text-xs text-center mt-10">Sé el primero en preguntar.</p>)}
                        </div>
                        {session ? (
                          <form onSubmit={(e) => enviarComentario(game.id, e)} className="flex gap-2 mt-auto">
                            <input type="text" placeholder="Escribe tu duda..." className="flex-1 bg-gray-800 text-white text-xs p-2.5 rounded-lg border border-gray-600 outline-none focus:border-green-500 transition-colors" value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)}/>
                            <button className="text-green-400 hover:text-white bg-green-500/20 hover:bg-green-500 p-2 rounded-lg transition-all">➤</button>
                          </form>
                        ) : (<p className="text-xs text-center text-gray-500 border-t border-gray-700 pt-2">Loguéate para preguntar.</p>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  )
}