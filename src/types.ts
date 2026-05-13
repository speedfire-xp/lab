export interface Projekt {
  id: string;
  nazwa: string;
  opis: string;
}

export type Rola = 'admin' | 'devops' | 'developer';

export interface Uzytkownik {
  id: string;
  imie: string;
  nazwisko: string;
  rola: Rola;
}

export interface Historyjka {
  id: string;
  nazwa: string;
  opis: string;
  priorytet: 'niski' | 'średni' | 'wysoki';
  projektId: string;
  dataUtworzenia: string;
  stan: 'todo' | 'doing' | 'done';
  wlascicielId: string;
}

export interface Zadanie {
  id: string;
  nazwa: string;
  opis: string;
  priorytet: 'niski' | 'średni' | 'wysoki';
  historyjkaId: string;
  przewidywanyCzas: number;
  stan: 'todo' | 'doing' | 'done';
  dataDodania: string;
  dataStartu?: string;
  dataZakonczenia?: string;
  wlascicielId?: string;
}
