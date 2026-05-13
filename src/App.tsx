import { useState, useEffect } from 'react';
import './App.css';
import type { Projekt } from './types';
import { projectService } from './api';

function App() {
  const [projects, setProjects] = useState<Projekt[]>([]);
  const [nazwa, setNazwa] = useState('');
  const [opis, setOpis] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    refreshList();
  }, []);

  const refreshList = () => {
    setProjects(projectService.getAll());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazwa.trim()) return;

    if (editingId) {
      projectService.update({ id: editingId, nazwa, opis });
      setEditingId(null);
    } else {
      projectService.create({ nazwa, opis });
    }

    setNazwa('');
    setOpis('');
    refreshList();
  };

  const handleEdit = (p: Projekt) => {
    setNazwa(p.nazwa);
    setOpis(p.opis);
    setEditingId(p.id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten projekt?')) {
      projectService.delete(id);
      refreshList();
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setNazwa('');
    setOpis('');
  };

  return (
    <div className="app-container">
      <h1>ManageMe</h1>
      
      <section className="project-form-container">
        <h2>{editingId ? 'Edytuj projekt' : 'Dodaj nowy projekt'}</h2>
        <form onSubmit={handleSubmit}>
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
              {editingId ? 'Zapisz zmiany' : 'Dodaj projekt'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Anuluj
              </button>
            )}
          </div>
        </form>
      </section>

      <hr />

      <section className="project-list-container">
        <h2>Lista projektów</h2>
        {projects.length === 0 ? (
          <p>Brak projektów.</p>
        ) : (
          <div className="projects-grid">
            {projects.map((p) => (
              <div key={p.id} className="project-card">
                <div className="card-content">
                  <h3>{p.nazwa}</h3>
                  <p>{p.opis}</p>
                </div>
                <div className="card-actions">
                  <button className="btn btn-edit" onClick={() => handleEdit(p)}>Edytuj</button>
                  <button className="btn btn-delete" onClick={() => handleDelete(p.id)}>Usuń</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
