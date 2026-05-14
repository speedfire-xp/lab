import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { STORAGE_MODE } from './config';
import type { Projekt, Uzytkownik, Historyjka, Zadanie, Powiadomienie, Rola } from './types';

const PROJECTS_KEY = 'manageme_projects';
const STORIES_KEY = 'manageme_stories';
const TASKS_KEY = 'manageme_tasks';
const NOTIFICATIONS_KEY = 'manageme_notifications';
const USERS_KEY = 'manageme_users';
const LOGGED_USER_KEY = 'manageme_logged_user';
const ACTIVE_PROJECT_KEY = 'manageme_active_project';

const SUPER_ADMIN_EMAIL = 'admin@manageme.com';

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
  async getAll(): Promise<Uzytkownik[]> {
    if (STORAGE_MODE === 'firebase') {
      const querySnapshot = await getDocs(collection(db, USERS_KEY));
      return querySnapshot.docs.map(doc => doc.data() as Uzytkownik);
    } else {
      const data = localStorage.getItem(USERS_KEY);
      return data ? JSON.parse(data) : [];
    }
  }

  private async saveAll(users: Uzytkownik[]): Promise<void> {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async getByEmail(email: string): Promise<Uzytkownik | undefined> {
    const users = await this.getAll();
    return users.find(u => u.email === email);
  }

  async create(user: Uzytkownik): Promise<void> {
    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, USERS_KEY, user.id), user);
    } else {
      const users = await this.getAll();
      users.push(user);
      await this.saveAll(users);
    }

    // Notify admins about new user
    const users = await this.getAll();
    users.filter(u => u.rola === 'admin').forEach(async (admin) => {
      await notificationService.create({
        tytul: 'Nowe konto w systemie',
        tresc: `Zarejestrowano nowego użytkownika: ${user.email}`,
        priorytet: 'high',
        odbiorcaId: admin.id
      });
    });
  }

  async updateRole(userId: string, role: Rola): Promise<void> {
    if (STORAGE_MODE === 'firebase') {
      await updateDoc(doc(db, USERS_KEY, userId), { rola: role });
    } else {
      const users = await this.getAll();
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
        users[index].rola = role;
        await this.saveAll(users);
      }
    }
  }

  async toggleBlock(userId: string): Promise<void> {
    if (STORAGE_MODE === 'firebase') {
      const users = await this.getAll();
      const user = users.find(u => u.id === userId);
      if (user) {
        await updateDoc(doc(db, USERS_KEY, userId), { czyZablokowany: !user.czyZablokowany });
      }
    } else {
      const users = await this.getAll();
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
        users[index].czyZablokowany = !users[index].czyZablokowany;
        await this.saveAll(users);
      }
    }
  }
}

export const userService = new UserService();

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

export const authService = new AuthService();

export class NotificationService {
  private async getNotificationsFromStorage(): Promise<Powiadomienie[]> {
    if (STORAGE_MODE === 'firebase') {
      const querySnapshot = await getDocs(collection(db, NOTIFICATIONS_KEY));
      return querySnapshot.docs.map(doc => doc.data() as Powiadomienie);
    } else {
      const data = localStorage.getItem(NOTIFICATIONS_KEY);
      return data ? JSON.parse(data) : [];
    }
  }

  private async saveNotificationsToStorage(notifications: Powiadomienie[]): Promise<void> {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }

  async getAllForUser(userId: string): Promise<Powiadomienie[]> {
    if (STORAGE_MODE === 'firebase') {
      const q = query(collection(db, NOTIFICATIONS_KEY), where("odbiorcaId", "==", userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => doc.data() as Powiadomienie)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    } else {
      const all = await this.getNotificationsFromStorage();
      return all
        .filter((n) => n.odbiorcaId === userId)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }
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

    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, NOTIFICATIONS_KEY, id), newNotification);
    } else {
      const notifications = await this.getNotificationsFromStorage();
      notifications.push(newNotification);
      await this.saveNotificationsToStorage(notifications);
    }

    notificationEmitter.emit(newNotification);
    return newNotification;
  }

  async markAsRead(id: string): Promise<void> {
    if (STORAGE_MODE === 'firebase') {
      await updateDoc(doc(db, NOTIFICATIONS_KEY, id), { czyPrzeczytane: true });
    } else {
      const notifications = await this.getNotificationsFromStorage();
      const index = notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        notifications[index].czyPrzeczytane = true;
        await this.saveNotificationsToStorage(notifications);
      }
    }
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

