import type { Projekt, Uzytkownik, Historyjka, Zadanie, Powiadomienie } from './types';

const PROJECTS_KEY = 'manageme_projects';
const STORIES_KEY = 'manageme_stories';
const TASKS_KEY = 'manageme_tasks';
const NOTIFICATIONS_KEY = 'manageme_notifications';
const ACTIVE_PROJECT_KEY = 'manageme_active_project';

export const mockUsers: Uzytkownik[] = [
  { id: 'user-1', imie: 'Jan', nazwisko: 'Kowalski', rola: 'admin' },
  { id: 'user-2', imie: 'Adam', nazwisko: 'Nowak', rola: 'developer' },
  { id: 'user-3', imie: 'Marta', nazwisko: 'Wisła', rola: 'devops' },
];

export const mockUser = mockUsers[0]; // Admin by default

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

// Simple Event Bus for UI updates
type NotificationListener = (notification: Powiadomienie) => void;
class NotificationEmitter {
  private listeners: NotificationListener[] = [];
  subscribe(callback: NotificationListener) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }
  emit(notification: Powiadomienie) {
    this.listeners.forEach(l => l(notification));
  }
}
export const notificationEmitter = new NotificationEmitter();

export class NotificationService {
  private getNotificationsFromStorage(): Powiadomienie[] {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveNotificationsToStorage(notifications: Powiadomienie[]): void {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }

  getAllForUser(userId: string): Powiadomienie[] {
    return this.getNotificationsFromStorage()
      .filter((n) => n.odbiorcaId === userId)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  getUnreadCount(userId: string): number {
    return this.getNotificationsFromStorage().filter((n) => n.odbiorcaId === userId && !n.czyPrzeczytane).length;
  }

  create(notification: Omit<Powiadomienie, 'id' | 'data' | 'czyPrzeczytane'>): Powiadomienie {
    const notifications = this.getNotificationsFromStorage();
    const newNotification: Powiadomienie = {
      ...notification,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      data: new Date().toISOString(),
      czyPrzeczytane: false,
    };
    notifications.push(newNotification);
    this.saveNotificationsToStorage(notifications);
    notificationEmitter.emit(newNotification);
    return newNotification;
  }

  markAsRead(id: string): void {
    const notifications = this.getNotificationsFromStorage();
    const index = notifications.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications[index].czyPrzeczytane = true;
      this.saveNotificationsToStorage(notifications);
    }
  }

  markAllAsRead(userId: string): void {
    const notifications = this.getNotificationsFromStorage();
    notifications.forEach(n => {
      if (n.odbiorcaId === userId) n.czyPrzeczytane = true;
    });
    this.saveNotificationsToStorage(notifications);
  }
}

export const notificationService = new NotificationService();

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

    // Notification Logic: New project for all admins
    mockUsers.filter(u => u.rola === 'admin').forEach(admin => {
      notificationService.create({
        tytul: 'Nowy Projekt',
        tresc: `Utworzono nowy projekt: ${newProject.nazwa}`,
        priorytet: 'high',
        odbiorcaId: admin.id
      });
    });

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

