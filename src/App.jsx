import { useEffect, useMemo, useState } from 'react';
import { Camera, CarFront, Cloud, Heart, LogIn, LogOut, Plus, Search, Smartphone, Star, Trash2, TriangleAlert, Wifi, WifiOff, X } from 'lucide-react';
import { fetchRemoteCars, firebaseEnabled, listenToAuth, loginWithGoogle, logoutUser, saveRemoteCar, deleteRemoteCar } from './lib/firebase';
import { clearLocalCars, getAllLocalCars, removeLocalCar, saveLocalCar, saveLocalCars } from './lib/localDb';

const initialForm = {
  id: '',
  name: '',
  series: '',
  color: '',
  year: '',
  notes: '',
  isFavorite: false,
  photoData: '',
  photoUrl: '',
};

const demoCars = [
  {
    id: crypto.randomUUID(),
    name: 'Bone Shaker',
    nameNormalized: 'bone shaker',
    series: 'HW Dream Garage',
    seriesNormalized: 'hw dream garage',
    color: 'Preto com chamas',
    year: '2026',
    notes: 'Favorito da coleção',
    isFavorite: true,
    syncStatus: 'local',
    photoData: '',
    photoUrl: '',
    updatedAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: 'Twin Mill',
    nameNormalized: 'twin mill',
    series: 'HW Legends',
    seriesNormalized: 'hw legends',
    color: 'Azul',
    year: '2025',
    notes: '',
    isFavorite: false,
    syncStatus: 'local',
    photoData: '',
    photoUrl: '',
    updatedAt: new Date().toISOString(),
  },
];

function normalizeText(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a, b) {
  const first = normalizeText(a);
  const second = normalizeText(b);
  if (!first || !second) return 0;
  if (first === second) return 1;
  const aWords = new Set(first.split(' '));
  const bWords = new Set(second.split(' '));
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  const union = new Set([...aWords, ...bWords]).size || 1;
  return intersection / union;
}

function detectDuplicates(candidate, cars, excludeId = '') {
  const name = normalizeText(candidate.name);
  const series = normalizeText(candidate.series);

  return cars
    .filter((car) => car.id !== excludeId)
    .map((car) => {
      const nameScore = similarity(name, car.nameNormalized || car.name);
      const sameName = name && name === (car.nameNormalized || normalizeText(car.name));
      const sameSeries = series && series === (car.seriesNormalized || normalizeText(car.series));
      let level = 'low';
      let score = nameScore;

      if (sameName && sameSeries) {
        level = 'high';
        score = 1;
      } else if (sameName || nameScore >= 0.85) {
        level = 'medium';
      } else if (nameScore >= 0.65) {
        level = 'low';
      }

      return {
        id: car.id,
        name: car.name,
        series: car.series,
        color: car.color,
        level,
        score,
      };
    })
    .filter((item) => item.score >= 0.65 || item.level === 'high')
    .sort((a, b) => b.score - a.score);
}

