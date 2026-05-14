import { dbInstance } from './database';
import type { MyStorage } from './config';
import type { Projekt, Uzytkownik, Historyjka, Zadanie, Powiadomienie, Rola } from './types';

const PROJECTS_KEY = 'manageme_projects';
const STORIES_KEY = 'manageme_stories';
const TASKS_KEY = 'manageme_tasks';
const NOTIFICATIONS_KEY = 'manageme_notifications';
const USERS_KEY = 'manageme_users';
const LOGGED_USER_KEY = 'manageme_logged_user';
const ACTIVE_PROJECT_KEY = 'manageme_active_project';

const SUPER_ADMIN_EMAIL = 'speedfirexp@gmail.com';

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

export class UserService {
  private storage: MyStorage;
  private collection: string;

  constructor(storage: MyStorage, collection: string) {
    this.storage = storage;
    this.collection = collection;
  }

  async getAll(): Promise<Uzytkownik[]> {
    return this.storage.list<Uzytkownik>(this.collection);
  }

  async getByEmail(email: string): Promise<Uzytkownik | undefined> {
    const users = await this.getAll();
    return users.find(u => u.email === email);
  }

  async create(user: Uzytkownik): Promise<void> {
    await this.storage.create(this.collection, user);

    // Notify admins about new user
    const users = await this.getAll();
    const admins = users.filter(u => u.rola === 'admin');
    for (const admin of admins) {
      await notificationService.create({
        tytul: 'Nowe konto w systemie',
        tresc: `Zarejestrowano nowego użytkownika: ${user.email}`,
        priorytet: 'high',
        odbiorcaId: admin.id
      });
    }
  }

  async updateRole(userId: string, role: Rola): Promise<void> {
    await this.storage.update(this.collection, userId, { rola: role });
  }

  async toggleBlock(userId: string): Promise<void> {
    const user = await this.storage.get<Uzytkownik>(this.collection, userId);
    if (user) {
      await this.storage.update(this.collection, userId, { czyZablokowany: !user.czyZablokowany });
    }
  }
}

export class AuthService {
  async getLoggedUser(): Promise<Uzytkownik | null> {
    const data = sessionStorage.getItem(LOGGED_USER_KEY);
    if (!data) return null;
    const user = JSON.parse(data);
    const dbUser = await userService.getByEmail(user.email);
    return dbUser || null;
  }

  async login(googleProfile: { email: string; given_name: string; family_name: string }): Promise<Uzytkownik> {
    const email = googleProfile.email;
    let user = await userService.getByEmail(email);

    if (!user) {
      const newUser: Uzytkownik = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        imie: googleProfile.given_name,
        nazwisko: googleProfile.family_name,
        email: email,
        rola: email === SUPER_ADMIN_EMAIL ? 'admin' : 'gość',
        czyZablokowany: false
      };
      await userService.create(newUser);
      user = newUser;
    }

    sessionStorage.setItem(LOGGED_USER_KEY, JSON.stringify(user));
    return user;
  }

  logout(): void {
    sessionStorage.removeItem(LOGGED_USER_KEY);
  }
}

export class NotificationService {
  private storage: MyStorage;
  private collection: string;

  constructor(storage: MyStorage, collection: string) {
    this.storage = storage;
    this.collection = collection;
  }

  async getAllForUser(userId: string): Promise<Powiadomienie[]> {
    const all = await this.storage.list<Powiadomienie>(this.collection);
    return all
      .filter((n) => n.odbiorcaId === userId)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  async getUnreadCount(userId: string): Promise<number> {
    const all = await this.getAllForUser(userId);
    return all.filter(n => !n.czyPrzeczytane).length;
  }

  async create(notification: Omit<Powiadomienie, 'id' | 'data' | 'czyPrzeczytane'>): Promise<Powiadomienie> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newNotification: Powiadomienie = {
      ...notification,
      id,
      data: new Date().toISOString(),
      czyPrzeczytane: false,
    };

    await this.storage.create(this.collection, newNotification);
    notificationEmitter.emit(newNotification);
    return newNotification;
  }

