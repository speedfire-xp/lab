import type { Projekt } from './types';

const STORAGE_KEY = 'manageme_projects';

export class ProjectService {
  private getProjectsFromStorage(): Projekt[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveProjectsToStorage(projects: Projekt[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  getAll(): Projekt[] {
    return this.getProjectsFromStorage();
  }

  getById(id: string): Projekt | undefined {
    return this.getProjectsFromStorage().find((p) => p.id === id);
  }

  create(projekt: Omit<Projekt, 'id'>): Projekt {
    const projects = this.getProjectsFromStorage();
    const newProject: Projekt = {
      ...projekt,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
    };
    projects.push(newProject);
    this.saveProjectsToStorage(projects);
    return newProject;
  }

  update(updatedProject: Projekt): Projekt {
    const projects = this.getProjectsFromStorage();
    const index = projects.findIndex((p) => p.id === updatedProject.id);
    if (index !== -1) {
      projects[index] = updatedProject;
      this.saveProjectsToStorage(projects);
    }
    return updatedProject;
  }

  delete(id: string): void {
    const projects = this.getProjectsFromStorage();
    const filteredProjects = projects.filter((p) => p.id !== id);
    this.saveProjectsToStorage(filteredProjects);
  }
}

export const projectService = new ProjectService();