  getById(id: string): Historyjka | undefined {
    return this.getStoriesFromStorage().find((s) => s.id === id);
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

  updateState(id: string, newState: 'todo' | 'doing' | 'done'): void {
    const story = this.getById(id);
    if (story) {
      this.update({ ...story, stan: newState });
    }
  }
}

export const projectService = new ProjectService();
export const storyService = new StoryService();

export class TaskService {
  private getTasksFromStorage(): Zadanie[] {
    const data = localStorage.getItem(TASKS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveTasksToStorage(tasks: Zadanie[]): void {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  getAllForStory(storyId: string): Zadanie[] {
    return this.getTasksFromStorage().filter((t) => t.historyjkaId === storyId);
  }

  getById(id: string): Zadanie | undefined {
    return this.getTasksFromStorage().find((t) => t.id === id);
  }

  create(task: Omit<Zadanie, 'id' | 'dataDodania'>): Zadanie {
    const tasks = this.getTasksFromStorage();
    const newTask: Zadanie = {
      ...task,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      dataDodania: new Date().toISOString(),
    };
    tasks.push(newTask);
    this.saveTasksToStorage(tasks);

    // Notification Logic: New task for story owner
    const story = storyService.getById(newTask.historyjkaId);
    if (story) {
      notificationService.create({
        tytul: 'Nowe zadanie w historyjce',
        tresc: `Dodano zadanie "${newTask.nazwa}" do Twojej historyjki "${story.nazwa}"`,
        priorytet: 'medium',
        odbiorcaId: story.wlascicielId
      });
    }

    return newTask;
  }

  update(updatedTask: Zadanie): Zadanie {
    const tasks = this.getTasksFromStorage();
    const index = tasks.findIndex((t) => t.id === updatedTask.id);
    if (index === -1) return updatedTask;

    const oldTask = tasks[index];
    const finalTask = { ...updatedTask };

    // Notification Logic: Task assignment
    if (finalTask.wlascicielId && finalTask.wlascicielId !== oldTask.wlascicielId) {
      notificationService.create({
        tytul: 'Przypisano zadanie',
        tresc: `Zostałeś przypisany do zadania: ${finalTask.nazwa}`,
        priorytet: 'high',
        odbiorcaId: finalTask.wlascicielId
      });
    }

    // Business Logic: Assigning user (devops/developer) to a 'todo' task
    if (finalTask.wlascicielId && finalTask.stan === 'todo' && oldTask.stan === 'todo') {
      const user = mockUsers.find(u => u.id === finalTask.wlascicielId);
      if (user && (user.rola === 'developer' || user.rola === 'devops')) {
        finalTask.stan = 'doing';
        finalTask.dataStartu = new Date().toISOString();
        
        // Propagate to Story
        const story = storyService.getById(finalTask.historyjkaId);
        if (story && story.stan === 'todo') {
          storyService.updateState(story.id, 'doing');
        }
      }
    }

    // Business Logic & Notifications: State changes
    if (finalTask.stan !== oldTask.stan) {
      const story = storyService.getById(finalTask.historyjkaId);
      if (story) {
        notificationService.create({
          tytul: 'Zmiana statusu zadania',
          tresc: `Zadanie "${finalTask.nazwa}" zmieniło stan na "${finalTask.stan}"`,
          priorytet: finalTask.stan === 'done' ? 'medium' : 'low',
          odbiorcaId: story.wlascicielId
        });
      }

      if (finalTask.stan === 'done') {
        finalTask.dataZakonczenia = new Date().toISOString();
        
        // Propagate to Story if all tasks are done
        setTimeout(() => {
          const allStoryTasks = this.getAllForStory(finalTask.historyjkaId);
          const otherTasks = allStoryTasks.filter(t => t.id !== finalTask.id);
          const allDone = otherTasks.every(t => t.stan === 'done');
          
          if (allDone) {
            storyService.updateState(finalTask.historyjkaId, 'done');
          }
        }, 0);
      }
    }

    tasks[index] = finalTask;
    this.saveTasksToStorage(tasks);
    return finalTask;
  }

  delete(id: string): void {
    const tasks = this.getTasksFromStorage();
    const taskToDelete = tasks.find(t => t.id === id);
    const filteredTasks = tasks.filter((t) => t.id !== id);
    this.saveTasksToStorage(filteredTasks);

    // Notification Logic: Task deletion
    if (taskToDelete) {
      const story = storyService.getById(taskToDelete.historyjkaId);
      if (story) {
        notificationService.create({
          tytul: 'Usunięto zadanie',
          tresc: `Zadanie "${taskToDelete.nazwa}" zostało usunięte z historyjki "${story.nazwa}"`,
          priorytet: 'medium',
          odbiorcaId: story.wlascicielId
        });
      }
    }
  }
}

export const taskService = new TaskService();