  async markAsRead(id: string): Promise<void> {
    await this.storage.update(this.collection, id, { czyPrzeczytane: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const notifications = await this.getAllForUser(userId);
    for (const n of notifications) {
      if (!n.czyPrzeczytane) {
        await this.markAsRead(n.id);
      }
    }
  }
}

export class ProjectService {
  private storage: MyStorage;
  private collection: string;

  constructor(storage: MyStorage, collection: string) {
    this.storage = storage;
    this.collection = collection;
  }

  async getAll(): Promise<Projekt[]> {
    return this.storage.list<Projekt>(this.collection);
  }

  async getById(id: string): Promise<Projekt | undefined> {
    return this.storage.get<Projekt>(this.collection, id);
  }

  async create(projekt: Omit<Projekt, 'id'>): Promise<Projekt> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newProject: Projekt = { ...projekt, id };

    await this.storage.create(this.collection, newProject);

    // Notification Logic: New project for all admins
    const users = await userService.getAll();
    const admins = users.filter(u => u.rola === 'admin');
    for (const admin of admins) {
      await notificationService.create({
        tytul: 'Nowy Projekt',
        tresc: `Utworzono nowy projekt: ${newProject.nazwa}`,
        priorytet: 'high',
        odbiorcaId: admin.id
      });
    }

    return newProject;
  }

  async update(updatedProject: Projekt): Promise<Projekt> {
    await this.storage.update(this.collection, updatedProject.id, updatedProject);
    return updatedProject;
  }

  async delete(id: string): Promise<void> {
    await this.storage.delete(this.collection, id);
    if (getActiveProjectId() === id) {
      setActiveProjectId(null);
    }
  }
}

export class StoryService {
  private storage: MyStorage;
  private collection: string;

  constructor(storage: MyStorage, collection: string) {
    this.storage = storage;
    this.collection = collection;
  }

  async getAll(): Promise<Historyjka[]> {
    return this.storage.list<Historyjka>(this.collection);
  }

  async getAllForProject(projectId: string): Promise<Historyjka[]> {
    const all = await this.getAll();
    return all.filter((s) => s.projektId === projectId);
  }

  async getById(id: string): Promise<Historyjka | undefined> {
    return this.storage.get<Historyjka>(this.collection, id);
  }

  async create(story: Omit<Historyjka, 'id' | 'dataUtworzenia'>): Promise<Historyjka> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newStory: Historyjka = {
      ...story,
      id,
      dataUtworzenia: new Date().toISOString(),
    };

    await this.storage.create(this.collection, newStory);
    return newStory;
  }

  async update(updatedStory: Historyjka): Promise<Historyjka> {
    await this.storage.update(this.collection, updatedStory.id, updatedStory);
    return updatedStory;
  }

  async delete(id: string): Promise<void> {
    await this.storage.delete(this.collection, id);
  }

  async updateState(id: string, newState: 'todo' | 'doing' | 'done'): Promise<void> {
    const story = await this.getById(id);
    if (story) {
      await this.update({ ...story, stan: newState });
    }
  }
}

export class TaskService {
  private storage: MyStorage;
  private collection: string;

  constructor(storage: MyStorage, collection: string) {
    this.storage = storage;
    this.collection = collection;
  }

  async getAll(): Promise<Zadanie[]> {
    return this.storage.list<Zadanie>(this.collection);
  }

  async getAllForStory(storyId: string): Promise<Zadanie[]> {
    const all = await this.getAll();
    return all.filter((t) => t.historyjkaId === storyId);
  }

  async getById(id: string): Promise<Zadanie | undefined> {
    return this.storage.get<Zadanie>(this.collection, id);
  }

  async create(task: Omit<Zadanie, 'id' | 'dataDodania'>): Promise<Zadanie> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newTask: Zadanie = {
      ...task,
      id,
      dataDodania: new Date().toISOString(),
    };

