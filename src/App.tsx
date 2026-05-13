import { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import './App.css';
import type { Projekt, Historyjka } from './types';
import { projectService, storyService, mockUser, getActiveProjectId, setActiveProjectId } from './api';

function App() {
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
  const [storyNazwa, setStoryNazwa] = useState('');
  const [storyOpis, setStoryOpis] = useState('');
  const [storyPriorytet, setStoryPriorytet] = useState<'niski' | 'średni' | 'wysoki'>('niski');
  const [storyStan, setStoryStan] = useState<'todo' | 'doing' | 'done'>('todo');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);

  const refreshProjects = () => {
    setProjects(projectService.getAll());
  };

  const refreshStories = (projectId: string) => {
    setStories(storyService.getAllForProject(projectId));
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
  };

  const handleProjectEdit = (p: Projekt) => {
    setNazwa(p.nazwa);
    setOpis(p.opis);
    setEditingProjectId(p.id);
  };

  const handleProjectDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten projekt? Wszystkie powiązane historyjki zostaną usunięte (w pamięci).')) {
      projectService.delete(id);
      if (activeProjectId === id) {
        setActiveProjectIdState(null);
        setActiveProjectId(null);
        setStories([]);
      }
      refreshProjects();
    }
  };

  const handleProjectCancel = () => {
    setEditingProjectId(null);
    setNazwa('');
    setOpis('');
  };

  const handleActiveProjectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value || null;
    setActiveProjectIdState(id);
    setActiveProjectId(id);
    if (id) {
      setStories(storyService.getAllForProject(id));
    } else {
      setStories([]);
    }
  };

  // Story handlers
  const handleStorySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!storyNazwa.trim() || !activeProjectId) return;

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
        wlascicielId: mockUser.id,
      });
    }

    resetStoryForm();
    refreshStories(activeProjectId);
  };

  const handleStoryEdit = (s: Historyjka) => {
    setStoryNazwa(s.nazwa);
    setStoryOpis(s.opis);
    setStoryPriorytet(s.priorytet);
    setStoryStan(s.stan);
    setEditingStoryId(s.id);
  };

  const handleStoryDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tę historyjkę?')) {
      storyService.delete(id);
      if (activeProjectId) refreshStories(activeProjectId);
    }
  };

  const resetStoryForm = () => {
    setStoryNazwa('');
    setStoryOpis('');
    setStoryPriorytet('niski');
    setStoryStan('todo');
    setEditingStoryId(null);
  };

  // Memoized stories by state
  const todoStories = useMemo(() => stories.filter(s => s.stan === 'todo'), [stories]);
  const doingStories = useMemo(() => stories.filter(s => s.stan === 'doing'), [stories]);
  const doneStories = useMemo(() => stories.filter(s => s.stan === 'done'), [stories]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

  return (
    <div className="app-container">
      <div className="user-info">
        Zalogowany: {mockUser.imie} {mockUser.nazwisko}
      </div>

      <header className="header">
        <h1>ManageMe</h1>
      </header>

      <section className="project-form-container">
        <h2>{editingProjectId ? 'Edytuj projekt' : 'Dodaj nowy projekt'}</h2>
        <form onSubmit={handleProjectSubmit}>
          <div className="form-group">
            <label>Nazwa:</label>
            <input 
              type="text" 
              value={nazwa} 
              onChange={(e) => setNazwa(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Opis:</label>
            <textarea 
              value={opis} 
              onChange={(e) => setOpis(e.target.value)} 
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingProjectId ? 'Zapisz zmiany' : 'Dodaj projekt'}
            </button>
            {editingProjectId && (
              <button type="button" className="btn btn-secondary" onClick={handleProjectCancel}>
                Anuluj
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="active-project-selector">
        <label>Aktywny projekt:</label>
        <select value={activeProjectId || ''} onChange={handleActiveProjectChange}>
          <option value="">-- Wybierz projekt --</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.nazwa}</option>
          ))}
        </select>
      </section>

      {activeProjectId && activeProject ? (
        <main>
          <section className="story-form-container">
            <h2>{editingStoryId ? 'Edytuj historyjkę' : 'Dodaj nową historyjkę'}</h2>
            <form onSubmit={handleStorySubmit} className="horizontal-form">
              <div className="form-group">
                <label>Nazwa:</label>
                <input 
                  type="text" 
                  value={storyNazwa} 
                  onChange={(e) => setStoryNazwa(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Priorytet:</label>
                <select 
                  value={storyPriorytet} 
                  onChange={(e) => setStoryPriorytet(e.target.value as 'niski' | 'średni' | 'wysoki')}
                >
                  <option value="niski">Niski</option>
                  <option value="średni">Średni</option>
                  <option value="wysoki">Wysoki</option>
                </select>
              </div>
              <div className="form-group">
                <label>Stan:</label>
                <select 
                  value={storyStan} 
                  onChange={(e) => setStoryStan(e.target.value as 'todo' | 'doing' | 'done')}
                >
                  <option value="todo">Todo</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '2 1 100%' }}>
                <label>Opis:</label>
                <textarea 
                  value={storyOpis} 
                  onChange={(e) => setStoryOpis(e.target.value)} 
                  rows={2}
                />
              </div>
              <div className="form-actions" style={{ width: '100%', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary">
                  {editingStoryId ? 'Zapisz historyjkę' : 'Dodaj historyjkę'}
                </button>
                {editingStoryId && (
                  <button type="button" className="btn btn-secondary" onClick={resetStoryForm}>
                    Anuluj
                  </button>
                )}
              </div>
            </form>
          </section>

          <div className="stories-board">
            <StoryColumn title="Todo" stories={todoStories} onEdit={handleStoryEdit} onDelete={handleStoryDelete} />
            <StoryColumn title="Doing" stories={doingStories} onEdit={handleStoryEdit} onDelete={handleStoryDelete} />
            <StoryColumn title="Done" stories={doneStories} onEdit={handleStoryEdit} onDelete={handleStoryDelete} />
          </div>
        </main>
      ) : (
        <section className="project-list-container">
          <h2>Wszystkie projekty</h2>
          {projects.length === 0 ? (
            <div className="empty-state">
              <p className="empty-message">Brak projektów. Dodaj swój pierwszy projekt powyżej!</p>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map((p) => (
                <div key={p.id} className={`project-card ${activeProjectId === p.id ? 'active' : ''}`}>
                  <div className="card-content">
                    <h3>{p.nazwa}</h3>
                    <p>{p.opis}</p>
                  </div>
                  <div className="card-actions">
                    <button className="btn btn-edit" onClick={() => handleProjectEdit(p)}>Edytuj</button>
                    <button className="btn btn-delete" onClick={() => handleProjectDelete(p.id)}>Usuń</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

interface StoryColumnProps {
  title: string;
  stories: Historyjka[];
  onEdit: (s: Historyjka) => void;
  onDelete: (id: string) => void;
}

function StoryColumn({ title, stories, onEdit, onDelete }: StoryColumnProps) {
  return (
    <div className="story-column">
      <h3>{title} ({stories.length})</h3>
      {stories.map(s => (
        <div key={s.id} className="story-card">
          <h4>{s.nazwa}</h4>
          <p>{s.opis}</p>
          <div className="story-meta">
            <span className={`priority-tag priority-${s.priorytet}`}>{s.priorytet}</span>
            <span>{new Date(s.dataUtworzenia).toLocaleDateString()}</span>
          </div>
          <div className="story-actions">
            <button className="btn btn-edit" onClick={() => onEdit(s)}>Edytuj</button>
            <button className="btn btn-delete" onClick={() => onDelete(s.id)}>Usuń</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