export const notificationService = new NotificationService();

export class ProjectService {
  async getAll(): Promise<Projekt[]> {
    if (STORAGE_MODE === 'firebase') {
      const querySnapshot = await getDocs(collection(db, PROJECTS_KEY));
      return querySnapshot.docs.map(doc => doc.data() as Projekt);
    } else {
      const data = localStorage.getItem(PROJECTS_KEY);
      return data ? JSON.parse(data) : [];
    }
  }

  private async saveProjectsToStorage(projects: Projekt[]): Promise<void> {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  async getById(id: string): Promise<Projekt | undefined> {
    if (STORAGE_MODE === 'firebase') {
      const docRef = doc(db, PROJECTS_KEY, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Projekt : undefined;
    } else {
      const projects = await this.getAll();
      return projects.find((p) => p.id === id);
    }
  }

  async create(projekt: Omit<Projekt, 'id'>): Promise<Projekt> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newProject: Projekt = { ...projekt, id };

    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, PROJECTS_KEY, id), newProject);
    } else {
      const projects = await this.getAll();
      projects.push(newProject);
      await this.saveProjectsToStorage(projects);
    }

    // Notification Logic: New project for all admins
    const users = await userService.getAll();
    users.filter(u => u.rola === 'admin').forEach(async (admin) => {
      await notificationService.create({
        tytul: 'Nowy Projekt',
        tresc: `Utworzono nowy projekt: ${newProject.nazwa}`,
        priorytet: 'high',
        odbiorcaId: admin.id
      });
    });

    return newProject;
  }

  async update(updatedProject: Projekt): Promise<Projekt> {
    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, PROJECTS_KEY, updatedProject.id), updatedProject);
    } else {
      const projects = await this.getAll();
      const index = projects.findIndex((p) => p.id === updatedProject.id);
      if (index !== -1) {
        projects[index] = updatedProject;
        await this.saveProjectsToStorage(projects);
      }
    }
    return updatedProject;
  }

  async delete(id: string): Promise<void> {
    if (STORAGE_MODE === 'firebase') {
      await deleteDoc(doc(db, PROJECTS_KEY, id));
    } else {
      const projects = await this.getAll();
      const filteredProjects = projects.filter((p) => p.id !== id);
      await this.saveProjectsToStorage(filteredProjects);
    }
    if (getActiveProjectId() === id) {
      setActiveProjectId(null);
    }
  }
}

export const projectService = new ProjectService();

export class StoryService {
  async getAll(): Promise<Historyjka[]> {
    if (STORAGE_MODE === 'firebase') {
      const querySnapshot = await getDocs(collection(db, STORIES_KEY));
      return querySnapshot.docs.map(doc => doc.data() as Historyjka);
    } else {
      const data = localStorage.getItem(STORIES_KEY);
      return data ? JSON.parse(data) : [];
    }
  }

  private async saveStoriesToStorage(stories: Historyjka[]): Promise<void> {
    localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
  }

