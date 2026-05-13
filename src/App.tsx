import { useState, useMemo, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { GoogleLogin, googleLogout, type CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import type { Projekt, Historyjka, Zadanie, Powiadomienie, Uzytkownik, Rola } from './types';
import { 
  projectService, 
  storyService, 
  taskService, 
  notificationService,
  notificationEmitter,
  authService,
  userService,
  getActiveProjectId, 
  setActiveProjectId 
} from './api';

interface GoogleProfile {
  email: string;
  given_name: string;
  family_name: string;
  sub: string;
}

function App() {
  // Auth state
  const [loggedUser, setLoggedUser] = useState<Uzytkownik | null>(authService.getLoggedUser());

  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('manageme_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Projects state
  const [projects, setProjects] = useState<Projekt[]>(projectService.getAll());
  const [nazwa, setNazwa] = useState('');
  const [opis, setOpis] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Active Project state
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(getActiveProjectId());

  // Stories state
  const [stories, setStories] = useState<Historyjka[]>(
    activeProjectId ? storyService.getAllForProject(activeProjectId) : []
  );
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  
  // Story Form state
  const [storyNazwa, setStoryNazwa] = useState('');
  const [storyOpis, setStoryOpis] = useState('');
  const [storyPriorytet, setStoryPriorytet] = useState<'niski' | 'średni' | 'wysoki'>('niski');
  const [storyStan, setStoryStan] = useState<'todo' | 'doing' | 'done'>('todo');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);

  // Tasks state
  const [tasks, setTasks] = useState<Zadanie[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Task Form state
  const [taskNazwa, setTaskNazwa] = useState('');
  const [taskOpis, setTaskOpis] = useState('');
  const [taskPriorytet, setTaskPriorytet] = useState<'niski' | 'średni' | 'wysoki'>('niski');
  const [taskCzas, setTaskCzas] = useState(1);

  // Notification state
  const [notifications, setNotifications] = useState<Powiadomienie[]>(
    loggedUser ? notificationService.getAllForUser(loggedUser.id) : []
  );
  const [unreadCount, setUnreadCount] = useState(
    loggedUser ? notificationService.getUnreadCount(loggedUser.id) : 0
  );
  const [view, setView] = useState<'board' | 'notifications' | 'admin'>('board');
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Powiadomienie[]>([]);

  // Admin state
  const [allUsers, setAllUsers] = useState<Uzytkownik[]>(
    loggedUser?.rola === 'admin' ? userService.getAll() : []
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('manageme_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('manageme_theme', 'light');
    }
  }, [darkMode]);

  // Real-time notifications listener
  useEffect(() => {
    const unsubscribe = notificationEmitter.subscribe((n) => {
      if (loggedUser && n.odbiorcaId === loggedUser.id) {
        setNotifications(prev => [n, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        if (n.priorytet === 'medium' || n.priorytet === 'high') {
          setToasts(prev => [...prev, n]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== n.id));
          }, 5000);
        }
      }
    });
    return unsubscribe;
  }, [loggedUser]);

  const refreshProjects = () => {
    setProjects(projectService.getAll());
  };

  const refreshStories = (projectId: string) => {
    const updatedStories = storyService.getAllForProject(projectId);
    setStories(updatedStories);
  };

  const refreshTasks = (storyId: string) => {
    setTasks(taskService.getAllForStory(storyId));
    if (activeProjectId) refreshStories(activeProjectId);
  };

  const refreshNotifications = () => {
    if (loggedUser) {
      setNotifications(notificationService.getAllForUser(loggedUser.id));
      setUnreadCount(notificationService.getUnreadCount(loggedUser.id));
    }
  };

  const refreshUsers = () => {
    setAllUsers(userService.getAll());
  };

  // Auth handlers
  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      const profile = jwtDecode<GoogleProfile>(credentialResponse.credential);
      const user = authService.login(profile);
      setLoggedUser(user);
      setView('board');
      setNotifications(notificationService.getAllForUser(user.id));
      setUnreadCount(notificationService.getUnreadCount(user.id));
      if (user.rola === 'admin') setAllUsers(userService.getAll());
    }
  };

  const handleLogout = () => {
    googleLogout();
    authService.logout();
    setLoggedUser(null);
    setView('board');
    setActiveProjectIdState(null);
    setActiveProjectId(null);
    setNotifications([]);
    setUnreadCount(0);
    setAllUsers([]);
  };

  // Project handlers
  const handleProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nazwa.trim()) return;

    if (editingProjectId) {
      projectService.update({ id: editingProjectId, nazwa, opis });
      setEditingProjectId(null);
    } else {
      projectService.create({ nazwa, opis });
    }

    setNazwa('');
    setOpis('');
    refreshProjects();
    if (loggedUser?.rola === 'admin') refreshUsers(); // Users might have received notification
  };

  const handleProjectEdit = (p: Projekt) => {
    setNazwa(p.nazwa);
    setOpis(p.opis);
    setEditingProjectId(p.id);
  };

  const handleProjectDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten projekt?')) {
      projectService.delete(id);
      if (activeProjectId === id) {
        setActiveProjectIdState(null);
        setActiveProjectId(null);
        setStories([]);
        setSelectedStoryId(null);
      }
      refreshProjects();
    }
  };

  const handleActiveProjectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value || null;
    setActiveProjectIdState(id);
    setActiveProjectId(id);
    setSelectedStoryId(null);
    setTasks([]);
    if (id) {
      refreshStories(id);
    } else {
      setStories([]);
    }
  };

  // Story handlers
  const handleStorySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!storyNazwa.trim() || !activeProjectId || !loggedUser) return;

    if (editingStoryId) {
      const existing = stories.find(s => s.id === editingStoryId);
      if (existing) {
        storyService.update({
          ...existing,
          nazwa: storyNazwa,
          opis: storyOpis,
          priorytet: storyPriorytet,
          stan: storyStan,
        });
      }
      setEditingStoryId(null);
    } else {
      storyService.create({
        nazwa: storyNazwa,
        opis: storyOpis,
        priorytet: storyPriorytet,
        stan: storyStan,
        projektId: activeProjectId,
        wlascicielId: loggedUser.id,
      });
    }

    resetStoryForm();
    refreshStories(activeProjectId);
  };

  const handleStoryEdit = (s: Historyjka, e: React.MouseEvent) => {
    e.stopPropagation();
    setStoryNazwa(s.nazwa);
    setStoryOpis(s.opis);
    setStoryPriorytet(s.priorytet);
    setStoryStan(s.stan);
    setEditingStoryId(s.id);
  };

  const handleStoryDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Czy na pewno chcesz usunąć tę historyjkę?')) {
      storyService.delete(id);
      if (selectedStoryId === id) {
        setSelectedStoryId(null);
        setTasks([]);
      }
      if (activeProjectId) refreshStories(activeProjectId);
    }
  };

  const handleStorySelect = (id: string) => {
    setSelectedStoryId(id);
    setTasks(taskService.getAllForStory(id));
  };

  const resetStoryForm = () => {
    setStoryNazwa('');
    setStoryOpis('');
    setStoryPriorytet('niski');
    setStoryStan('todo');
    setEditingStoryId(null);
  };

  // Task handlers
  const handleTaskSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!taskNazwa.trim() || !selectedStoryId) return;

    taskService.create({
      nazwa: taskNazwa,
      opis: taskOpis,
      priorytet: taskPriorytet,
      przewidywanyCzas: taskCzas,
      stan: 'todo',
      historyjkaId: selectedStoryId,
    });

    setTaskNazwa('');
    setTaskOpis('');
    setTaskPriorytet('niski');
    setTaskCzas(1);
    refreshTasks(selectedStoryId);
  };

  const handleTaskAssignUser = (taskId: string, userId: string) => {
    const task = taskService.getById(taskId);
    if (task) {
      taskService.update({ ...task, wlascicielId: userId });
      if (selectedStoryId) refreshTasks(selectedStoryId);
    }
  };

  const handleTaskComplete = (taskId: string) => {
    const task = taskService.getById(taskId);
    if (task) {
      taskService.update({ ...task, stan: 'done' });
      setTimeout(() => {
        if (selectedStoryId) refreshTasks(selectedStoryId);
      }, 50);
    }
  };

  const handleTaskDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Czy na pewno chcesz usunąć to zadanie?')) {
      taskService.delete(id);
      if (selectedStoryId) refreshTasks(selectedStoryId);
    }
  };

  // Notification handlers
  const handleNotificationClick = (id: string) => {
    setSelectedNotificationId(id);
    notificationService.markAsRead(id);
    refreshNotifications();
  };

  // Admin handlers
  const handleUpdateUserRole = (userId: string, role: Rola) => {
    userService.updateRole(userId, role);
    refreshUsers();
  };

  const handleToggleBlock = (userId: string) => {
    userService.toggleBlock(userId);
    refreshUsers();
  };

  // Memoized data
  const todoStories = useMemo(() => stories.filter(s => s.stan === 'todo'), [stories]);
  const doingStories = useMemo(() => stories.filter(s => s.stan === 'doing'), [stories]);
  const doneStories = useMemo(() => stories.filter(s => s.stan === 'done'), [stories]);

  const todoTasks = useMemo(() => tasks.filter(t => t.stan === 'todo'), [tasks]);
  const doingTasks = useMemo(() => tasks.filter(t => t.stan === 'doing'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.stan === 'done'), [tasks]);

  const selectedStory = useMemo(() => stories.find(s => s.id === selectedStoryId), [stories, selectedStoryId]);
  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
  const selectedNotification = useMemo(() => notifications.find(n => n.id === selectedNotificationId), [notifications, selectedNotificationId]);

  // Conditional Rendering for Login/Auth states
  if (!loggedUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 ${darkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-100 dark:border-slate-700">
          <h1 className="text-4xl font-black text-indigo-600 mb-6">ManageMe</h1>
          <p className="text-slate-500 mb-10">Zaloguj się, aby zarządzać swoimi projektami</p>
          <div className="flex justify-center">
            <GoogleLogin onSuccess={handleLoginSuccess} onError={() => console.log('Login Failed')} />
          </div>
        </div>
      </div>
    );
  }

  if (loggedUser.czyZablokowany) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 ${darkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-2xl text-center max-w-md w-full border-t-8 border-red-500">
          <span className="text-6xl mb-6 block">🚫</span>
          <h1 className="text-2xl font-black mb-4">Konto Zablokowane</h1>
          <p className="text-slate-500 mb-8">Twoje konto zostało zablokowane przez administratora.</p>
          <button onClick={handleLogout} className="text-indigo-600 font-bold hover:underline">Wyloguj</button>
        </div>
      </div>
    );
  }

  if (loggedUser.rola === 'gość') {
    return (
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 ${darkMode ? 'dark' : ''}`}>
        <div className="max-w-4xl mx-auto p-8">
          <div className="flex justify-between items-center mb-12">
            <h1 className="text-3xl font-black text-indigo-600">ManageMe</h1>
            <button onClick={handleLogout} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold text-sm">Wyloguj</button>
          </div>
          <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-xl text-center border-l-8 border-amber-500">
            <span className="text-6xl mb-6 block">⏳</span>
            <h1 className="text-2xl font-black mb-4">Oczekiwanie na zatwierdzenie</h1>
            <p className="text-slate-500">Twoje konto zostało zarejestrowane jako <span className="font-bold text-amber-600">gość</span>. Musisz poczekać, aż administrator przypisze Ci odpowiednią rolę (developer, devops lub admin), aby uzyskać dostęp do aplikacji.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-4 md:p-8 ${darkMode ? 'dark' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{loggedUser.imie} {loggedUser.nazwisko}</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] uppercase font-black">{loggedUser.rola}</span>
              <button onClick={handleLogout} className="ml-2 text-slate-400 hover:text-red-500 transition-colors" title="Wyloguj">🚪</button>
            </div>
            
            <nav className="flex gap-2">
              <button 
                onClick={() => setView('board')}
                className={`p-2 rounded-lg border transition-all ${view === 'board' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                title="Tablica"
              >
                📊
              </button>
              <button 
                onClick={() => setView('notifications')}
                className={`relative p-2 rounded-lg border transition-all ${view === 'notifications' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                title="Powiadomienia"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </button>
              {loggedUser.rola === 'admin' && (
                <button 
                  onClick={() => setView('admin')}
                  className={`p-2 rounded-lg border transition-all ${view === 'admin' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                  title="Zarządzanie Użytkownikami"
                >
                  👥
                </button>
              )}
            </nav>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-inner"
            title="Przełącz tryb"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {view === 'admin' && loggedUser.rola === 'admin' ? (
          <section className="animate-in fade-in duration-500">
            <h2 className="text-3xl font-black mb-8">Zarządzanie Użytkownikami</h2>
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase text-xs text-slate-500">Użytkownik</th>
                      <th className="px-6 py-4 font-black uppercase text-xs text-slate-500">Email</th>
                      <th className="px-6 py-4 font-black uppercase text-xs text-slate-500">Rola</th>
                      <th className="px-6 py-4 font-black uppercase text-xs text-slate-500 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {allUsers.map(u => (
                      <tr key={u.id} className={u.czyZablokowany ? 'bg-red-50/50 dark:bg-red-900/10 grayscale-[0.5]' : ''}>
                        <td className="px-6 py-4 font-bold">{u.imie} {u.nazwisko}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                        <td className="px-6 py-4">
                          <select 
                            value={u.rola} 
                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value as Rola)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="admin">Admin</option>
                            <option value="developer">Developer</option>
                            <option value="devops">DevOps</option>
                            <option value="gość">Gość</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleToggleBlock(u.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                              u.czyZablokowany ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'
                            }`}
                          >
                            {u.czyZablokowany ? 'ODBLOKUJ' : 'BLOKUJ'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : view === 'notifications' ? (
          <section className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black">Twoje Powiadomienia</h2>
              <button onClick={() => { notificationService.markAllAsRead(loggedUser.id); refreshNotifications(); }} className="text-xs font-black text-indigo-600 hover:underline">OZNACZ WSZYSTKIE JAKO PRZECZYTANE</button>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-slate-500">Brak powiadomień.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n.id)}
                    className={`p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-l-4 transition-all cursor-pointer hover:shadow-md ${
                      !n.czyPrzeczytane ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          n.priorytet === 'high' ? 'bg-red-500' : 
                          n.priorytet === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}></span>
                        <h3 className={`font-bold ${!n.czyPrzeczytane ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>{n.tytul}</h3>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{new Date(n.data).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{n.tresc}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <header className="mb-12 text-center">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">ManageMe</h1>
              <p className="text-slate-500 dark:text-slate-400">Twoje centrum zarządzania projektami</p>
            </header>

            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 mb-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                {editingProjectId ? '✏️ Edytuj projekt' : '🚀 Dodaj nowy projekt'}
              </h2>
              <form onSubmit={handleProjectSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nazwa</label>
                  <input 
                    type="text" 
                    value={nazwa} 
                    onChange={(e) => setNazwa(e.target.value)} 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required 
                  />
                </div>
                <div className="space-y-1 md:col-span-2 flex gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Opis</label>
                    <input 
                      type="text" 
                      value={opis} 
                      onChange={(e) => setOpis(e.target.value)} 
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
                      {editingProjectId ? 'Zapisz' : 'Dodaj'}
                    </button>
                    {editingProjectId && (
                      <button type="button" className="px-3 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg" onClick={() => setEditingProjectId(null)}>✕</button>
                    )}
                  </div>
                </div>
              </form>
            </section>

            <section className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 mb-8">
              <label className="text-sm font-bold whitespace-nowrap">Wybrany projekt:</label>
              <select 
                value={activeProjectId || ''} 
                onChange={handleActiveProjectChange}
                className="w-full md:w-auto flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Wybierz projekt z listy --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.nazwa}</option>)}
              </select>
            </section>

            {activeProjectId ? (
              <main className="space-y-12 animate-in fade-in duration-500">
                <section className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                  <h3 className="text-lg font-bold mb-4">{editingStoryId ? '📝 Edycja historyjki' : '✨ Nowa historyjka'}</h3>
                  <form onSubmit={handleStorySubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input placeholder="Nazwa" value={storyNazwa} onChange={(e) => setStoryNazwa(e.target.value)} required className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={storyPriorytet} onChange={(e) => setStoryPriorytet(e.target.value as 'niski' | 'średni' | 'wysoki')} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="niski">Niski priorytet</option><option value="średni">Średni priorytet</option><option value="wysoki">Wysoki priorytet</option>
                    </select>
                    <input placeholder="Opis" value={storyOpis} onChange={(e) => setStoryOpis(e.target.value)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-1" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all">{editingStoryId ? 'Zapisz' : 'Dodaj'}</button>
                      {editingStoryId && <button type="button" className="px-4 bg-slate-200 dark:bg-slate-700 rounded-lg" onClick={resetStoryForm}>Anuluj</button>}
                    </div>
                  </form>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Column title="To Do" items={todoStories} onSelect={handleStorySelect} selectedId={selectedStoryId} onEdit={handleStoryEdit} onDelete={handleStoryDelete} color="bg-slate-100 dark:bg-slate-800/50" />
                  <Column title="In Progress" items={doingStories} onSelect={handleStorySelect} selectedId={selectedStoryId} onEdit={handleStoryEdit} onDelete={handleStoryDelete} color="bg-blue-50 dark:bg-blue-900/10" />
                  <Column title="Done" items={doneStories} onSelect={handleStorySelect} selectedId={selectedStoryId} onEdit={handleStoryEdit} onDelete={handleStoryDelete} color="bg-emerald-50 dark:bg-emerald-900/10" />
                </div>

                {selectedStoryId && selectedStory && (
                  <section className="mt-16 pt-16 border-t-2 border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-3xl font-black">Zadania: <span className="text-indigo-600 dark:text-indigo-400">{selectedStory.nazwa}</span></h2>
                    </div>
                    
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-2xl mb-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">➕ Nowe zadanie operacyjne</h3>
                      <form onSubmit={handleTaskSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input placeholder="Nazwa zadania" value={taskNazwa} onChange={(e) => setTaskNazwa(e.target.value)} required className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                        <select value={taskPriorytet} onChange={(e) => setTaskPriorytet(e.target.value as 'niski' | 'średni' | 'wysoki')} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="niski">Niski priorytet</option><option value="średni">Średni priorytet</option><option value="wysoki">Wysoki priorytet</option>
                        </select>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-400 uppercase">Godz:</span>
                          <input type="number" min="1" value={taskCzas} onChange={(e) => setTaskCzas(parseInt(e.target.value))} className="w-full bg-transparent outline-none font-bold" />
                        </div>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg">Utwórz zadanie</button>
                      </form>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <Column title="Zadania: Do zrobienia" items={todoTasks} onSelect={setSelectedTaskId} selectedId={selectedTaskId} onDelete={handleTaskDelete} isTask color="bg-slate-100 dark:bg-slate-800/50" />
                      <Column title="Zadania: W trakcie" items={doingTasks} onSelect={setSelectedTaskId} selectedId={selectedTaskId} onDelete={handleTaskDelete} isTask color="bg-amber-50 dark:bg-amber-900/10" />
                      <Column title="Zadania: Zakończone" items={doneTasks} onSelect={setSelectedTaskId} selectedId={selectedTaskId} onDelete={handleTaskDelete} isTask color="bg-emerald-50 dark:bg-emerald-900/10" />
                    </div>
                  </section>
                )}
              </main>
            ) : (
              <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold mb-6">Wszystkie Projekty</h2>
                {projects.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500">Brak aktywnych projektów. Stwórz swój pierwszy projekt powyżej!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((p) => (
                      <div key={p.id} className="group relative bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all hover:shadow-xl">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.nazwa}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-3 mb-6">{p.opis}</p>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="flex-1 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md text-sm font-bold" onClick={() => handleProjectEdit(p)}>Edytuj</button>
                          <button className="flex-1 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md text-sm font-bold" onClick={() => handleProjectDelete(p.id)}>Usuń</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Modals & Toasts */}
      {selectedTaskId && selectedTask && (
        <TaskDetails 
          task={selectedTask} 
          storyName={selectedStory?.nazwa || ''} 
          onClose={() => setSelectedTaskId(null)} 
          onAssign={handleTaskAssignUser}
          onComplete={handleTaskComplete}
        />
      )}

      {selectedNotificationId && selectedNotification && (
        <NotificationDetails 
          notification={selectedNotification} 
          onClose={() => setSelectedNotificationId(null)} 
        />
      )}

      <div className="fixed bottom-4 right-4 z-[100] space-y-4 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className="w-80 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-l-4 border-indigo-500 animate-in slide-in-from-right-full duration-300 pointer-events-auto"
          >
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-indigo-600 dark:text-indigo-400">{t.tytul}</h4>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-slate-400">&times;</button>
            </div>
            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{t.tresc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ColumnProps {
  title: string;
  items: (Historyjka | Zadanie)[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  onEdit?: (item: Historyjka, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  isTask?: boolean;
  color?: string;
}

function Column({ title, items, onSelect, selectedId, onEdit, onDelete, isTask, color }: ColumnProps) {
  return (
    <div className={`p-4 rounded-2xl ${color} min-h-[400px] border border-slate-200 dark:border-slate-700/50 shadow-inner`}>
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 text-center">{title} <span className="ml-2 px-2 py-0.5 bg-white dark:bg-slate-700 rounded-full text-[10px]">{items.length}</span></h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`group relative p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border-2 transition-all cursor-pointer ${selectedId === item.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`} 
            onClick={() => onSelect(item.id)}
          >
            <h4 className="font-bold text-sm mb-1">{item.nazwa}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">{item.opis}</p>
            <div className="flex items-center justify-between mt-auto">
              <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                item.priorytet === 'wysoki' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                item.priorytet === 'średni' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 
                'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              }`}>
                {item.priorytet}
              </span>
              {isTask && 'wlascicielId' in item && item.wlascicielId && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  {userService.getAll().find(u => u.id === (item as Zadanie).wlascicielId)?.imie}
                </div>
              )}
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isTask && onEdit && <button className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors" onClick={(e) => onEdit(item as Historyjka, e)}>✏️</button>}
              <button className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors" onClick={(e) => onDelete(item.id, e)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TaskDetailsProps {
  task: Zadanie;
  storyName: string;
  onClose: () => void;
  onAssign: (taskId: string, userId: string) => void;
  onComplete: (taskId: string) => void;
}

function TaskDetails({ task, storyName, onClose, onAssign, onComplete }: TaskDetailsProps) {
  const allUsers = userService.getAll();
  const assignableUsers = allUsers.filter(u => (u.rola === 'developer' || u.rola === 'devops') && !u.czyZablokowany);
  const assignedUser = allUsers.find(u => u.id === task.wlascicielId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-2xl" onClick={onClose}>&times;</button>
        
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">🛠️</span>
            <div>
              <h2 className="text-2xl font-black leading-tight">{task.nazwa}</h2>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">{storyName}</p>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Status</p>
                <p className="font-bold text-sm capitalize">{task.stan}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Priorytet</p>
                <p className={`font-bold text-sm capitalize ${task.priorytet === 'wysoki' ? 'text-red-500' : task.priorytet === 'średni' ? 'text-amber-500' : 'text-emerald-500'}`}>{task.priorytet}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Opis zadania</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{task.opis || 'Brak dodatkowego opisu dla tego zadania.'}</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xl">👤</div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Wykonawca</p>
                      <p className="font-bold text-sm">{assignedUser ? `${assignedUser.imie} ${assignedUser.nazwisko}` : 'Nieprzypisane'}</p>
                    </div>
                  </div>
                  <select 
                    value={task.wlascicielId || ''} 
                    onChange={(e) => onAssign(task.id, e.target.value)}
                    disabled={task.stan === 'done'}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Przypisz...</option>
                    {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.imie} ({u.rola})</option>)}
                  </select>
               </div>
            </div>

            <div className="text-[10px] text-slate-400 space-y-1">
              <p>Dodano: {new Date(task.dataDodania).toLocaleString()}</p>
              {task.dataStartu && <p>Rozpoczęto: {new Date(task.dataStartu).toLocaleString()}</p>}
              {task.dataZakonczenia && <p>Zakończono: {new Date(task.dataZakonczenia).toLocaleString()}</p>}
            </div>
          </div>

          {task.stan !== 'done' && (
            <button 
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]" 
              onClick={() => onComplete(task.id)}
            >
              Ukończ zadanie ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationDetailsProps {
  notification: Powiadomienie;
  onClose: () => void;
}

function NotificationDetails({ notification, onClose }: NotificationDetailsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className={`h-2 w-full ${
          notification.priorytet === 'high' ? 'bg-red-500' : 
          notification.priorytet === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
        }`}></div>
        <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-2xl" onClick={onClose}>&times;</button>
        
        <div className="p-8 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-2xl font-black mb-2">{notification.tytul}</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">{new Date(notification.data).toLocaleString()}</p>
          
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-left mb-8">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{notification.tresc}</p>
          </div>

          <button 
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all" 
            onClick={onClose}
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
