'use client';

import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CarFront,
  Cloud,
  Download,
  Heart,
  LogIn,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Car } from '@/types/car';
import { clearLocalCars, getAllLocalCars, removeLocalCar, saveLocalCar, saveLocalCars } from '@/lib/local-db';
import { deleteRemoteCar, fetchRemoteCars, firebaseEnabled, initFirebaseAnalytics, listenToAuth, loginWithGoogle, logoutUser, saveRemoteCar } from '@/lib/firebase';
import { buildCarPayload, demoCars, duplicateLabel, initialForm, readFileAsDataURL, detectDuplicates } from '@/lib/normalize';

type FormState = typeof initialForm & Partial<Car>;

function sortCars(cars: Car[]) {
  return [...cars].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export default function Dashboard() {
  const [cars, setCars] = useState<Car[]>([]);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [duplicatePreview, setDuplicatePreview] = useState<Car['duplicateCandidates']>([]);
  const [status, setStatus] = useState('Inicializando coleção...');
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : false);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    initFirebaseAnalytics().catch(() => undefined);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let unsub = () => {};

    async function boot() {
      const localCars = await getAllLocalCars();
      if (localCars.length > 0) {
        setCars(sortCars(localCars));
      } else {
        setCars(sortCars(demoCars));
        await saveLocalCars(demoCars);
      }

      setStatus(
        firebaseEnabled
          ? 'Pronto para sincronização em nuvem e uso offline.'
          : 'Modo local ativo. Configure o Firebase para login Google e backup em nuvem.',
      );

      unsub = listenToAuth(async (currentUser) => {
        setUser(currentUser);
        if (!currentUser) return;

        const remoteCars = await fetchRemoteCars(currentUser.uid);
        if (remoteCars.length > 0) {
          const sorted = sortCars(remoteCars);
          setCars(sorted);
          await clearLocalCars();
          await saveLocalCars(sorted);
        }
        setStatus('Coleção conectada à nuvem com sucesso.');
      });
    }

    boot();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    setDuplicatePreview(detectDuplicates({ id: form.id || '', name: form.name || '', series: form.series || '' }, cars, form.id || ''));
  }, [showForm, form, cars]);

  const filteredCars = useMemo(() => {
    const search = query.toLowerCase();
    return sortCars(
      cars.filter((car) => {
        const haystack = `${car.name} ${car.series} ${car.color} ${car.notes}`.toLowerCase();
        const matchesSearch = haystack.includes(search);
        const matchesFavorite = favoritesOnly ? car.isFavorite : true;
        return matchesSearch && matchesFavorite;
      }),
    );
  }, [cars, query, favoritesOnly]);

  const stats = useMemo(() => {
    const favorites = cars.filter((car) => car.isFavorite).length;
    const pending = cars.filter((car) => car.syncStatus !== 'synced').length;
    const duplicateAlerts = cars.filter((car) => car.duplicateStatus === 'high' || car.duplicateStatus === 'medium').length;
    return { favorites, pending, duplicateAlerts };
  }, [cars]);

  async function handleLogin() {
    try {
      await loginWithGoogle();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha no login com Google.');
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setStatus('Sessão encerrada. A coleção local continua disponível neste dispositivo.');
  }

  function openNewForm() {
    setForm(initialForm);
    setShowForm(true);
  }

  function openEditForm(car: Car) {
    setForm({
      ...car,
      photoData: car.photoData || '',
      photoUrl: car.photoUrl || '',
    });
    setShowForm(true);
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const photoData = await readFileAsDataURL(file);
    setForm((prev) => ({ ...prev, photoData, photoUrl: '' }));
  }

  async function upsertCar(payload: Car) {
    const merged = sortCars([payload, ...cars.filter((car) => car.id !== payload.id)]);
    setCars(merged);
    await saveLocalCar(payload);

    if (firebaseEnabled && user?.uid && isOnline) {
      const remote = await saveRemoteCar(user.uid, payload);
      await saveLocalCar(remote);
      setCars((current) => sortCars([remote, ...current.filter((car) => car.id !== remote.id)]));
      setStatus('Carrinho salvo e sincronizado na nuvem.');
    } else if (user?.uid && !isOnline) {
      setStatus('Carrinho salvo offline. A sincronização será feita quando a conexão voltar.');
    } else {
      setStatus('Carrinho salvo no modo local.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>, forceSave = false) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = buildCarPayload(form, cars, user?.uid || 'local-user', isOnline);

      if (!forceSave && payload.duplicateStatus === 'high') {
        setDuplicatePreview(payload.duplicateCandidates);
        setSaving(false);
        return;
      }

      await upsertCar(payload);
      setShowForm(false);
      setForm(initialForm);
      setDuplicatePreview([]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível salvar o carrinho.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(car: Car) {
    const updated: Car = {
      ...car,
      isFavorite: !car.isFavorite,
      updatedAt: new Date().toISOString(),
      syncStatus: user?.uid && isOnline ? 'synced' : car.syncStatus,
    };
    await upsertCar(updated);
  }

  async function deleteCar(car: Car) {
    const confirmed = window.confirm(`Excluir ${car.name} da coleção?`);
    if (!confirmed) return;

    setCars((current) => current.filter((item) => item.id !== car.id));
    await removeLocalCar(car.id);

    if (firebaseEnabled && user?.uid && isOnline) {
      await deleteRemoteCar(user.uid, car.id);
    }

    setStatus('Carrinho removido com sucesso.');
  }

  function exportCollection() {
    const blob = new Blob([JSON.stringify(cars, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'carrinhocerto-colecao.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell">
      <section className="hero-panel glass-panel">
        <div className="hero-copy">
          <span className="pill subtle"><Sparkles size={14} /> Next.js pronto para produção</span>
          <h1>CarrinhoCerto</h1>
          <p>
            Uma versão mais robusta, moderna e dark para cadastrar Hot Wheels, consultar rapidamente a coleção e evitar
            compras repetidas no mercado ou shopping.
          </p>
          <div className="hero-buttons">
            {user ? (
              <button className="button secondary" onClick={handleLogout}>
                <LogOut size={18} /> Sair
              </button>
            ) : (
              <button className="button primary" onClick={handleLogin} disabled={!firebaseEnabled}>
                <LogIn size={18} /> Entrar com Google
              </button>
            )}
            <button className="button ghost" onClick={openNewForm}>
              <Plus size={18} /> Novo carrinho
            </button>
            <button className="button tertiary" onClick={exportCollection}>
              <Download size={18} /> Exportar coleção
            </button>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-top">
            <strong>Visão rápida</strong>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="hero-stats">
            <Metric label="Coleção" value={String(cars.length)} icon={<CarFront size={18} />} />
            <Metric label="Favoritos" value={String(stats.favorites)} icon={<Star size={18} />} />
            <Metric label="Pendências" value={String(stats.pending)} icon={<Cloud size={18} />} />
            <Metric label="Alertas" value={String(stats.duplicateAlerts)} icon={<TriangleAlert size={18} />} />
          </div>
          <div className="hero-note">
            <ShieldCheck size={16} />
            <span>{user ? `Conta conectada: ${user.email}` : 'Modo local ativo até configurar o Firebase.'}</span>
          </div>
        </div>
      </section>

      <section className="quick-grid">
        <QuickCard title="Sincronização" value={user && firebaseEnabled ? 'Nuvem ativa' : 'Somente local'} icon={<Cloud size={18} />} />
        <QuickCard title="Conectividade" value={isOnline ? 'Pronto para sincronizar' : 'Modo offline'} icon={isOnline ? <Wifi size={18} /> : <WifiOff size={18} />} />
        <QuickCard title="Busca rápida" value="Nome, série e cor" icon={<Search size={18} />} />
      </section>

      <section className="toolbar glass-panel">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, série, cor ou observação"
          />
        </div>
        <label className="toggle-chip">
          <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
          <Heart size={16} />
          Somente favoritos
        </label>
      </section>

      <p className="feedback-line">{status}</p>

      <section className="collection-grid">
        {filteredCars.map((car) => (
          <article key={car.id} className="collection-card glass-panel">
            <div className="collection-media">
              {car.photoData || car.photoUrl ? (
                <img src={car.photoUrl || car.photoData} alt={car.name} />
              ) : (
                <div className="empty-photo">
                  <Camera size={28} />
                  <span>Adicione uma foto</span>
                </div>
              )}
            </div>
            <div className="collection-content">
              <div className="collection-header">
                <div>
                  <h2>{car.name}</h2>
                  <p>{car.series || 'Série não informada'}</p>
                </div>
                <button className="icon-action" onClick={() => toggleFavorite(car)} aria-label="alternar favorito">
                  {car.isFavorite ? <Star size={18} fill="currentColor" /> : <Heart size={18} />}
                </button>
              </div>

              <div className="meta-grid">
                <Meta label="Cor" value={car.color || 'Não informada'} />
                <Meta label="Ano" value={car.year || 'Não informado'} />
                <Meta label="Status" value={car.syncStatus === 'synced' ? 'Sincronizado' : car.syncStatus === 'pending' ? 'Pendente' : 'Local'} />
              </div>

              {car.notes ? <p className="notes">{car.notes}</p> : null}

              {car.duplicateStatus !== 'none' ? (
                <div className={`duplicate-badge ${car.duplicateStatus}`}>{duplicateLabel(car.duplicateStatus)}</div>
              ) : null}

              <div className="card-row-actions">
                <button className="button tertiary" onClick={() => openEditForm(car)}>
                  Editar
                </button>
                <button className="button danger" onClick={() => deleteCar(car)}>
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {filteredCars.length === 0 ? (
        <section className="empty-block glass-panel">
          <CarFront size={42} />
          <h2>Nenhum carrinho encontrado</h2>
          <p>Use a busca com outro termo ou cadastre um novo item na coleção.</p>
        </section>
      ) : null}

      {showForm ? (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section className="modal-panel glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="pill accent">Cadastro inteligente</span>
                <h2>{form.id ? 'Editar carrinho' : 'Novo carrinho'}</h2>
                <p>Fluxo mobile-first com alerta de duplicidade por nome e série.</p>
              </div>
              <button className="icon-action" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="form-layout" onSubmit={handleSubmit}>
              <label className="field full">
                <span>Foto do carrinho</span>
                <div className="upload-box">
                  {form.photoData || form.photoUrl ? (
                    <img src={form.photoUrl || form.photoData} alt="Prévia do carrinho" />
                  ) : (
                    <div className="upload-placeholder">
                      <Camera size={28} />
                      <strong>Toque para adicionar foto</strong>
                      <small>PNG, JPG ou captura do celular</small>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} />
                </div>
              </label>

              <label className="field">
                <span>Nome *</span>
                <input required value={form.name || ''} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>

              <label className="field">
                <span>Série</span>
                <input value={form.series || ''} onChange={(event) => setForm((prev) => ({ ...prev, series: event.target.value }))} />
              </label>

              <label className="field">
                <span>Cor</span>
                <input value={form.color || ''} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} />
              </label>

              <label className="field">
                <span>Ano</span>
                <input value={form.year || ''} onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))} />
              </label>

              <label className="field full">
                <span>Observações</span>
                <textarea rows={4} value={form.notes || ''} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
              </label>

              <label className="toggle-chip full">
                <input type="checkbox" checked={Boolean(form.isFavorite)} onChange={(event) => setForm((prev) => ({ ...prev, isFavorite: event.target.checked }))} />
                <Star size={16} />
                Marcar como favorito
              </label>

              {duplicatePreview.length > 0 ? (
                <div className="duplicate-panel full">
                  <div className="duplicate-title">
                    <TriangleAlert size={18} />
                    <strong>Possíveis duplicados</strong>
                  </div>
                  <ul>
                    {duplicatePreview.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.series || 'Sem série'}</span>
                        </div>
                        <b>{duplicateLabel(item.level)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="modal-actions full">
                <button className="button secondary" type="button" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                {duplicatePreview[0]?.level === 'high' ? (
                  <button className="button warning" type="button" onClick={(event) => handleSubmit(event, true)}>
                    Salvar mesmo assim
                  </button>
                ) : null}
                <button className="button primary" type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar carrinho'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function QuickCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <article className="quick-card glass-panel">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}