  async getAllForProject(projectId: string): Promise<Historyjka[]> {
    if (STORAGE_MODE === 'firebase') {
      const q = query(collection(db, STORIES_KEY), where("projektId", "==", projectId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Historyjka);
    } else {
      const all = await this.getAll();
      return all.filter((s) => s.projektId === projectId);
    }
  }

  async getById(id: string): Promise<Historyjka | undefined> {
    if (STORAGE_MODE === 'firebase') {
      const docRef = doc(db, STORIES_KEY, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Historyjka : undefined;
    } else {
      const all = await this.getAll();
      return all.find((s) => s.id === id);
    }
  }

  async create(story: Omit<Historyjka, 'id' | 'dataUtworzenia'>): Promise<Historyjka> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newStory: Historyjka = {
      ...story,
      id,
      dataUtworzenia: new Date().toISOString(),
    };

    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, STORIES_KEY, id), newStory);
    } else {
      const stories = await this.getAll();
      stories.push(newStory);
      await this.saveStoriesToStorage(stories);
    }
    return newStory;
  }

  async update(updatedStory: Historyjka): Promise<Historyjka> {
    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, STORIES_KEY, updatedStory.id), updatedStory);
    } else {
      const stories = await this.getAll();
      const index = stories.findIndex((s) => s.id === updatedStory.id);
      if (index !== -1) {
        stories[index] = updatedStory;
        await this.saveStoriesToStorage(stories);
      }
    }
    return updatedStory;
  }

  async delete(id: string): Promise<void> {
    if (STORAGE_MODE === 'firebase') {
      await deleteDoc(doc(db, STORIES_KEY, id));
    } else {
      const stories = await this.getAll();
      const filteredStories = stories.filter((s) => s.id !== id);
      await this.saveStoriesToStorage(filteredStories);
    }
  }

  async updateState(id: string, newState: 'todo' | 'doing' | 'done'): Promise<void> {
    const story = await this.getById(id);
    if (story) {
      await this.update({ ...story, stan: newState });
    }
  }
}

export const storyService = new StoryService();

export class TaskService {
  async getAll(): Promise<Zadanie[]> {
    if (STORAGE_MODE === 'firebase') {
      const querySnapshot = await getDocs(collection(db, TASKS_KEY));
      return querySnapshot.docs.map(doc => doc.data() as Zadanie);
    } else {
      const data = localStorage.getItem(TASKS_KEY);
      return data ? JSON.parse(data) : [];
    }
  }

  private async saveTasksToStorage(tasks: Zadanie[]): Promise<void> {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  async getAllForStory(storyId: string): Promise<Zadanie[]> {
    if (STORAGE_MODE === 'firebase') {
      const q = query(collection(db, TASKS_KEY), where("historyjkaId", "==", storyId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Zadanie);
    } else {
      const all = await this.getAll();
      return all.filter((t) => t.historyjkaId === storyId);
    }
  }

  async getById(id: string): Promise<Zadanie | undefined> {
    if (STORAGE_MODE === 'firebase') {
      const docRef = doc(db, TASKS_KEY, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Zadanie : undefined;
    } else {
      const all = await this.getAll();
      return all.find((t) => t.id === id);
    }
  }

  async create(task: Omit<Zadanie, 'id' | 'dataDodania'>): Promise<Zadanie> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newTask: Zadanie = {
      ...task,
      id,
      dataDodania: new Date().toISOString(),
    };

    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, TASKS_KEY, id), newTask);
    } else {
      const tasks = await this.getAll();
      tasks.push(newTask);
      await this.saveTasksToStorage(tasks);
    }

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

    if (STORAGE_MODE === 'firebase') {
      await setDoc(doc(db, TASKS_KEY, finalTask.id), finalTask);
    } else {
      const tasks = await this.getAll();
      const index = tasks.findIndex((t) => t.id === finalTask.id);
      if (index !== -1) {
        tasks[index] = finalTask;
        await this.saveTasksToStorage(tasks);
      }
    }
    return finalTask;
  }

  async delete(id: string): Promise<void> {
    const taskToDelete = await this.getById(id);
    if (STORAGE_MODE === 'firebase') {
      await deleteDoc(doc(db, TASKS_KEY, id));
    } else {
      const tasks = await this.getAll();
      const filteredTasks = tasks.filter((t) => t.id !== id);
      await this.saveTasksToStorage(filteredTasks);
    }

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

export const taskService = new TaskService();
