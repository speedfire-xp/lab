import type { Projekt, Uzytkownik, Historyjka } from './types';

const PROJECTS_KEY = 'manageme_projects';
const STORIES_KEY = 'manageme_stories';
const ACTIVE_PROJECT_KEY = 'manageme_active_project';

export const mockUser: Uzytkownik = {
  id: 'user-1',
  imie: 'Jan',
  nazwisko: 'Kowalski',
};

export const getActiveProjectId = (): string | null => {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
};

export const setActiveProjectId = (id: string | null): void => {
  if (id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
};

export class ProjectService {
  private getProjectsFromStorage(): Projekt[] {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveProjectsToStorage(projects: Projekt[]): void {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
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
    if (getActiveProjectId() === id) {
      setActiveProjectId(null);
    }
  }
}

export class StoryService {
  private getStoriesFromStorage(): Historyjka[] {
    const data = localStorage.getItem(STORIES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveStoriesToStorage(stories: Historyjka[]): void {
    localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
  }

  getAllForProject(projectId: string): Historyjka[] {
    return this.getStoriesFromStorage().filter((s) => s.projektId === projectId);
  }

  create(story: Omit<Historyjka, 'id' | 'dataUtworzenia'>): Historyjka {
    const stories = this.getStoriesFromStorage();
    const newStory: Historyjka = {
      ...story,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      dataUtworzenia: new Date().toISOString(),
    };
    stories.push(newStory);
    this.saveStoriesToStorage(stories);
    return newStory;
  }

  update(updatedStory: Historyjka): Historyjka {
    const stories = this.getStoriesFromStorage();
    const index = stories.findIndex((s) => s.id === updatedStory.id);
    if (index !== -1) {
      stories[index] = updatedStory;
      this.saveStoriesToStorage(stories);
    }
    return updatedStory;
  }

  delete(id: string): void {
    const stories = this.getStoriesFromStorage();
    const filteredStories = stories.filter((s) => s.id !== id);
    this.saveStoriesToStorage(filteredStories);
  }
}

export const projectService = new ProjectService();
export const storyService = new StoryService();