function buildCarPayload(form, existingCars, userId, online) {
  const now = new Date().toISOString();
  const payload = {
    ...form,
    id: form.id || crypto.randomUUID(),
    userId: userId || 'local-user',
    nameNormalized: normalizeText(form.name),
    seriesNormalized: normalizeText(form.series),
    updatedAt: now,
    createdAt: form.createdAt || now,
    syncStatus: online && userId ? 'synced' : 'pending',
  };

  const duplicateCandidates = detectDuplicates(payload, existingCars, form.id).slice(0, 3);
  payload.duplicateCandidates = duplicateCandidates;
  payload.duplicateStatus = duplicateCandidates[0]?.level || 'none';
  return payload;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function App() {
  const [cars, setCars] = useState([]);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [duplicatePreview, setDuplicatePreview] = useState([]);
  const [status, setStatus] = useState('Carregando coleção...');
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let unsub = () => {};
    async function boot() {
      const localCars = await getAllLocalCars();
      if (localCars.length) {
        setCars(localCars.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      } else {
        setCars(demoCars);
        await saveLocalCars(demoCars);
      }
      setStatus(firebaseEnabled ? 'Pronto para sincronizar com a nuvem.' : 'Modo local ativo. Configure o Firebase para login Google e backup na nuvem.');
      unsub = listenToAuth(async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          const remoteCars = await fetchRemoteCars(currentUser.uid);
          if (remoteCars.length) {
            setCars(remoteCars.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
            await clearLocalCars();
            await saveLocalCars(remoteCars);
          }
          setStatus('Coleção sincronizada com a nuvem.');
        }
      });
    }
    boot();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    setDuplicatePreview(detectDuplicates(form, cars, form.id).slice(0, 3));
  }, [form, cars, showForm]);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      const text = `${car.name} ${car.series} ${car.color} ${car.notes}`.toLowerCase();
      const searchMatch = text.includes(query.toLowerCase());
      const favoriteMatch = favoritesOnly ? car.isFavorite : true;
      return searchMatch && favoriteMatch;
    });
  }, [cars, query, favoritesOnly]);

  async function handleLogin() {
    try {
      await loginWithGoogle();
    } catch (error) {
      setStatus(error.message || 'Não foi possível fazer login com Google.');
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setStatus(firebaseEnabled ? 'Você saiu. Os dados locais continuam disponíveis.' : 'Modo local ativo.');
  }

  function openNewForm() {
    setForm(initialForm);
    setShowForm(true);
  }

  function openEditForm(car) {
    setForm(car);
    setShowForm(true);
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const photoData = await readFileAsDataURL(file);
    setForm((prev) => ({ ...prev, photoData, photoUrl: '' }));
  }

  async function handleSubmit(event, forceSave = false) {
    if (event) event.preventDefault();
    setSaving(true);
    try {
      const payload = buildCarPayload(form, cars, user?.uid, isOnline);
      if (!forceSave && payload.duplicateStatus === 'high') {
        setDuplicatePreview(payload.duplicateCandidates || []);
        setSaving(false);
        return;
      }

      const updatedCars = [payload, ...cars.filter((car) => car.id !== payload.id)].sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      setCars(updatedCars);
      await saveLocalCar(payload);
      if (firebaseEnabled && user?.uid && isOnline) {
        const savedRemote = await saveRemoteCar(user.uid, payload);
        await saveLocalCar(savedRemote);
        setCars((current) => [savedRemote, ...current.filter((car) => car.id !== payload.id)]);
        setStatus('Carrinho salvo e sincronizado com a nuvem.');
      } else {
        setStatus(user?.uid ? 'Carrinho salvo. Sincronização será feita quando houver internet.' : 'Carrinho salvo localmente.');
      }
      setShowForm(false);
      setForm(initialForm);
      setDuplicatePreview([]);
    } catch (error) {
      setStatus(error.message || 'Erro ao salvar carrinho.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(car) {
    const updated = { ...car, isFavorite: !car.isFavorite, updatedAt: new Date().toISOString() };
    setCars((current) => [updated, ...current.filter((item) => item.id !== car.id)]);
    await saveLocalCar(updated);
    if (firebaseEnabled && user?.uid && isOnline) {
      await saveRemoteCar(user.uid, updated);
    }
  }

  async function deleteCar(car) {
    const confirmed = window.confirm(`Excluir ${car.name}?`);
    if (!confirmed) return;
    setCars((current) => current.filter((item) => item.id !== car.id));
    await removeLocalCar(car.id);
    if (firebaseEnabled && user?.uid && isOnline) {
      await deleteRemoteCar(user.uid, car.id);
    }
    setStatus('Carrinho removido com sucesso.');
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <span className="badge">MVP pronto para deploy</span>
          <h1>CarrinhoCerto</h1>
          <p>Cadastre, consulte e evite comprar Hot Wheels repetido no mercado ou no shopping.</p>
        </div>
        <div className="hero-actions">
          {user ? (
            <button className="button secondary" onClick={handleLogout}><LogOut size={18} /> Sair</button>
          ) : (
            <button className="button primary" onClick={handleLogin} disabled={!firebaseEnabled}><LogIn size={18} /> Entrar com Google</button>
          )}
          <button className="button dark" onClick={openNewForm}><Plus size={18} /> Novo carrinho</button>
        </div>
      </header>

      <section className="status-grid">
        <InfoCard icon={<Smartphone size={18} />} title="Uso" value="Celular e desktop" />
        <InfoCard icon={isOnline ? <Wifi size={18} /> : <WifiOff size={18} />} title="Conexão" value={isOnline ? 'Online' : 'Offline'} />
        <InfoCard icon={<Cloud size={18} />} title="Sincronização" value={user && firebaseEnabled ? 'Nuvem ativa' : 'Modo local'} />
        <InfoCard icon={<CarFront size={18} />} title="Carrinhos" value={String(cars.length)} />
      </section>

      <section className="toolbar card">
        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, série, cor ou observação" />
        </div>
        <label className="favorite-toggle">
          <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
          <span>Somente favoritos</span>
        </label>
      </section>

      <section className="feedback">{status}</section>

      <section className="grid-cars">
        {filteredCars.map((car) => (
          <article key={car.id} className="car-card card">
            <div className="car-photo">
              {car.photoData || car.photoUrl ? (
                <img src={car.photoUrl || car.photoData} alt={car.name} />
              ) : (
                <div className="photo-placeholder"><Camera size={28} /><span>Sem foto</span></div>
              )}
            </div>
            <div className="car-content">
              <div className="car-title-row">
                <h3>{car.name}</h3>
                <button className="icon-button" onClick={() => toggleFavorite(car)} aria-label="favoritar">
                  {car.isFavorite ? <Star size={18} fill="currentColor" /> : <Heart size={18} />}
                </button>
              </div>
              <p><strong>Série:</strong> {car.series || 'Não informada'}</p>
              <p><strong>Cor:</strong> {car.color || 'Não informada'}</p>
              <p><strong>Ano:</strong> {car.year || 'Não informado'}</p>
              {car.duplicateStatus && car.duplicateStatus !== 'none' && (
                <span className={`duplicate-tag ${car.duplicateStatus}`}>{labelDuplicate(car.duplicateStatus)}</span>
              )}
              <div className="card-actions">
                <button className="button ghost" onClick={() => openEditForm(car)}>Editar</button>
                <button className="button danger" onClick={() => deleteCar(car)}><Trash2 size={16} /> Excluir</button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!filteredCars.length && (
        <section className="empty-state card">
          <CarFront size={42} />
          <h2>Nenhum carrinho encontrado</h2>
          <p>Tente outro termo de busca ou cadastre um novo item da coleção.</p>
        </section>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{form.id ? 'Editar carrinho' : 'Novo carrinho'}</h2>
                <p>Preencha os dados essenciais e o sistema verifica possíveis duplicados.</p>
              </div>
              <button className="icon-button" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="field full">
                <span>Foto</span>
                <div className="photo-upload">
                  {form.photoData || form.photoUrl ? <img src={form.photoUrl || form.photoData} alt="preview" /> : <Camera size={26} />}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} />
                </div>
              </label>

              <label className="field">
                <span>Nome *</span>
                <input required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </label>
              <label className="field">
                <span>Série</span>
                <input value={form.series} onChange={(e) => setForm((prev) => ({ ...prev, series: e.target.value }))} />
              </label>
              <label className="field">
                <span>Cor</span>
                <input value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} />
              </label>
              <label className="field">
                <span>Ano</span>
                <input value={form.year} onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))} />
              </label>
              <label className="field full">
                <span>Observações</span>
                <textarea rows="3" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </label>
              <label className="checkbox-row full">
                <input type="checkbox" checked={form.isFavorite} onChange={(e) => setForm((prev) => ({ ...prev, isFavorite: e.target.checked }))} />
                Marcar como favorito
              </label>

              {duplicatePreview.length > 0 && (
                <div className="duplicate-box full">
                  <div className="duplicate-head">
                    <TriangleAlert size={18} />
                    <strong>Possíveis duplicados encontrados</strong>
                  </div>
                  <ul>
                    {duplicatePreview.map((item) => (
                      <li key={item.id}>
                        <span>{item.name} • {item.series || 'Sem série'}</span>
                        <b>{labelDuplicate(item.level)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="modal-actions full">
                <button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                {duplicatePreview[0]?.level === 'high' && (
                  <button type="button" className="button warning" onClick={(e) => handleSubmit(e, true)}>Salvar mesmo assim</button>
                )}
                <button type="submit" className="button primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar carrinho'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, title, value }) {
  return (
    <article className="info-card card">
      <div className="info-icon">{icon}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function labelDuplicate(level) {
  if (level === 'high') return 'Duplicado forte';
  if (level === 'medium') return 'Duplicado provável';
  return 'Parecido';
}

export default App;