    await this.storage.create(this.collection, newTask);

    // Notification Logic: New task for story owner
    const story = await storyService.getById(newTask.historyjkaId);
    if (story) {
      await notificationService.create({
        tytul: 'Nowe zadanie w historyjce',
        tresc: `Dodano zadanie "${newTask.nazwa}" do Twojej historyjki "${story.nazwa}"`,
        priorytet: 'medium',
        odbiorcaId: story.wlascicielId
      });
    }

    return newTask;
  }

  async update(updatedTask: Zadanie): Promise<Zadanie> {
    const oldTask = await this.getById(updatedTask.id);
    if (!oldTask) return updatedTask;

    const finalTask = { ...updatedTask };

    // Notification Logic: Task assignment
    if (finalTask.wlascicielId && finalTask.wlascicielId !== oldTask.wlascicielId) {
      await notificationService.create({
        tytul: 'Przypisano zadanie',
        tresc: `Zostałeś przypisany do zadania: ${finalTask.nazwa}`,
        priorytet: 'high',
        odbiorcaId: finalTask.wlascicielId
      });
    }

    // Business Logic: Assigning user (devops/developer) to a 'todo' task
    if (finalTask.wlascicielId && finalTask.stan === 'todo' && oldTask.stan === 'todo') {
      const users = await userService.getAll();
      const user = users.find(u => u.id === finalTask.wlascicielId);
      if (user && (user.rola === 'developer' || user.rola === 'devops')) {
        finalTask.stan = 'doing';
        finalTask.dataStartu = new Date().toISOString();
        
        // Propagate to Story
        const story = await storyService.getById(finalTask.historyjkaId);
        if (story && story.stan === 'todo') {
          await storyService.updateState(story.id, 'doing');
        }
      }
    }

    // Business Logic & Notifications: State changes
    if (finalTask.stan !== oldTask.stan) {
      const story = await storyService.getById(finalTask.historyjkaId);
      if (story) {
        await notificationService.create({
          tytul: 'Zmiana statusu zadania',
          tresc: `Zadanie "${finalTask.nazwa}" zmieniło stan na "${finalTask.stan}"`,
          priorytet: finalTask.stan === 'done' ? 'medium' : 'low',
          odbiorcaId: story.wlascicielId
        });
      }

      if (finalTask.stan === 'done') {
        finalTask.dataZakonczenia = new Date().toISOString();
        
        // Propagate to Story if all tasks are done
        const allStoryTasks = await this.getAllForStory(finalTask.historyjkaId);
        const otherTasks = allStoryTasks.filter(t => t.id !== finalTask.id);
        const allDone = otherTasks.every(t => t.stan === 'done');
        
        if (allDone) {
          await storyService.updateState(finalTask.historyjkaId, 'done');
        }
      }
    }

    await this.storage.update(this.collection, finalTask.id, finalTask);
    return finalTask;
  }

  async delete(id: string): Promise<void> {
    const taskToDelete = await this.getById(id);
    await this.storage.delete(this.collection, id);

    // Notification Logic: Task deletion
    if (taskToDelete) {
      const story = await storyService.getById(taskToDelete.historyjkaId);
      if (story) {
        await notificationService.create({
          tytul: 'Usunięto zadanie',
          tresc: `Zadanie "${taskToDelete.nazwa}" zostało usunięte z historyjki "${story.nazwa}"`,
          priorytet: 'medium',
          odbiorcaId: story.wlascicielId
        });
      }
    }
  }
}

export const userService = new UserService(dbInstance, USERS_KEY);
export const authService = new AuthService();
export const notificationService = new NotificationService(dbInstance, NOTIFICATIONS_KEY);
export const projectService = new ProjectService(dbInstance, PROJECTS_KEY);
export const storyService = new StoryService(dbInstance, STORIES_KEY);
export const taskService = new TaskService(dbInstance, TASKS_KEY);
